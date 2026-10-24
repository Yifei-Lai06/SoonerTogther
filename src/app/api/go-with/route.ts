import { NextResponse, type NextRequest } from "next/server";
import { intersect } from "@/lib/matching";
import { courseById, sortSlots } from "@/lib/data/catalog";
import { resourceById } from "@/lib/data/resources";
import { loadDirectory, publicStudent } from "@/server/directory";
import { jsonError, requireUserAndAdmin } from "@/server/http";

// Students who also want to visit a campus resource for a course, with only the
// time windows you share. Never books anything with the resource itself.
export async function GET(req: NextRequest) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  const resource = resourceById(req.nextUrl.searchParams.get("resource") ?? "");
  const course = courseById(req.nextUrl.searchParams.get("course") ?? "");
  if (!resource || !course) return jsonError(400, "invalid_input");

  const { data, error } = await ctx.admin
    .from("go_with_interests")
    .select("user_id")
    .eq("resource_id", resource.id)
    .eq("course_id", course.id)
    .neq("user_id", ctx.user.id);
  if (error) return jsonError(500, "lookup_failed");
  const ids = new Set(data.map((d) => d.user_id as string));

  const { me, others } = await loadDirectory(ctx.admin, ctx.user.id);
  if (!me) return jsonError(404, "profile_missing");
  const candidates = others
    .filter((s) => ids.has(s.id))
    .map((s) => ({ student: publicStudent(s), slots: sortSlots(intersect(me.availability, s.availability)) }))
    .filter((c) => c.slots.length > 0)
    .sort((a, b) => b.slots.length - a.slots.length || a.student.name.localeCompare(b.student.name));

  return NextResponse.json({ candidates }, { headers: { "Cache-Control": "no-store" } });
}
