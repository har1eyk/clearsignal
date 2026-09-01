import assert from "node:assert/strict";
import test from "node:test";
import { confirmEndotoxinOrder, previewEndotoxinOrder } from "../../lib/lab/endotoxin-order-client";
import { TestingRequestClientError, type FetchLike } from "../../lib/lab/testing-request-client";

test("previews and confirms through the two server operations hidden behind one tool", async () => {
  const calls: string[] = [];
  const fetcher: FetchLike = async (url) => {
    calls.push(String(url));
    if (String(url).endsWith("/preview")) {
      return Response.json({ data: {
        intent: "signed.intent",
        quote_id: "quote-id",
        laboratory: "ClearSignal",
        service: "Standard endotoxin test",
        sample_ids: ["ID0001", "ID0002"],
        sample_count: 2,
        unit_price: 350,
        total: 700,
        currency: "USD",
        spend_less_than_each: 400,
        expires_at: "2026-09-01T17:00:00.000Z",
      }, error: null });
    }
    return Response.json({ data: {
      id: "order-id",
      order_number: "TR-20260901-ORDER001",
      sample_count: 2,
      unit_price: 350,
      total: 700,
      currency: "USD",
      status: "pending_laboratory_review",
    }, error: null }, { status: 201 });
  };

  const preview = await previewEndotoxinOrder({
    accessToken: "token",
    input: { sample_ids: ["ID0001", "ID0002"], spend_less_than_each: 400, currency: "USD" },
    fetcher,
  });
  const created = await confirmEndotoxinOrder({ accessToken: "token", intent: preview.intent, fetcher });
  assert.deepEqual(calls, ["/api/lab/endotoxin-orders/preview", "/api/lab/endotoxin-orders/confirm"]);
  assert.equal(created.total, 700);
});

test("preserves a server-enforced price-cap failure", async () => {
  const fetcher: FetchLike = async () => Response.json({
    data: null,
    error: { code: "price_cap_exceeded", message: "Strict price limit failed", details: { unit_price: 400 } },
  }, { status: 409 });
  await assert.rejects(
    previewEndotoxinOrder({ accessToken: "token", input: { sample_ids: ["ID0001"], spend_less_than_each: 400, currency: "USD" }, fetcher }),
    (error: unknown) => error instanceof TestingRequestClientError && error.code === "price_cap_exceeded",
  );
});
