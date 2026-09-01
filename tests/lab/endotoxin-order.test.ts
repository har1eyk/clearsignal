import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  STANDARD_ENDOTOXIN_TEST,
  dollarsToCents,
  endotoxinOrderInputSchema,
  orderFingerprint,
} from "../../lib/lab/endotoxin-order";

test("parses the one-prompt order contract without extra metadata", () => {
  const parsed = endotoxinOrderInputSchema.parse({
    sample_ids: ["ID0001", "ID0002"],
    spend_less_than_each: 400,
  });
  assert.deepEqual(parsed.sample_ids, ["ID0001", "ID0002"]);
  assert.equal(parsed.currency, "USD");
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(parsed.spend_less_than_each), true);
});

test("treats the spending bound as strict", () => {
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(350), false);
  assert.equal(STANDARD_ENDOTOXIN_TEST.unitPriceCents < dollarsToCents(350.01), true);
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

test("exposes one narrow ordering tool and retires the old multi-tool flow", async () => {
  const source = await readFile(new URL("../../app/user/requests/new/TestingRequestWebMCP.tsx", import.meta.url), "utf8");
  assert.match(source, /name: "order_endotoxin_tests"/);
  assert.match(source, /sample_ids/);
  assert.match(source, /spend_less_than_each/);
  assert.doesNotMatch(source, /get_testing_request_requirements|prepare_testing_request|submit_testing_request/);
});
