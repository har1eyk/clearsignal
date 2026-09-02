import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { endotoxinOrderInputSchema } from "../../lib/lab/endotoxin-order";
import { buildNotebookQuote, notebookQuoteSchema } from "../../lib/lab/notebook-quote";
import { generateCapabilityToken, sha256 } from "../../lib/lab/notebook-session";
import { GUIDANCE_CATALOG_VERSION, reviewedGuidance } from "../../lib/lab/service-guidance";

test("notebook capabilities are independent high-entropy values and only hashes are persisted", async () => {
  const readToken = generateCapabilityToken();
  const browserToken = generateCapabilityToken();
  assert.notEqual(readToken, browserToken);
  assert.equal(readToken.length >= 40, true);
  assert.match(await sha256(readToken), /^[0-9a-f]{64}$/);
  const migration = await readFile(new URL("../../supabase/migrations/20260902000000_obsidian_notebook_sessions.sql", import.meta.url), "utf8");
  assert.match(migration, /read_token_sha256/);
  assert.match(migration, /browser_token_sha256/);
  assert.doesNotMatch(migration, /\bread_token\s+text|\bbrowser_token\s+text/);
});

test("public quote uses the one catalog source, server timestamp, expiry, and exact total", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");
  const quote = buildNotebookQuote(["SAMPLE-001", "SAMPLE-002"], now);
  assert.equal(quote.unit_price, 375);
  assert.equal(quote.total, 750);
  assert.equal(quote.catalog_version, "2026-09-01");
  assert.equal(quote.quoted_at, now.toISOString());
  assert.equal(Date.parse(quote.expires_at) - now.getTime(), 600_000);
});

test("quote and order inputs reject duplicate sample IDs without regard to case", () => {
  assert.equal(notebookQuoteSchema.safeParse({ sample_ids: ["A", "a"] }).success, false);
  assert.equal(endotoxinOrderInputSchema.safeParse({ sample_ids: ["A", "a"] }).success, false);
});

test("the strict spend limit is optional for an order", () => {
  assert.deepEqual(endotoxinOrderInputSchema.parse({ sample_ids: ["A"] }), { sample_ids: ["A"], currency: "USD" });
});

test("guidance never invents operational instructions before scientific review", () => {
  const response = reviewedGuidance("How should I prepare and ship a serum sample?", "serum");
  assert.equal(response.status, "needs_human_review");
  assert.equal(response.answer, null);
  assert.equal(response.catalog_version, GUIDANCE_CATALOG_VERSION);
  assert.match(response.limitations[0], /No scientist-reviewed/);
});

test("integration page exposes top-level site tools and no iframe", async () => {
  const component = await readFile(new URL("../../app/integrations/obsidian/ObsidianNotebookWebMCP.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/integrations/obsidian/page.tsx", import.meta.url), "utf8");
  assert.match(component, /quote_endotoxin_tests/);
  assert.match(component, /get_endotoxin_service_guidance/);
  assert.match(await readFile(new URL("../../app/ClearSignalWebMCP.tsx", import.meta.url), "utf8"), /order_endotoxin_tests/);
  assert.doesNotMatch(page, /<iframe/i);
  assert.match(component, /history\.replaceState/);
});
