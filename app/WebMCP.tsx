"use client";

import { useEffect } from "react";

type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type WebMCPModelContext = {
  registerTool: (
    tool: WebMCPTool,
    options?: { signal?: AbortSignal },
  ) => Promise<void>;
};

type WebMCPDocument = Document & { modelContext?: WebMCPModelContext };

const sections = {
  technology: "Technology and endotoxin background",
  workflow: "Five-step testing workflow",
  performance: "Illustrative performance evidence",
  applications: "Application and sample-type fit",
  quality: "Quality and implementation resources",
  faq: "Frequently asked questions about endotoxin testing",
} as const;

const workflow = [
  { step: 1, name: "Prepare", detail: "Identify, dilute, and document the sample." },
  { step: 2, name: "Load", detail: "Add the validated test reagent or cartridge." },
  { step: 3, name: "React", detail: "Run the specified kinetic or endpoint method." },
  { step: 4, name: "Quantify", detail: "Compare the response with controls and standards." },
  { step: 5, name: "Review", detail: "Assess validity, approve, and export the result." },
];

const applicationGuidance = [
  { keywords: ["biologic", "drug substance", "drug product", "protein"], area: "Biologics", fit: "In-process and finished-product samples" },
  { keywords: ["cell", "gene", "vector", "therapy"], area: "Cell & gene therapy", fit: "Complex matrices and limited sample volumes" },
  { keywords: ["vaccine"], area: "Vaccines", fit: "Process development through release" },
  { keywords: ["device", "implant", "extract"], area: "Medical devices", fit: "Extraction-based test workflows" },
  { keywords: ["water", "raw material", "excipient", "incoming"], area: "Raw materials & water", fit: "Incoming and routine monitoring" },
];

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const tools: WebMCPTool[] = [
  {
    name: "get_clearsignal_overview",
    description: "Get a concise, factual overview of ClearSignal's endotoxin-testing product concept, intended users, and important evidence limitations.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => json({
      product: "ClearSignal",
      category: "Endotoxin-testing workflow product concept",
      purpose: "Connect sample preparation, measurement, controls, interpretation, and reporting in one traceable workflow.",
      intendedTeams: ["Pharmaceutical", "Biotechnology", "Medical device", "Quality and analytical operations"],
      importantLimitation: "Performance values on this concept site are placeholders. Validate final claims, compendial alignment, and intended-use statements for the actual product configuration before relying on them.",
    }),
  },
  {
    name: "get_endotoxin_workflow",
    description: "Return ClearSignal's five-stage sample-to-answer workflow and its validation caveat.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => json({
      workflow,
      caveat: "This sequence is illustrative and must be adapted to the validated instrument, reagent, cartridge, or service configuration.",
    }),
  },
  {
    name: "find_application_fit",
    description: "Match a sample or application description to the closest ClearSignal use-case category. This is directional product guidance, not a regulatory or method-suitability determination.",
    inputSchema: {
      type: "object",
      properties: {
        sampleType: { type: "string", description: "Plain-language sample or application, such as biologic drug substance, water, or medical device extract.", minLength: 2, maxLength: 160 },
        currentMethod: { type: "string", description: "Optional current endotoxin test method.", enum: ["Gel-clot", "Chromogenic", "Turbidimetric", "Recombinant factor C", "Other / evaluating"] },
      },
      required: ["sampleType"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: ({ sampleType, currentMethod }) => {
      const normalized = String(sampleType).toLowerCase();
      const match = applicationGuidance.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
      return json({
        sampleType,
        currentMethod: currentMethod ?? "Not provided",
        closestFit: match ? { area: match.area, typicalUse: match.fit } : { area: "Needs application review", typicalUse: "Discuss the product matrix, process stage, sample volume, and method requirements with an applications scientist." },
        nextStep: "Review the FAQ section for general guidance, then use Order Testing to submit sample details for laboratory review.",
        caveat: "Confirm method suitability, interference controls, acceptance criteria, and regulatory requirements for the actual sample and intended use.",
      });
    },
  },
  {
    name: "navigate_clearsignal_page",
    description: "Move the visible page to a named ClearSignal section and return what that section covers.",
    inputSchema: {
      type: "object",
      properties: { section: { type: "string", enum: Object.keys(sections), description: "Page section to show." } },
      required: ["section"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: ({ section }) => {
      const sectionName = String(section) as keyof typeof sections;
      const target = document.getElementById(sectionName);
      if (!target || !(sectionName in sections)) throw new Error("That ClearSignal section is not available.");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${sectionName}`);
      return `Showing ${sectionName}: ${sections[sectionName]}.`;
    },
  },
];

export function WebMCP() {
  useEffect(() => {
    const modelContext = (document as WebMCPDocument).modelContext;
    if (!modelContext?.registerTool) return;

    const controller = new AbortController();
    Promise.all(tools.map((tool) => modelContext.registerTool(tool, { signal: controller.signal }))).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("ClearSignal WebMCP tools could not be registered.", error);
    });

    return () => controller.abort();
  }, []);

  return null;
}
