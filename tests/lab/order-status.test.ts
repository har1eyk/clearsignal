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

test("completion uses an ordered closing handshake for notebook sessions", async () => {
  const enumMigration = await readFile(new URL("../../supabase/migrations/20260903020000_obsidian_session_closing_enum.sql", import.meta.url), "utf8");
  const behavior = await readFile(new URL("../../supabase/migrations/20260903030000_complete_closes_notebook_sessions.sql", import.meta.url), "utf8");
  const resultsEnum = await readFile(new URL("../../supabase/migrations/20260903060000_obsidian_results_event_enum.sql", import.meta.url), "utf8");
  const resultsBehavior = await readFile(new URL("../../supabase/migrations/20260903070000_demo_results_notebook_events.sql", import.meta.url), "utf8");
  assert.match(enumMigration, /add value if not exists 'closing'/);
  assert.match(behavior, /new\.status = 'complete'/);
  assert.match(behavior, /set status = 'closing'/);
  assert.match(behavior, /v_session\.status = 'closed'/);
  assert.match(resultsEnum, /add value if not exists 'results'/);
  assert.match(resultsBehavior, /'sample_results', v_sample_results/);
  assert.match(resultsBehavior, /'negative_cutoff_eu_ml', 0\.05/);
  assert.match(resultsBehavior, /v_sequence \+ 1, 'results'/);
  assert.ok(resultsBehavior.indexOf("v_sequence + 1, 'results'") < resultsBehavior.indexOf("set status = 'closing'"));
});

test("order progression is database-controlled, private, and always active", async () => {
  const baseMigration = await readFile(new URL("../../supabase/migrations/20260903040000_demo_order_progression.sql", import.meta.url), "utf8");
  const alwaysOnMigration = await readFile(new URL("../../supabase/migrations/20260903050000_always_on_order_progression.sql", import.meta.url), "utf8");
  assert.match(baseMigration, /create table public\.demo_order_progression_config/);
  assert.match(baseMigration, /pending_to_preparing_seconds integer not null default 20/);
  assert.match(baseMigration, /create or replace function public\.advance_demo_test_orders/);
  assert.match(baseMigration, /for update skip locked/);
  assert.match(baseMigration, /'Automated demo progression'/);
  assert.match(baseMigration, /revoke all on public\.demo_order_progression_config from public, anon, authenticated/);
  assert.match(baseMigration, /revoke all on function public\.advance_demo_test_orders\(integer\) from public, anon, authenticated/);
  assert.match(alwaysOnMigration, /alter column enabled set default true/);
  assert.match(alwaysOnMigration, /automatic order progression cannot be disabled/);
  assert.match(alwaysOnMigration, /schedule := '1 second'/);
  assert.match(alwaysOnMigration, /active := true/);
  assert.match(alwaysOnMigration, /o\.order_number = 'TR-20260903-ED1A7B2C'/);
});
