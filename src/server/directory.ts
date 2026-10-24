import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeetFormat, Mode, SlotId, Student, Year } from "@/lib/types";

// Loads full student records (including private availability and learning needs)
// with the secret key, for server-side matching only. Callers must strip private
// fields before sending anything to a browser — see `publicStudent`.

type Row = Record<string, unknown>;
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export async function loadDirectory(admin: SupabaseClient, meId: string): Promise<{ me: Student | null; others: Student[] }> {
  const [profiles, priv, tutor, needs, blocks] = await Promise.all([
    admin.from("profiles").select("*").or(`onboarded.eq.true,id.eq.${meId}`).limit(2000),
    admin.from("private_profiles").select("user_id, availability").limit(2000),
    admin.from("tutor_subjects").select("*").limit(5000),
    admin.from("help_needs").select("*").limit(5000),
    admin.from("blocks").select("blocker_id, blocked_id").or(`blocker_id.eq.${meId},blocked_id.eq.${meId}`),
  ]);
  for (const r of [profiles, priv, tutor, needs, blocks]) if (r.error) throw new Error(r.error.message);

  const avail = new Map((priv.data as Row[]).map((p) => [p.user_id as string, arr<SlotId>(p.availability)]));
  const blocked = new Set((blocks.data as Row[]).map((b) => (b.blocker_id === meId ? b.blocked_id : b.blocker_id) as string));

  const students = (profiles.data as Row[]).map<Student>((p) => {
    const id = p.id as string;
    return {
      id,
      name: (p.display_name as string) || "New Sooner",
      avatarColor: p.avatar_color as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      major: (p.major as string) ?? "",
      year: p.year as Year,
      courses: arr<string>(p.courses),
      needsHelp: (needs.data as Row[]).filter((n) => n.user_id === id).map((n) => ({ courseId: n.course_id as string, topics: arr<string>(n.topics) })),
      canTutor: (tutor.data as Row[])
        .filter((t) => t.user_id === id)
        .map((t) => ({ courseId: t.course_id as string, topics: arr<string>(t.topics), experience: (t.experience as string) ?? "" })),
      modes: arr<Mode>(p.modes),
      availability: avail.get(id) ?? [],
      interests: arr<string>(p.interests),
      format: p.format as MeetFormat,
      bio: (p.bio as string) ?? "",
      firstTimeLearner: !!p.first_time_learner,
      xp: (p.xp as number) ?? 0,
      ouVerified: !!p.ou_verified,
    };
  });

  return {
    me: students.find((s) => s.id === meId) ?? null,
    others: students.filter((s) => s.id !== meId && !blocked.has(s.id)),
  };
}

/** What another signed-in student may see about someone: no schedule, no struggles, no email. */
export function publicStudent(s: Student): Student {
  return { ...s, availability: [], needsHelp: s.needsHelp.map((n) => ({ courseId: n.courseId, topics: [] })) };
}
