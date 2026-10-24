// XP, levels and badges. XP is an append-only ledger of events with unique
// keys, so the same session/check-in/milestone can never be claimed twice.

import type { AppState, XpEvent } from "./types.ts";

export const REWARDS = {
  sessionComplete: 30,
  helpfulFeedback: 10,
  circleAttend: 15,
  firstTimeLearner: 20,
  groupMilestone: 25,
} as const;

/** Session-completion XP is capped per day so grinding short sessions doesn't pay. */
export const DAILY_SESSION_XP_CAP = 3;

export const LEVELS: { min: number; title: string }[] = [
  { min: 0, title: "Newcomer" },
  { min: 50, title: "Study Buddy" },
  { min: 120, title: "Helper" },
  { min: 210, title: "Peer Guide" },
  { min: 320, title: "Mentor" },
  { min: 450, title: "Community Pillar" },
  { min: 600, title: "Sooner Sage" },
  { min: 800, title: "Campus Legend" },
];

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  floor: number;
  next: number | null;
  /** 0..1 progress toward the next level (1 at max level). */
  progress: number;
}

export function totalXp(events: XpEvent[], userId: string): number {
  return events.filter((e) => e.userId === userId).reduce((s, e) => s + e.amount, 0);
}

export function levelInfo(xp: number): LevelInfo {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].min) i++;
  const floor = LEVELS[i].min;
  const next = i + 1 < LEVELS.length ? LEVELS[i + 1].min : null;
  return {
    level: i + 1,
    title: LEVELS[i].title,
    xp,
    floor,
    next,
    progress: next === null ? 1 : (xp - floor) / (next - floor),
  };
}

/** Appends an event unless its key was already awarded. */
export function award(events: XpEvent[], ev: XpEvent): { events: XpEvent[]; awarded: boolean } {
  if (events.some((e) => e.key === ev.key)) return { events, awarded: false };
  return { events: [...events, ev], awarded: true };
}

function utcDay(at: number): number {
  return Math.floor(at / 86_400_000);
}

export function sessionXpAllowed(events: XpEvent[], userId: string, at: number): boolean {
  const today = utcDay(at);
  const count = events.filter(
    (e) => e.userId === userId && e.key.startsWith("session:") && utcDay(e.at) === today,
  ).length;
  return count < DAILY_SESSION_XP_CAP;
}

/** ISO-8601 week key, e.g. "2026-W43". Used for once-per-week circle check-ins. */
export function weekKey(at: number): string {
  const d = new Date(at);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── Badges ───────────────────────────────────────────────────────────────────

export type BadgeId = "first-helper" | "peer-mentor" | "study-connector" | "community-builder" | "knowledge-sharer";

export interface BadgeStatus {
  id: BadgeId;
  name: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
}

export function tutoredSessions(state: AppState, userId: string) {
  return state.sessions.filter((s) => s.status === "completed" && s.tutorId === userId);
}

export function computeBadges(state: AppState, userId: string): BadgeStatus[] {
  const tutored = tutoredSessions(state, userId);
  const topics = new Set(tutored.flatMap((s) => s.topics.map((t) => `${s.courseId}:${t}`)));
  const connections = state.connections.filter((c) => c.userIds.includes(userId)).length;
  const circles = state.circles.filter((c) => c.memberIds.includes(userId)).length;
  const attended = state.circles.some((c) => Object.values(c.attendance).some((ids) => ids.includes(userId)));
  const builderProgress = Math.min(circles, 2) + (attended ? 1 : 0);

  const make = (
    id: BadgeId,
    name: string,
    description: string,
    progress: number,
    target: number,
  ): BadgeStatus => ({ id, name, description, progress: Math.min(progress, target), target, earned: progress >= target });

  return [
    make("first-helper", "First Helper", "Teach your first completed peer session.", tutored.length, 1),
    make("peer-mentor", "Peer Mentor", "Teach five completed peer sessions.", tutored.length, 5),
    make("study-connector", "Study Connector", "Form two mutual study connections.", connections, 2),
    make(
      "community-builder",
      "Community Builder",
      "Belong to two Study Circles and check in to a meeting.",
      builderProgress,
      3,
    ),
    make("knowledge-sharer", "Knowledge Sharer", "Help classmates with three different topics.", topics.size, 3),
  ];
}
