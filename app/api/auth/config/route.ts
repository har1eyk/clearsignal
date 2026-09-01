function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function GET() {
  try {
    return Response.json(
      {
        url: requiredEnvironment("SUPABASE_URL"),
        publishableKey: requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Account services are not configured." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
