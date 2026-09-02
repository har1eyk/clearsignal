import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "@/lib/lab/endotoxin-order";
import { verifyOrderIntent } from "@/lib/lab/order-intent";
import { operationIdSchema, sessionIdSchema, sha256, tokenSchema } from "@/lib/lab/notebook-session";
import { z } from "zod";

const confirmationSchema = z.object({
  intent: z.string().min(40).max(64_000),
  notebook_session: z.object({
    sessionId: sessionIdSchema,
    browserToken: tokenSchema,
    operationId: operationIdSchema,
  }).optional(),
});
type DatabaseOrder = {
  id: string;
  order_number: string;
  sample_count: number;
  unit_price_cents: number;
  total_price_cents: number;
  currency: "USD";
};

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { intent: token, notebook_session: notebookSession } = confirmationSchema.parse(await parseJson(request));
    const intent = await verifyOrderIntent(token);

    if (intent.user_id !== context.user.id || intent.lab_id !== context.labId) {
      throw new ApiError(403, "The price intent belongs to another account or laboratory", "forbidden");
    }
    if (Date.parse(intent.expires_at) <= Date.now()) {
      throw new ApiError(409, "The price intent expired; request a current price", "price_intent_expired");
    }
    if (
      intent.catalog_item !== STANDARD_ENDOTOXIN_TEST.code
      || intent.catalog_version !== STANDARD_ENDOTOXIN_TEST.version
      || intent.currency !== STANDARD_ENDOTOXIN_TEST.currency
      || intent.unit_price_cents !== STANDARD_ENDOTOXIN_TEST.unitPriceCents
      || intent.total_price_cents !== STANDARD_ENDOTOXIN_TEST.unitPriceCents * intent.sample_ids.length
    ) {
      throw new ApiError(409, "The catalog changed; request a current price", "catalog_changed");
    }
    if (intent.spend_less_than_each_cents != null && intent.unit_price_cents >= intent.spend_less_than_each_cents) {
      throw new ApiError(409, "The current price does not satisfy the strict per-test price limit", "price_cap_exceeded", {
        unit_price: centsToDollars(intent.unit_price_cents),
        spend_less_than_each: centsToDollars(intent.spend_less_than_each_cents),
        currency: intent.currency,
      });
    }

    const { data, error } = await context.supabase.rpc("confirm_testing_request_draft", {
      p_draft_id: intent.draft_id,
      p_idempotency_key: intent.idempotency_key,
      p_catalog_item: intent.catalog_item,
      p_catalog_version: intent.catalog_version,
      p_unit_price_cents: intent.unit_price_cents,
      p_total_price_cents: intent.total_price_cents,
      p_currency: intent.currency,
      p_spend_less_than_each_cents: intent.spend_less_than_each_cents,
      p_quote_confirmed_at: new Date().toISOString(),
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "A sample ID in this order already exists in the laboratory", "sample_id_conflict", {
        field: "sample_ids",
      });
    }
    if (error?.message?.includes("price cap")) {
      throw new ApiError(409, "The current price does not satisfy the strict per-test price limit", "price_cap_exceeded");
    }
    if (error) throw error;
    const created = rpcValue<DatabaseOrder>(data);
    if (notebookSession) {
      const { error: notebookError } = await context.supabase.rpc("append_obsidian_order_event", {
        p_session_id: notebookSession.sessionId,
        p_browser_token_sha256: await sha256(notebookSession.browserToken),
        p_operation_id: notebookSession.operationId,
        p_test_order_id: created.id,
      });
      if (notebookError) throw notebookError;
    }
    return ok({
      id: created.id,
      order_number: created.order_number,
      sample_count: created.sample_count,
      unit_price: centsToDollars(created.unit_price_cents),
      total: centsToDollars(created.total_price_cents),
      currency: created.currency,
      status: "pending_laboratory_review",
    }, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}
