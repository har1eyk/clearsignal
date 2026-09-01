import { ApiError, authorizeLabRequest, failure, ok, pagination, parseJson, requestIdFor, requireRole, rpcValue } from "@/lib/lab/api";
import { instrumentEventSchema, instrumentSchema, materialLotSchema, methodSchema, sopSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ resource: string }> };

const resources = {
  sops: { table: "sop_versions", schema: sopSchema, rpc: "create_sop_version" },
  methods: { table: "method_versions", schema: methodSchema, rpc: "create_method_version" },
  instruments: { table: "instruments", schema: instrumentSchema, rpc: "create_instrument" },
  "instrument-events": { table: "instrument_events", schema: instrumentEventSchema, rpc: "record_instrument_event" },
  "material-lots": { table: "material_lots", schema: materialLotSchema, rpc: "create_material_lot" },
} as const;

function resourceFor(value: string) {
  const resource = resources[value as keyof typeof resources];
  if (!resource) throw new ApiError(404, "Reference resource not found", "not_found");
  return resource;
}

export async function GET(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { resource: resourceName } = await route.params;
    const resource = resourceFor(resourceName);
    const { limit, before } = pagination(request);
    let query = context.supabase.from(resource.table).select("*").eq("lab_id", context.labId).order("created_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw error;
    return ok({ items: data, nextCursor: data?.length === limit ? data[data.length - 1].created_at : null }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    requireRole(context, ["admin"]);
    const { resource: resourceName } = await route.params;
    const resource = resourceFor(resourceName);
    const payload = resource.schema.parse(await parseJson(request));
    if (payload.lab_id !== context.labId) throw new ApiError(403, "Laboratory mismatch", "forbidden");
    const { data, error } = await context.supabase.rpc(resource.rpc, { p_payload: payload });
    if (error) throw error;
    const id = rpcValue<string>(data);
    const read = await context.supabase.from(resource.table).select("*").eq("id", id).single();
    if (read.error) throw read.error;
    return ok(read.data, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}

