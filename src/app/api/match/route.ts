import { NextResponse } from "next/server";
import { courseById, MODE_LIST } from "@/lib/data/catalog";
import { matchStudents } from "@/lib/matching";
import type { MeetFormat, Mode } from "@/lib/types";
import { loadDirectory, publicStudent } from "@/server/directory";
import { burstLimited, jsonError, requireUserAndAdmin } from "@/server/http";

// Server-side matching: the same weighted algorithm as the demo (src/lib/matching.ts),
// run here so other students' schedules and learning needs never reach the browser.
// The caller's own availability comes from the database, never from the request.
export async function POST(req: Request) {
  const ctx = await requireUserAndAdmin();
  if ("error" in ctx) return ctx.error;
  if (burstLimited(`match:${ctx.user.id}`, 30, 60_000)) return jsonError(429, "rate_limited");

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const course = courseById(String(body?.courseId ?? ""));
  const kind = body?.kind === "partner" ? "partner" : body?.kind === "tutor" ? "tutor" : null;
  const mode = MODE_LIST.includes(body?.mode as Mode) ? (body!.mode as Mode) : null;
  const format = (["either", "in-person", "online"] as const).includes(body?.format as MeetFormat)
    ? (body!.format as MeetFormat)
    : "either";
  if (!course || !kind || !mode) return jsonError(400, "invalid_input");
  const topics = Array.isArray(body?.topics) ? (body!.topics as unknown[]).map(String).filter((t) => course.topics.includes(t)) : [];

  const { me, others } = await loadDirectory(ctx.admin, ctx.user.id);
  if (!me) return jsonError(404, "profile_missing");

  const result = matchStudents(me, others, {
    courseId: course.id,
    topics,
    kind,
    mode,
    format,
    slots: body?.useSchedule === false ? [] : me.availability,
  });

  return NextResponse.json(
    {
      matches: result.matches.slice(0, 30).map((m) => ({ ...m, student: publicStudent(m.student) })),
      // Reasons only, no names or ids.
      excluded: result.excluded.map((e) => ({ reason: e.reason })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
