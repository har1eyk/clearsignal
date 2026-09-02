import { z } from "zod";
import { centsToDollars, STANDARD_ENDOTOXIN_TEST } from "./endotoxin-order";
import { operationIdSchema } from "./notebook-session";

const sampleId = z.string().trim().min(1).max(120);
export const notebookQuoteSchema = z.object({
  sample_ids: z.array(sampleId).min(1).max(100),
  currency: z.literal("USD").default("USD"),
  operation_id: operationIdSchema.optional(),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  value.sample_ids.forEach((sample, index) => {
    const normalized = sample.toLocaleLowerCase();
    if (seen.has(normalized)) context.addIssue({ code: "custom", path: ["sample_ids", index], message: "Sample IDs must be unique" });
    seen.add(normalized);
  });
});

const QUOTE_LIFETIME_MS = 10 * 60 * 1000;

export function buildNotebookQuote(sampleIds: string[], now = new Date()) {
  return {
    quote_id: crypto.randomUUID(),
    service: STANDARD_ENDOTOXIN_TEST.name,
    sample_ids: sampleIds,
    sample_count: sampleIds.length,
    unit_price: centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents),
    total: centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents * sampleIds.length),
    currency: STANDARD_ENDOTOXIN_TEST.currency,
    catalog_version: STANDARD_ENDOTOXIN_TEST.version,
    quoted_at: now.toISOString(),
    expires_at: new Date(now.getTime() + QUOTE_LIFETIME_MS).toISOString(),
  };
}
