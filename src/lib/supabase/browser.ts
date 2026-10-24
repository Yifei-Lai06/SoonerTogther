"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOUD_ENABLED, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./config";

let client: SupabaseClient | null = null;

/** One browser client per tab. Returns null when the cloud isn't configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!CLOUD_ENABLED) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
  return client;
}
