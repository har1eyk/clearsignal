"use client";

import { useEffect } from "react";

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>) => unknown;
};

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void>;
  };
};

export function AuthWebMCP() {
  useEffect(() => {
    const modelContext = (document as WebMCPDocument).modelContext;
    if (!modelContext?.registerTool) return;
    const controller = new AbortController();
    const tool: WebMCPTool = {
      name: "prepare_clearsignal_sign_in",
      description: "Show ClearSignal sign-in for an endotoxin order and optionally fill the email field. The user enters and submits their password.",
      inputSchema: {
        type: "object",
        properties: { email: { type: "string", format: "email", maxLength: 254 } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: ({ email }) => {
        const url = new URL(window.location.href);
        url.searchParams.set("next", "/user/requests/new");
        history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
        document.querySelector<HTMLButtonElement>('[data-auth-view="sign-in"]')?.click();
        if (typeof email === "string" && email) {
          const field = document.querySelector<HTMLInputElement>("#auth-form input[name='email']");
          if (!field) throw new Error("The email field is unavailable.");
          field.value = email;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.focus();
        }
        return { ready: true, next: "/user/requests/new", password_required_from_user: true };
      },
    };
    modelContext.registerTool(tool, { signal: controller.signal }).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("ClearSignal sign-in tool could not be registered.", error);
    });
    return () => controller.abort();
  }, []);

  return null;
}
