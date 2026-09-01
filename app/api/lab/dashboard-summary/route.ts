import { authorizeLabRequest, failure, ok, requestIdFor, rpcValue } from "@/lib/lab/api";

type DashboardSummary = {
  testingRequests: number;
  samplesInProgress: number;
  approvedResults: number;
};

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { data, error } = await context.supabase.rpc("get_user_dashboard_summary");
    if (error) throw error;
    return ok(rpcValue<DashboardSummary>(data), context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
