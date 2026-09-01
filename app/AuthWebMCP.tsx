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

const tools: WebMCPTool[] = [
  {
    name: "get_clearsignal_account_help",
    description: "Explain the available ClearSignal sign-in, sign-up, and password-recovery paths without handling credentials.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => JSON.stringify({
      signIn: "Existing users sign in with their email and password.",
      signUp: "New users create an account with a name, email, and password. Laboratory access may still require approval.",
      recovery: "Users can request a password-reset email.",
      safety: "Passwords and final form submission must remain under the user's direct control.",
    }),
  },
  {
    name: "show_clearsignal_auth_form",
    description: "Show the requested ClearSignal account form. This does not submit anything.",
    inputSchema: {
      type: "object",
      properties: { view: { type: "string", enum: ["sign-in", "sign-up", "forgot-password"] } },
      required: ["view"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: ({ view }) => {
      const button = document.querySelector<HTMLButtonElement>(`[data-auth-view="${String(view)}"]`);
      if (!button) throw new Error("That account form is not available on this page.");
      button.click();
      return `Showing the ${String(view)} form. The user must enter their password and submit it themselves.`;
    },
  },
  {
    name: "prepare_clearsignal_account_email",
    description: "Fill only the non-sensitive email field in the visible ClearSignal account form for the user to review. This never fills a password or submits the form.",
    inputSchema: {
      type: "object",
      properties: { email: { type: "string", format: "email", maxLength: 254 } },
      required: ["email"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: ({ email }) => {
      const field = document.querySelector<HTMLInputElement>("#auth-form input[name='email']");
      if (!field) throw new Error("The email field is not available on this page.");
      field.value = String(email);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus();
      return "The email field is prepared. The user must enter their password, review the form, and submit it themselves.";
    },
  },
];

export function AuthWebMCP() {
  useEffect(() => {
    const modelContext = (document as WebMCPDocument).modelContext;
    if (!modelContext?.registerTool) return;
    const controller = new AbortController();
    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("ClearSignal account tools could not be registered.", error);
    });
    return () => controller.abort();
  }, []);

  return null;
}
