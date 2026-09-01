import { authorizeLabRequest, failure, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { sampleEventSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const payload = sampleEventSchema.parse(await parseJson(request));
    const { reason, ...event } = payload;
    const { data, error } = await context.supabase.rpc("record_sample_event", { p_sample_id: id, p_payload: event, p_reason: reason ?? null });
    if (error) throw error;
    const eventId = rpcValue<string>(data);
    const { data: created, error: readError } = await context.supabase.from("sample_events").select("*").eq("id", eventId).single();
    if (readError) throw readError;
    return ok(created, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}

