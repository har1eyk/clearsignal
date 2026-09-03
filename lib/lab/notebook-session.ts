import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ApiError, rpcValue } from "./api";

export const sessionIdSchema = z.string().uuid();
export const requestDigestSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const tokenSchema = z.string().min(32).max(256).regex(/^[A-Za-z0-9_-]+$/);
export const operationIdSchema = z.string().uuid();

export type NotebookEvent = {
  sequence: number;
  kind: "quote" | "guidance" | "order" | "order_status" | "results";
  operation_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new ApiError(500, `Server environment ${name} is not configured`, "server_configuration");
  return value;
}

export function notebookSupabase(accessToken?: string) {
  return createClient(environment("SUPABASE_URL"), environment("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(accessToken ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } } : {}),
  });
}

export function generateCapabilityToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bearerToken(request: Request, header = "authorization"): string {
  const authorization = request.headers.get(header) ?? "";
  if (!authorization.startsWith("Bearer ")) throw new ApiError(401, "A notebook capability token is required", "invalid_notebook_token");
  return tokenSchema.parse(authorization.slice(7).trim());
}

export function browserToken(request: Request): string {
  return bearerToken(request, "x-clearsignal-notebook-token");
}

export function accessToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
}

export async function assertActiveBrowserSession(sessionId: string, token: string) {
  const supabase = notebookSupabase();
  const { data, error } = await supabase.rpc("get_obsidian_browser_session", {
    p_session_id: sessionIdSchema.parse(sessionId),
    p_browser_token_sha256: await sha256(tokenSchema.parse(token)),
  });
  if (error) throw error;
  return rpcValue<Record<string, unknown>>(data);
}

export async function assertOpenBrowserSession(sessionId: string, token: string) {
  const session = await assertActiveBrowserSession(sessionId, token);
  if (session.status !== "open") throw new ApiError(409, "Notebook session is closing", "notebook_session_closing");
  return session;
}

export async function appendPublicEvent({
  sessionId, token, operationId, kind, payload,
}: {
  sessionId: string;
  token: string;
  operationId: string;
  kind: "quote" | "guidance";
  payload: Record<string, unknown>;
}) {
  const supabase = notebookSupabase();
  const { data, error } = await supabase.rpc("append_obsidian_public_event", {
    p_session_id: sessionIdSchema.parse(sessionId),
    p_browser_token_sha256: await sha256(tokenSchema.parse(token)),
    p_operation_id: operationIdSchema.parse(operationId),
    p_kind: kind,
    p_payload: payload,
  });
  if (error) throw error;
  return rpcValue<NotebookEvent>(data);
}
