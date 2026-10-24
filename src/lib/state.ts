// Pure reducer for all app state. Every demo control dispatches the same
// actions a real user would, so the demo and the product share one code path.

import { courseById } from "./data/catalog.ts";
import { seedState } from "./data/seed.ts";
import type {
  AppState,
  ChecklistItem,
  Circle,
  Connection,
  MeetFormat,
  Appearance,
  Mode,
  ProfileVisibility,
  Session,
  SessionFeedback,
  SlotId,
  Student,
} from "./types.ts";
import { award, REWARDS, sessionXpAllowed, weekKey } from "./xp.ts";
import { intersect } from "./matching.ts";

export type Action =
  | { type: "RESET" }
  | { type: "UPDATE_PROFILE"; patch: Partial<Omit<Student, "id">> }
  | { type: "COMPLETE_ONBOARDING" }
  | {
      type: "REQUEST_SESSION";
      partnerId: string;
      kind: "tutor" | "partner";
      courseId: string;
      topics: string[];
      mode: Mode;
      note: string;
      at: number;
    }
  | { type: "RESPOND_REQUEST"; sessionId: string; accept: boolean }
  | { type: "SCHEDULE_SESSION"; sessionId: string; slot: SlotId }
  | { type: "SET_MODE"; sessionId: string; mode: Mode }
  | {
      type: "UPDATE_WORKSPACE";
      sessionId: string;
      patch: Partial<Pick<Session, "goals" | "notes" | "reflection" | "checklist">>;
    }
  | { type: "CONFIRM_COMPLETE"; sessionId: string; userId: string; at: number }
  | { type: "SUBMIT_FEEDBACK"; sessionId: string; userId: string; feedback: SessionFeedback; at: number }
  | { type: "CANCEL_SESSION"; sessionId: string }
  | { type: "JOIN_CIRCLE"; circleId: string; userId: string }
  | { type: "LEAVE_CIRCLE"; circleId: string; userId: string }
  | {
      type: "CREATE_CIRCLE";
      circle: Pick<
        Circle,
        "name" | "courseId" | "focus" | "weeklyObjective" | "day" | "time" | "part" | "format" | "location" | "capacity"
      >;
    }
  | { type: "ATTEND_CIRCLE"; circleId: string; userId: string; at: number }
  | { type: "TOGGLE_CHALLENGE"; circleId: string; challengeId: string; userId: string; at: number }
  | { type: "GO_WITH_INVITE"; resourceId: string; courseId: string; toId: string; slot: SlotId; at: number }
  | { type: "GO_WITH_RESPOND"; id: string; accept: boolean }
  | { type: "SET_GO_WITH_INTEREST"; resourceId: string; courseId: string; on: boolean }
  | { type: "MARK_INTRO_SEEN" }
  | { type: "SET_VISIBILITY"; visibility: ProfileVisibility }
  | { type: "SET_APPEARANCE"; appearance: Appearance }
  | { type: "SET_AVATAR"; url: string | null };

export const OPEN_STATUSES: Session["status"][] = ["requested", "accepted", "scheduled"];

export function studentById(state: AppState, id: string): Student | undefined {
  return state.students.find((s) => s.id === id);
}

export function me(state: AppState): Student {
  return studentById(state, state.meId)!;
}

export function otherId(session: Session, userId: string): string {
  return session.requesterId === userId ? session.partnerId : session.requesterId;
}

export function mutualSlots(a: Student, b: Student): SlotId[] {
  return intersect(a.availability, b.availability);
}

export function openSessionWith(state: AppState, a: string, b: string, courseId: string): Session | undefined {
  return state.sessions.find(
    (s) =>
      OPEN_STATUSES.includes(s.status) &&
      s.courseId === courseId &&
      ((s.requesterId === a && s.partnerId === b) || (s.requesterId === b && s.partnerId === a)),
  );
}

export function connectionBetween(state: AppState, a: string, b: string): Connection | undefined {
  return state.connections.find((c) => c.userIds.includes(a) && c.userIds.includes(b));
}

/** The shared "Group milestone" rule: a challenge counts once 3 members (or every member of a tiny circle) finish it. */
export function challengeComplete(circle: Circle, doneBy: string[]): boolean {
  const done = doneBy.filter((id) => circle.memberIds.includes(id)).length;
  return done >= Math.min(3, circle.memberIds.length);
}

function defaultChecklist(topics: string[], mode: Mode): ChecklistItem[] {
  if (mode === "talk") return [];
  return topics.map((t) => ({ text: `Work through ${t}`, done: false }));
}

function defaultGoals(courseId: string, topics: string[], mode: Mode): string {
  const course = courseById(courseId)?.id ?? courseId;
  if (mode === "talk") return "Get to know each other and swap what's working this semester.";
  const what = topics.length > 0 ? topics.join(", ") : course;
  return mode === "teaching"
    ? `Understand ${what} well enough to try a new problem alone.`
    : `Reason through ${what} together until both of us can explain it.`;
}

function mapSession(state: AppState, id: string, fn: (s: Session) => Session): AppState {
  return { ...state, sessions: state.sessions.map((s) => (s.id === id ? fn(s) : s)) };
}

function mapCircle(state: AppState, id: string, fn: (c: Circle) => Circle): AppState {
  return { ...state, circles: state.circles.map((c) => (c.id === id ? fn(c) : c)) };
}

function firstName(state: AppState, id: string): string {
  return studentById(state, id)?.name.split(" ")[0] ?? "a classmate";
}

function completeSession(state: AppState, session: Session, at: number): AppState {
  const ids = [session.requesterId, session.partnerId];
  let xp = state.xp;
  for (const uid of ids) {
    if (!sessionXpAllowed(xp, uid, at)) continue; // daily cap: session still counts, no XP
    const partner = firstName(state, ids.find((x) => x !== uid)!);
    const verb = session.tutorId ? "tutoring session" : "study session";
    xp = award(xp, {
      key: `session:${session.id}:${uid}`,
      userId: uid,
      amount: REWARDS.sessionComplete,
      reason: `Completed a verified ${verb} with ${partner}`,
      at,
    }).events;
  }

  let students = state.students;
  if (session.tutorId) {
    const learnerId = otherId(session, session.tutorId);
    const learner = studentById(state, learnerId);
    if (learner?.firstTimeLearner) {
      xp = award(xp, {
        key: `first-timer:${session.id}`,
        userId: session.tutorId,
        amount: REWARDS.firstTimeLearner,
        reason: `Helped ${firstName(state, learnerId)}, a first-time learner`,
        at,
      }).events;
      students = students.map((s) => (s.id === learnerId ? { ...s, firstTimeLearner: false } : s));
    }
  }

  // Already-connected students get this session added to their shared history.
  const [a, b] = ids;
  const connections = state.connections.map((c) =>
    c.userIds.includes(a) && c.userIds.includes(b) && !c.sessionIds.includes(session.id)
      ? { ...c, sessionIds: [...c.sessionIds, session.id] }
      : c,
  );

  return {
    ...mapSession(state, session.id, (s) => ({ ...s, status: "completed", completedAt: at })),
    xp,
    students,
    connections,
  };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "RESET":
      return seedState();

    case "UPDATE_PROFILE":
      return {
        ...state,
        students: state.students.map((s) => (s.id === state.meId ? { ...s, ...action.patch } : s)),
      };

    case "COMPLETE_ONBOARDING":
      return { ...state, onboarded: true };

    case "REQUEST_SESSION": {
      if (action.partnerId === state.meId || !studentById(state, action.partnerId)) return state;
      if (openSessionWith(state, state.meId, action.partnerId, action.courseId)) return state;
      const id = `s-${state.nextId}`;
      const session: Session = {
        id,
        requesterId: state.meId,
        partnerId: action.partnerId,
        tutorId: action.kind === "tutor" ? action.partnerId : null,
        kind: action.kind,
        courseId: action.courseId,
        topics: action.topics,
        mode: action.mode,
        note: action.note.trim(),
        status: "requested",
        slot: null,
        createdAt: action.at,
        completedAt: null,
        goals: defaultGoals(action.courseId, action.topics, action.mode),
        checklist: defaultChecklist(action.topics, action.mode),
        notes: "",
        reflection: "",
        confirmations: {},
        feedback: {},
      };
      return { ...state, sessions: [session, ...state.sessions], nextId: state.nextId + 1 };
    }

    case "RESPOND_REQUEST":
      return mapSession(state, action.sessionId, (s) =>
        s.status === "requested" ? { ...s, status: action.accept ? "accepted" : "declined" } : s,
      );

    case "SCHEDULE_SESSION": {
      const s = state.sessions.find((x) => x.id === action.sessionId);
      if (!s || (s.status !== "accepted" && s.status !== "scheduled")) return state;
      const a = studentById(state, s.requesterId);
      const b = studentById(state, s.partnerId);
      if (!a || !b || !mutualSlots(a, b).includes(action.slot)) return state;
      return mapSession(state, s.id, (x) => ({ ...x, status: "scheduled", slot: action.slot }));
    }

    case "SET_MODE":
      return mapSession(state, action.sessionId, (s) => {
        if (!OPEN_STATUSES.includes(s.status) || s.mode === action.mode) return s;
        return {
          ...s,
          mode: action.mode,
          goals: defaultGoals(s.courseId, s.topics, action.mode),
          checklist: s.checklist.length > 0 ? s.checklist : defaultChecklist(s.topics, action.mode),
        };
      });

    case "UPDATE_WORKSPACE":
      return mapSession(state, action.sessionId, (s) =>
        s.status === "scheduled" || s.status === "completed" ? { ...s, ...action.patch } : s,
      );

    case "CONFIRM_COMPLETE": {
      const s = state.sessions.find((x) => x.id === action.sessionId);
      if (!s || s.status !== "scheduled") return state;
      if (action.userId !== s.requesterId && action.userId !== s.partnerId) return state;
      const confirmations = { ...s.confirmations, [action.userId]: true };
      const updated = { ...s, confirmations };
      const next = mapSession(state, s.id, () => updated);
      return confirmations[s.requesterId] && confirmations[s.partnerId]
        ? completeSession(next, updated, action.at)
        : next;
    }

    case "SUBMIT_FEEDBACK": {
      const s = state.sessions.find((x) => x.id === action.sessionId);
      if (!s || s.status !== "completed") return state;
      if (action.userId !== s.requesterId && action.userId !== s.partnerId) return state;
      if (s.feedback[action.userId]) return state; // one private response per person, no re-claiming
      const feedback = { ...s.feedback, [action.userId]: action.feedback };
      let next = mapSession(state, s.id, (x) => ({ ...x, feedback }));
      const other = otherId(s, action.userId);

      if (action.feedback.helpful) {
        next = {
          ...next,
          xp: award(next.xp, {
            key: `helpful:${s.id}:${other}`,
            userId: other,
            amount: REWARDS.helpfulFeedback,
            reason: `${firstName(state, action.userId)} found your session helpful`,
            at: action.at,
          }).events,
        };
      }

      // A connection exists only when BOTH people privately said yes.
      const mine = feedback[action.userId];
      const theirs = feedback[other];
      if (mine?.connect && theirs?.connect && !connectionBetween(next, action.userId, other)) {
        const conn: Connection = {
          id: `conn-${next.nextId}`,
          userIds: [s.requesterId, s.partnerId],
          since: action.at,
          sessionIds: next.sessions
            .filter(
              (x) =>
                x.status === "completed" &&
                [x.requesterId, x.partnerId].includes(action.userId) &&
                [x.requesterId, x.partnerId].includes(other),
            )
            .map((x) => x.id),
        };
        next = { ...next, connections: [...next.connections, conn], nextId: next.nextId + 1 };
      }
      return next;
    }

    case "CANCEL_SESSION":
      return mapSession(state, action.sessionId, (s) =>
        OPEN_STATUSES.includes(s.status) ? { ...s, status: "cancelled" } : s,
      );

    case "JOIN_CIRCLE":
      return mapCircle(state, action.circleId, (c) =>
        c.memberIds.includes(action.userId) || c.memberIds.length >= c.capacity
          ? c
          : { ...c, memberIds: [...c.memberIds, action.userId], leadRotation: [...c.leadRotation, action.userId] },
      );

    case "LEAVE_CIRCLE":
      return mapCircle(state, action.circleId, (c) => ({
        ...c,
        memberIds: c.memberIds.filter((id) => id !== action.userId),
        leadRotation: c.leadRotation.filter((id) => id !== action.userId),
      }));

    case "CREATE_CIRCLE": {
      const id = `circle-${state.nextId}`;
      const capacity = Math.max(2, Math.min(8, Math.round(action.circle.capacity)));
      const circle: Circle = {
        ...action.circle,
        capacity,
        id,
        memberIds: [state.meId],
        creatorId: state.meId,
        challenges: [
          { id: "c1", text: "Everyone brings one question they're stuck on", doneBy: [] },
          { id: "c2", text: "Each member leads one explanation this week", doneBy: [] },
        ],
        attendance: {},
        leadRotation: [state.meId],
      };
      return { ...state, circles: [circle, ...state.circles], nextId: state.nextId + 1 };
    }

    case "ATTEND_CIRCLE": {
      const c = state.circles.find((x) => x.id === action.circleId);
      if (!c || !c.memberIds.includes(action.userId)) return state;
      const wk = weekKey(action.at);
      if ((c.attendance[wk] ?? []).includes(action.userId)) return state;
      const next = mapCircle(state, c.id, (x) => ({
        ...x,
        attendance: { ...x.attendance, [wk]: [...(x.attendance[wk] ?? []), action.userId] },
      }));
      return {
        ...next,
        xp: award(next.xp, {
          key: `circle:${c.id}:${wk}:${action.userId}`,
          userId: action.userId,
          amount: REWARDS.circleAttend,
          reason: `Attended ${c.name}`,
          at: action.at,
        }).events,
      };
    }

    case "TOGGLE_CHALLENGE": {
      const c = state.circles.find((x) => x.id === action.circleId);
      const ch = c?.challenges.find((x) => x.id === action.challengeId);
      if (!c || !ch || !c.memberIds.includes(action.userId)) return state;
      const wasComplete = challengeComplete(c, ch.doneBy);
      const doneBy = ch.doneBy.includes(action.userId)
        ? ch.doneBy.filter((id) => id !== action.userId)
        : [...ch.doneBy, action.userId];
      let next = mapCircle(state, c.id, (x) => ({
        ...x,
        challenges: x.challenges.map((y) => (y.id === ch.id ? { ...y, doneBy } : y)),
      }));
      if (!wasComplete && challengeComplete(c, doneBy)) {
        let xp = next.xp;
        for (const uid of doneBy.filter((id) => c.memberIds.includes(id))) {
          xp = award(xp, {
            key: `milestone:${c.id}:${ch.id}:${uid}`,
            userId: uid,
            amount: REWARDS.groupMilestone,
            reason: `${c.name} completed a group challenge`,
            at: action.at,
          }).events;
        }
        next = { ...next, xp };
      }
      return next;
    }

    case "GO_WITH_INVITE": {
      const dup = state.goTogether.find(
        (g) =>
          g.fromId === state.meId &&
          g.toId === action.toId &&
          g.resourceId === action.resourceId &&
          g.status !== "declined",
      );
      if (dup) return state;
      return {
        ...state,
        goTogether: [
          {
            id: `go-${state.nextId}`,
            resourceId: action.resourceId,
            courseId: action.courseId,
            fromId: state.meId,
            toId: action.toId,
            slot: action.slot,
            status: "invited",
            createdAt: action.at,
          },
          ...state.goTogether,
        ],
        nextId: state.nextId + 1,
      };
    }

    case "GO_WITH_RESPOND":
      return {
        ...state,
        goTogether: state.goTogether.map((g) =>
          g.id === action.id && g.status === "invited"
            ? { ...g, status: action.accept ? "confirmed" : "declined" }
            : g,
        ),
      };

    case "MARK_INTRO_SEEN":
      return { ...state, students: state.students.map((s) => (s.id === state.meId ? { ...s, introSeen: true } : s)) };

    case "SET_APPEARANCE":
      return { ...state, students: state.students.map((s) => (s.id === state.meId ? { ...s, appearance: action.appearance } : s)) };

    case "SET_AVATAR":
      return { ...state, students: state.students.map((s) => (s.id === state.meId ? { ...s, avatarUrl: action.url } : s)) };

    case "SET_VISIBILITY":
      return {
        ...state,
        students: state.students.map((s) => (s.id === state.meId ? { ...s, visibility: action.visibility } : s)),
      };

    case "SET_GO_WITH_INTEREST": {
      const rest = state.goWithInterests.filter(
        (g) => !(g.studentId === state.meId && g.resourceId === action.resourceId && g.courseId === action.courseId),
      );
      return {
        ...state,
        goWithInterests: action.on
          ? [...rest, { studentId: state.meId, resourceId: action.resourceId, courseId: action.courseId }]
          : rest,
      };
    }

    default:
      return state;
  }
}

/** XP total for anyone: the ledger for the current user, the server total for others (cloud). */
export function xpFor(state: AppState, id: string): number {
  const own = state.xp.filter((e) => e.userId === id).reduce((s, e) => s + e.amount, 0);
  if (id === state.meId) return own;
  return studentById(state, id)?.xp ?? own;
}

export function formatLabel(f: MeetFormat): string {
  return f === "in-person" ? "In person" : f === "online" ? "Online" : "In person or online";
}
