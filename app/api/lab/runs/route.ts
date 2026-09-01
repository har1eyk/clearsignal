import { authorizeLabRequest, failure, idempotencyKey, ok, pagination, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { runCreateSchema } from "@/lib/lab/validation";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { limit, before } = pagination(request);
    const url = new URL(request.url);
    let query = context.supabase.from("assay_runs").select("*,method_versions(method_code,name,version),instruments(instrument_code,name)").eq("lab_id", context.labId).order("created_at", { ascending: false }).limit(limit);
    const status = url.searchParams.get("status");
    if (status) query = query.eq("status", status);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw error;
    return ok({ items: data, nextCursor: data?.length === limit ? data[data.length - 1].created_at : null }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const key = idempotencyKey(request, true)!;
    const payload = runCreateSchema.parse(await parseJson(request));
    if (payload.lab_id !== context.labId) throw new Error("Laboratory mismatch");
    const { data, error } = await context.supabase.rpc("create_assay_run", { p_payload: payload, p_idempotency_key: key });
    if (error) throw error;
    const id = rpcValue<string>(data);
    const { data: run, error: readError } = await context.supabase.from("assay_runs").select("*").eq("id", id).single();
    if (readError) throw readError;
    return ok(run, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}

