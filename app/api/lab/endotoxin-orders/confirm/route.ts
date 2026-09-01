import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { STANDARD_ENDOTOXIN_TEST, centsToDollars } from "@/lib/lab/endotoxin-order";
import { verifyOrderIntent } from "@/lib/lab/order-intent";
import { z } from "zod";

const confirmationSchema = z.object({ intent: z.string().min(40).max(64_000) });
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
    const { intent: token } = confirmationSchema.parse(await parseJson(request));
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
    if (intent.unit_price_cents >= intent.spend_less_than_each_cents) {
      throw new ApiError(409, "The current price does not satisfy the strict per-test price limit", "price_cap_exceeded", {
        unit_price: centsToDollars(intent.unit_price_cents),
        spend_less_than_each: centsToDollars(intent.spend_less_than_each_cents),
        currency: intent.currency,
      });
    }

    const date = intent.issued_at.slice(0, 10);
    const payload = {
      lab_id: context.labId,
      client_name: null,
      project_name: `Endotoxin testing — ${date}`,
      purpose: "Quantify endotoxin in submitted samples.",
      samples: intent.sample_ids.map((externalId) => ({ external_id: externalId, kind: "original", matrix: null })),
      catalog_item: intent.catalog_item,
      catalog_version: intent.catalog_version,
      unit_price_cents: intent.unit_price_cents,
      total_price_cents: intent.total_price_cents,
      currency: intent.currency,
      spend_less_than_each_cents: intent.spend_less_than_each_cents,
      quote_confirmed_at: new Date().toISOString(),
    };

    const { data, error } = await context.supabase.rpc("create_testing_request", {
      p_payload: payload,
      p_idempotency_key: intent.idempotency_key,
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
