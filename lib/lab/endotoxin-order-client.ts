import type {
  CreatedEndotoxinOrder,
  EndotoxinOrderInput,
  EndotoxinOrderPreview,
  TestingRequestQuoteInput,
} from "./endotoxin-order";
import { TestingRequestClientError, type FetchLike } from "./testing-request-client";

async function apiCall<T>({
  url,
  accessToken,
  body,
  signal,
  fetcher = fetch,
}: {
  url: string;
  accessToken: string;
  body: unknown;
  signal?: AbortSignal;
  fetcher?: FetchLike;
}): Promise<T> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal,
  });
  const result = await response.json() as { data?: T; error?: { code?: string; message?: string; details?: unknown } };
  if (!response.ok || !result.data) {
    throw new TestingRequestClientError(
      result.error?.message ?? "The endotoxin order could not be completed.",
      result.error?.code ?? "request_failed",
      result.error?.details ?? null,
    );
  }
  return result.data;
}

export function previewTestingRequestOrder({
  accessToken,
  input,
  signal,
  fetcher,
}: {
  accessToken: string;
  input: TestingRequestQuoteInput;
  signal?: AbortSignal;
  fetcher?: FetchLike;
}) {
  return apiCall<EndotoxinOrderPreview>({ url: "/api/lab/endotoxin-orders/preview", accessToken, body: input, signal, fetcher });
}

export function previewEndotoxinOrder({
  accessToken,
  labId,
  input,
  signal,
  fetcher,
}: {
  accessToken: string;
  labId: string;
  input: EndotoxinOrderInput;
  signal?: AbortSignal;
  fetcher?: FetchLike;
}) {
  const date = new Date().toISOString().slice(0, 10);
  return previewTestingRequestOrder({
    accessToken,
    input: {
      details: {
        lab_id: labId,
        client_name: null,
        project_name: `Endotoxin testing — ${date}`,
        purpose: "Quantify endotoxin in submitted samples.",
        samples: input.sample_ids.map((externalId) => ({ external_id: externalId, kind: "original" as const, matrix: null })),
      },
      spend_less_than_each: input.spend_less_than_each,
      currency: input.currency,
    },
    signal,
    fetcher,
  });
}

export function confirmEndotoxinOrder({
  accessToken,
  intent,
  signal,
  fetcher,
}: {
  accessToken: string;
  intent: string;
  signal?: AbortSignal;
  fetcher?: FetchLike;
}) {
  return apiCall<CreatedEndotoxinOrder>({ url: "/api/lab/endotoxin-orders/confirm", accessToken, body: { intent }, signal, fetcher });
}
