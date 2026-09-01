import { authorizeLabRequest, failure, idempotencyKey, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { reviewSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const key = idempotencyKey(request, true)!;
    const { id } = await route.params;
    const payload = reviewSchema.parse(await parseJson(request));
    const { data, error } = await context.supabase.rpc("review_assay_run", {
      p_run_id: id,
      p_decision: payload.decision,
      p_meaning: payload.meaning,
      p_comment: payload.comment ?? null,
      p_idempotency_key: key,
    });
    if (error) throw error;
    return ok({ reviewActionId: rpcValue<string>(data), decision: payload.decision }, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}

