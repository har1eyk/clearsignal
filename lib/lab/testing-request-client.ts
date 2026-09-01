import { z } from "zod";
import { testingRequestCreateSchema } from "./validation";

export type TestingRequestPayload = z.infer<typeof testingRequestCreateSchema>;
export type CreatedTestingRequest = {
  id: string;
  order_number: string;
  sample_count: number;
  unit_price?: number;
  total?: number;
  currency?: "USD";
  status?: "pending_laboratory_review";
};
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class TestingRequestClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: unknown = null,
  ) {
    super(message);
  }
}

export async function createTestingRequest({
  accessToken,
  payload,
  submissionKey,
  fetcher = fetch,
}: {
  accessToken: string;
  payload: unknown;
  submissionKey: string;
  fetcher?: FetchLike;
}): Promise<CreatedTestingRequest> {
  if (submissionKey.trim().length < 8 || submissionKey.trim().length > 160) {
    throw new TestingRequestClientError("Submission key must contain 8 to 160 characters", "invalid_submission_key", {
      field: "submission_key",
    });
  }

  const parsed = testingRequestCreateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TestingRequestClientError("Testing request validation failed", "validation_failed", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  const response = await fetcher("/api/lab/testing-requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": submissionKey.trim(),
    },
    body: JSON.stringify(parsed.data),
  });
  const body = await response.json() as {
    data?: CreatedTestingRequest;
    error?: { code?: string; message?: string; details?: unknown };
  };
  if (!response.ok || !body.data) {
    throw new TestingRequestClientError(
      body.error?.message ?? "The testing request could not be submitted.",
      body.error?.code ?? "request_failed",
      body.error?.details ?? null,
    );
  }
  return body.data;
}
