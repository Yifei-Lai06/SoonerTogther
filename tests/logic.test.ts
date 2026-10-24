// Run with `npm test` (Node's built-in test runner, no extra dependencies).
import { test } from "node:test";
import assert from "node:assert/strict";

import { seedState, ME } from "../src/lib/data/seed.ts";
import { matchCircles, matchStudents, WEIGHTS } from "../src/lib/matching.ts";
import { me, reducer, mutualSlots, studentById } from "../src/lib/state.ts";
import type { AppState, MatchRequest } from "../src/lib/types.ts";
import { award, computeBadges, levelInfo, totalXp, weekKey, DAILY_SESSION_XP_CAP } from "../src/lib/xp.ts";

const AT = Date.UTC(2026, 9, 21, 16); // a Wednesday

function chainRuleRequest(state: AppState, extra: Partial<MatchRequest> = {}): MatchRequest {
  return {
    courseId: "MATH 1914",
    topics: ["Chain Rule"],
    kind: "tutor",
    mode: "discussion",
    format: "either",
    slots: me(state).availability,
    ...extra,
  };
}

test("weights add up to 100", () => {
  assert.equal(Object.values(WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test("tutor matching is deterministic, ranked and explainable", () => {
  const state = seedState();
  const a = matchStudents(me(state), state.students, chainRuleRequest(state));
  const b = matchStudents(me(state), state.students, chainRuleRequest(state));
  assert.deepEqual(
    a.matches.map((m) => [m.student.id, m.score]),
    b.matches.map((m) => [m.student.id, m.score]),
  );
  assert.equal(a.matches[0].student.id, "maya");
  for (let i = 1; i < a.matches.length; i++) assert.ok(a.matches[i - 1].score >= a.matches[i].score);
  for (const m of a.matches) {
    assert.equal(m.score, m.factors.reduce((s, f) => s + f.points, 0));
    assert.ok(m.score <= 100 && m.score >= 0);
    assert.ok(m.reasons.length > 0);
  }
});

test("eligibility gates: no tutoring, no shared time, or incompatible format → excluded", () => {
  const state = seedState();
  const r = matchStudents(me(state), state.students, chainRuleRequest(state));
  const ids = r.matches.map((m) => m.student.id);
  assert.ok(!ids.includes("sam"), "Sam has no overlapping availability");
  assert.ok(!ids.includes("hannah"), "Hannah doesn't tutor MATH 1914");
  assert.ok(!ids.includes(ME));
  assert.equal(r.excluded.find((e) => e.studentId === "sam")?.reason, "No shared availability");

  const inPerson = matchStudents(me(state), state.students, chainRuleRequest(state, { format: "in-person" }));
  assert.ok(!inPerson.matches.some((m) => m.student.id === "priya"), "Priya is online-only");
});

test("shared hobbies never outweigh academic fit", () => {
  const state = seedState();
  const r = matchStudents(me(state), state.students, chainRuleRequest(state, { topics: ["Related rates"] }));
  const leo = r.matches.find((m) => m.student.id === "leo");
  const maya = r.matches.find((m) => m.student.id === "maya")!;
  // Leo shares all three of Alex's hobbies but doesn't know related rates.
  if (leo) assert.ok(maya.score > leo.score);
  assert.equal(maya.factors[1].fraction, 1);
});

test("partner matching finds classmates in the same course", () => {
  const state = seedState();
  const r = matchStudents(me(state), state.students, chainRuleRequest(state, { kind: "partner" }));
  const ids = r.matches.map((m) => m.student.id);
  assert.ok(ids.includes("hannah") && ids.includes("jordan"));
  assert.ok(!ids.includes("maya"), "Maya isn't taking MATH 1914");
});

test("circle matching respects course, capacity and schedule", () => {
  const state = seedState();
  const r = matchCircles(me(state), state.circles, state.students, chainRuleRequest(state, { kind: "circle" }));
  assert.equal(r.matches[0].circle.id, "calc-survival");
  const chem = matchCircles(me(state), state.circles, state.students, {
    ...chainRuleRequest(state, { kind: "circle" }),
    courseId: "CHEM 1315",
    slots: [],
  });
  assert.equal(chem.excluded.find((e) => e.circleId === "chem-hall")?.reason, "Circle is full");
});

test("levels", () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(49).level, 1);
  assert.equal(levelInfo(50).level, 2);
  assert.equal(levelInfo(100).progress, 50 / 70);
  assert.equal(levelInfo(99999).next, null);
});

test("award never double-counts a key", () => {
  const ev = { key: "x", userId: ME, amount: 30, reason: "", at: 0 };
  const once = award([], ev);
  const twice = award(once.events, ev);
  assert.equal(twice.awarded, false);
  assert.equal(twice.events.length, 1);
});

function runSession(state: AppState, partnerId: string, at = AT): { state: AppState; id: string } {
  let s = reducer(state, {
    type: "REQUEST_SESSION",
    partnerId,
    kind: "tutor",
    courseId: "MATH 1914",
    topics: ["Chain Rule"],
    mode: "discussion",
    note: "",
    at,
  });
  const id = s.sessions[0].id;
  s = reducer(s, { type: "RESPOND_REQUEST", sessionId: id, accept: true });
  const slot = mutualSlots(me(s), studentById(s, partnerId)!)[0];
  s = reducer(s, { type: "SCHEDULE_SESSION", sessionId: id, slot });
  return { state: s, id };
}

test("full session flow: XP only after BOTH confirm, and only once", () => {
  const start = seedState();
  const before = totalXp(start.xp, ME);
  const run = runSession(start, "maya");
  let state = run.state;
  const id = run.id;
  assert.equal(state.sessions[0].status, "scheduled");

  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: ME, at: AT });
  assert.equal(totalXp(state.xp, ME), before, "no XP after one confirmation");

  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: "maya", at: AT });
  assert.equal(state.sessions.find((s) => s.id === id)!.status, "completed");
  assert.equal(totalXp(state.xp, ME), before + 30);
  assert.equal(totalXp(state.xp, "maya"), 30);

  // Re-confirming or replaying can't re-award.
  const again = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: ME, at: AT });
  assert.equal(totalXp(again.xp, ME), before + 30);
});

test("scheduling outside mutual availability is rejected", () => {
  let s = reducer(seedState(), {
    type: "REQUEST_SESSION",
    partnerId: "maya",
    kind: "tutor",
    courseId: "MATH 1914",
    topics: [],
    mode: "teaching",
    note: "",
    at: AT,
  });
  const id = s.sessions[0].id;
  s = reducer(s, { type: "RESPOND_REQUEST", sessionId: id, accept: true });
  s = reducer(s, { type: "SCHEDULE_SESSION", sessionId: id, slot: "sun-morning" });
  assert.equal(s.sessions[0].status, "accepted");
});

test("duplicate open requests are ignored", () => {
  const req = {
    type: "REQUEST_SESSION" as const,
    partnerId: "maya",
    kind: "tutor" as const,
    courseId: "MATH 1914",
    topics: [],
    mode: "teaching" as const,
    note: "",
    at: AT,
  };
  const s = reducer(reducer(seedState(), req), req);
  assert.equal(s.sessions.filter((x) => x.partnerId === "maya").length, 1);
});

test("connections need mutual consent; feedback can't be resubmitted", () => {
  const run = runSession(seedState(), "maya");
  let state = run.state;
  const id = run.id;
  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: ME, at: AT });
  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: "maya", at: AT });
  const conns = state.connections.length;

  state = reducer(state, {
    type: "SUBMIT_FEEDBACK",
    sessionId: id,
    userId: ME,
    feedback: { helpful: true, again: true, connect: true },
    at: AT,
  });
  assert.equal(state.connections.length, conns, "one-sided interest creates nothing");
  assert.equal(totalXp(state.xp, "maya"), 40);

  const resubmit = reducer(state, {
    type: "SUBMIT_FEEDBACK",
    sessionId: id,
    userId: ME,
    feedback: { helpful: true, again: true, connect: true },
    at: AT,
  });
  assert.equal(totalXp(resubmit.xp, "maya"), 40);

  state = reducer(state, {
    type: "SUBMIT_FEEDBACK",
    sessionId: id,
    userId: "maya",
    feedback: { helpful: true, again: true, connect: true },
    at: AT,
  });
  assert.equal(state.connections.length, conns + 1);
  assert.ok(computeBadges(state, ME).find((b) => b.id === "study-connector")!.earned);
});

test("declined connection stays private: no connection, nothing revealed", () => {
  const run = runSession(seedState(), "diego");
  let state = run.state;
  const id = run.id;
  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: ME, at: AT });
  state = reducer(state, { type: "CONFIRM_COMPLETE", sessionId: id, userId: "diego", at: AT });
  state = reducer(state, {
    type: "SUBMIT_FEEDBACK",
    sessionId: id,
    userId: "diego",
    feedback: { helpful: false, again: false, connect: false },
    at: AT,
  });
  state = reducer(state, {
    type: "SUBMIT_FEEDBACK",
    sessionId: id,
    userId: ME,
    feedback: { helpful: true, again: true, connect: true },
    at: AT,
  });
  assert.ok(!state.connections.some((c) => c.userIds.includes("diego")));
});

test("first-time learner bonus goes to the tutor once", () => {
  let s = seedState();
  s = reducer(s, { type: "RESPOND_REQUEST", sessionId: "incoming-noah", accept: true });
  s = reducer(s, { type: "SCHEDULE_SESSION", sessionId: "incoming-noah", slot: "thu-evening" });
  const before = totalXp(s.xp, ME);
  s = reducer(s, { type: "CONFIRM_COMPLETE", sessionId: "incoming-noah", userId: ME, at: AT });
  s = reducer(s, { type: "CONFIRM_COMPLETE", sessionId: "incoming-noah", userId: "noah", at: AT });
  assert.equal(totalXp(s.xp, ME), before + 30 + 20);
  assert.equal(studentById(s, "noah")!.firstTimeLearner, false);
});

test("daily cap on session XP", () => {
  let s = seedState();
  const partners = ["maya", "diego", "priya", "leo"];
  for (const p of partners) {
    const r = runSession(s, p);
    s = reducer(r.state, { type: "CONFIRM_COMPLETE", sessionId: r.id, userId: ME, at: AT });
    s = reducer(s, { type: "CONFIRM_COMPLETE", sessionId: r.id, userId: p, at: AT });
  }
  const today = s.xp.filter((e) => e.userId === ME && e.key.startsWith("session:") && e.at === AT);
  assert.equal(today.length, DAILY_SESSION_XP_CAP);
});

test("circle: join, weekly check-in once, capacity, group milestone", () => {
  let s = seedState();
  s = reducer(s, { type: "JOIN_CIRCLE", circleId: "calc-survival", userId: ME });
  const c = s.circles.find((x) => x.id === "calc-survival")!;
  assert.equal(c.memberIds.length, 5);

  const before = totalXp(s.xp, ME);
  s = reducer(s, { type: "ATTEND_CIRCLE", circleId: "calc-survival", userId: ME, at: AT });
  s = reducer(s, { type: "ATTEND_CIRCLE", circleId: "calc-survival", userId: ME, at: AT + 3600_000 });
  assert.equal(totalXp(s.xp, ME), before + 15);

  // Full circle refuses new members.
  const full = reducer(s, { type: "JOIN_CIRCLE", circleId: "calc-survival", userId: "noah" });
  assert.equal(full.circles.find((x) => x.id === "calc-survival")!.memberIds.length, 5);

  // Third member finishing challenge c1 → milestone for everyone who did it.
  s = reducer(s, { type: "TOGGLE_CHALLENGE", circleId: "calc-survival", challengeId: "c1", userId: ME, at: AT });
  assert.equal(totalXp(s.xp, ME), before + 15 + 25);
  assert.equal(totalXp(s.xp, "maya"), 25);
  // Untoggle + retoggle can't farm it.
  s = reducer(s, { type: "TOGGLE_CHALLENGE", circleId: "calc-survival", challengeId: "c1", userId: ME, at: AT });
  s = reducer(s, { type: "TOGGLE_CHALLENGE", circleId: "calc-survival", challengeId: "c1", userId: ME, at: AT });
  assert.equal(totalXp(s.xp, ME), before + 15 + 25);
  assert.ok(computeBadges(s, ME).find((b) => b.id === "community-builder")!.earned);
});

test("week keys", () => {
  assert.equal(weekKey(Date.UTC(2026, 0, 1)), "2026-W01");
  assert.equal(weekKey(Date.UTC(2026, 9, 21)), "2026-W43");
});

test("go-together invites dedupe and respond", () => {
  const invite = {
    type: "GO_WITH_INVITE" as const,
    resourceId: "math-center",
    courseId: "MATH 1914",
    toId: "hannah",
    slot: "wed-afternoon" as const,
    at: AT,
  };
  let s = reducer(reducer(seedState(), invite), invite);
  assert.equal(s.goTogether.length, 1);
  s = reducer(s, { type: "GO_WITH_RESPOND", id: s.goTogether[0].id, accept: true });
  assert.equal(s.goTogether[0].status, "confirmed");
});
