import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { TEST_ORDER_STATUSES } from "../../lib/lab/types";
import { testOrderStatusChangeSchema } from "../../lib/lab/validation";

test("accepts every supported order status and requires a reason", () => {
  for (const status of TEST_ORDER_STATUSES) {
    assert.deepEqual(testOrderStatusChangeSchema.parse({ status, reason: "Workflow update" }), {
      status,
      reason: "Workflow update",
    });
  }
  assert.equal(testOrderStatusChangeSchema.safeParse({ status: "cancelled", reason: "No" }).success, false);
  assert.equal(testOrderStatusChangeSchema.safeParse({ status: "in_testing", reason: "   " }).success, false);
});

test("status API authorizes operational roles and delegates to the status RPC", async () => {
  const source = await readFile(new URL("../../app/api/lab/endotoxin-orders/[id]/status/route.ts", import.meta.url), "utf8");
  assert.match(source, /requireRole\(context, \["admin", "analyst", "reviewer"\]\)/);
  assert.match(source, /set_test_order_status/);
  assert.match(source, /p_reason: input\.reason/);
  assert.match(source, /new ApiError\(404, "Test order not found", "not_found"\)/);
});

test("ordered migrations separate enum creation from status-event trigger use", async () => {
  const enums = await readFile(new URL("../../supabase/migrations/20260903000000_order_status_enums.sql", import.meta.url), "utf8");
  const behavior = await readFile(new URL("../../supabase/migrations/20260903010000_order_status_notebook_events.sql", import.meta.url), "utf8");
  assert.match(enums, /create type public\.test_order_status/);
  assert.match(enums, /alter type public\.obsidian_event_kind add value if not exists 'order_status'/);
  assert.match(behavior, /create table public\.obsidian_notebook_order_links/);
  assert.match(behavior, /create trigger append_obsidian_order_status_events/);
  assert.match(behavior, /create or replace function public\.set_test_order_status/);
});
