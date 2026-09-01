import { authorizeLabRequest, failure, idempotencyKey, ok, requestIdFor, rpcValue } from "@/lib/lab/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const key = idempotencyKey(request, true)!;
    const { id } = await route.params;
    const calculation = await context.supabase.rpc("calculate_assay_run", { p_run_id: id, p_idempotency_key: key });
    if (calculation.error) throw calculation.error;
    const calculationRevisionId = rpcValue<string>(calculation.data);
    const read = await context.supabase.from("calculation_revisions").select("*,sample_results(*)").eq("id", calculationRevisionId).single();
    if (read.error) throw read.error;
    return ok(read.data, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}
