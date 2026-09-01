"use client";

import { useEffect } from "react";
import { z } from "zod";
import { createTestingRequest, TestingRequestClientError, type CreatedTestingRequest, type TestingRequestPayload } from "@/lib/lab/testing-request-client";
import { testingRequestCreateSchema } from "@/lib/lab/validation";

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
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type WebMCPDocument = Document & {
  modelContext?: {
    registerTool(tool: WebMCPTool, options?: { signal?: AbortSignal }): Promise<void>;
  };
};

const sampleProperties = {
  external_id: { type: "string", description: "Laboratory-unique sample identifier.", minLength: 1, maxLength: 120 },
  kind: { type: "string", enum: ["original", "aliquot", "pool"], default: "original" },
  product_name: { type: "string", maxLength: 240 },
  product_lot: { type: "string", maxLength: 120 },
  matrix: { type: "string", description: "Physical or product matrix, such as protein solution or water.", minLength: 1, maxLength: 240 },
  process_stage: { type: "string", maxLength: 160 },
  collected_at: { type: "string", format: "date-time", description: "ISO 8601 collection timestamp with timezone offset." },
  collected_by: { type: "string", maxLength: 160 },
  storage_condition: { type: "string", maxLength: 240 },
  quantity: { type: "number", minimum: 0 },
  quantity_unit: { type: "string", enum: ["mL", "µL", "g", "mg", "units"] },
};

const requestProperties = {
  client_name: { type: "string", description: "Optional client or organization name.", maxLength: 240 },
  project_name: { type: "string", minLength: 1, maxLength: 240 },
  purpose: { type: "string", minLength: 1, maxLength: 2000 },
  samples: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: {
      type: "object",
      properties: sampleProperties,
      required: ["external_id", "matrix"],
      additionalProperties: false,
    },
  },
};

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parsedPayload(labId: string, input: Record<string, unknown>): TestingRequestPayload {
  const request = { ...input };
  delete request.submission_key;
  return testingRequestCreateSchema.parse({ lab_id: labId, ...request });
}

function failure(error: unknown) {
  if (error instanceof TestingRequestClientError) {
    return json({ ok: false, error: { code: error.code, message: error.message, details: error.details } });
  }
  if (error instanceof z.ZodError) {
    return json({
      ok: false,
      error: {
        code: "validation_failed",
        message: "Testing request validation failed",
        details: { issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
      },
    });
  }
  return json({ ok: false, error: { code: "request_failed", message: error instanceof Error ? error.message : "Request failed" } });
}

export function TestingRequestWebMCP({
  accessToken,
  labId,
  onPrepare,
  onCreated,
}: {
  accessToken: string;
  labId: string;
  onPrepare: (payload: TestingRequestPayload) => void;
  onCreated: (created: CreatedTestingRequest) => void;
}) {
  useEffect(() => {
    const modelContext = (document as WebMCPDocument).modelContext;
    if (!modelContext?.registerTool) return;
    const controller = new AbortController();

    const tools: WebMCPTool[] = [
      {
        name: "get_testing_request_requirements",
        description: "Return the fields and workflow requirements for a ClearSignal endotoxin testing request. This does not change or submit the form.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false, untrustedContentHint: false },
        execute: () => json({
          request: { required: ["project_name", "purpose", "samples"], optional: ["client_name"] },
          sample: { required: ["external_id", "matrix"], optional: ["kind", "product_name", "product_lot", "process_stage", "collected_at", "collected_by", "storage_condition", "quantity", "quantity_unit"] },
          sampleKinds: ["original", "aliquot", "pool"],
          quantityUnits: ["mL", "µL", "g", "mg", "units"],
          constraints: ["At least one sample is required.", "Sample IDs must be unique within the laboratory.", "Quantity and quantity unit must be supplied together."],
          workflow: "The laboratory assigns the endotoxin limit and maximum valid dilution after request submission and before assay execution.",
        }),
      },
      {
        name: "prepare_testing_request",
        description: "Validate and place a multi-sample endotoxin testing request into the visible form for review. This does not submit or create any records.",
        inputSchema: { type: "object", properties: requestProperties, required: ["project_name", "purpose", "samples"], additionalProperties: false },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false, untrustedContentHint: false },
        execute: (input) => {
          try {
            const payload = parsedPayload(labId, input);
            onPrepare(payload);
            return json({ ok: true, prepared: true, sample_count: payload.samples.length, message: "The visible form is prepared for review; no request has been submitted." });
          } catch (error) {
            return failure(error);
          }
        },
      },
      {
        name: "submit_testing_request",
        description: "Create an authenticated multi-sample endotoxin testing request immediately. This is an external side effect and must only be called after the user confirms the exact request and samples at action time.",
        inputSchema: {
          type: "object",
          properties: {
            ...requestProperties,
            submission_key: { type: "string", description: "Stable unique key for this intended submission; reuse it for retries.", minLength: 8, maxLength: 160 },
          },
          required: ["project_name", "purpose", "samples", "submission_key"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false, untrustedContentHint: false },
        execute: async (input) => {
          try {
            const payload = parsedPayload(labId, input);
            const created = await createTestingRequest({ accessToken, payload, submissionKey: String(input.submission_key ?? "") });
            onCreated(created);
            return json({ ok: true, request: { ...created, status: "pending_laboratory_review" } });
          } catch (error) {
            return failure(error);
          }
        },
      },
    ];

    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("ClearSignal testing-request tools could not be registered.", error);
    });
    return () => controller.abort();
  }, [accessToken, labId, onCreated, onPrepare]);

  return null;
}
