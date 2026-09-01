import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor, requireRole } from "@/lib/lab/api";
import { statusChangeSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ resource: string; id: string }> };

const statusFunctions = {
  sops: "set_sop_status",
  methods: "set_method_status",
  instruments: "set_instrument_status",
  "material-lots": "set_material_lot_status",
} as const;

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    requireRole(context, ["admin"]);
    const { resource, id } = await route.params;
    const rpc = statusFunctions[resource as keyof typeof statusFunctions];
    if (!rpc) throw new ApiError(404, "Reference resource not found", "not_found");
    const payload = statusChangeSchema.parse(await parseJson(request));
    const { error } = await context.supabase.rpc(rpc, { p_id: id, p_status: payload.status, p_reason: payload.reason });
    if (error) throw error;
    return ok({ id, status: payload.status }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

