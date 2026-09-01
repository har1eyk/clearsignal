import { ApiError, authorizeLabRequest, failure, idempotencyKey, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import { testingRequestCreateSchema } from "@/lib/lab/validation";

type CreatedTestingRequest = { id: string; order_number: string; sample_count: number };

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const key = idempotencyKey(request, true)!;
    const payload = testingRequestCreateSchema.parse(await parseJson(request));
    if (payload.lab_id !== context.labId) throw new ApiError(403, "Laboratory mismatch", "forbidden");
    const { data, error } = await context.supabase.rpc("create_testing_request", {
      p_payload: payload,
      p_idempotency_key: key,
    });
    if (error?.code === "23505") {
      throw new ApiError(409, "A sample ID in this request already exists in the laboratory", "sample_id_conflict", {
        field: "samples.external_id",
      });
    }
    if (error) throw error;
    return ok(rpcValue<CreatedTestingRequest>(data), context.requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}
