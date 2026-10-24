// Deterministic, explainable weighted matching.
//
// The weights below are initial product assumptions, not validated research.
// Course compatibility, meeting format and shared availability are eligibility
// gates: a candidate who fails one is excluded (with a reason) instead of being
// allowed to "win" on shared hobbies.

import { MODES, slotShort, sortSlots } from "./data/catalog.ts";
import type { Circle, MatchRequest, MeetFormat, Mode, SlotId, Student } from "./types.ts";

export const WEIGHTS = {
  course: 35,
  topic: 25,
  style: 20,
  schedule: 15,
  social: 5,
} as const;

export type FactorKey = keyof typeof WEIGHTS;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  course: "Course compatibility",
  topic: "Topic expertise",
  style: "Learning style",
  schedule: "Schedule overlap",
  social: "Shared interests",
};

export interface FactorScore {
  key: FactorKey;
  weight: number;
  /** 0..1 */
  fraction: number;
  /** Rounded points out of `weight`. */
  points: number;
  detail: string;
}

export interface StudentMatch {
  student: Student;
  score: number;
  factors: FactorScore[];
  reasons: string[];
  sharedSlots: SlotId[];
  sharedInterests: string[];
  /** Requested topics this person can teach (tutor) or is also working on (partner). */
  relevantTopics: string[];
  experience: string | null;
}

export interface Exclusion {
  studentId: string;
  reason: string;
}

export interface MatchResult {
  matches: StudentMatch[];
  excluded: Exclusion[];
}

export function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}

export function formatsCompatible(a: MeetFormat, b: MeetFormat): boolean {
  return a === "either" || b === "either" || a === b;
}

function formatFit(a: MeetFormat, b: MeetFormat): number {
  if (a === b) return 1;
  return formatsCompatible(a, b) ? 0.5 : 0;
}

function listText(items: string[], max = 3): string {
  const shown = items.slice(0, max);
  if (shown.length <= 1) return shown.join("");
  const rest = items.length - shown.length;
  const head = shown.slice(0, -1).join(", ");
  const tail = shown[shown.length - 1];
  return rest > 0 ? `${shown.join(", ")} +${rest} more` : `${head} and ${tail}`;
}

function factor(key: FactorKey, fraction: number, detail: string): FactorScore {
  const f = Math.max(0, Math.min(1, fraction));
  return { key, weight: WEIGHTS[key], fraction: f, points: Math.round(WEIGHTS[key] * f), detail };
}

function takesCourse(s: Student, courseId: string): boolean {
  return s.courses.includes(courseId) || s.needsHelp.some((n) => n.courseId === courseId);
}

function eligibility(me: Student, s: Student, req: MatchRequest): string | null {
  const course = req.courseId;
  if (req.kind === "tutor") {
    if (!s.canTutor.some((t) => t.courseId === course)) return `Doesn't tutor ${course}`;
  } else if (!takesCourse(s, course)) {
    return `Not taking ${course}`;
  }
  if (!formatsCompatible(req.format, s.format)) {
    return `Meets ${s.format} only — you asked for ${req.format}`;
  }
  if (req.slots.length > 0 && intersect(req.slots, s.availability).length === 0) {
    return "No shared availability";
  }
  if (me.id === s.id) return "This is you";
  return null;
}

function styleFactor(s: Student, mode: Mode): FactorScore {
  if (s.modes.includes(mode)) return factor("style", 1, `Prefers ${MODES[mode].label}`);
  const others = s.modes.map((m) => MODES[m].label).join(" or ");
  return factor("style", 0, `Usually prefers ${others}`);
}

function scheduleFactor(req: MatchRequest, shared: SlotId[]): FactorScore {
  if (req.slots.length === 0) return factor("schedule", 0.5, "You didn't set availability yet");
  const fraction = shared.length / Math.min(3, req.slots.length);
  const example = shared.length > 0 ? ` (e.g. ${slotShort(shared[0])})` : "";
  return factor(
    "schedule",
    fraction,
    `${shared.length} shared time window${shared.length === 1 ? "" : "s"}${example}`,
  );
}

function socialFactor(me: Student, s: Student, shared: string[]): FactorScore {
  const fraction = 0.7 * Math.min(1, shared.length / 3) + 0.3 * formatFit(me.format, s.format);
  const detail = shared.length > 0 ? `You both like ${listText(shared)}` : "No shared interests listed yet";
  return factor("social", fraction, detail);
}

export function scoreStudent(me: Student, s: Student, req: MatchRequest): StudentMatch {
  const courseName = req.courseId;
  const sharedSlots = sortSlots(intersect(req.slots, s.availability));
  const sharedInterests = intersect(me.interests, s.interests);

  let topicF: FactorScore;
  let relevantTopics: string[] = [];
  let experience: string | null = null;
  let courseF: FactorScore;

  if (req.kind === "tutor") {
    const subject = s.canTutor.find((t) => t.courseId === req.courseId)!;
    experience = subject.experience;
    courseF = factor("course", 1, `Tutors ${courseName}`);
    relevantTopics = intersect(req.topics, subject.topics);
    if (req.topics.length === 0) {
      topicF = factor("topic", 0.5, `Confident in ${listText(subject.topics)}`);
    } else {
      topicF = factor(
        "topic",
        relevantTopics.length / req.topics.length,
        relevantTopics.length > 0
          ? `Confident in ${listText(relevantTopics)}`
          : `Confident in other ${courseName} topics`,
      );
    }
  } else {
    courseF = factor("course", 1, `Also taking ${courseName}`);
    const teaches = s.canTutor.find((t) => t.courseId === req.courseId)?.topics ?? [];
    const struggles = s.needsHelp.find((n) => n.courseId === req.courseId)?.topics ?? [];
    if (req.topics.length === 0) {
      topicF = factor("topic", 0.5, "Working through the same course");
    } else {
      const strong = intersect(req.topics, teaches);
      const same = intersect(req.topics, struggles).filter((t) => !strong.includes(t));
      relevantTopics = [...strong, ...same];
      const fraction = (strong.length + 0.7 * same.length) / req.topics.length;
      const detail =
        strong.length > 0
          ? `Confident in ${listText(strong)}`
          : same.length > 0
            ? `Also working on ${listText(same)} — figure it out together`
            : "Working on different topics in the same course";
      topicF = factor("topic", fraction, detail);
    }
  }

  const factors = [
    courseF,
    topicF,
    styleFactor(s, req.mode),
    scheduleFactor(req, sharedSlots),
    socialFactor(me, s, sharedInterests),
  ];
  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const reasons = factors.filter((f) => f.fraction > 0).map((f) => f.detail);

  return { student: s, score, factors, reasons, sharedSlots, sharedInterests, relevantTopics, experience };
}

export function matchStudents(me: Student, candidates: Student[], req: MatchRequest): MatchResult {
  const matches: StudentMatch[] = [];
  const excluded: Exclusion[] = [];
  for (const s of candidates) {
    if (s.id === me.id) continue;
    const why = eligibility(me, s, req);
    if (why) excluded.push({ studentId: s.id, reason: why });
    else matches.push(scoreStudent(me, s, req));
  }
  matches.sort(
    (a, b) =>
      b.score - a.score ||
      b.factors[1].fraction - a.factors[1].fraction ||
      a.student.name.localeCompare(b.student.name),
  );
  return { matches, excluded };
}

// ── Study Circles ────────────────────────────────────────────────────────────

export interface CircleMatch {
  circle: Circle;
  score: number;
  factors: FactorScore[];
  reasons: string[];
  isMember: boolean;
}

export interface CircleMatchResult {
  matches: CircleMatch[];
  excluded: { circleId: string; reason: string }[];
}

export function matchCircles(
  me: Student,
  circles: Circle[],
  students: Student[],
  req: MatchRequest,
): CircleMatchResult {
  const matches: CircleMatch[] = [];
  const excluded: { circleId: string; reason: string }[] = [];
  const byId = new Map(students.map((s) => [s.id, s]));

  for (const c of circles) {
    const isMember = c.memberIds.includes(me.id);
    const slot = `${c.day}-${c.part}` as SlotId;
    if (c.courseId !== req.courseId) {
      excluded.push({ circleId: c.id, reason: `Different course (${c.courseId})` });
      continue;
    }
    if (!isMember && c.memberIds.length >= c.capacity) {
      excluded.push({ circleId: c.id, reason: "Circle is full" });
      continue;
    }
    if (!formatsCompatible(req.format, c.format)) {
      excluded.push({ circleId: c.id, reason: `Meets ${c.format} only` });
      continue;
    }
    if (req.slots.length > 0 && !req.slots.includes(slot)) {
      excluded.push({ circleId: c.id, reason: `Meets ${slotShort(slot)} — outside your availability` });
      continue;
    }

    const focus = intersect(req.topics, c.focus);
    const topicFraction = req.topics.length === 0 ? 0.5 : focus.length / req.topics.length;
    const styleFraction = req.mode === "talk" ? 0.5 : 1;
    const members = c.memberIds.map((id) => byId.get(id)).filter((s): s is Student => !!s && s.id !== me.id);
    const friendly = members.filter((m) => intersect(me.interests, m.interests).length > 0);

    const factors = [
      factor("course", 1, `Focused on ${c.courseId}`),
      factor(
        "topic",
        topicFraction,
        focus.length > 0 ? `This week: ${listText(focus)}` : `Focus: ${listText(c.focus)}`,
      ),
      factor(
        "style",
        styleFraction,
        req.mode === "talk" ? "Mostly problem-solving, some casual chat" : "Rotating teach-and-discuss format",
      ),
      factor("schedule", req.slots.length === 0 ? 0.5 : 1, `Meets ${slotShort(slot)} at ${c.time}`),
      factor(
        "social",
        members.length === 0 ? 0 : friendly.length / members.length,
        friendly.length > 0
          ? `${friendly.length} member${friendly.length === 1 ? "" : "s"} share your interests`
          : "A chance to meet new people",
      ),
    ];
    const score = factors.reduce((sum, f) => sum + f.points, 0);
    matches.push({
      circle: c,
      score,
      factors,
      reasons: factors.filter((f) => f.fraction > 0).map((f) => f.detail),
      isMember,
    });
  }
  matches.sort((a, b) => b.score - a.score || a.circle.name.localeCompare(b.circle.name));
  return { matches, excluded };
}
