import { z } from "zod";
import { endotoxinOrderInputSchema, type EndotoxinOrderInput } from "./endotoxin-order";

export const PENDING_ORDER_INPUT_KEY = "clearsignal.webmcp.pending-order-input";
export const PENDING_ORDER_PREVIEW_KEY = "clearsignal.webmcp.pending-order-preview";
export const ORDER_CREATED_EVENT = "clearsignal:order-created";
export const PENDING_ORDER_LIFETIME_MS = 30 * 60 * 1000;

const pendingOrderSchema = z.object({
  input: endotoxinOrderInputSchema,
  created_at: z.string().datetime({ offset: true }),
  expires_at: z.string().datetime({ offset: true }),
});

export type PendingOrder = z.infer<typeof pendingOrderSchema>;

export function createPendingOrder(input: EndotoxinOrderInput, now = Date.now()): PendingOrder {
  return {
    input: endotoxinOrderInputSchema.parse(input),
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + PENDING_ORDER_LIFETIME_MS).toISOString(),
  };
}

export function parsePendingOrder(value: string, now = Date.now()): PendingOrder | null {
  try {
    const pending = pendingOrderSchema.parse(JSON.parse(value));
    return Date.parse(pending.expires_at) > now ? pending : null;
  } catch {
    return null;
  }
}
