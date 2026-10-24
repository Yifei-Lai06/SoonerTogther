// Cloud mapping and helper tests (pure functions, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildState, friendlyError, type CloudRows } from "../src/lib/cloud.ts";
import { safeNext } from "../src/lib/supabase/config.ts";
import { computeBadges } from "../src/lib/xp.ts";

const ME = "11111111-1111-4111-8111-111111111111";
const MAYA = "22222222-2222-4222-8222-222222222222";

function rows(extra: Partial<CloudRows> = {}): CloudRows {
  return {
    meId: ME,
    profiles: [
      { id: ME, display_name: "Alex Rivera", avatar_color: "#841617", major: "CS", year: "Freshman", modes: ["discussion"], interests: ["Music"], courses: ["MATH 1914"], onboarded: true, xp: 30, format: "either", bio: "" },
      { id: MAYA, display_name: "Maya Chen", avatar_color: "#2F5D62", major: "Math", year: "Junior", modes: ["teaching"], interests: [], courses: [], onboarded: true, xp: 60, ou_verified: true, format: "online", bio: "hi" },
    ],
    tutorSubjects: [{ user_id: MAYA, course_id: "MATH 1914", topics: ["Chain Rule"], experience: "Took it" }],
    achievements: [{ user_id: MAYA, badge_id: "first-helper" }],
    privateProfile: { availability: ["wed-afternoon"] },
    helpNeeds: [{ course_id: "MATH 1914", topics: ["Chain Rule"] }],
    requests: [
      {
        id: "r1",
        requester_id: ME,
        recipient_id: MAYA,
        kind: "tutor",
        course_id: "MATH 1914",
        topics: ["Chain Rule"],
        mode: "discussion",
        note: "",
        status: "accepted",
        created_at: "2026-10-20T10:00:00Z",
        study_sessions: { id: "s1", tutor_id: MAYA, slot: "wed-afternoon", status: "completed", completed_at: "2026-10-21T10:00:00Z", goals: "g", notes: "", reflection: "", checklist: [], session_confirmations: [{ user_id: ME }, { user_id: MAYA }] },
      },
      { id: "r2", requester_id: MAYA, recipient_id: ME, kind: "partner", course_id: "CS 1323", topics: [], mode: "talk", note: "hey", status: "requested", created_at: "2026-10-22T10:00:00Z", study_sessions: [] },
      { id: "r3", requester_id: ME, recipient_id: MAYA, kind: "partner", course_id: "CS 1323", topics: [], mode: "talk", note: "", status: "accepted", created_at: "2026-10-19T10:00:00Z", study_sessions: [{ id: "s3", status: "unscheduled", checklist: [] }] },
    ],
    feedback: [{ session_id: "s1", helpful: true, again: true, connect: true }],
    circles: [
      {
        id: "c1", name: "Calc Circle", course_id: "MATH 1914", focus: ["Chain Rule"], weekly_objective: "x", day: "wed", part: "afternoon",
        time_label: "4:00 PM", format: "in-person", location: "Bizzell", capacity: 5, creator_id: null,
        circle_members: [{ user_id: MAYA, joined_at: "2026-10-02T00:00:00Z" }, { user_id: ME, joined_at: "2026-10-01T00:00:00Z" }],
        circle_challenges: [{ id: "ch2", text: "second", position: 1, challenge_completions: [] }, { id: "ch1", text: "first", position: 0, challenge_completions: [{ user_id: ME }] }],
        circle_attendance: [{ user_id: ME, week_key: "2026-W43" }],
      },
    ],
    connections: [{ id: "k1", user_a: ME, user_b: MAYA, created_at: "2026-10-21T11:00:00Z" }],
    xp: [{ key: "session:s1:me", user_id: ME, amount: 30, reason: "Completed", created_at: "2026-10-21T10:00:00Z" }],
    goTogether: [],
    goWith: [{ user_id: MAYA, resource_id: "math-center", course_id: "MATH 1914" }],
    ...extra,
  };
}

test("maps database rows into the UI state shape", () => {
  const s = buildState(rows());
  assert.equal(s.meId, ME);
  assert.equal(s.onboarded, true);
  const me = s.students.find((x) => x.id === ME)!;
  const maya = s.students.find((x) => x.id === MAYA)!;
  assert.deepEqual(me.availability, ["wed-afternoon"]);
  assert.deepEqual(me.needsHelp, [{ courseId: "MATH 1914", topics: ["Chain Rule"] }]);
  assert.deepEqual(maya.availability, [], "other people's schedules are never in browser state");
  assert.deepEqual(maya.needsHelp, []);
  assert.equal(maya.ouVerified, true);
  assert.deepEqual(maya.badges, ["first-helper"]);
  assert.equal(maya.canTutor[0].courseId, "MATH 1914");
});

test("session statuses combine request + session rows", () => {
  const s = buildState(rows());
  const byId = Object.fromEntries(s.sessions.map((x) => [x.id, x]));
  assert.equal(byId.r1.status, "completed");
  assert.equal(byId.r1.tutorId, MAYA);
  assert.deepEqual(byId.r1.confirmations, { [ME]: true, [MAYA]: true });
  assert.deepEqual(byId.r1.feedback, { [ME]: { helpful: true, again: true, connect: true } });
  assert.equal(byId.r2.status, "requested");
  assert.equal(byId.r3.status, "accepted", "accepted but unscheduled → pick a time");
  assert.deepEqual(s.sessions.map((x) => x.id), ["r2", "r1", "r3"], "newest first");
});

test("circles keep join order, challenge order and weekly attendance", () => {
  const c = buildState(rows()).circles[0];
  assert.deepEqual(c.memberIds, [ME, MAYA]);
  assert.deepEqual(c.challenges.map((x) => x.id), ["ch1", "ch2"]);
  assert.deepEqual(c.attendance, { "2026-W43": [ME] });
  assert.equal(c.time, "4:00 PM");
});

test("connections carry shared session history; badges compute from cloud state", () => {
  const s = buildState(rows());
  assert.deepEqual(s.connections[0].userIds, [ME, MAYA]);
  assert.deepEqual(s.connections[0].sessionIds, ["r1"]);
  const badges = computeBadges(s, MAYA);
  assert.equal(badges.find((b) => b.id === "first-helper")!.earned, true);
});

test("friendly errors never leak raw database text", () => {
  assert.equal(friendlyError('new row violates... already_open'), "You already have an open request or session with them for this course.");
  assert.equal(friendlyError("some internal stack trace"), "Something went wrong. Please try again.");
});

test("post-login redirects stay on this site", () => {
  assert.equal(safeNext("/sessions/abc"), "/sessions/abc");
  assert.equal(safeNext("https://evil.example"), "/dashboard");
  assert.equal(safeNext("//evil.example"), "/dashboard");
  assert.equal(safeNext("/\\evil.example"), "/dashboard");
  assert.equal(safeNext(null), "/dashboard");
});
