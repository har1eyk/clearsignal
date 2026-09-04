"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { z } from "zod";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { getEndotoxinFaqResponse } from "@/lib/marketing-faq";
import { confirmEndotoxinOrder, previewEndotoxinOrder } from "@/lib/lab/endotoxin-order-client";
import {
  endotoxinOrderInputSchema,
  orderFingerprint,
  type CreatedEndotoxinOrder,
  type EndotoxinOrderInput,
  type EndotoxinOrderPreview,
} from "@/lib/lab/endotoxin-order";
import { TestingRequestClientError } from "@/lib/lab/testing-request-client";
import { readBrowserNotebookSession } from "@/lib/lab/notebook-browser-state";
import {
  createPendingOrder,
  ORDER_CREATED_EVENT,
  parsePendingOrder,
  PENDING_ORDER_INPUT_KEY,
  PENDING_ORDER_PREVIEW_KEY,
} from "@/lib/lab/webmcp-order-state";
import { TestingRequestPriceConfirmation } from "./TestingRequestPriceConfirmation";

type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
  untrustedContentHint?: boolean;
};

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>;
};

type WebMCPModelContext = {
  registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void>;
};

type WebMCPDocument = Document & { modelContext?: WebMCPModelContext };

type Membership = {
  user: { display_name: string | null; email: string | null };
  laboratory: { id: string; name: string };
  role: string;
};

type OrderingAccess =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "active"; session: Session; membership: Membership }
  | { status: "laboratory_access_required" }
  | { status: "unavailable"; message: string };

type ConfirmationState = {
  preview: EndotoxinOrderPreview;
  resolve: (approved: boolean) => void;
};

type OrderNotice =
  | { kind: "success"; order: CreatedEndotoxinOrder }
  | { kind: "error"; message: string };

const ORDER_INPUT_SCHEMA = {
  type: "object",
  properties: {
    sample_ids: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 120 },
      description: "Laboratory-unique sample IDs to test.",
    },
    spend_less_than_each: {
      type: "number",
      exclusiveMinimum: 0,
      description: "The unit price must be strictly below this amount.",
    },
    currency: { type: "string", enum: ["USD"], default: "USD" },
  },
  required: ["sample_ids"],
  additionalProperties: false,
};

const MUTATING_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  untrustedContentHint: true,
};

const FAQ_INPUT_SCHEMA = {
  type: "object",
  properties: {
    question: {
      type: "string",
      minLength: 2,
      maxLength: 500,
      description: "Optional customer question to match against ClearSignal's published endotoxin FAQs.",
    },
  },
  additionalProperties: false,
};

const READ_ONLY_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  untrustedContentHint: false,
};

const CUSTOMER_ORDER_STATUS = "order_submitted" as const;

async function getNotebookAwareFaqResponse(question: unknown, signal?: AbortSignal) {
  const notebook = readBrowserNotebookSession();
  if (!notebook) return getEndotoxinFaqResponse(question);
  const response = await fetch(`/api/integrations/obsidian/sessions/${encodeURIComponent(notebook.sessionId)}/faq`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ClearSignal-Notebook-Token": `Bearer ${notebook.browserToken}`,
    },
    body: JSON.stringify({ ...(question === undefined ? {} : { question }), operation_id: crypto.randomUUID() }),
    cache: "no-store",
    signal,
  });
  const result = await response.json() as { data?: unknown; error?: { code?: string; message?: string; details?: unknown } };
  if (!response.ok || !result.data) {
    return { ok: false, error: result.error ?? { code: "request_failed", message: "ClearSignal could not check its published FAQs." } };
  }
  return result.data;
}

function failure(error: unknown) {
  if (error instanceof TestingRequestClientError) {
    return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
  }
  if (error instanceof z.ZodError) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "The order instruction is invalid.",
        details: error.issues.slice(0, 5).map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return { ok: false, error: { code: "cancelled", message: "The order operation was cancelled." } };
  }
  return { ok: false, error: { code: "request_failed", message: error instanceof Error ? error.message : "The order failed." } };
}

function readCachedPreview(fingerprint: string): EndotoxinOrderPreview | null {
  try {
    const stored = sessionStorage.getItem(PENDING_ORDER_PREVIEW_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { fingerprint?: string; preview?: EndotoxinOrderPreview };
    if (parsed.fingerprint !== fingerprint || !parsed.preview || Date.parse(parsed.preview.expires_at) <= Date.now()) {
      sessionStorage.removeItem(PENDING_ORDER_PREVIEW_KEY);
      return null;
    }
    return parsed.preview;
  } catch {
    sessionStorage.removeItem(PENDING_ORDER_PREVIEW_KEY);
    return null;
  }
}

function cachePreview(fingerprint: string, preview: EndotoxinOrderPreview) {
  sessionStorage.setItem(PENDING_ORDER_PREVIEW_KEY, JSON.stringify({ fingerprint, preview }));
}

function clearBrowserOrderState() {
  sessionStorage.removeItem(PENDING_ORDER_INPUT_KEY);
  sessionStorage.removeItem(PENDING_ORDER_PREVIEW_KEY);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function ClearSignalWebMCP() {
  const [modelContext, setModelContext] = useState<WebMCPModelContext | null>(null);
  const [access, setAccess] = useState<OrderingAccess>({ status: "checking" });
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [notice, setNotice] = useState<OrderNotice | null>(null);
  const confirmationRef = useRef<ConfirmationState | null>(null);
  const operationRef = useRef(false);
  const resumedOrderRef = useRef("");

  const settleConfirmation = useCallback((approved: boolean) => {
    const pending = confirmationRef.current;
    if (!pending) return;
    confirmationRef.current = null;
    setConfirmation(null);
    pending.resolve(approved);
  }, []);

  const requestConfirmation = useCallback((preview: EndotoxinOrderPreview, signal?: AbortSignal) => {
    if (confirmationRef.current) return Promise.reject(new Error("Another order confirmation is already open."));
    return new Promise<boolean>((resolve) => {
      const pending = { preview, resolve };
      confirmationRef.current = pending;
      setConfirmation(pending);
      signal?.addEventListener("abort", () => settleConfirmation(false), { once: true });
    });
  }, [settleConfirmation]);

  useEffect(() => () => {
    if (confirmationRef.current) confirmationRef.current.resolve(false);
    confirmationRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    let detected = false;
    let interval = 0;
    let timeout = 0;
    const root = document.documentElement;
    root.dataset.webmcpStatus = "registering";

    const detect = () => {
      const candidate = (document as WebMCPDocument).modelContext;
      if (!active || detected || !candidate?.registerTool) return false;
      detected = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      setModelContext(candidate);
      return true;
    };
    const detectWhenVisible = () => {
      if (document.visibilityState === "visible") detect();
    };

    if (!detect()) {
      interval = window.setInterval(detect, 250);
      timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (!detected) root.dataset.webmcpStatus = "unsupported";
      }, 10_000);
      window.addEventListener("pageshow", detect);
      window.addEventListener("focus", detect);
      document.addEventListener("visibilitychange", detectWhenVisible);
    }

    return () => {
      active = false;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      window.removeEventListener("pageshow", detect);
      window.removeEventListener("focus", detect);
      document.removeEventListener("visibilitychange", detectWhenVisible);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe: () => void = () => {};

    const resolveAccess = async (session: Session | null) => {
      const currentGeneration = ++generation;
      if (!session) {
        if (active) setAccess((current) => current.status === "unauthenticated" ? current : { status: "unauthenticated" });
        return;
      }
      try {
        const response = await fetch("/api/lab/me", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        const body = await response.json() as { data?: Membership; error?: { message?: string } };
        if (!active || currentGeneration !== generation) return;
        if (response.ok && body.data) {
          const membership = body.data;
          setAccess((current) => (
            current.status === "active"
            && current.session.access_token === session.access_token
            && current.membership.laboratory.id === membership.laboratory.id
          ) ? current : { status: "active", session, membership });
        }
        else if (response.status === 401) setAccess((current) => current.status === "unauthenticated" ? current : { status: "unauthenticated" });
        else if (response.status === 403) setAccess((current) => current.status === "laboratory_access_required" ? current : { status: "laboratory_access_required" });
        else setAccess({ status: "unavailable", message: body.error?.message ?? "Laboratory access could not be checked." });
      } catch (error) {
        if (active && currentGeneration === generation) {
          setAccess({ status: "unavailable", message: error instanceof Error ? error.message : "Laboratory access could not be checked." });
        }
      }
    };

    getBrowserSupabase().then(async (supabase) => {
      if (!active) return;
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") clearBrowserOrderState();
        void resolveAccess(session);
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      const { data } = await supabase.auth.getSession();
      await resolveAccess(data.session);
    }).catch((error) => {
      if (active) setAccess({ status: "unavailable", message: error instanceof Error ? error.message : "Account services are unavailable." });
    });

    return () => {
      active = false;
      generation += 1;
      unsubscribe();
    };
  }, []);

  const executeOrder = useCallback(async (rawInput: Record<string, unknown> | EndotoxinOrderInput, signal?: AbortSignal) => {
    if (access.status !== "active") {
      return { ok: false, error: { code: "authentication_required", message: "Sign in with active laboratory access before ordering." } };
    }
    if (operationRef.current) {
      return { ok: false, error: { code: "order_in_progress", message: "Another endotoxin order is already in progress." } };
    }
    operationRef.current = true;
    setNotice(null);
    try {
      const input = endotoxinOrderInputSchema.parse(rawInput);
      const fingerprint = orderFingerprint(input);
      let preview = readCachedPreview(fingerprint);
      if (!preview) {
        preview = await previewEndotoxinOrder({
          accessToken: access.session.access_token,
          labId: access.membership.laboratory.id,
          input,
          signal,
        });
        cachePreview(fingerprint, preview);
      }

      const approved = await requestConfirmation(preview, signal);
      if (!approved) {
        sessionStorage.removeItem(PENDING_ORDER_PREVIEW_KEY);
        return { ok: false, error: { code: "confirmation_declined", message: "The user declined the priced order." } };
      }

      const notebook = readBrowserNotebookSession();
      const created = await confirmEndotoxinOrder({
        accessToken: access.session.access_token,
        intent: preview.intent,
        ...(notebook ? { notebookSession: { ...notebook, operationId: preview.quote_id } } : {}),
        signal,
      });
      clearBrowserOrderState();
      setNotice({ kind: "success", order: created });
      window.dispatchEvent(new CustomEvent(ORDER_CREATED_EVENT, { detail: created }));
      return {
        ok: true,
        order_number: created.order_number,
        sample_count: created.sample_count,
        unit_price: created.unit_price,
        total: created.total,
        currency: created.currency,
        status: CUSTOMER_ORDER_STATUS,
      };
    } catch (error) {
      if (error instanceof TestingRequestClientError && ["price_intent_expired", "catalog_changed", "invalid_price_intent", "price_cap_exceeded"].includes(error.code)) {
        sessionStorage.removeItem(PENDING_ORDER_PREVIEW_KEY);
      }
      return failure(error);
    } finally {
      operationRef.current = false;
    }
  }, [access, requestConfirmation]);

  useEffect(() => {
    if (access.status !== "active") return;
    const stored = sessionStorage.getItem(PENDING_ORDER_INPUT_KEY);
    if (!stored) return;
    const pending = parsePendingOrder(stored);
    if (!pending) {
      sessionStorage.removeItem(PENDING_ORDER_INPUT_KEY);
      return;
    }
    const resumeKey = `${access.session.user.id}:${pending.created_at}`;
    if (resumedOrderRef.current === resumeKey) return;
    resumedOrderRef.current = resumeKey;
    sessionStorage.removeItem(PENDING_ORDER_INPUT_KEY);
    const controller = new AbortController();
    void executeOrder(pending.input, controller.signal).then((result) => {
      if (!result.ok && "error" in result && result.error.code !== "confirmation_declined" && result.error.code !== "cancelled") {
        setNotice({ kind: "error", message: result.error.message });
      }
    });
    return () => controller.abort();
  }, [access, executeOrder]);

  useEffect(() => {
    if (!modelContext) return;
    const controller = new AbortController();
    const root = document.documentElement;
    root.dataset.webmcpStatus = "registering";

    const faqTool: WebMCPTool = {
      name: "get_endotoxin_faqs",
      description: "Return all published ClearSignal endotoxin FAQs, or match one customer question to a published answer. Unmatched questions never receive a guessed answer.",
      inputSchema: FAQ_INPUT_SCHEMA,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
      execute: ({ question }, options) => getNotebookAwareFaqResponse(question, options?.signal),
    };

    const orderTool: WebMCPTool | null = access.status === "checking" ? null : access.status === "active" ? {
      name: "order_endotoxin_tests",
      description: "Price and order the standard endotoxin test for sample IDs. ClearSignal enforces the strict per-test limit, asks for confirmation, and creates one order.",
      inputSchema: ORDER_INPUT_SCHEMA,
      annotations: MUTATING_TOOL_ANNOTATIONS,
      execute: (input, options) => executeOrder(input, options?.signal),
    } : {
      name: "start_endotoxin_order",
      description: "Preserve an endotoxin order request and open ClearSignal sign-in. After authentication, ClearSignal prices the order and asks for confirmation.",
      inputSchema: ORDER_INPUT_SCHEMA,
      annotations: MUTATING_TOOL_ANNOTATIONS,
      execute: (rawInput) => {
        try {
          const input = endotoxinOrderInputSchema.parse(rawInput);
          if (access.status === "laboratory_access_required") {
            return { ok: false, error: { code: "laboratory_access_required", message: "An active laboratory membership is required before ordering." } };
          }
          if (access.status === "unavailable") {
            return { ok: false, error: { code: "laboratory_access_unavailable", message: access.message } };
          }
          sessionStorage.setItem(PENDING_ORDER_INPUT_KEY, JSON.stringify(createPendingOrder(input)));
          const notebook = readBrowserNotebookSession();
          const next = notebook ? `/integrations/obsidian?session=${encodeURIComponent(notebook.sessionId)}` : "/user/requests/new";
          const destination = `/login?next=${encodeURIComponent(next)}&reason=order_required`;
          if (window.location.pathname === "/login") {
            history.replaceState(null, "", destination);
            document.querySelector<HTMLButtonElement>('[data-auth-view="sign-in"]')?.click();
            document.querySelector<HTMLInputElement>("#auth-form input[name='email']")?.focus();
          } else {
            window.setTimeout(() => window.location.assign(destination), 0);
          }
          return { ok: true, status: "authentication_required", next, order_intent_preserved: true };
        } catch (error) {
          return failure(error);
        }
      },
    };

    const tools = orderTool ? [faqTool, orderTool] : [faqTool];

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).then(() => {
      if (controller.signal.aborted) return;
      root.dataset.webmcpStatus = "ready";
      root.dataset.webmcpTool = orderTool?.name ?? faqTool.name;
      root.dataset.webmcpTools = tools.map(({ name }) => name).join(",");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      root.dataset.webmcpStatus = "error";
      delete root.dataset.webmcpTool;
      delete root.dataset.webmcpTools;
      console.warn("ClearSignal WebMCP tools could not be registered.", error);
    });

    return () => {
      controller.abort();
      delete root.dataset.webmcpTool;
      delete root.dataset.webmcpTools;
    };
  }, [access, executeOrder, modelContext]);

  return (
    <>
      {confirmation && (
        <TestingRequestPriceConfirmation
          preview={confirmation.preview}
          laboratory={confirmation.preview.laboratory}
          onCancel={() => settleConfirmation(false)}
          onConfirm={() => settleConfirmation(true)}
        />
      )}
      {notice && (
        <div className="global-order-result-backdrop" role="presentation">
          <section className="global-order-result" role="dialog" aria-modal="true" aria-live="polite" aria-labelledby="global-order-result-title">
            <p className="eyebrow">{notice.kind === "success" ? "ORDER RECEIVED" : "ORDER NOT CREATED"}</p>
            <h2 id="global-order-result-title">{notice.kind === "success" ? "Your endotoxin tests are ordered." : "ClearSignal could not continue."}</h2>
            {notice.kind === "success" ? (
              <dl>
                <div><dt>Order number</dt><dd>{notice.order.order_number}</dd></div>
                <div><dt>Samples</dt><dd>{notice.order.sample_count}</dd></div>
                <div><dt>Price per test</dt><dd>{money(notice.order.unit_price, notice.order.currency)}</dd></div>
                <div><dt>Order total</dt><dd>{money(notice.order.total, notice.order.currency)}</dd></div>
                <div><dt>Status</dt><dd>Order submitted</dd></div>
              </dl>
            ) : <p>{notice.message}</p>}
            <button type="button" className="button button-amber" onClick={() => setNotice(null)}>Close</button>
          </section>
        </div>
      )}
    </>
  );
}
