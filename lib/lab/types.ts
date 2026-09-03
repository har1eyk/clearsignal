export const LAB_ROLES = ["admin", "analyst", "reviewer", "viewer"] as const;
export type LabRole = (typeof LAB_ROLES)[number];

export const TEST_ORDER_STATUSES = [
  "pending_laboratory_review",
  "preparing_samples",
  "in_testing",
  "in_analysis",
  "in_review",
  "complete",
] as const;
export type TestOrderStatus = (typeof TEST_ORDER_STATUSES)[number];

export const WELL_ROLES = ["blank", "standard", "sample", "ppc"] as const;
export type WellRole = (typeof WELL_ROLES)[number];

export type CurveModel = "linear" | "log10-linear";
export type ResultQualifier =
  | "within_range"
  | "below_lloq"
  | "above_uloq"
  | "invalid";
export type SpecificationDecision = "pass" | "fail" | "not_reportable";

export type CanonicalEndpointRow = {
  well: string;
  role: WellRole;
  sampleExternalId: string | null;
  sampleId: string | null;
  replicate: number;
  dilutionFactor: number;
  standardEuMl: number | null;
  spikeEuMl: number | null;
  fluorescenceRfu: number;
};

export type MethodConfiguration = {
  curveModel: CurveModel;
  standardMinEuMl: number;
  standardMaxEuMl: number;
  r2Min: number;
  replicateCvMaxPct: number;
  ppcRecoveryMinPct: number;
  ppcRecoveryMaxPct: number;
  blankMaxRfu: number;
};

export type CalculationSample = {
  id: string;
  externalId: string;
  endotoxinLimitEuMl: number;
  maximumValidDilution: number;
};

export type CurveParameters = {
  model: CurveModel;
  slope: number;
  intercept: number;
  r2: number;
  blankMeanRfu: number;
  standardPoints: Array<{
    concentrationEuMl: number;
    meanCorrectedRfu: number;
    cvPct: number | null;
    replicates: number;
  }>;
};

export type CalculationResult = {
  sample_id: string;
  measured_eu_ml: number | null;
  corrected_eu_ml: number | null;
  qualifier: ResultQualifier;
  ppc_recovery_pct: number | null;
  replicate_cv_pct: number | null;
  specification_decision: SpecificationDecision;
  validity_details: {
    valid: boolean;
    issues: string[];
    dilutionFactor: number | null;
  };
};

export type RfcCalculation = {
  isValid: boolean;
  diagnostics: {
    issues: string[];
    blankValid: boolean;
    curveValid: boolean;
    standardsValid: boolean;
    samplesValid: boolean;
  };
  curveParameters: CurveParameters | null;
  results: CalculationResult[];
};
