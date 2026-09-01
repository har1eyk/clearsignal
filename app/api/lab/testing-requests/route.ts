import { ApiError, failure, requestIdFor } from "@/lib/lab/api";

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  try {
    throw new ApiError(
      410,
      "Direct order creation is retired. Request a server quote and confirm its signed price intent.",
      "priced_confirmation_required",
    );
  } catch (error) {
    return failure(error, requestId);
  }
}
