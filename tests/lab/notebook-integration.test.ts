import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { endotoxinOrderInputSchema } from "../../lib/lab/endotoxin-order";
import { buildNotebookQuote, notebookQuoteSchema } from "../../lib/lab/notebook-quote";
import { generateCapabilityToken, sha256 } from "../../lib/lab/notebook-session";

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

test("integration page exposes top-level site tools and no iframe", async () => {
  const component = await readFile(new URL("../../app/integrations/obsidian/ObsidianNotebookWebMCP.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../../app/integrations/obsidian/page.tsx", import.meta.url), "utf8");
  const coordinator = await readFile(new URL("../../app/ClearSignalWebMCP.tsx", import.meta.url), "utf8");
  const faqRoute = await readFile(new URL("../../app/api/integrations/obsidian/sessions/[id]/faq/route.ts", import.meta.url), "utf8");
  assert.match(component, /quote_endotoxin_tests/);
  assert.doesNotMatch(component, /get_endotoxin_service_guidance/);
  assert.match(coordinator, /get_endotoxin_faqs/);
  assert.match(coordinator, /getNotebookAwareFaqResponse/);
  assert.match(faqRoute, /response\.status !== "matched"/);
  assert.match(faqRoute, /kind: "guidance"/);
  assert.match(faqRoute, /source_type: "published_faq"/);
  assert.match(component, /Finishing notebook session/);
  assert.match(component, /closeBrowserNotebookSession\(sessionId\)/);
  assert.match(component, /isBrowserNotebookSessionClosed\(sessionId\) \? "closed" : "invalid"/);
  assert.match(component, /status !== "ready"/);
  assert.match(coordinator, /order_endotoxin_tests/);
  assert.match(coordinator, /status: CUSTOMER_ORDER_STATUS/);
  assert.match(coordinator, /Order submitted/);
  assert.match(await readFile(new URL("../../app/user/requests/new/TestingRequestForm.tsx", import.meta.url), "utf8"), /Order submitted/);
  assert.doesNotMatch(page, /<iframe/i);
  assert.match(component, /history\.replaceState/);
});
