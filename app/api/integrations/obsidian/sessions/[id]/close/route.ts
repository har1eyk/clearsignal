import { failure, ok, requestIdFor, rpcValue } from "@/lib/lab/api";
import { bearerToken, notebookSupabase, sessionIdSchema, sha256 } from "@/lib/lab/notebook-session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const { id } = await params;
    const sessionId = sessionIdSchema.parse(id);
    const token = bearerToken(request);
    const supabase = notebookSupabase();
    const { data, error } = await supabase.rpc("close_obsidian_notebook_session", {
      p_session_id: sessionId,
      p_read_token_sha256: await sha256(token),
    });
    if (error) throw error;
    return ok(rpcValue(data), requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
