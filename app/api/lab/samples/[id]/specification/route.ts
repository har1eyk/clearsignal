import { authorizeLabRequest, failure, ok, parseJson, requestIdFor, requireRole, rpcValue } from "@/lib/lab/api";
import { sampleSpecificationSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    requireRole(context, ["admin", "analyst"]);
    const { id } = await route.params;
    const payload = sampleSpecificationSchema.parse(await parseJson(request));
    const { data, error } = await context.supabase.rpc("set_sample_specification", {
      p_sample_id: id,
      p_endotoxin_limit_eu_ml: payload.endotoxin_limit_eu_ml,
      p_maximum_valid_dilution: payload.maximum_valid_dilution,
      p_reason: payload.reason,
    });
    if (error) throw error;
    return ok({ id: rpcValue<string>(data), specification_status: "complete" }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
