import { failure, ok, requestIdFor } from "@/lib/lab/api";
import { assertActiveBrowserSession, browserToken, sessionIdSchema } from "@/lib/lab/notebook-session";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const sessionId = sessionIdSchema.parse((await params).id);
    const session = await assertActiveBrowserSession(sessionId, browserToken(request));
    return ok(session, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
