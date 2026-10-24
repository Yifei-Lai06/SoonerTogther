// The judge walkthrough. Each step's "done" is derived from real app state,
// so the checklist can never drift from what actually happened.

import { SEED_SESSIONS } from "./data/seed.ts";
import type { AppState } from "./types.ts";

export interface DemoStep {
  id: string;
  title: string;
  detail: string;
  href: string;
  done: boolean;
}

const SEEDED = new Set(SEED_SESSIONS.map((s) => s.id));
const MATCH_HREF = "/match?course=MATH%201914&topic=Chain%20Rule&mode=discussion&kind=tutor";

export function demoSteps(state: AppState): DemoStep[] {
  const mine = state.sessions.filter((s) => !SEEDED.has(s.id) && s.requesterId === state.meId);
  const latest = mine[0];
  const reached = (statuses: string[]) => mine.some((s) => statuses.includes(s.status));
  const sessionXp = state.xp.some(
    (e) => e.userId === state.meId && e.key.startsWith("session:") && !SEEDED.has(e.key.split(":")[1]),
  );
  const newConnection = state.connections.some((c) => c.id !== "conn-jordan" && c.userIds.includes(state.meId));
  const calc = state.circles.find((c) => c.id === "calc-survival");
  const inCalc = !!calc?.memberIds.includes(state.meId);
  const circleActivity =
    state.circles.some((c) => Object.values(c.attendance).some((ids) => ids.includes(state.meId))) ||
    state.xp.some((e) => e.userId === state.meId && e.key.startsWith("milestone:"));
  const sessionHref = latest ? `/sessions/${latest.id}` : "/sessions";

  return [
    {
      id: "match",
      title: "Find help for MATH 1914",
      detail: "Pick Chain Rule + Discussion Mode, review the ranked matches, and request a session.",
      href: MATCH_HREF,
      done: mine.length > 0,
    },
    {
      id: "accept",
      title: "Simulate the tutor accepting",
      detail: "Use the demo control on your request.",
      href: sessionHref,
      done: reached(["accepted", "scheduled", "completed"]),
    },
    {
      id: "schedule",
      title: "Pick a time you're both free",
      detail: "Only mutual availability is offered.",
      href: sessionHref,
      done: reached(["scheduled", "completed"]),
    },
    {
      id: "complete",
      title: "Complete the session",
      detail: "Both people confirm — XP is awarded once.",
      href: sessionHref,
      done: sessionXp,
    },
    {
      id: "connect",
      title: "Form a mutual study connection",
      detail: "Private feedback; a connection appears only if both say yes.",
      href: sessionHref,
      done: newConnection,
    },
    {
      id: "circle",
      title: "Join the Calculus Survival Circle",
      detail: "Recurring Wednesdays — same people every week.",
      href: "/circles/calc-survival",
      done: inCalc,
    },
    {
      id: "circle-activity",
      title: "Check in or finish a group challenge",
      detail: "Weekly check-ins and group milestones earn XP.",
      href: "/circles/calc-survival",
      done: circleActivity,
    },
    {
      id: "resource",
      title: "Find someone to visit the Math Center with",
      detail: "Pair up with a classmate — separate from official appointments.",
      href: "/resources?resource=math-center&course=MATH%201914",
      done: state.goTogether.length > 0,
    },
  ];
}
