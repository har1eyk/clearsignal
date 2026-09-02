import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ZodError } from "zod";
import type { LabRole } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
    public details?: unknown,
  ) {
    super(message);
  }
}

export type LabApiContext = {
  requestId: string;
  token: string;
  user: User;
  labId: string;
  role: LabRole;
  supabase: SupabaseClient;
};

function environment(name: string): string {
  const value = process.env[name];
  if (!value) throw new ApiError(500, `Server environment ${name} is not configured`, "server_configuration");
  return value;
}

export function requestIdFor(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 120) || crypto.randomUUID();
}

export async function authorizeLabRequest(request: Request): Promise<LabApiContext> {
  const requestId = requestIdFor(request);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new ApiError(401, "A Supabase bearer token is required", "unauthenticated");
  const token = authorization.slice(7).trim();
  if (!token) throw new ApiError(401, "A Supabase bearer token is required", "unauthenticated");
  const supabase = createClient(environment("SUPABASE_URL"), environment("SUPABASE_PUBLISHABLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}`, "X-Request-Id": requestId } },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) throw new ApiError(401, "The Supabase session is invalid or expired", "unauthenticated");
  const { data: memberships, error: membershipError } = await supabase
    .from("lab_memberships")
    .select("lab_id,role")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .limit(2);
  if (membershipError) throw membershipError;
  if (!memberships?.length) throw new ApiError(403, "The account is not an active laboratory member", "forbidden");
  if (memberships.length > 1) throw new ApiError(409, "Multiple active laboratory memberships are not supported in this prototype", "ambiguous_membership");
  return {
    requestId,
    token,
    user: userData.user,
    labId: memberships[0].lab_id,
    role: memberships[0].role as LabRole,
    supabase,
  };
}

export function requireRole(context: LabApiContext, roles: LabRole[]): void {
  if (!roles.includes(context.role)) throw new ApiError(403, "The account does not have permission for this action", "forbidden");
}

export function idempotencyKey(request: Request, required = false): string | null {
  const value = request.headers.get("idempotency-key")?.trim() ?? null;
  if (required && !value) throw new ApiError(400, "Idempotency-Key header is required", "missing_idempotency_key");
  if (value && (value.length < 8 || value.length > 160)) throw new ApiError(400, "Idempotency-Key must contain 8 to 160 characters", "invalid_idempotency_key");
  return value;
}

export function pagination(request: Request): { limit: number; before: string | null } {
  const url = new URL(request.url);
  const parsedLimit = Number(url.searchParams.get("limit") ?? 50);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) throw new ApiError(400, "limit must be an integer from 1 to 100", "invalid_pagination");
  const before = url.searchParams.get("before");
  if (before && Number.isNaN(Date.parse(before))) throw new ApiError(400, "before must be an ISO timestamp", "invalid_pagination");
  return { limit: parsedLimit, before };
}

export function ok(data: unknown, requestId: string, init?: ResponseInit): Response {
  return Response.json({ data, error: null, requestId }, { ...init, headers: { "cache-control": "no-store", ...(init?.headers ?? {}) } });
}

export function failure(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) return Response.json({ data: null, error: { code: error.code, message: error.message, details: error.details ?? null }, requestId }, { status: error.status, headers: { "cache-control": "no-store" } });
  if (error instanceof ZodError) return Response.json({ data: null, error: { code: "validation_failed", message: "Request validation failed", details: error.flatten() }, requestId }, { status: 400, headers: { "cache-control": "no-store" } });
  const candidate = error as { code?: string; message?: string; details?: string };
  const status = candidate?.code === "42501" ? 403 : ["23505", "55000"].includes(candidate?.code ?? "") ? 409 : 500;
  const message = status === 500 ? "The laboratory backend could not complete the request" : candidate.message ?? "Request failed";
  if (status === 500) console.error("ClearSignal API error", { requestId, error });
  return Response.json({ data: null, error: { code: candidate?.code ?? "internal_error", message, details: status === 500 ? null : candidate.details ?? null }, requestId }, { status, headers: { "cache-control": "no-store" } });
}

export async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON", "invalid_json");
  }
}

export function rpcValue<T>(data: T | T[] | null): T {
  if (Array.isArray(data)) {
    if (!data.length) throw new ApiError(500, "Database function returned no value", "empty_database_result");
    return data[0] as T;
  }
  if (data === null || data === undefined) throw new ApiError(500, "Database function returned no value", "empty_database_result");
  return data;
}
