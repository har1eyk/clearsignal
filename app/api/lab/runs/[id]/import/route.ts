import { ApiError, authorizeLabRequest, failure, idempotencyKey, ok, requestIdFor, rpcValue } from "@/lib/lab/api";
import { sha256Hex } from "@/lib/lab/calculation";
import { parseEndpointCsv } from "@/lib/lab/csv";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const key = idempotencyKey(request, true)!;
    const { id } = await route.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "A CSV file field is required", "missing_file");
    if (file.size > 10 * 1024 * 1024) throw new ApiError(413, "CSV files cannot exceed 10 MB", "file_too_large");
    if (!file.name.toLowerCase().endsWith(".csv")) throw new ApiError(400, "The uploaded file must use a .csv extension", "invalid_file_type");
    const [buffer, runResult, assignmentsResult] = await Promise.all([
      file.arrayBuffer(),
      context.supabase.from("assay_runs").select("id,plate_format,status").eq("lab_id", context.labId).eq("id", id).single(),
      context.supabase.from("run_samples").select("sample_id,samples(external_id)").eq("run_id", id),
    ]);
    if (runResult.error) throw runResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;
    const sampleMap = new Map<string, string>();
    for (const assignment of assignmentsResult.data ?? []) {
      const sample = assignment.samples as unknown as { external_id: string } | null;
      if (sample) sampleMap.set(sample.external_id, assignment.sample_id);
    }
    const text = new TextDecoder().decode(buffer);
    const rows = parseEndpointCsv(text, runResult.data.plate_format as 96 | 384, sampleMap);
    const hash = await sha256Hex(buffer);
    const keyHash = await sha256Hex(key);
    const storagePath = `${context.labId}/${id}/${keyHash.slice(0, 20)}-${hash}.csv`;
    const { error: uploadError } = await context.supabase.storage.from("assay-raw-data").upload(storagePath, buffer, { contentType: "text/csv", upsert: false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError;
    const artifactPayload = {
      storage_path: storagePath,
      storage_version: hash,
      original_filename: file.name,
      mime_type: file.type || "text/csv",
      byte_size: file.size,
      sha256: hash,
    };
    const artifactResult = await context.supabase.rpc("register_raw_artifact", { p_run_id: id, p_payload: artifactPayload, p_idempotency_key: key });
    if (artifactResult.error) throw artifactResult.error;
    const artifactId = rpcValue<string>(artifactResult.data);
    const canonicalRows = rows.map((row) => ({
      well: row.well,
      role: row.role,
      sample_id: row.sampleId,
      replicate: row.replicate,
      dilution_factor: row.dilutionFactor,
      standard_eu_ml: row.standardEuMl,
      spike_eu_ml: row.spikeEuMl,
      fluorescence_rfu: row.fluorescenceRfu,
    }));
    const readingResult = await context.supabase.rpc("upsert_endpoint_readings", { p_run_id: id, p_rows: canonicalRows, p_artifact_id: artifactId, p_reason: `Imported ${file.name} (${hash})` });
    if (readingResult.error) throw readingResult.error;
    return ok({ artifactId, sha256: hash, accepted: readingResult.data }, context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}

