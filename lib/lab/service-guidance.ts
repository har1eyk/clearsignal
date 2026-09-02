import { z } from "zod";

export const guidanceTopics = ["preparation", "volume", "containers", "storage", "shipping", "turnaround", "method", "ordering"] as const;
export type GuidanceTopic = typeof guidanceTopics[number];

export type ReviewedGuidanceEntry = {
  topic: GuidanceTopic;
  version: string;
  effective_date: string;
  reviewer: string;
  answer: string;
  limitations: string[];
  source_url: string;
  sample_types?: string[];
};

// Operational answers intentionally remain empty until ClearSignal loads a scientist-approved guide.
// This prevents the site tool from inventing vendor-specific handling instructions.
export const REVIEWED_GUIDANCE_CATALOG: readonly ReviewedGuidanceEntry[] = [];
export const GUIDANCE_CATALOG_VERSION = "awaiting-scientific-review";

export const guidanceInputSchema = z.object({
  question: z.string().trim().min(3).max(2_000),
  sample_type: z.string().trim().min(1).max(200).optional(),
  operation_id: z.string().uuid().optional(),
});

const keywordTopics: Array<[GuidanceTopic, RegExp]> = [
  ["preparation", /prepar|dilut|reconstitut/i],
  ["volume", /volume|amount|how much/i],
  ["containers", /container|tube|vial|bottle/i],
  ["storage", /stor|temperatur|freeze|refriger/i],
  ["shipping", /ship|packag|courier|ice/i],
  ["turnaround", /turnaround|how long|timing|result/i],
  ["method", /method|assay|lal|recombinant|kinetic/i],
  ["ordering", /order|request|submit/i],
];

export function reviewedGuidance(question: string, sampleType?: string) {
  const topic = keywordTopics.find(([, pattern]) => pattern.test(question))?.[0] ?? null;
  const entry = topic ? REVIEWED_GUIDANCE_CATALOG.find((candidate) => {
    if (candidate.topic !== topic) return false;
    if (!candidate.sample_types?.length || !sampleType) return true;
    return candidate.sample_types.some((value) => value.toLocaleLowerCase() === sampleType.toLocaleLowerCase());
  }) : undefined;

  if (!entry) {
    return {
      status: "needs_human_review" as const,
      topic,
      catalog_version: GUIDANCE_CATALOG_VERSION,
      answer: null,
      limitations: ["No scientist-reviewed ClearSignal answer is loaded for this question."],
      source_url: null,
      reviewed_at: null,
    };
  }
  return { status: "reviewed" as const, ...entry };
}
