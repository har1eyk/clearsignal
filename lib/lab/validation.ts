import { z } from "zod";
import { TEST_ORDER_STATUSES } from "./types";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(2000).optional().nullable();

const testingRequestSampleSchema = z.object({
  external_id: z.string().trim().min(1, "Sample ID is required").max(120),
  kind: z.enum(["original", "aliquot", "pool"]).default("original"),
  product_name: z.string().trim().max(240).optional().nullable(),
  product_lot: z.string().trim().max(120).optional().nullable(),
  matrix: z.string().trim().max(240).optional().nullable(),
  process_stage: z.string().trim().max(160).optional().nullable(),
  collected_at: z.string().datetime({ offset: true }).optional().nullable(),
  collected_by: z.string().trim().max(160).optional().nullable(),
  storage_condition: z.string().trim().max(240).optional().nullable(),
  quantity: z.number().nonnegative().optional().nullable(),
  quantity_unit: z.string().trim().max(40).optional().nullable(),
}).superRefine((sample, context) => {
  if (sample.quantity != null && !sample.quantity_unit) {
    context.addIssue({ code: "custom", path: ["quantity_unit"], message: "Quantity unit is required when quantity is entered" });
  }
  if (sample.quantity == null && sample.quantity_unit) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "Quantity is required when a unit is selected" });
  }
});

export const testingRequestCreateSchema = z.object({
  lab_id: uuid,
  client_name: z.string().trim().max(240).optional().nullable(),
  project_name: z.string().trim().min(1, "Project name is required").max(240),
  purpose: z.string().trim().min(1, "Testing purpose is required").max(2000),
  samples: z.array(testingRequestSampleSchema).min(1, "Add at least one sample").max(100),
}).superRefine((request, context) => {
  const seen = new Set<string>();
  request.samples.forEach((sample, index) => {
    const normalized = sample.external_id.toLocaleLowerCase();
    if (seen.has(normalized)) {
      context.addIssue({ code: "custom", path: ["samples", index, "external_id"], message: "Sample IDs must be unique within the request" });
    }
    seen.add(normalized);
  });
});

export const sampleSpecificationSchema = z.object({
  matrix: z.string().trim().min(1).max(240).optional(),
  endotoxin_limit_eu_ml: z.number().nonnegative(),
  maximum_valid_dilution: z.number().min(1),
  reason: z.string().trim().min(1).max(1000),
});

export const sampleCreateSchema = z.object({
  lab_id: uuid,
  test_order_id: uuid.optional().nullable(),
  external_id: z.string().trim().min(1).max(120),
  kind: z.enum(["original", "aliquot", "pool"]).default("original"),
  product_name: z.string().trim().max(240).optional().nullable(),
  product_lot: z.string().trim().max(120).optional().nullable(),
  matrix: z.string().trim().min(1).max(240),
  process_stage: z.string().trim().max(160).optional().nullable(),
  collected_at: z.string().datetime({ offset: true }).optional().nullable(),
  collected_by: z.string().trim().max(160).optional().nullable(),
  storage_condition: z.string().trim().max(240).optional().nullable(),
  quantity: z.number().nonnegative().optional().nullable(),
  quantity_unit: z.string().trim().max(40).optional().nullable(),
  endotoxin_limit_eu_ml: z.number().nonnegative(),
  maximum_valid_dilution: z.number().min(1),
});

export const sampleEventSchema = z.object({
  event_type: z.enum(["registered", "received", "transferred", "aliquoted", "pooled", "stored", "removed", "consumed", "disposed", "condition_noted"]),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  location: z.string().trim().max(240).optional().nullable(),
  condition: z.string().trim().max(1000).optional().nullable(),
  quantity: z.number().nonnegative().optional().nullable(),
  quantity_unit: z.string().trim().max(40).optional().nullable(),
  notes: optionalText,
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const runCreateSchema = z.object({
  lab_id: uuid,
  run_number: z.string().trim().min(1).max(120),
  method_version_id: uuid,
  instrument_id: uuid,
  reagent_lot_id: uuid,
  standard_lot_id: uuid,
  plate_format: z.union([z.literal(96), z.literal(384)]),
  supersedes_run_id: uuid.optional().nullable(),
  notes: optionalText,
  samples: z.array(z.object({ sample_id: uuid, planned_dilution: z.number().min(1) })).min(1),
});

export const manualReadingSchema = z.object({
  well: z.string().trim().toUpperCase().regex(/^[A-P](?:[1-9]|1\d|2[0-4])$/),
  role: z.enum(["blank", "standard", "sample", "ppc"]),
  sample_id: uuid.optional().nullable(),
  replicate: z.number().int().min(1),
  dilution_factor: z.number().min(1),
  standard_eu_ml: z.number().positive().optional().nullable(),
  spike_eu_ml: z.number().positive().optional().nullable(),
  fluorescence_rfu: z.number().nonnegative(),
}).superRefine((row, context) => {
  const valid =
    (row.role === "blank" && !row.sample_id && !row.standard_eu_ml && !row.spike_eu_ml)
    || (row.role === "standard" && !row.sample_id && Boolean(row.standard_eu_ml) && !row.spike_eu_ml)
    || (row.role === "sample" && Boolean(row.sample_id) && !row.standard_eu_ml && !row.spike_eu_ml)
    || (row.role === "ppc" && Boolean(row.sample_id) && !row.standard_eu_ml && Boolean(row.spike_eu_ml));
  if (!valid) context.addIssue({ code: "custom", message: "Fields are inconsistent with the well role" });
});

export const manualReadingsSchema = z.object({
  rows: z.array(manualReadingSchema).min(1).max(384),
  reason: z.string().trim().min(1).max(1000).optional(),
});

export const reviewSchema = z.object({
  decision: z.enum(["approve", "reject", "invalidate"]),
  meaning: z.string().trim().min(1).max(240),
  comment: z.string().trim().max(2000).optional().nullable(),
});

export const submitSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export const sopSchema = z.object({
  lab_id: uuid,
  sop_code: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(240),
  version: z.string().trim().min(1).max(80),
  document_uri: z.string().trim().max(1000).optional().nullable(),
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional().nullable(),
});

export const methodSchema = z.object({
  lab_id: uuid,
  sop_version_id: uuid.optional().nullable(),
  method_code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(240),
  version: z.string().trim().min(1).max(80),
  curve_model: z.enum(["linear", "log10-linear"]),
  standard_min_eu_ml: z.number().positive(),
  standard_max_eu_ml: z.number().positive(),
  r2_min: z.number().min(0).max(1),
  replicate_cv_max_pct: z.number().nonnegative(),
  ppc_recovery_min_pct: z.number().nonnegative(),
  ppc_recovery_max_pct: z.number().positive(),
  blank_max_rfu: z.number().nonnegative(),
  notes: optionalText,
}).refine((value) => value.standard_max_eu_ml > value.standard_min_eu_ml, { message: "standard_max_eu_ml must exceed standard_min_eu_ml" })
  .refine((value) => value.ppc_recovery_max_pct > value.ppc_recovery_min_pct, { message: "PPC recovery maximum must exceed minimum" });

export const instrumentSchema = z.object({
  lab_id: uuid,
  instrument_code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(240),
  manufacturer: z.string().trim().max(240).optional().nullable(),
  model: z.string().trim().max(160).optional().nullable(),
  serial_number: z.string().trim().max(160).optional().nullable(),
  status: z.enum(["draft", "active", "retired"]).default("draft"),
});

export const instrumentEventSchema = z.object({
  lab_id: uuid,
  instrument_id: uuid,
  event_type: z.enum(["calibration", "qualification", "maintenance", "repair", "inspection"]),
  performed_at: z.string().datetime({ offset: true }),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
  outcome: z.string().trim().min(1).max(240),
  notes: optionalText,
});

export const materialLotSchema = z.object({
  lab_id: uuid,
  material_type: z.enum(["rfc_reagent", "control_standard_endotoxin", "water", "consumable", "other"]),
  name: z.string().trim().min(1).max(240),
  manufacturer: z.string().trim().max(240).optional().nullable(),
  catalog_number: z.string().trim().max(120).optional().nullable(),
  lot_number: z.string().trim().min(1).max(160),
  concentration: z.number().positive().optional().nullable(),
  concentration_unit: z.string().trim().max(40).optional().nullable(),
  received_at: z.string().datetime({ offset: true }).optional().nullable(),
  opened_at: z.string().datetime({ offset: true }).optional().nullable(),
  expires_at: z.string().datetime({ offset: true }).optional().nullable(),
  storage_condition: z.string().trim().max(240).optional().nullable(),
  status: z.enum(["draft", "active", "retired"]).default("draft"),
  certificate_uri: z.string().trim().max(1000).optional().nullable(),
});

export const statusChangeSchema = z.object({
  status: z.enum(["active", "retired"]),
  reason: z.string().trim().min(1).max(1000),
});

export const testOrderStatusChangeSchema = z.object({
  status: z.enum(TEST_ORDER_STATUSES),
  reason: z.string().trim().min(1).max(1000),
});
