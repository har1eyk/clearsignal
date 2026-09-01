"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { confirmEndotoxinOrder, previewEndotoxinOrder } from "@/lib/lab/endotoxin-order-client";
import { endotoxinOrderInputSchema, orderFingerprint, type EndotoxinOrderPreview } from "@/lib/lab/endotoxin-order";
import { TestingRequestClientError, type CreatedTestingRequest } from "@/lib/lab/testing-request-client";

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

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void>;
  };
};

type ConfirmationState = {
  preview: EndotoxinOrderPreview;
  resolve: (approved: boolean) => void;
};

const PENDING_ORDER_KEY = "clearsignal.webmcp.pending-order";

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
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
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
    const stored = sessionStorage.getItem(PENDING_ORDER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { fingerprint?: string; preview?: EndotoxinOrderPreview };
    if (parsed.fingerprint !== fingerprint || !parsed.preview || Date.parse(parsed.preview.expires_at) <= Date.now()) {
      sessionStorage.removeItem(PENDING_ORDER_KEY);
      return null;
    }
    return parsed.preview;
  } catch {
    sessionStorage.removeItem(PENDING_ORDER_KEY);
    return null;
  }
}

function cachePreview(fingerprint: string, preview: EndotoxinOrderPreview) {
  sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ fingerprint, preview }));
}

function clearCachedPreview() {
  sessionStorage.removeItem(PENDING_ORDER_KEY);
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function TestingRequestWebMCP({
  accessToken,
  laboratory,
  onCreated,
}: {
  accessToken: string;
  laboratory: string;
  onCreated: (created: CreatedTestingRequest) => void;
}) {
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const confirmationRef = useRef<ConfirmationState | null>(null);
  const approveButtonRef = useRef<HTMLButtonElement | null>(null);

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
    if (confirmation) approveButtonRef.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") settleConfirmation(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmation, settleConfirmation]);

  useEffect(() => {
    const modelContext = (document as WebMCPDocument).modelContext;
    if (!modelContext?.registerTool) return;
    const controller = new AbortController();

    const tool: WebMCPTool = {
      name: "order_endotoxin_tests",
      description: "Price and order the standard endotoxin test for sample IDs. ClearSignal enforces the strict per-test limit, shows one confirmation, then creates the order.",
      inputSchema: {
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
        required: ["sample_ids", "spend_less_than_each"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        untrustedContentHint: true,
      },
      execute: async (rawInput, options) => {
        try {
          const input = endotoxinOrderInputSchema.parse(rawInput);
          const fingerprint = orderFingerprint(input);
          let preview = readCachedPreview(fingerprint);
          if (!preview) {
            preview = await previewEndotoxinOrder({ accessToken, input, signal: options?.signal });
            cachePreview(fingerprint, preview);
          }

          const approved = await requestConfirmation(preview, options?.signal);
          if (!approved) {
            clearCachedPreview();
            return { ok: false, error: { code: "confirmation_declined", message: "The user declined the priced order." } };
          }

          const created = await confirmEndotoxinOrder({ accessToken, intent: preview.intent, signal: options?.signal });
          clearCachedPreview();
          onCreated(created);
          return {
            ok: true,
            order_number: created.order_number,
            sample_count: created.sample_count,
            unit_price: created.unit_price,
            total: created.total,
            currency: created.currency,
            status: created.status,
          };
        } catch (error) {
          if (error instanceof TestingRequestClientError && ["price_intent_expired", "catalog_changed", "invalid_price_intent"].includes(error.code)) {
            clearCachedPreview();
          }
          return failure(error);
        }
      },
    };

    modelContext.registerTool(tool, { signal: controller.signal }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("ClearSignal ordering tool could not be registered.", error);
    });
    return () => controller.abort();
  }, [accessToken, onCreated, requestConfirmation]);

  if (!confirmation) return null;
  const { preview } = confirmation;
  return (
    <div className="order-confirmation-backdrop" role="presentation">
      <section className="order-confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="order-confirmation-title" aria-describedby="order-confirmation-description">
        <p className="eyebrow">PRICED ORDER</p>
        <h2 id="order-confirmation-title">Confirm this endotoxin order.</h2>
        <p id="order-confirmation-description">ClearSignal verified that the unit price is strictly below your limit. No order exists until you approve.</p>
        <dl>
          <div><dt>Laboratory</dt><dd>{preview.laboratory || laboratory}</dd></div>
          <div><dt>Service</dt><dd>{preview.service}</dd></div>
          <div><dt>Samples</dt><dd>{preview.sample_ids.join(" / ")}</dd></div>
          <div><dt>Price per test</dt><dd>{money(preview.unit_price, preview.currency)}</dd></div>
          <div><dt>Strict limit</dt><dd>Less than {money(preview.spend_less_than_each, preview.currency)}</dd></div>
          <div><dt>Order total</dt><dd>{money(preview.total, preview.currency)}</dd></div>
        </dl>
        <p className="order-confirmation-note">Sample matrix and assay specifications may be completed during laboratory review before testing starts.</p>
        <div className="order-confirmation-actions">
          <button type="button" className="button button-cream" onClick={() => settleConfirmation(false)}>Cancel</button>
          <button ref={approveButtonRef} type="button" className="button button-amber" onClick={() => settleConfirmation(true)}>Confirm &amp; order <span aria-hidden="true">→</span></button>
        </div>
      </section>
    </div>
  );
}
