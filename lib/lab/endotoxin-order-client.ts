import type { CreatedEndotoxinOrder, EndotoxinOrderInput, EndotoxinOrderPreview } from "./endotoxin-order";
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

export function previewEndotoxinOrder({
  accessToken,
  input,
  signal,
  fetcher,
}: {
  accessToken: string;
  input: EndotoxinOrderInput;
  signal?: AbortSignal;
  fetcher?: FetchLike;
}) {
  return apiCall<EndotoxinOrderPreview>({ url: "/api/lab/endotoxin-orders/preview", accessToken, body: input, signal, fetcher });
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
