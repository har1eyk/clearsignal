import { ApiError, authorizeLabRequest, failure, ok, requestIdFor } from "@/lib/lab/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const { data: sample, error } = await context.supabase.from("samples").select("*").eq("lab_id", context.labId).eq("id", id).single();
    if (error?.code === "PGRST116") throw new ApiError(404, "Sample not found", "not_found");
    if (error) throw error;
    const [events, components] = await Promise.all([
      context.supabase.from("sample_events").select("*").eq("sample_id", id).order("occurred_at"),
      context.supabase.from("sample_components").select("*").or(`derived_sample_id.eq.${id},source_sample_id.eq.${id}`),
    ]);
    if (events.error) throw events.error;
    if (components.error) throw components.error;
    return ok({ sample, events: events.data, components: components.data }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

