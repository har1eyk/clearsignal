import assert from "node:assert/strict";
import test from "node:test";
import { testingRequestCreateSchema } from "../../lib/lab/validation";

const validRequest = {
  lab_id: "20000000-0000-4000-8000-000000000001",
  client_name: "Acme Biologics",
  project_name: "Release testing",
  purpose: "Confirm the sample is suitable for release.",
  samples: [{
    external_id: "DS-001",
    kind: "original" as const,
    matrix: "Protein solution",
    quantity: 2,
    quantity_unit: "mL",
  }],
};

test("accepts a testing request with structured sample details", () => {
  const result = testingRequestCreateSchema.safeParse(validRequest);
  assert.equal(result.success, true);
});

test("allows matrix to remain pending during request intake", () => {
  const result = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [{ ...validRequest.samples[0], matrix: null }],
  });
  assert.equal(result.success, true);
});

test("requires request context and at least one sample", () => {
  const result = testingRequestCreateSchema.safeParse({ ...validRequest, project_name: "", purpose: "", samples: [] });
  assert.equal(result.success, false);
  if (!result.success) {
    assert.deepEqual(new Set(result.error.issues.map((issue) => issue.path[0])), new Set(["project_name", "purpose", "samples"]));
  }
});

test("rejects duplicate sample IDs without regard to case", () => {
  const result = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [validRequest.samples[0], { ...validRequest.samples[0], external_id: "ds-001" }],
  });
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error.issues[0].message, /unique/i);
});

test("requires quantity and unit together", () => {
  const missingUnit = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [{ ...validRequest.samples[0], quantity_unit: null }],
  });
  const missingQuantity = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [{ ...validRequest.samples[0], quantity: null, quantity_unit: "mL" }],
  });
  assert.equal(missingUnit.success, false);
  assert.equal(missingQuantity.success, false);
});

test("validates collection timestamps and field lengths", () => {
  const invalidDate = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [{ ...validRequest.samples[0], collected_at: "September 1" }],
  });
  const longId = testingRequestCreateSchema.safeParse({
    ...validRequest,
    samples: [{ ...validRequest.samples[0], external_id: "S".repeat(121) }],
  });
  assert.equal(invalidDate.success, false);
  assert.equal(longId.success, false);
});
