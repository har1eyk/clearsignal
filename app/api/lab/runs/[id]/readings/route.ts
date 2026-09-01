import { ApiError, authorizeLabRequest, failure, ok, parseJson, requestIdFor } from "@/lib/lab/api";
import { manualReadingsSchema } from "@/lib/lab/validation";

type RouteContext = { params: Promise<{ id: string }> };

function assertPlateWell(well: string, format: number): void {
  const match = /^([A-P])(\d{1,2})$/.exec(well);
  const row = match ? match[1].charCodeAt(0) - 64 : 999;
  const column = match ? Number(match[2]) : 999;
  if (!match || row > (format === 96 ? 8 : 16) || column > (format === 96 ? 12 : 24)) {
    throw new ApiError(400, `Well ${well} is outside the ${format}-well plate`, "invalid_well");
  }
}

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const payload = manualReadingsSchema.parse(await parseJson(request));
    const { data: run, error: runError } = await context.supabase.from("assay_runs").select("plate_format").eq("id", id).eq("lab_id", context.labId).single();
    if (runError) throw runError;
    const wells = new Set<string>();
    for (const row of payload.rows) {
      assertPlateWell(row.well, run.plate_format);
      if (wells.has(row.well)) throw new ApiError(400, `Duplicate well ${row.well}`, "duplicate_well");
      wells.add(row.well);
    }
    const sampleIds = [...new Set(payload.rows.flatMap((row) => row.sample_id ? [row.sample_id] : []))];
    if (sampleIds.length) {
      const { data: assigned, error } = await context.supabase.from("run_samples").select("sample_id").eq("run_id", id).in("sample_id", sampleIds);
      if (error) throw error;
      if (assigned?.length !== sampleIds.length) throw new ApiError(400, "Every sample well must reference a sample assigned to the run", "unassigned_sample");
    }
    const rows = payload.rows.map((row) => ({
      well: row.well,
      role: row.role,
      sample_id: row.sample_id ?? null,
      replicate: row.replicate,
      dilution_factor: row.dilution_factor,
      standard_eu_ml: row.standard_eu_ml ?? null,
      spike_eu_ml: row.spike_eu_ml ?? null,
      fluorescence_rfu: row.fluorescence_rfu,
    }));
    const { data, error } = await context.supabase.rpc("upsert_endpoint_readings", { p_run_id: id, p_rows: rows, p_artifact_id: null, p_reason: payload.reason ?? "manual endpoint entry" });
    if (error) throw error;
    return ok({ accepted: data }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

