import assert from "node:assert/strict";
import test from "node:test";
import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "../../lib/lab/endotoxin-order";
import { endotoxinFaqs, getEndotoxinFaqResponse } from "../../lib/marketing-faq";

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

test("returns the public FAQ catalog without internal search aliases", () => {
  const response = getEndotoxinFaqResponse();

  assert.equal(response.status, "catalog");
  assert.equal(response.count, 12);
  assert.deepEqual(
    response.faqs,
    endotoxinFaqs.map(({ question, answer }) => ({ question, answer })),
  );
  assert.equal("aliases" in response.faqs[0], false);
});

test("matches every canonical FAQ question to its own published answer", () => {
  for (const faq of endotoxinFaqs) {
    const response = getEndotoxinFaqResponse(faq.question);
    assert.deepEqual(response, {
      status: "matched",
      query: faq.question,
      question: faq.question,
      answer: faq.answer,
    });
  }
});

test("matches common customer paraphrases deterministically", () => {
  const cases = [
    ["Why do researchers test for endotoxin contamination?", "What is endotoxin, and why is it tested?"],
    ["Which materials and matrices can you test?", "What types of samples can be tested?"],
    ["Do you use recombinant Factor C?", "Which endotoxin testing method is used?"],
    ["What is the price per sample?", "How much does Endotoxin cost?"],
    ["What sample volume is required?", "How much sample do I need to provide?"],
    ["How should I label and package samples?", "How should samples be labeled and prepared?"],
    ["How do you handle inhibition or enhancement?", "How is sample interference handled?"],
    ["What sample information is needed?", "What information should accompany my testing request?"],
    ["How quickly will I receive results?", "How long does endotoxin testing take?"],
    ["Does the report include EU/mL?", "What information is included with the result?"],
    ["What is the shipping address?", "Where do I send my samples?"],
    ["Can you test aqueous plasmids?", "Are plasmid samples okay to send?"],
    ["Can ClearSignal process my plasmid samples?", "Are plasmid samples okay to send?"],
  ] as const;

  for (const [query, expectedQuestion] of cases) {
    const response = getEndotoxinFaqResponse(query);
    assert.equal(response.status, "matched", query);
    assert.equal(response.question, expectedQuestion, query);
    assert.equal(response.answer, endotoxinFaqs.find(({ question }) => question === expectedQuestion)?.answer, query);
  }
});

test("does not guess an answer for an unrelated question", () => {
  const query = "Do you offer genomic sequencing?";
  const response = getEndotoxinFaqResponse(query);

  assert.deepEqual(response, {
    status: "no_match",
    query,
    answer: null,
    message: "ClearSignal has no published FAQ answer for this question.",
    available_questions: endotoxinFaqs.map(({ question }) => question),
  });
});
