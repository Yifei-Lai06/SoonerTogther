// Public Supabase settings. These two values are safe to ship to the browser
// (they are protected by Row Level Security). The secret key lives in admin.ts only.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when the app should run against the real cloud database. */
export const CLOUD_ENABLED = SUPABASE_URL.startsWith("https://") && SUPABASE_PUBLIC_KEY.length > 20;

/** Non-httpOnly cookie that lets signed-out visitors explore the local demo. */
export const DEMO_COOKIE = "st_demo";

/** Only allow same-site relative redirects (prevents open redirects after login). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
