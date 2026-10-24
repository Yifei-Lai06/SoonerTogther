import { getAdminSupabase } from "@/lib/supabase/admin";
import { CLOUD_ENABLED } from "@/lib/supabase/config";
import { getVerifiedUser } from "@/lib/supabase/server";
import { aiConfigured, MAX_INPUT, streamChat, type ChatTurn } from "@/server/ai";
import { burstLimited, clientIp, jsonError } from "@/server/http";

// Ask AI. Streams plain text. Every request is authenticated (cloud), checked
// against per-user and global daily quotas in the database, bounded in size and
// time, and stored separately from human conversations.

export const maxDuration = 90;

const USER_LIMIT = Number(process.env.AI_DAILY_LIMIT_PER_USER ?? 30);
const GLOBAL_LIMIT = Number(process.env.AI_DAILY_LIMIT_TOTAL ?? 500);
const HISTORY = 12;

function clean(s: unknown, max: number): string {
  return typeof s === "string" ? s.replace(/\u0000/g, "").trim().slice(0, max) : "";
}

export async function GET() {
  return Response.json({ configured: aiConfigured(), dailyLimit: USER_LIMIT });
}

export async function POST(req: Request) {
  if (!aiConfigured()) return jsonError(503, "ai_not_configured");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = clean(body?.message, MAX_INPUT + 1);
  if (!message) return jsonError(400, "empty_message");
  if (message.length > MAX_INPUT) return jsonError(400, "message_too_long");
  const context = clean(body?.context, 300) || null;
  let conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;

  let history: ChatTurn[] = [];
  let save: ((content: string) => Promise<void>) | null = null;

  if (CLOUD_ENABLED) {
    const auth = await getVerifiedUser();
    if (!auth) return jsonError(401, "not_authenticated");
    const admin = getAdminSupabase();
    if (!admin) return jsonError(503, "server_not_configured");
    const { supabase, user } = auth;
    if (burstLimited(`ai:${user.id}`, 6, 60_000)) return jsonError(429, "slow_down");

    const { data: quota, error: quotaError } = await admin.rpc("consume_ai_quota", {
      p_user: user.id,
      p_user_limit: USER_LIMIT,
      p_global_limit: GLOBAL_LIMIT,
    });
    if (quotaError) return jsonError(500, "quota_check_failed");
    if (quota !== "ok") return jsonError(429, String(quota), { limit: USER_LIMIT });

    if (conversationId) {
      const { data: conv } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).maybeSingle();
      if (!conv) conversationId = null;
    }
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title: message.slice(0, 60) })
        .select("id")
        .single();
      if (error || !conv) return jsonError(500, "save_failed");
      conversationId = conv.id as string;
    } else {
      const { data: past } = await supabase
        .from("ai_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(HISTORY);
      history = ((past ?? []) as ChatTurn[]).reverse();
    }
    const convId = conversationId;
    await supabase.from("ai_messages").insert({ conversation_id: convId, user_id: user.id, role: "user", content: message });
    save = async (content) => {
      if (!content.trim()) return;
      await supabase.from("ai_messages").insert({ conversation_id: convId, user_id: user.id, role: "assistant", content: content.slice(0, 12000) });
      await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
    };
  } else {
    // Local development without a database: history comes from the browser, limited per IP.
    if (burstLimited(`ai:${clientIp(req)}`, 6, 60_000)) return jsonError(429, "slow_down");
    history = (Array.isArray(body?.history) ? (body!.history as ChatTurn[]) : [])
      .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
      .slice(-HISTORY)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 4000) }));
  }

  let upstream: ReadableStream<string>;
  try {
    upstream = await streamChat([...history, { role: "user", content: message }], context);
  } catch (e) {
    console.error("AI request failed:", (e as Error).message);
    return jsonError(502, "ai_unavailable");
  }

  let full = "";
  const encoder = new TextEncoder();
  const out = upstream.pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform(text, controller) {
        full += text;
        controller.enqueue(encoder.encode(text));
      },
      async flush() {
        await save?.(full).catch(() => undefined);
      },
    }),
  );

  return new Response(out, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(conversationId ? { "X-Conversation-Id": conversationId } : {}),
    },
  });
}
