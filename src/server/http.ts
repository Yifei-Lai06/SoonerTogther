import "server-only";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/server";

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Verified user + admin client, or an error response to return as-is. */
export async function requireUserAndAdmin() {
  const auth = await getVerifiedUser();
  if (!auth) return { error: jsonError(401, "not_authenticated") } as const;
  const admin = getAdminSupabase();
  if (!admin) return { error: jsonError(503, "server_not_configured") } as const;
  return { ...auth, admin } as const;
}

/** Small in-memory limiter (per server instance). The database enforces the real quotas. */
const buckets = new Map<string, number[]>();
export function burstLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return hits.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
