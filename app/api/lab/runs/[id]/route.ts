import { ApiError, authorizeLabRequest, failure, ok, requestIdFor } from "@/lib/lab/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const runQuery = await context.supabase.from("assay_runs").select("*,method_versions(*),instruments(*),reagent_lot:material_lots!assay_runs_reagent_lot_id_fkey(*),standard_lot:material_lots!assay_runs_standard_lot_id_fkey(*)").eq("lab_id", context.labId).eq("id", id).single();
    if (runQuery.error?.code === "PGRST116") throw new ApiError(404, "Assay run not found", "not_found");
    if (runQuery.error) throw runQuery.error;
    const [runSamples, wells, artifacts, calculations, reviews, deviations] = await Promise.all([
      context.supabase.from("run_samples").select("*,samples(*)").eq("run_id", id),
      context.supabase.from("plate_wells").select("*,endpoint_readings(*)").eq("run_id", id).order("well"),
      context.supabase.from("raw_artifacts").select("*").eq("run_id", id).order("uploaded_at"),
      context.supabase.from("calculation_revisions").select("*,sample_results(*)").eq("run_id", id).order("revision"),
      context.supabase.from("review_actions").select("id,decision,meaning,comment,reviewed_at,reviewed_by").eq("run_id", id).order("reviewed_at"),
      context.supabase.from("deviations").select("*").eq("run_id", id).order("created_at"),
    ]);
    for (const result of [runSamples, wells, artifacts, calculations, reviews, deviations]) if (result.error) throw result.error;
    return ok({ run: runQuery.data, samples: runSamples.data, wells: wells.data, artifacts: artifacts.data, calculations: calculations.data, reviews: reviews.data, deviations: deviations.data }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

