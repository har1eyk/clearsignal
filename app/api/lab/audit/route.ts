import { ApiError, authorizeLabRequest, failure, ok, pagination, requestIdFor } from "@/lib/lab/api";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { limit, before } = pagination(request);
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entity_type");
    const entityId = url.searchParams.get("entity_id");
    if (!entityType || !entityId) throw new ApiError(400, "entity_type and entity_id are required", "missing_filter");
    let query = context.supabase.from("audit_events").select("*").eq("lab_id", context.labId).eq("entity_type", entityType).eq("entity_id", entityId).order("occurred_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("occurred_at", before);
    const { data, error } = await query;
    if (error) throw error;
    return ok({ items: data, nextCursor: data?.length === limit ? data[data.length - 1].occurred_at : null }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

