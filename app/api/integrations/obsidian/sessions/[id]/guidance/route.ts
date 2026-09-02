import { failure, ok, parseJson, requestIdFor } from "@/lib/lab/api";
import { guidanceInputSchema, reviewedGuidance } from "@/lib/lab/service-guidance";
import { appendPublicEvent, assertOpenBrowserSession, browserToken, sessionIdSchema } from "@/lib/lab/notebook-session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const sessionId = sessionIdSchema.parse((await params).id);
    const token = browserToken(request);
    const input = guidanceInputSchema.parse(await parseJson(request));
    await assertOpenBrowserSession(sessionId, token);
    const operationId = input.operation_id ?? crypto.randomUUID();
    const payload = {
      question: input.question,
      ...(input.sample_type ? { sample_type: input.sample_type } : {}),
      ...reviewedGuidance(input.question, input.sample_type),
      answered_at: new Date().toISOString(),
    };
    const event = await appendPublicEvent({ sessionId, token, operationId, kind: "guidance", payload });
    return ok({ ...payload, notebook_event: { sequence: event.sequence, created_at: event.created_at } }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
