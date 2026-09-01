import type {
  CalculationSample,
  CanonicalEndpointRow,
  CurveParameters,
  MethodConfiguration,
  RfcCalculation,
} from "./types";

const round = (value: number, digits = 8) => Number(value.toFixed(digits));

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cvPct(values: number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  if (average === 0) return null;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance) / Math.abs(average) * 100;
}

function fitCurve(
  points: Array<{ concentration: number; response: number }>,
  model: MethodConfiguration["curveModel"],
): { slope: number; intercept: number; r2: number } | null {
  const transformed = points.map(({ concentration, response }) => {
    if (model === "log10-linear") {
      if (concentration <= 0 || response <= 0) return null;
      return { x: Math.log10(concentration), y: Math.log10(response) };
    }
    return { x: concentration, y: response };
  });
  if (transformed.some((point) => point === null)) return null;
  const usable = transformed as Array<{ x: number; y: number }>;
  const xMean = mean(usable.map((point) => point.x));
  const yMean = mean(usable.map((point) => point.y));
  const ssX = usable.reduce((sum, point) => sum + (point.x - xMean) ** 2, 0);
  if (ssX === 0) return null;
  const slope = usable.reduce((sum, point) => sum + (point.x - xMean) * (point.y - yMean), 0) / ssX;
  const intercept = yMean - slope * xMean;
  const ssTotal = usable.reduce((sum, point) => sum + (point.y - yMean) ** 2, 0);
  const ssResidual = usable.reduce((sum, point) => sum + (point.y - (intercept + slope * point.x)) ** 2, 0);
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
  return { slope, intercept, r2 };
}

function invertCurve(response: number, curve: CurveParameters): number | null {
  if (response <= 0 || curve.slope <= 0) return null;
  const x = curve.model === "log10-linear"
    ? (Math.log10(response) - curve.intercept) / curve.slope
    : (response - curve.intercept) / curve.slope;
  const concentration = curve.model === "log10-linear" ? 10 ** x : x;
  return Number.isFinite(concentration) && concentration >= 0 ? concentration : null;
}

export function calculateRfcEndpoint(input: {
  method: MethodConfiguration;
  samples: CalculationSample[];
  rows: CanonicalEndpointRow[];
}): RfcCalculation {
  const { method, samples, rows } = input;
  const issues: string[] = [];
  const blankValues = rows.filter((row) => row.role === "blank").map((row) => row.fluorescenceRfu);
  const blankMean = blankValues.length ? mean(blankValues) : Number.NaN;
  const blankValid = Number.isFinite(blankMean) && blankMean <= method.blankMaxRfu;
  if (!blankValues.length) issues.push("No blank wells were provided");
  else if (!blankValid) issues.push(`Blank mean RFU ${round(blankMean)} exceeds ${method.blankMaxRfu}`);

  const standardGroups = new Map<number, number[]>();
  for (const row of rows.filter((candidate) => candidate.role === "standard")) {
    const concentration = row.standardEuMl!;
    const list = standardGroups.get(concentration) ?? [];
    list.push(row.fluorescenceRfu - blankMean);
    standardGroups.set(concentration, list);
  }
  const standardPoints = [...standardGroups.entries()].sort(([a], [b]) => a - b).map(([concentrationEuMl, values]) => ({
    concentrationEuMl,
    meanCorrectedRfu: mean(values),
    cvPct: cvPct(values),
    replicates: values.length,
  }));
  if (standardPoints.length < 3) issues.push("At least three standard concentrations are required");
  const standardsWithinRange = standardPoints.every((point) =>
    point.concentrationEuMl >= method.standardMinEuMl && point.concentrationEuMl <= method.standardMaxEuMl,
  );
  if (!standardsWithinRange) issues.push("A standard concentration is outside the configured range");
  const standardsCvValid = standardPoints.every((point) => point.cvPct === null || point.cvPct <= method.replicateCvMaxPct);
  if (!standardsCvValid) issues.push("A standard replicate CV exceeds the configured maximum");
  const fit = standardPoints.length >= 3
    ? fitCurve(standardPoints.map((point) => ({ concentration: point.concentrationEuMl, response: point.meanCorrectedRfu })), method.curveModel)
    : null;
  const curveValid = Boolean(fit && fit.slope > 0 && fit.r2 >= method.r2Min);
  if (!fit) issues.push("The standard curve could not be fitted");
  else {
    if (fit.slope <= 0) issues.push("The standard curve slope must be positive");
    if (fit.r2 < method.r2Min) issues.push(`Standard curve R² ${round(fit.r2)} is below ${method.r2Min}`);
  }
  const curveParameters: CurveParameters | null = fit ? {
    model: method.curveModel,
    slope: round(fit.slope),
    intercept: round(fit.intercept),
    r2: round(fit.r2),
    blankMeanRfu: round(blankMean),
    standardPoints: standardPoints.map((point) => ({ ...point, meanCorrectedRfu: round(point.meanCorrectedRfu), cvPct: point.cvPct === null ? null : round(point.cvPct) })),
  } : null;

  let samplesValid = true;
  const results = samples.map((sample) => {
    const sampleRows = rows.filter((row) => row.role === "sample" && row.sampleId === sample.id);
    const ppcRows = rows.filter((row) => row.role === "ppc" && row.sampleId === sample.id);
    const sampleIssues: string[] = [];
    if (!sampleRows.length) sampleIssues.push("No unspiked sample wells");
    if (!ppcRows.length) sampleIssues.push("No PPC wells");
    const dilutions = new Set([...sampleRows, ...ppcRows].map((row) => row.dilutionFactor));
    if (dilutions.size > 1) sampleIssues.push("Sample and PPC wells must use one common dilution");
    const spikeLevels = new Set(ppcRows.map((row) => row.spikeEuMl));
    if (spikeLevels.size > 1) sampleIssues.push("PPC wells must use one common spike concentration");
    const dilutionFactor = dilutions.size === 1 ? [...dilutions][0] : null;
    if (dilutionFactor !== null && dilutionFactor > sample.maximumValidDilution) {
      sampleIssues.push(`Dilution ${dilutionFactor} exceeds MVD ${sample.maximumValidDilution}`);
    }
    const correctedSampleRfu = sampleRows.map((row) => row.fluorescenceRfu - blankMean);
    const correctedPpcRfu = ppcRows.map((row) => row.fluorescenceRfu - blankMean);
    const sampleCv = correctedSampleRfu.length ? cvPct(correctedSampleRfu) : null;
    const ppcCv = correctedPpcRfu.length ? cvPct(correctedPpcRfu) : null;
    if (sampleCv !== null && sampleCv > method.replicateCvMaxPct) sampleIssues.push("Sample replicate CV exceeds the configured maximum");
    if (ppcCv !== null && ppcCv > method.replicateCvMaxPct) sampleIssues.push("PPC replicate CV exceeds the configured maximum");

    const measured = curveParameters && correctedSampleRfu.length ? invertCurve(mean(correctedSampleRfu), curveParameters) : null;
    const ppcMeasured = curveParameters && correctedPpcRfu.length ? invertCurve(mean(correctedPpcRfu), curveParameters) : null;
    const spike = spikeLevels.size === 1 ? [...spikeLevels][0] : null;
    const recovery = measured !== null && ppcMeasured !== null && spike !== null
      ? (ppcMeasured - measured) / spike! * 100
      : null;
    if (recovery === null) sampleIssues.push("PPC recovery could not be calculated");
    else if (recovery < method.ppcRecoveryMinPct || recovery > method.ppcRecoveryMaxPct) {
      sampleIssues.push(`PPC recovery ${round(recovery)}% is outside the configured range`);
    }
    const corrected = measured !== null && dilutionFactor !== null ? measured * dilutionFactor : null;
    const localValid = sampleIssues.length === 0;
    if (!localValid) samplesValid = false;
    const reportable = blankValid && curveValid && standardsWithinRange && standardsCvValid && localValid;
    const qualifier = !reportable || measured === null
      ? "invalid" as const
      : measured < method.standardMinEuMl
        ? "below_lloq" as const
        : measured > method.standardMaxEuMl
          ? "above_uloq" as const
          : "within_range" as const;
    const specificationDecision = !reportable || corrected === null || qualifier === "above_uloq"
      ? "not_reportable" as const
      : corrected <= sample.endotoxinLimitEuMl ? "pass" as const : "fail" as const;
    return {
      sample_id: sample.id,
      measured_eu_ml: measured === null ? null : round(measured),
      corrected_eu_ml: corrected === null ? null : round(corrected),
      qualifier,
      ppc_recovery_pct: recovery === null ? null : round(recovery),
      replicate_cv_pct: sampleCv === null ? null : round(sampleCv),
      specification_decision: specificationDecision,
      validity_details: { valid: reportable, issues: sampleIssues, dilutionFactor },
    };
  });

  const isValid = blankValid && curveValid && standardsWithinRange && standardsCvValid && samplesValid && samples.length > 0;
  if (!samples.length) issues.push("No samples are assigned to the run");
  for (const result of results) {
    if (!result.validity_details.valid) issues.push(`${samples.find((sample) => sample.id === result.sample_id)?.externalId ?? result.sample_id}: ${result.validity_details.issues.join("; ")}`);
  }
  return {
    isValid,
    diagnostics: { issues, blankValid, curveValid, standardsValid: standardsWithinRange && standardsCvValid, samplesValid },
    curveParameters,
    results,
  };
}

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
