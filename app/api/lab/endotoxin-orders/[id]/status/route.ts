import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor, requireRole, rpcValue } from "@/lib/lab/api";
import { testOrderStatusChangeSchema } from "@/lib/lab/validation";
import { z } from "zod";

const orderIdSchema = z.string().uuid();
type RouteContext = { params: Promise<{ id: string }> };

type StatusResult = {
  id: string;
  order_number: string;
  status: string;
  status_updated_at: string;
  changed: boolean;
};

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    requireRole(context, ["admin", "analyst", "reviewer"]);
    const orderId = orderIdSchema.parse((await route.params).id);
    const input = testOrderStatusChangeSchema.parse(await parseJson(request));
    const { data, error } = await context.supabase.rpc("set_test_order_status", {
      p_order_id: orderId,
      p_status: input.status,
      p_reason: input.reason,
    });
    if (error?.code === "P0002") throw new ApiError(404, "Test order not found", "not_found");
    if (error) throw error;
    return ok(rpcValue<StatusResult>(data), context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
