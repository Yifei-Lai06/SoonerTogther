import { createHash, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { burstLimited, jsonError, requireUserAndAdmin } from "@/server/http";

// Optional OU email verification by one-time code.
//   POST { action: "start", email }  → emails a 6-digit code (needs RESEND_API_KEY)
//   POST { action: "verify", code }  → marks the profile OU-verified if the code matches
// Typing an @ou.edu address alone never grants the badge.

const OU_EMAIL = /^[^\s@]+@([a-z0-9-]+\.)*ou\.edu$/i;
const hash = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code}`).digest("hex");

export function GET() {
  return NextResponse.json({ available: !!process.env.RESEND_API_KEY });
}

export async function POST(req: Request) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "start") {
    const key = process.env.RESEND_API_KEY;
    if (!key) return jsonError(501, "email_verification_not_configured");
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!OU_EMAIL.test(email)) return jsonError(400, "not_an_ou_email");
    if (burstLimited(`ou:${ctx.user.id}`, 3, 10 * 60_000)) return jsonError(429, "rate_limited");

    const code = String(randomInt(100000, 1000000));
    const { error } = await ctx.admin.rpc("ou_code_store", { p_user: ctx.user.id, p_email: email, p_hash: hash(ctx.user.id, code) });
    if (error) return jsonError(500, "store_failed");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "SoonerTogether <onboarding@resend.dev>",
        to: [email],
        subject: "Your SoonerTogether verification code",
        text: `Your code is ${code}. It expires in 15 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!res?.ok) return jsonError(502, "email_send_failed");
    return NextResponse.json({ ok: true });
  }

  if (body?.action === "verify") {
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return jsonError(400, "invalid_code");
    const { data, error } = await ctx.admin.rpc("ou_code_check", { p_user: ctx.user.id, p_hash: hash(ctx.user.id, code) });
    if (error) return jsonError(500, "verify_failed");
    return data === "ok" ? NextResponse.json({ ok: true }) : jsonError(400, String(data));
  }

  return jsonError(400, "invalid_input");
}
