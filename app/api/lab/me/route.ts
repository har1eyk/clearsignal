import { authorizeLabRequest, failure, ok, requestIdFor } from "@/lib/lab/api";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);
  try {
    const context = await authorizeLabRequest(request);
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("user_id,email,display_name")
      .eq("user_id", context.user.id)
      .single();
    if (profileError) throw profileError;
    const { data: lab, error: labError } = await context.supabase
      .from("laboratories")
      .select("id,name,created_at")
      .eq("id", context.labId)
      .single();
    if (labError) throw labError;
    return ok({ user: profile, laboratory: lab, role: context.role }, context.requestId);
  } catch (error) {
    return failure(error, requestId);
  }
}

