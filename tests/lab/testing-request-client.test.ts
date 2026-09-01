import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("retires the direct unpriced order-creation endpoint", async () => {
  const source = await readFile(new URL("../../app/api/lab/testing-requests/route.ts", import.meta.url), "utf8");
  assert.match(source, /priced_confirmation_required/);
  assert.doesNotMatch(source, /create_testing_request"/);
});

test("the database requires an unpriced draft before atomic order creation", async () => {
  const migration = await readFile(new URL("../../supabase/migrations/20260901040000_priced_testing_request_drafts.sql", import.meta.url), "utf8");
  assert.match(migration, /create table public\.testing_request_drafts/);
  assert.match(migration, /status text not null default 'unpriced'/);
  assert.match(migration, /create or replace function public\.confirm_testing_request_draft/);
  assert.match(migration, /for update/);
  assert.match(migration, /p_total_price_cents <> p_unit_price_cents \* v_sample_count/);
  assert.match(migration, /revoke execute on function public\.create_testing_request/);
});
