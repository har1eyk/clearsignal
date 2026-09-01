import assert from "node:assert/strict";
import test from "node:test";
import { parseEndpointCsv } from "../../lib/lab/csv";

const sampleMap = new Map([["S-001", "00000000-0000-4000-8000-000000000001"]]);
const header = "well,role,sample_external_id,replicate,dilution_factor,standard_eu_ml,spike_eu_ml,fluorescence_rfu";
const valid = [
  header,
  "A1,blank,,1,1,,,10",
  "A2,standard,,1,1,0.1,,110",
  "A3,standard,,1,1,1,,1010",
  "A4,standard,,1,1,10,,10010",
  "B1,sample,S-001,1,2,,,510",
  "B2,ppc,S-001,1,2,,1,1510",
].join("\n");

test("parses the canonical endpoint CSV", () => {
  const rows = parseEndpointCsv(valid, 96, sampleMap);
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1)?.sampleId, sampleMap.get("S-001"));
});

test("requires exact headers", () => {
  assert.throws(() => parseEndpointCsv(valid.replace("fluorescence_rfu", "rfu"), 96, sampleMap), /headers must be exactly/);
});

test("rejects duplicate wells", () => {
  assert.throws(() => parseEndpointCsv(`${valid}\nA1,blank,,2,1,,,10`, 96, sampleMap), /Duplicate well/);
});

test("rejects unknown samples", () => {
  assert.throws(() => parseEndpointCsv(valid.replaceAll("S-001", "MISSING"), 96, sampleMap), /Unknown sample_external_id/);
});

test("validates the selected plate format", () => {
  assert.throws(() => parseEndpointCsv(valid.replace("A1,blank", "P24,blank"), 96, sampleMap), /outside a 96-well plate/);
  assert.doesNotThrow(() => parseEndpointCsv(valid.replace("A1,blank", "P24,blank"), 384, sampleMap));
});

test("requires standards and samples", () => {
  assert.throws(() => parseEndpointCsv([header, "A1,blank,,1,1,,,10", "A2,sample,S-001,1,1,,,50"].join("\n"), 96, sampleMap), /three distinct standard/);
});

