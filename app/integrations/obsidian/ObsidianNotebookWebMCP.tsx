"use client";

import { useEffect, useState } from "react";
import {
  clearBrowserNotebookSession,
  readBrowserNotebookSession,
  storeBrowserNotebookSession,
  type BrowserNotebookSession,
} from "@/lib/lab/notebook-browser-state";

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, boolean>;
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => unknown | Promise<unknown>;
};
type WebMCPModelContext = { registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void> };
type WebMCPDocument = Document & { modelContext?: WebMCPModelContext };
type PairingStatus = "pairing" | "ready" | "closed" | "invalid" | "unsupported";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, untrustedContentHint: true };

async function notebookCall(session: BrowserNotebookSession, action: "quote" | "guidance", input: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch(`/api/integrations/obsidian/sessions/${encodeURIComponent(session.sessionId)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-ClearSignal-Notebook-Token": `Bearer ${session.browserToken}` },
    body: JSON.stringify({ ...input, operation_id: crypto.randomUUID() }),
    cache: "no-store",
    signal,
  });
  const result = await response.json() as { data?: unknown; error?: { code?: string; message?: string; details?: unknown } };
  if (!response.ok || !result.data) return { ok: false, error: result.error ?? { code: "request_failed", message: "ClearSignal could not complete the request." } };
  return { ok: true, data: result.data };
}

function captureSession(expectedSessionId: string): BrowserNotebookSession | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const browserToken = params.get("browser_token");
  if (browserToken) {
    storeBrowserNotebookSession(expectedSessionId, browserToken);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  const stored = readBrowserNotebookSession();
  return stored?.sessionId === expectedSessionId ? stored : null;
}

export function ObsidianNotebookWebMCP({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<PairingStatus>("pairing");
  const [session, setSession] = useState<BrowserNotebookSession | null>(null);

  useEffect(() => {
    let active = true;
    let captured: BrowserNotebookSession | null = null;
    const check = () => captured && fetch(`/api/integrations/obsidian/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { "X-ClearSignal-Notebook-Token": `Bearer ${captured.browserToken}` }, cache: "no-store",
    }).then((response) => {
      if (!active) return;
      if (response.ok) setStatus("ready");
      else if (response.status === 409 || response.status === 423) {
        clearBrowserNotebookSession();
        setStatus("closed");
      } else setStatus("invalid");
    }).catch(() => { if (active) setStatus("invalid"); });
    void Promise.resolve().then(() => {
      captured = captureSession(sessionId);
      if (!active) return;
      if (!captured) {
        setStatus("invalid");
        return;
      }
      setSession(captured);
      void check();
    });
    const interval = window.setInterval(() => { void check(); }, 5_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [sessionId]);

  useEffect(() => {
    if (!session || status !== "ready") return;
    let active = true;
    let interval = 0;
    let timeout = 0;
    const controller = new AbortController();
    const register = async (modelContext: WebMCPModelContext) => {
      const tools: WebMCPTool[] = [
        {
          name: "quote_endotoxin_tests",
          description: "Get ClearSignal's current public unit price and total for a list of unique sample IDs. This does not create a draft or an order.",
          inputSchema: {
            type: "object",
            properties: {
              sample_ids: { type: "array", minItems: 1, maxItems: 100, items: { type: "string", minLength: 1, maxLength: 120 } },
              currency: { type: "string", enum: ["USD"], default: "USD" },
            },
            required: ["sample_ids"], additionalProperties: false,
          },
          annotations: READ_ONLY,
          execute: (input, options) => notebookCall(session, "quote", input, options?.signal),
        },
        {
          name: "get_endotoxin_service_guidance",
          description: "Return only scientist-reviewed ClearSignal service guidance. If no reviewed answer applies, returns needs_human_review and no operational answer.",
          inputSchema: {
            type: "object",
            properties: {
              question: { type: "string", minLength: 3, maxLength: 2000 },
              sample_type: { type: "string", minLength: 1, maxLength: 200 },
            },
            required: ["question"], additionalProperties: false,
          },
          annotations: READ_ONLY,
          execute: (input, options) => notebookCall(session, "guidance", input, options?.signal),
        },
      ];
      await Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal })));
      if (active) document.documentElement.dataset.obsidianWebmcp = "ready";
    };
    const detect = () => {
      const context = (document as WebMCPDocument).modelContext;
      if (!context?.registerTool) return false;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      void register(context).catch(() => {
        if (active) document.documentElement.dataset.obsidianWebmcp = "error";
      });
      return true;
    };
    if (!detect()) {
      interval = window.setInterval(detect, 250);
      timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        if (active) setStatus("unsupported");
      }, 10_000);
    }
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [session, status]);

  const copy: Record<PairingStatus, { title: string; body: string }> = {
    pairing: { title: "Pairing with your notebook…", body: "Keep this page open while ClearSignal checks the private notebook session." },
    ready: { title: "Notebook paired", body: "Quote and reviewed-guidance tools are available. Ordering becomes available after ClearSignal sign-in and always shows a final price confirmation." },
    closed: { title: "Notebook session closed", body: "This page can no longer read from or write to the notebook record." },
    invalid: { title: "Pairing link unavailable", body: "Return to Obsidian and run the request again to create a new private session." },
    unsupported: { title: "Site tools not detected", body: "Open this page in ChatGPT’s built-in browser and keep the page open during the conversation." },
  };
  return (
    <section className={`obsidian-pairing-card status-${status}`} aria-live="polite">
      <span className="obsidian-pairing-dot" aria-hidden="true" />
      <div><p className="eyebrow">OBSIDIAN LAB NOTEBOOK</p><h2>{copy[status].title}</h2><p>{copy[status].body}</p></div>
    </section>
  );
}
