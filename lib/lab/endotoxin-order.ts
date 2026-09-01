import { z } from "zod";

export const STANDARD_ENDOTOXIN_TEST = {
  code: "standard_endotoxin_test",
  name: "Standard endotoxin test",
  version: "2026-09-01",
  currency: "USD" as const,
  unitPriceCents: 35_000,
} as const;

const sampleId = z.string().trim().min(1, "Sample ID is required").max(120);

export const endotoxinOrderInputSchema = z.object({
  sample_ids: z.array(sampleId).min(1).max(100),
  spend_less_than_each: z.number().positive().finite().max(1_000_000),
  currency: z.literal("USD").default("USD"),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  value.sample_ids.forEach((id, index) => {
    const normalized = id.toLocaleLowerCase();
    if (seen.has(normalized)) {
      context.addIssue({ code: "custom", path: ["sample_ids", index], message: "Sample IDs must be unique" });
    }
    seen.add(normalized);
  });
});

export type EndotoxinOrderInput = z.infer<typeof endotoxinOrderInputSchema>;

export const pricedOrderIntentSchema = z.object({
  version: z.literal(1),
  quote_id: z.string().uuid(),
  idempotency_key: z.string().min(8).max(160),
  user_id: z.string().uuid(),
  lab_id: z.string().uuid(),
  sample_ids: z.array(sampleId).min(1).max(100),
  catalog_item: z.literal(STANDARD_ENDOTOXIN_TEST.code),
  catalog_version: z.string().min(1).max(80),
  unit_price_cents: z.number().int().positive(),
  total_price_cents: z.number().int().positive(),
  spend_less_than_each_cents: z.number().int().positive(),
  currency: z.literal("USD"),
  issued_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
});

export type PricedOrderIntent = z.infer<typeof pricedOrderIntentSchema>;

export type EndotoxinOrderPreview = {
  intent: string;
  quote_id: string;
  laboratory: string;
  service: string;
  sample_ids: string[];
  sample_count: number;
  unit_price: number;
  total: number;
  currency: "USD";
  spend_less_than_each: number;
  expires_at: string;
};

export type CreatedEndotoxinOrder = {
  id: string;
  order_number: string;
  sample_count: number;
  unit_price: number;
  total: number;
  currency: "USD";
  status: "pending_laboratory_review";
};

export function dollarsToCents(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error("Price limit must be a positive number");
  return Math.round((value + Number.EPSILON) * 100);
}

export function centsToDollars(value: number): number {
  return value / 100;
}

export function orderFingerprint(input: EndotoxinOrderInput): string {
  return JSON.stringify({
    sample_ids: input.sample_ids.map((id) => id.trim()),
    spend_less_than_each: input.spend_less_than_each,
    currency: input.currency,
  });
}
