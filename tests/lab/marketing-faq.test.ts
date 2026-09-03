import assert from "node:assert/strict";
import test from "node:test";
import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "../../lib/lab/endotoxin-order";
import { endotoxinFaqs } from "../../lib/marketing-faq";

test("the marketing FAQ uses the current catalog price", () => {
  const priceFaq = endotoxinFaqs.find((faq) => faq.question === "How much does Endotoxin cost?");
  const formattedPrice = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: STANDARD_ENDOTOXIN_TEST.currency,
  }).format(centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents));

  assert.equal(
    priceFaq?.answer,
    `The standard endotoxin test costs ${formattedPrice} ${STANDARD_ENDOTOXIN_TEST.currency} per sample.`,
  );
});
