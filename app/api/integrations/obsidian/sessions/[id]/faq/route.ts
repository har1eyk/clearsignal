import { z } from "zod";
import { failure, ok, parseJson, requestIdFor } from "@/lib/lab/api";
import { getEndotoxinFaqResponse } from "@/lib/marketing-faq";
import { appendPublicEvent, assertOpenBrowserSession, browserToken, sessionIdSchema } from "@/lib/lab/notebook-session";

const faqInputSchema = z.object({
  question: z.string().trim().min(2).max(500).optional(),
  operation_id: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = requestIdFor(request);
  try {
    const sessionId = sessionIdSchema.parse((await params).id);
    const token = browserToken(request);
    const input = faqInputSchema.parse(await parseJson(request));
    await assertOpenBrowserSession(sessionId, token);
    const response = getEndotoxinFaqResponse(input.question);
    if (response.status !== "matched") return ok(response, requestId);

    const operationId = input.operation_id ?? crypto.randomUUID();
    const payload = {
      source_type: "published_faq",
      question: response.query,
      faq_question: response.question,
      answer: response.answer,
      answered_at: new Date().toISOString(),
    };
    const event = await appendPublicEvent({ sessionId, token, operationId, kind: "guidance", payload });
    return ok({
      ...response,
      notebook_event: { sequence: event.sequence, created_at: event.created_at },
    }, requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}
