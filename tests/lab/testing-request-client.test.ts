import assert from "node:assert/strict";
import test from "node:test";
import { createTestingRequest, TestingRequestClientError, type FetchLike } from "../../lib/lab/testing-request-client";

const payload = {
  lab_id: "20000000-0000-4000-8000-000000000001",
  client_name: "Acme Biologics",
  project_name: "Release testing",
  purpose: "Confirm the sample is suitable for release.",
  samples: [{ external_id: "DS-AGENT-001", kind: "original" as const, matrix: "Protein solution", quantity: 2, quantity_unit: "mL" }],
};

test("submits human and agent requests through the shared authenticated contract", async () => {
  let received: { url?: string; init?: RequestInit } = {};
  const fetcher: FetchLike = async (url, init) => {
    received = { url: String(url), init };
    return Response.json({ data: { id: "request-id", order_number: "TR-20260901-1234ABCD", sample_count: 1 }, error: null });
  };
  const created = await createTestingRequest({ accessToken: "session-token", payload, submissionKey: "agent-request-0001", fetcher });
  assert.equal(created.order_number, "TR-20260901-1234ABCD");
  assert.equal(received.url, "/api/lab/testing-requests");
  assert.equal((received.init?.headers as Record<string, string>)["Idempotency-Key"], "agent-request-0001");
  assert.equal((received.init?.headers as Record<string, string>).Authorization, "Bearer session-token");
  assert.deepEqual(JSON.parse(String(received.init?.body)), payload);
});

test("reuses the supplied submission key for idempotent retries", async () => {
  const keys: string[] = [];
  const fetcher: FetchLike = async (_url, init) => {
    keys.push((init?.headers as Record<string, string>)["Idempotency-Key"]);
    return Response.json({ data: { id: "same-request", order_number: "TR-20260901-RETRY001", sample_count: 1 }, error: null });
  };
  await createTestingRequest({ accessToken: "token", payload, submissionKey: "stable-retry-key", fetcher });
  await createTestingRequest({ accessToken: "token", payload, submissionKey: "stable-retry-key", fetcher });
  assert.deepEqual(keys, ["stable-retry-key", "stable-retry-key"]);
});

test("returns structured validation errors before making a request", async () => {
  let called = false;
  const fetcher: FetchLike = async () => {
    called = true;
    return new Response();
  };
  await assert.rejects(
    createTestingRequest({ accessToken: "token", payload: { ...payload, samples: [] }, submissionKey: "validation-key", fetcher }),
    (error: unknown) => error instanceof TestingRequestClientError && error.code === "validation_failed" && Array.isArray((error.details as { issues?: unknown[] }).issues),
  );
  assert.equal(called, false);
});

test("preserves authenticated API failures and sample conflicts", async () => {
  const unauthenticated: FetchLike = async () => Response.json({ data: null, error: { code: "unauthenticated", message: "Session expired" } }, { status: 401 });
  const conflict: FetchLike = async () => Response.json({ data: null, error: { code: "sample_id_conflict", message: "Sample already exists", details: { field: "samples.external_id" } } }, { status: 409 });
  await assert.rejects(
    createTestingRequest({ accessToken: "expired", payload, submissionKey: "auth-failure-key", fetcher: unauthenticated }),
    (error: unknown) => error instanceof TestingRequestClientError && error.code === "unauthenticated",
  );
  await assert.rejects(
    createTestingRequest({ accessToken: "token", payload, submissionKey: "conflict-key", fetcher: conflict }),
    (error: unknown) => error instanceof TestingRequestClientError && error.code === "sample_id_conflict" && (error.details as { field?: string }).field === "samples.external_id",
  );
});

test("rejects unstable submission keys", async () => {
  await assert.rejects(
    createTestingRequest({ accessToken: "token", payload, submissionKey: "short" }),
    (error: unknown) => error instanceof TestingRequestClientError && error.code === "invalid_submission_key",
  );
});
