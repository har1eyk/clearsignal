"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/lab/database.types";

let browserClient: Promise<SupabaseClient<Database>> | null = null;

export function getBrowserSupabase(): Promise<SupabaseClient<Database>> {
  if (typeof window === "undefined") throw new Error("Account services are only available in the browser.");
  if (!browserClient) {
    browserClient = fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => {
        const config = await response.json() as { url?: string; publishableKey?: string; error?: string };
        if (!response.ok || !config.url || !config.publishableKey) {
          throw new Error(config.error ?? "Account services are unavailable.");
        }
        return createClient<Database>(config.url, config.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "implicit",
          },
        });
      })
      .catch((error) => {
        browserClient = null;
        throw error;
      });
  }
  return browserClient;
}
