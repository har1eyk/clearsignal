import { z } from "zod";
import { WELL_ROLES, type CanonicalEndpointRow, type WellRole } from "./types";

const HEADERS = [
  "well",
  "role",
  "sample_external_id",
  "replicate",
  "dilution_factor",
  "standard_eu_ml",
  "spike_eu_ml",
  "fluorescence_rfu",
] as const;

const numberCell = (label: string, options?: { positive?: boolean; integer?: boolean }) =>
  z.string().trim().refine((value) => value !== "" && Number.isFinite(Number(value)), `${label} must be numeric`)
    .transform(Number)
    .refine((value) => !options?.positive || value > 0, `${label} must be greater than zero`)
    .refine((value) => !options?.integer || Number.isInteger(value), `${label} must be an integer`);

function parseCsvRecords(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function optionalNumber(value: string, label: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be greater than zero`);
  return parsed;
}

function assertWell(well: string, plateFormat: 96 | 384): void {
  const match = /^([A-Z])(\d{1,2})$/.exec(well);
  if (!match) throw new Error(`Invalid well position: ${well}`);
  const row = match[1].charCodeAt(0) - 64;
  const column = Number(match[2]);
  const maxRow = plateFormat === 96 ? 8 : 16;
  const maxColumn = plateFormat === 96 ? 12 : 24;
  if (row < 1 || row > maxRow || column < 1 || column > maxColumn) {
    throw new Error(`Well ${well} is outside a ${plateFormat}-well plate`);
  }
}

export function parseEndpointCsv(
  csv: string,
  plateFormat: 96 | 384,
  sampleIdsByExternalId: ReadonlyMap<string, string>,
): CanonicalEndpointRow[] {
  const records = parseCsvRecords(csv.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("CSV must include a header and at least one data row");
  const header = records[0].map((value) => value.trim().toLowerCase());
  if (header.length !== HEADERS.length || header.some((value, index) => value !== HEADERS[index])) {
    throw new Error(`CSV headers must be exactly: ${HEADERS.join(",")}`);
  }

  const rows: CanonicalEndpointRow[] = [];
  const wells = new Set<string>();
  const replicateKeys = new Set<string>();
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index];
    if (record.length !== HEADERS.length) throw new Error(`Row ${index + 1} has ${record.length} columns; expected ${HEADERS.length}`);
    const well = record[0].trim().toUpperCase();
    assertWell(well, plateFormat);
    if (wells.has(well)) throw new Error(`Duplicate well: ${well}`);
    wells.add(well);

    const role = record[1].trim().toLowerCase() as WellRole;
    if (!WELL_ROLES.includes(role)) throw new Error(`Row ${index + 1} has an invalid role`);
    const sampleExternalId = record[2].trim() || null;
    const sampleId = sampleExternalId ? sampleIdsByExternalId.get(sampleExternalId) ?? null : null;
    if (sampleExternalId && !sampleId) throw new Error(`Unknown sample_external_id: ${sampleExternalId}`);
    const replicate = numberCell("replicate", { positive: true, integer: true }).parse(record[3]);
    const dilutionFactor = numberCell("dilution_factor", { positive: true }).parse(record[4]);
    const standardEuMl = optionalNumber(record[5], "standard_eu_ml");
    const spikeEuMl = optionalNumber(record[6], "spike_eu_ml");
    const fluorescenceRfu = numberCell("fluorescence_rfu").refine((value) => value >= 0, "fluorescence_rfu cannot be negative").parse(record[7]);

    if (role === "blank" && (sampleExternalId || standardEuMl || spikeEuMl)) throw new Error(`Blank ${well} contains role-incompatible values`);
    if (role === "standard" && (!standardEuMl || sampleExternalId || spikeEuMl)) throw new Error(`Standard ${well} must contain only standard_eu_ml`);
    if (role === "sample" && (!sampleId || standardEuMl || spikeEuMl)) throw new Error(`Sample ${well} must contain only sample_external_id`);
    if (role === "ppc" && (!sampleId || standardEuMl || !spikeEuMl)) throw new Error(`PPC ${well} requires sample_external_id and spike_eu_ml`);

    const replicateKey = [role, sampleId ?? "", standardEuMl ?? "", spikeEuMl ?? "", dilutionFactor, replicate].join("|");
    if (replicateKeys.has(replicateKey)) throw new Error(`Duplicate replicate assignment at ${well}`);
    replicateKeys.add(replicateKey);
    rows.push({ well, role, sampleExternalId, sampleId, replicate, dilutionFactor, standardEuMl, spikeEuMl, fluorescenceRfu });
  }

  if (!rows.some((row) => row.role === "blank")) throw new Error("At least one blank is required");
  if (new Set(rows.filter((row) => row.role === "standard").map((row) => row.standardEuMl)).size < 3) {
    throw new Error("At least three distinct standard concentrations are required");
  }
  if (!rows.some((row) => row.role === "sample")) throw new Error("At least one sample well is required");
  return rows;
}

export const ENDPOINT_CSV_HEADERS = HEADERS;

