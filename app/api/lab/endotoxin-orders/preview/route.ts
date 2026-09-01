import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import {
  STANDARD_ENDOTOXIN_TEST,
  centsToDollars,
  dollarsToCents,
  testingRequestQuoteInputSchema,
  type PricedOrderIntent,
} from "@/lib/lab/endotoxin-order";
import { signOrderIntent } from "@/lib/lab/order-intent";

const QUOTE_LIFETIME_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const input = testingRequestQuoteInputSchema.parse(await parseJson(request));
    if (input.details.lab_id !== context.labId) throw new ApiError(403, "Laboratory mismatch", "forbidden");

    const { data: draftData, error: draftError } = await context.supabase.rpc("create_testing_request_draft", {
      p_payload: input.details,
    });
    if (draftError) throw draftError;
    const draftId = rpcValue<string>(draftData);

    const spendLimitCents = input.spend_less_than_each == null ? null : dollarsToCents(input.spend_less_than_each);
    if (spendLimitCents != null && STANDARD_ENDOTOXIN_TEST.unitPriceCents >= spendLimitCents) {
      throw new ApiError(409, "The standard endotoxin test does not satisfy the strict per-test price limit", "price_cap_exceeded", {
        unit_price: centsToDollars(STANDARD_ENDOTOXIN_TEST.unitPriceCents),
        spend_less_than_each: input.spend_less_than_each,
        currency: input.currency,
      });
    }

    const { data: laboratory, error: laboratoryError } = await context.supabase
      .from("laboratories")
      .select("name")
      .eq("id", context.labId)
      .single();
    if (laboratoryError) throw laboratoryError;

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + QUOTE_LIFETIME_MS);
    const quoteId = crypto.randomUUID();
    const intent: PricedOrderIntent = {
      version: 2,
      quote_id: quoteId,
      draft_id: draftId,
      idempotency_key: `testing-request-${quoteId}`,
      user_id: context.user.id,
      lab_id: context.labId,
      sample_ids: input.details.samples.map((sample) => sample.external_id.trim()),
      catalog_item: STANDARD_ENDOTOXIN_TEST.code,
      catalog_version: STANDARD_ENDOTOXIN_TEST.version,
      unit_price_cents: STANDARD_ENDOTOXIN_TEST.unitPriceCents,
      total_price_cents: STANDARD_ENDOTOXIN_TEST.unitPriceCents * input.details.samples.length,
      spend_less_than_each_cents: spendLimitCents,
      currency: STANDARD_ENDOTOXIN_TEST.currency,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    return ok({
      intent: await signOrderIntent(intent),
      quote_id: quoteId,
      laboratory: laboratory.name,
      service: STANDARD_ENDOTOXIN_TEST.name,
      sample_ids: intent.sample_ids,
      sample_count: intent.sample_ids.length,
      unit_price: centsToDollars(intent.unit_price_cents),
      total: centsToDollars(intent.total_price_cents),
      currency: intent.currency,
      ...(intent.spend_less_than_each_cents == null ? {} : {
        spend_less_than_each: centsToDollars(intent.spend_less_than_each_cents),
      }),
      expires_at: intent.expires_at,
    }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
