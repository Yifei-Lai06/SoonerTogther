import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

// Bypasses Row Level Security. Server only, never imported by client code
// (the "server-only" import makes the build fail if that ever happens).
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let admin: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient | null {
  if (!SUPABASE_URL || SECRET.length < 20) return null;
  admin ??= createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
