import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STANDARD_ENDOTOXIN_TEST,
  dollarsToCents,
  endotoxinOrderInputSchema,
  orderFingerprint,
} from "../../lib/lab/endotoxin-order";
import {
  createPendingOrder,
  PENDING_ORDER_LIFETIME_MS,
  parsePendingOrder,
} from "../../lib/lab/webmcp-order-state";

test("parses the one-prompt order contract without extra metadata", () => {
  const parsed = endotoxinOrderInputSchema.parse({
    sample_ids: ["ID0001", "ID0002"],
    spend_less_than_each: 400,
  });
  assert.deepEqual(parsed.sample_ids, ["ID0001", "ID0002"]);
  assert.equal(parsed.currency, "USD");
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(parsed.spend_less_than_each!), true);
});

test("treats the spending bound as strict", () => {
  const unitPrice = STANDARD_ENDOTOXIN_TEST.unitPriceCents / 100;
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(unitPrice), false);
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(unitPrice + 0.01), true);
});

test("rejects duplicate sample IDs without regard to case", () => {
  const result = endotoxinOrderInputSchema.safeParse({
    sample_ids: ["ID0001", "id0001"],
    spend_less_than_each: 400,
  });
  assert.equal(result.success, false);
});

test("creates a stable fingerprint for retrying the same instruction", () => {
  const input = endotoxinOrderInputSchema.parse({ sample_ids: [" ID0001 ", "ID0002"], spend_less_than_each: 400 });
  assert.equal(orderFingerprint(input), orderFingerprint({ ...input, sample_ids: ["ID0001", "ID0002"] }));
});

test("registers one state-appropriate ordering tool from the root layout", async () => {
  const coordinator = await readFile(new URL("../../app/ClearSignalWebMCP.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  const requestForm = await readFile(new URL("../../app/user/requests/new/TestingRequestForm.tsx", import.meta.url), "utf8");
  assert.match(coordinator, /name: "order_endotoxin_tests"/);
  assert.match(coordinator, /name: "start_endotoxin_order"/);
  assert.match(coordinator, /access\.status === "active" \?/);
  assert.match(coordinator, /onAuthStateChange/);
  assert.match(coordinator, /data.*webmcpStatus|webmcpStatus/);
  assert.match(layout, /<ClearSignalWebMCP \/>/);
  assert.doesNotMatch(requestForm, /TestingRequestWebMCP|order_endotoxin_tests/);
  assert.doesNotMatch(coordinator, /get_testing_request_requirements|prepare_testing_request|submit_testing_request/);
});

test("preserves a validated public order instruction for thirty minutes", () => {
  const now = Date.parse("2026-09-02T12:00:00.000Z");
  const input = endotoxinOrderInputSchema.parse({ sample_ids: ["SAMPLE-001", "SAMPLE-002"], spend_less_than_each: 400 });
  const pending = createPendingOrder(input, now);
  assert.equal(Date.parse(pending.expires_at) - Date.parse(pending.created_at), PENDING_ORDER_LIFETIME_MS);
  assert.deepEqual(parsePendingOrder(JSON.stringify(pending), now + PENDING_ORDER_LIFETIME_MS - 1)?.input, input);
  assert.equal(parsePendingOrder(JSON.stringify(pending), now + PENDING_ORDER_LIFETIME_MS), null);
  assert.equal(parsePendingOrder("not-json", now), null);
});

test("the human review multiplies the shared unit price by the sample count", async () => {
  const source = await readFile(new URL("../../app/user/requests/new/TestingRequestForm.tsx", import.meta.url), "utf8");
  assert.match(source, /STANDARD_ENDOTOXIN_TEST\.unitPriceCents \* samples\.length/);
  assert.match(source, /Review priced order/);
  assert.doesNotMatch(source, /createTestingRequest/);
});

test("the atomic database guard matches the current catalog price source", async () => {
  const migration = await readFile(new URL("../../supabase/migrations/20260901040000_priced_testing_request_drafts.sql", import.meta.url), "utf8");
  assert.match(migration, new RegExp(`p_unit_price_cents <> ${STANDARD_ENDOTOXIN_TEST.unitPriceCents}`));
});
