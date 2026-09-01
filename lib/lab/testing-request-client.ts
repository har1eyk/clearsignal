import type { z } from "zod";
import { testingRequestCreateSchema } from "./validation";

export type TestingRequestPayload = z.infer<typeof testingRequestCreateSchema>;
export type CreatedTestingRequest = {
  id: string;
  order_number: string;
  sample_count: number;
  unit_price?: number;
  total?: number;
  currency?: "USD";
  status?: "pending_laboratory_review";
};
export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class TestingRequestClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public details: unknown = null,
  ) {
    super(message);
  }
}
