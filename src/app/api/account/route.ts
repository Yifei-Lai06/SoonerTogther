import { NextResponse } from "next/server";
import { jsonError, requireUserAndAdmin } from "@/server/http";

// Permanently deletes the signed-in user's account. Database rows cascade from
// auth.users; messages they sent stay in the other person's chat as "Deleted user".
export async function DELETE(req: Request) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
  if (body?.confirm !== "DELETE") return jsonError(400, "confirmation_required");
  const { error } = await ctx.admin.auth.admin.deleteUser(ctx.user.id);
  if (error) return jsonError(500, "delete_failed");
  await ctx.supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
