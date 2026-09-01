import { ApiError, authorizeLabRequest, failure, ok, requestIdFor } from "@/lib/lab/api";

type RouteContext = { params: Promise<{ id: string }> };

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function reportCsv(report: Record<string, unknown>): string {
  const calculations = (report.calculations as Array<Record<string, unknown>> | undefined) ?? [];
  const latest = calculations.at(-1);
  const results = (latest?.results as Array<Record<string, unknown>> | undefined) ?? [];
  const samples = (report.samples as Array<{ sample?: { id?: string; external_id?: string } }> | undefined) ?? [];
  const sampleNames = new Map(samples.map((entry) => [entry.sample?.id, entry.sample?.external_id]));
  const headers = ["run_id", "run_number", "sample_id", "sample_external_id", "measured_eu_ml", "corrected_eu_ml", "qualifier", "ppc_recovery_pct", "replicate_cv_pct", "specification_decision", "calculation_revision"];
  const run = report.run as { id?: string; run_number?: string } | undefined;
  const rows = results.map((result) => [run?.id, run?.run_number, result.sample_id, sampleNames.get(String(result.sample_id)), result.measured_eu_ml, result.corrected_eu_ml, result.qualifier, result.ppc_recovery_pct, result.replicate_cv_pct, result.specification_decision, latest?.revision]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function GET(request: Request, route: RouteContext) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { id } = await route.params;
    const runResult = await context.supabase.from("assay_runs").select("status,report_snapshot").eq("id", id).eq("lab_id", context.labId).single();
    if (runResult.error?.code === "PGRST116") throw new ApiError(404, "Assay run not found", "not_found");
    if (runResult.error) throw runResult.error;
    let data = runResult.data.report_snapshot;
    if (!data) {
      const reportResult = await context.supabase.rpc("build_run_report", { p_run_id: id });
      if (reportResult.error) throw reportResult.error;
      data = reportResult.data;
    }
    if (!data) throw new ApiError(404, "Assay run not found", "not_found");
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    if (format === "json") return ok(data, context.requestId);
    if (format !== "csv") throw new ApiError(400, "format must be json or csv", "invalid_format");
    const runNumber = (data as { run?: { run_number?: string } }).run?.run_number ?? id;
    return new Response(reportCsv(data as Record<string, unknown>), {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${String(runNumber).replace(/[^a-zA-Z0-9._-]/g, "_")}-report.csv"`,
        "cache-control": "no-store",
        "x-request-id": context.requestId,
      },
    });
  } catch (error) {
    return failure(error, requestId);
  }
}
