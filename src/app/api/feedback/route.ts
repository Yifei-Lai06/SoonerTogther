import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/server";
import { burstLimited, clientIp, jsonError } from "@/server/http";

const CATEGORIES = ["general", "feature", "bug", "suggestion"];

// Beta feedback. Signed-in users write with their own session (RLS: insert only).
// Demo visitors' feedback is stored anonymously with the server key, rate limited per IP.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = String(body?.message ?? "").trim();
  const category = String(body?.category ?? "general");
  const rating = body?.rating == null ? null : Number(body.rating);
  if (!message || message.length > 3000 || !CATEGORIES.includes(category)) return jsonError(400, "invalid_input");
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return jsonError(400, "invalid_input");

  const row = {
    category,
    message,
    rating,
    page: String(body?.page ?? "").slice(0, 200) || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
  };

  const auth = await getVerifiedUser();
  if (auth) {
    if (burstLimited(`fb:${auth.user.id}`, 10, 10 * 60_000)) return jsonError(429, "rate_limited");
    const { error } = await auth.supabase.from("feedback").insert({ ...row, user_id: auth.user.id });
    if (error) return jsonError(500, "save_failed");
    return NextResponse.json({ ok: true });
  }

  const admin = getAdminSupabase();
  if (!admin) return jsonError(503, "feedback_storage_not_configured");
  if (burstLimited(`fb:${clientIp(req)}`, 5, 10 * 60_000)) return jsonError(429, "rate_limited");
  const { error } = await admin.from("feedback").insert({ ...row, user_id: null });
  if (error) return jsonError(500, "save_failed");
  return NextResponse.json({ ok: true });
}
