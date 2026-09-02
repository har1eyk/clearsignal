import { failure, ok, parseJson, requestIdFor } from "@/lib/lab/api";
import { buildNotebookQuote, notebookQuoteSchema } from "@/lib/lab/notebook-quote";
import { appendPublicEvent, assertOpenBrowserSession, browserToken, sessionIdSchema } from "@/lib/lab/notebook-session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const sessionId = sessionIdSchema.parse((await params).id);
    const token = browserToken(request);
    const input = notebookQuoteSchema.parse(await parseJson(request));
    await assertOpenBrowserSession(sessionId, token);
    const operationId = input.operation_id ?? crypto.randomUUID();
    const payload = buildNotebookQuote(input.sample_ids);
    const event = await appendPublicEvent({ sessionId, token, operationId, kind: "quote", payload });
    return ok({ ...payload, notebook_event: { sequence: event.sequence, created_at: event.created_at } }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
