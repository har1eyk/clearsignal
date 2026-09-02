import { z } from "zod";
import { failure, ok, parseJson, requestIdFor, rpcValue } from "@/lib/lab/api";
import {
  generateCapabilityToken,
  notebookSupabase,
  requestDigestSchema,
  sha256,
} from "@/lib/lab/notebook-session";

const createSessionSchema = z.object({ request_sha256: requestDigestSchema });

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const input = createSessionSchema.parse(await parseJson(request));
    const sessionId = crypto.randomUUID();
    const readToken = generateCapabilityToken();
    const browserToken = generateCapabilityToken();
    const supabase = notebookSupabase();
    const { data, error } = await supabase.rpc("create_obsidian_notebook_session", {
      p_session_id: sessionId,
      p_request_sha256: input.request_sha256,
      p_read_token_sha256: await sha256(readToken),
      p_browser_token_sha256: await sha256(browserToken),
    });
    if (error) throw error;
    const created = rpcValue<{ created_at: string }>(data);
    return ok({
      schema_version: 1,
      session_id: sessionId,
      request_sha256: input.request_sha256,
      status: "open",
      created_at: created.created_at,
      read_token: readToken,
      browser_token: browserToken,
      browser_path: `/integrations/obsidian?session=${encodeURIComponent(sessionId)}#browser_token=${encodeURIComponent(browserToken)}`,
    }, requestId, { status: 201 });
  } catch (error) {
    return failure(error, requestId);
  }
}
