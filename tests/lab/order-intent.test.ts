import assert from "node:assert/strict";
import test from "node:test";
import { STANDARD_ENDOTOXIN_TEST, type PricedOrderIntent } from "../../lib/lab/endotoxin-order";
import { signOrderIntent, verifyOrderIntent } from "../../lib/lab/order-intent";

process.env.ORDER_INTENT_SIGNING_SECRET = "test-only-signing-secret-with-at-least-32-characters";

const intent: PricedOrderIntent = {
  version: 2,
  quote_id: "10000000-0000-4000-8000-000000000001",
  draft_id: "10000000-0000-4000-8000-000000000002",
  idempotency_key: "testing-request-10000000-0000-4000-8000-000000000001",
  user_id: "20000000-0000-4000-8000-000000000001",
  lab_id: "30000000-0000-4000-8000-000000000001",
  sample_ids: ["ID0001", "ID0002"],
  catalog_item: STANDARD_ENDOTOXIN_TEST.code,
  catalog_version: STANDARD_ENDOTOXIN_TEST.version,
  unit_price_cents: STANDARD_ENDOTOXIN_TEST.unitPriceCents,
  total_price_cents: STANDARD_ENDOTOXIN_TEST.unitPriceCents * 2,
  spend_less_than_each_cents: 40_000,
  currency: "USD",
  issued_at: "2026-09-01T16:00:00.000Z",
  expires_at: "2026-09-01T16:10:00.000Z",
};

test("signs and verifies an exact priced order intent", async () => {
  const token = await signOrderIntent(intent);
  assert.deepEqual(await verifyOrderIntent(token), intent);
});

test("rejects a tampered priced order intent", async () => {
  const token = await signOrderIntent(intent);
  const [payload, signature] = token.split(".");
  const replacement = payload.endsWith("A") ? "B" : "A";
  const tampered = `${payload.slice(0, -1)}${replacement}.${signature}`;
  await assert.rejects(verifyOrderIntent(tampered), (error: unknown) => (
    error instanceof Error && /signature|payload/i.test(error.message)
  ));
});
