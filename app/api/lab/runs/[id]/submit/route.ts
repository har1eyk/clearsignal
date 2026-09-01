import { authorizeLabRequest, failure, ok, parseJson, requestIdFor } from "@/lib/lab/api";
import { submitSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const payload = submitSchema.parse(await parseJson(request));
    const { error } = await context.supabase.rpc("submit_assay_run", { p_run_id: id, p_reason: payload.reason ?? null });
    if (error) throw error;
    return ok({ id, status: "submitted" }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

