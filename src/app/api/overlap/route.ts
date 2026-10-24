import { NextResponse, type NextRequest } from "next/server";
import { intersect } from "@/lib/matching";
import { sortSlots } from "@/lib/data/catalog";
import type { SlotId } from "@/lib/types";
import { jsonError, requireUserAndAdmin } from "@/server/http";

// Returns only the time windows the caller and another student BOTH have free.
export async function GET(req: NextRequest) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const other = req.nextUrl.searchParams.get("user") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(other)) return jsonError(400, "invalid_input");

  const { data, error } = await ctx.admin.from("private_profiles").select("user_id, availability").in("user_id", [ctx.user.id, other]);
  if (error) return jsonError(500, "lookup_failed");
  const mine = (data.find((r) => r.user_id === ctx.user.id)?.availability ?? []) as SlotId[];
  const theirs = (data.find((r) => r.user_id === other)?.availability ?? []) as SlotId[];
  return NextResponse.json({ shared: sortSlots(intersect(mine, theirs)) }, { headers: { "Cache-Control": "no-store" } });
}
