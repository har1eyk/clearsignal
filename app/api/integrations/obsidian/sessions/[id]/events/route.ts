import { z } from "zod";
import { failure, ok, requestIdFor, rpcValue } from "@/lib/lab/api";
import { bearerToken, notebookSupabase, sessionIdSchema, sha256 } from "@/lib/lab/notebook-session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const { id } = await params;
    const sessionId = sessionIdSchema.parse(id);
    const token = bearerToken(request);
    const url = new URL(request.url);
    const afterSequence = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).parse(url.searchParams.get("after_sequence") ?? "0");
    const supabase = notebookSupabase();
    const { data, error } = await supabase.rpc("read_obsidian_notebook_events", {
      p_session_id: sessionId,
      p_read_token_sha256: await sha256(token),
      p_after_sequence: afterSequence,
    });
    if (error) throw error;
    return ok(rpcValue(data), requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
