import assert from "node:assert/strict";
import test from "node:test";
import { calculateRfcEndpoint } from "../../lib/lab/calculation";
import type { CalculationSample, CanonicalEndpointRow, MethodConfiguration } from "../../lib/lab/types";

const method: MethodConfiguration = {
  curveModel: "log10-linear",
  standardMinEuMl: 0.1,
  standardMaxEuMl: 10,
  r2Min: 0.99,
  replicateCvMaxPct: 25,
  ppcRecoveryMinPct: 50,
  ppcRecoveryMaxPct: 200,
  blankMaxRfu: 20,
};

const sample: CalculationSample = {
  id: "00000000-0000-4000-8000-000000000001",
  externalId: "S-001",
  endotoxinLimitEuMl: 2,
  maximumValidDilution: 4,
};

const row = (overrides: Partial<CanonicalEndpointRow>): CanonicalEndpointRow => ({
  well: "A1",
  role: "blank",
  sampleExternalId: null,
  sampleId: null,
  replicate: 1,
  dilutionFactor: 1,
  standardEuMl: null,
  spikeEuMl: null,
  fluorescenceRfu: 10,
  ...overrides,
});

function validRows(): CanonicalEndpointRow[] {
  return [
    row({ well: "A1", replicate: 1 }), row({ well: "A2", replicate: 2 }),
    row({ well: "B1", role: "standard", replicate: 1, standardEuMl: 0.1, fluorescenceRfu: 110 }),
    row({ well: "B2", role: "standard", replicate: 2, standardEuMl: 0.1, fluorescenceRfu: 110 }),
    row({ well: "C1", role: "standard", replicate: 1, standardEuMl: 1, fluorescenceRfu: 1010 }),
    row({ well: "C2", role: "standard", replicate: 2, standardEuMl: 1, fluorescenceRfu: 1010 }),
    row({ well: "D1", role: "standard", replicate: 1, standardEuMl: 10, fluorescenceRfu: 10010 }),
    row({ well: "D2", role: "standard", replicate: 2, standardEuMl: 10, fluorescenceRfu: 10010 }),
    row({ well: "E1", role: "sample", sampleId: sample.id, sampleExternalId: sample.externalId, replicate: 1, dilutionFactor: 2, fluorescenceRfu: 510 }),
    row({ well: "E2", role: "sample", sampleId: sample.id, sampleExternalId: sample.externalId, replicate: 2, dilutionFactor: 2, fluorescenceRfu: 510 }),
    row({ well: "F1", role: "ppc", sampleId: sample.id, sampleExternalId: sample.externalId, replicate: 1, dilutionFactor: 2, spikeEuMl: 1, fluorescenceRfu: 1510 }),
    row({ well: "F2", role: "ppc", sampleId: sample.id, sampleExternalId: sample.externalId, replicate: 2, dilutionFactor: 2, spikeEuMl: 1, fluorescenceRfu: 1510 }),
  ];
}

test("calculates a valid endpoint rFC result", () => {
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows: validRows() });
  assert.equal(calculation.isValid, true);
  assert.equal(calculation.curveParameters?.r2, 1);
  assert.equal(calculation.results[0].measured_eu_ml, 0.5);
  assert.equal(calculation.results[0].corrected_eu_ml, 1);
  assert.equal(calculation.results[0].ppc_recovery_pct, 100);
  assert.equal(calculation.results[0].specification_decision, "pass");
});

test("fails a high blank and suppresses a passing decision", () => {
  const rows = validRows().map((candidate) => candidate.role === "blank" ? { ...candidate, fluorescenceRfu: 100 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.isValid, false);
  assert.equal(calculation.results[0].qualifier, "invalid");
  assert.equal(calculation.results[0].specification_decision, "not_reportable");
});

test("detects failed standard-curve correlation", () => {
  const rows = validRows().map((candidate) => candidate.role === "standard" && candidate.standardEuMl === 1 ? { ...candidate, fluorescenceRfu: 7010 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.isValid, false);
  assert.equal(calculation.diagnostics.curveValid, false);
});

test("detects replicate variability", () => {
  const rows = validRows();
  rows.find((candidate) => candidate.well === "E2")!.fluorescenceRfu = 1010;
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.isValid, false);
  assert.match(calculation.results[0].validity_details.issues.join(" "), /replicate CV/i);
});

test("rejects dilution above the sample MVD", () => {
  const rows = validRows().map((candidate) => candidate.sampleId === sample.id ? { ...candidate, dilutionFactor: 5 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.isValid, false);
  assert.match(calculation.results[0].validity_details.issues.join(" "), /exceeds MVD/);
});

test("detects failed PPC recovery", () => {
  const rows = validRows().map((candidate) => candidate.role === "ppc" ? { ...candidate, fluorescenceRfu: 3510 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.isValid, false);
  assert.equal(calculation.results[0].ppc_recovery_pct, 300);
});

test("marks above-range measurements as not reportable", () => {
  const rows = validRows().map((candidate) => candidate.role === "sample" ? { ...candidate, fluorescenceRfu: 20010 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.results[0].specification_decision, "not_reportable");
});

test("qualifies below-range measurements while retaining the specification comparison", () => {
  const rows = validRows().map((candidate) => candidate.role === "sample" ? { ...candidate, fluorescenceRfu: 60 } : candidate);
  const calculation = calculateRfcEndpoint({ method, samples: [sample], rows });
  assert.equal(calculation.results[0].qualifier, "below_lloq");
  assert.equal(calculation.results[0].specification_decision, "pass");
});
