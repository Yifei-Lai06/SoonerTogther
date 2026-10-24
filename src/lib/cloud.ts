// Cloud backend: loads the signed-in user's view of the database into the same
// AppState shape the UI already uses, and turns UI actions into server-side RPCs.
// Row Level Security decides what each query can see.

import type { SupabaseClient } from "@supabase/supabase-js";
import { STATE_VERSION } from "./data/seed.ts";
import type { Action } from "./state.ts";
import type {
  Accent,
  AppState,
  Circle,
  Connection,
  Day,
  DayPart,
  GoTogether,
  MeetFormat,
  Mode,
  Session,
  SessionFeedback,
  SlotId,
  Student,
  XpEvent,
  Year,
} from "./types.ts";

type Row = Record<string, unknown>;
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v ? [v as T] : []);
const time = (v: unknown) => (typeof v === "string" ? Date.parse(v) : 0);

/** Friendly copy for errors raised by the database functions. */
export function friendlyError(message: string): string {
  const map: Record<string, string> = {
    cannot_match_self: "You can't send a request to yourself.",
    not_a_tutor_for_course: "They don't tutor that course anymore.",
    already_open: "You already have an open request or session with them for this course.",
    rate_limited: "Slow down a little — you've hit a limit. Try again later.",
    unavailable: "This person isn't available.",
    unknown_user: "That profile isn't available.",
    already_answered: "That request was already answered.",
    slot_not_mutual: "That time doesn't work for both of you anymore.",
    not_confirmable: "This session can't be confirmed right now.",
    already_submitted: "You already left feedback for this session.",
    circle_full: "This circle just filled up.",
    not_a_member: "Join the circle first.",
    invalid_length: "Messages must be between 1 and 2,000 characters.",
    not_authenticated: "Please sign in again.",
    not_found: "That item couldn't be found. It may have been removed.",
  };
  const key = Object.keys(map).find((k) => message.includes(k));
  return key ? map[key] : "Something went wrong. Please try again.";
}

export interface CloudRows {
  meId: string;
  profiles: Row[];
  tutorSubjects: Row[];
  achievements: Row[];
  privateProfile: Row | null;
  helpNeeds: Row[];
  requests: Row[];
  feedback: Row[];
  circles: Row[];
  connections: Row[];
  xp: Row[];
  goTogether: Row[];
  goWith: Row[];
}

/** Pure mapping from database rows to AppState (unit-tested). */
export function buildState(rows: CloudRows): AppState {
  const { meId } = rows;
  const me = rows.profiles.find((p) => p.id === meId);

  const students: Student[] = rows.profiles.map((p) => {
    const id = p.id as string;
    const isMe = id === meId;
    return {
      id,
      name: (p.display_name as string) || "New Sooner",
      avatarColor: (p.avatar_color as string) ?? "#0284C7",
      avatarUrl: (p.avatar_url as string | null) ?? null,
      major: (p.major as string) ?? "",
      year: ((p.year as Year) ?? "Freshman") as Year,
      courses: arr<string>(p.courses),
      needsHelp: isMe ? rows.helpNeeds.map((h) => ({ courseId: h.course_id as string, topics: arr<string>(h.topics) })) : [],
      canTutor: rows.tutorSubjects
        .filter((t) => t.user_id === id)
        .map((t) => ({ courseId: t.course_id as string, topics: arr<string>(t.topics), experience: (t.experience as string) ?? "" })),
      modes: arr<Mode>(p.modes),
      availability: isMe ? arr<SlotId>(rows.privateProfile?.availability) : [],
      interests: arr<string>(p.interests),
      format: ((p.format as MeetFormat) ?? "either") as MeetFormat,
      bio: (p.bio as string) ?? "",
      firstTimeLearner: !!p.first_time_learner,
      xp: (p.xp as number) ?? 0,
      ouVerified: !!p.ou_verified,
      badges: rows.achievements.filter((a) => a.user_id === id).map((a) => a.badge_id as string),
      introSeen: !!p.intro_seen_at,
      visibility: { circles: p.show_circles !== false, xp: p.show_xp !== false, interests: p.show_interests !== false },
      appearance: isMe
        ? { accent: ((p.accent as Accent) ?? "blue") as Accent, reduceMotion: !!p.reduce_motion, showDoodles: p.show_doodles !== false }
        : undefined,
    };
  });

  const myFeedback = new Map<string, SessionFeedback>(
    rows.feedback.map((f) => [f.session_id as string, { helpful: !!f.helpful, again: !!f.again, connect: !!f.connect }]),
  );

  const sessions: Session[] = rows.requests.map((r) => {
    const s = arr<Row>(r.study_sessions)[0];
    const confirmations: Record<string, boolean> = {};
    for (const c of arr<Row>(s?.session_confirmations)) confirmations[c.user_id as string] = true;
    let status: Session["status"] = r.status as Session["status"];
    if (r.status === "accepted" && s) {
      status = s.status === "unscheduled" ? "accepted" : (s.status as Session["status"]);
    }
    const fb = s ? myFeedback.get(s.id as string) : undefined;
    return {
      id: r.id as string,
      requesterId: r.requester_id as string,
      partnerId: r.recipient_id as string,
      tutorId: (s?.tutor_id as string | null) ?? (r.kind === "tutor" ? (r.recipient_id as string) : null),
      kind: r.kind as Session["kind"],
      courseId: r.course_id as string,
      topics: arr<string>(r.topics),
      mode: r.mode as Mode,
      note: (r.note as string) ?? "",
      status,
      slot: (s?.slot as SlotId | null) ?? null,
      createdAt: time(r.created_at),
      completedAt: s?.completed_at ? time(s.completed_at) : null,
      goals: (s?.goals as string) ?? "",
      checklist: arr<{ text: string; done: boolean }>(s?.checklist),
      notes: (s?.notes as string) ?? "",
      reflection: (s?.reflection as string) ?? "",
      confirmations,
      feedback: fb ? { [meId]: fb } : {},
    };
  });
  sessions.sort((a, b) => b.createdAt - a.createdAt);

  const circles: Circle[] = rows.circles.map((c) => {
    const members = arr<Row>(c.circle_members).sort((a, b) => time(a.joined_at) - time(b.joined_at));
    const attendance: Record<string, string[]> = {};
    for (const a of arr<Row>(c.circle_attendance)) (attendance[a.week_key as string] ??= []).push(a.user_id as string);
    const memberIds = members.map((m) => m.user_id as string);
    return {
      id: c.id as string,
      name: c.name as string,
      courseId: c.course_id as string,
      focus: arr<string>(c.focus),
      weeklyObjective: c.weekly_objective as string,
      day: c.day as Day,
      part: c.part as DayPart,
      time: c.time_label as string,
      format: c.format as MeetFormat,
      location: (c.location as string) ?? "",
      capacity: c.capacity as number,
      memberIds,
      creatorId: (c.creator_id as string | null) ?? "",
      challenges: arr<Row>(c.circle_challenges)
        .sort((a, b) => (a.position as number) - (b.position as number))
        .map((ch) => ({
          id: ch.id as string,
          text: ch.text as string,
          doneBy: arr<Row>(ch.challenge_completions).map((d) => d.user_id as string),
        })),
      attendance,
      leadRotation: memberIds,
    };
  });

  const completedWith = (other: string) =>
    sessions
      .filter((s) => s.status === "completed" && [s.requesterId, s.partnerId].includes(other))
      .map((s) => s.id);

  const connections: Connection[] = rows.connections.map((c) => {
    const other = (c.user_a === meId ? c.user_b : c.user_a) as string;
    return { id: c.id as string, userIds: [meId, other], since: time(c.created_at), sessionIds: completedWith(other) };
  });

  const xp: XpEvent[] = rows.xp.map((e) => ({
    key: e.key as string,
    userId: e.user_id as string,
    amount: e.amount as number,
    reason: e.reason as string,
    at: time(e.created_at),
  }));

  const goTogether: GoTogether[] = rows.goTogether.map((g) => ({
    id: g.id as string,
    resourceId: g.resource_id as string,
    courseId: g.course_id as string,
    fromId: g.from_id as string,
    toId: g.to_id as string,
    slot: g.slot as SlotId,
    status: g.status as GoTogether["status"],
    createdAt: time(g.created_at),
  }));

  return {
    version: STATE_VERSION,
    meId,
    onboarded: !!me?.onboarded,
    students,
    sessions,
    circles,
    connections,
    xp,
    goTogether,
    goWithInterests: rows.goWith.map((g) => ({
      studentId: g.user_id as string,
      resourceId: g.resource_id as string,
      courseId: g.course_id as string,
    })),
    nextId: 0,
  };
}

async function q<T = Row[]>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export async function loadCloudState(sb: SupabaseClient, meId: string): Promise<AppState> {
  const [profiles, tutorSubjects, achievements, priv, helpNeeds, requests, feedback, circles, connections, xp, goTogether, goWith] =
    await Promise.all([
      q(
        sb
          .from("profiles")
          .select("id, display_name, avatar_color, avatar_url, major, year, bio, format, modes, interests, courses, onboarded, first_time_learner, ou_verified, xp, intro_seen_at, show_circles, show_xp, show_interests, accent, reduce_motion, show_doodles")
          .or(`onboarded.eq.true,id.eq.${meId}`)
          .limit(1000),
      ),
      q(sb.from("tutor_subjects").select("user_id, course_id, topics, experience").limit(5000)),
      q(sb.from("achievements").select("user_id, badge_id").limit(5000)),
      q(sb.from("private_profiles").select("availability").eq("user_id", meId)),
      q(sb.from("help_needs").select("course_id, topics")),
      q(
        sb
          .from("match_requests")
          .select("*, study_sessions(*, session_confirmations(user_id))")
          .order("created_at", { ascending: false })
          .limit(200),
      ),
      q(sb.from("session_feedback").select("session_id, helpful, again, connect")),
      q(
        sb
          .from("circles")
          .select("*, circle_members(user_id, joined_at), circle_challenges(id, text, position, challenge_completions(user_id)), circle_attendance(user_id, week_key)")
          .order("created_at", { ascending: true })
          .limit(200),
      ),
      q(sb.from("connections").select("*")),
      q(sb.from("xp_events").select("key, user_id, amount, reason, created_at").order("created_at", { ascending: false }).limit(500)),
      q(sb.from("go_together").select("*").order("created_at", { ascending: false })),
      q(sb.from("go_with_interests").select("user_id, resource_id, course_id").limit(2000)),
    ]);

  return buildState({
    meId,
    profiles,
    tutorSubjects,
    achievements,
    privateProfile: (priv as Row[])[0] ?? null,
    helpNeeds,
    requests,
    feedback,
    circles,
    connections,
    xp,
    goTogether,
    goWith,
  });
}

async function rpc(sb: SupabaseClient, fn: string, args: Row): Promise<unknown> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

async function replaceSubjects(sb: SupabaseClient, meId: string, table: "tutor_subjects" | "help_needs", rows: Row[]) {
  const keep = rows.map((r) => r.course_id as string);
  const del = sb.from(table).delete().eq("user_id", meId);
  await q(keep.length ? del.not("course_id", "in", `(${keep.map((k) => `"${k}"`).join(",")})`) : del);
  if (rows.length) await q(sb.from(table).upsert(rows.map((r) => ({ ...r, user_id: meId }))));
}

/** Runs one UI action against the database. Returns the new id for create actions. */
export async function runCloudAction(sb: SupabaseClient, meId: string, action: Action): Promise<string | undefined> {
  switch (action.type) {
    case "UPDATE_PROFILE": {
      const p = action.patch;
      const profile: Row = {};
      if (p.name !== undefined) profile.display_name = p.name.slice(0, 60);
      if (p.avatarColor !== undefined) profile.avatar_color = p.avatarColor;
      if (p.major !== undefined) profile.major = p.major;
      if (p.year !== undefined) profile.year = p.year;
      if (p.bio !== undefined) profile.bio = p.bio.slice(0, 280);
      if (p.format !== undefined) profile.format = p.format;
      if (p.modes !== undefined) profile.modes = p.modes;
      if (p.interests !== undefined) profile.interests = p.interests;
      if (p.courses !== undefined) profile.courses = p.courses;
      if (Object.keys(profile).length) await q(sb.from("profiles").update(profile).eq("id", meId));
      if (p.availability !== undefined) await q(sb.from("private_profiles").update({ availability: p.availability }).eq("user_id", meId));
      if (p.canTutor !== undefined)
        await replaceSubjects(sb, meId, "tutor_subjects", p.canTutor.map((t) => ({ course_id: t.courseId, topics: t.topics, experience: t.experience.slice(0, 200) })));
      if (p.needsHelp !== undefined)
        await replaceSubjects(sb, meId, "help_needs", p.needsHelp.map((n) => ({ course_id: n.courseId, topics: n.topics })));
      return;
    }
    case "COMPLETE_ONBOARDING":
      await q(sb.from("profiles").update({ onboarded: true }).eq("id", meId));
      return;
    case "REQUEST_SESSION":
      return (await rpc(sb, "request_session", {
        p_recipient: action.partnerId,
        p_kind: action.kind,
        p_course: action.courseId,
        p_topics: action.topics,
        p_mode: action.mode,
        p_note: action.note,
      })) as string;
    case "RESPOND_REQUEST":
      await rpc(sb, "respond_request", { p_request: action.sessionId, p_accept: action.accept });
      return;
    case "SCHEDULE_SESSION":
      await rpc(sb, "schedule_session", { p_request: action.sessionId, p_slot: action.slot });
      return;
    case "SET_MODE":
      await rpc(sb, "set_session_mode", { p_request: action.sessionId, p_mode: action.mode });
      return;
    case "UPDATE_WORKSPACE":
      await rpc(sb, "update_workspace", {
        p_request: action.sessionId,
        p_goals: action.patch.goals ?? null,
        p_notes: action.patch.notes ?? null,
        p_reflection: action.patch.reflection ?? null,
        p_checklist: action.patch.checklist ?? null,
      });
      return;
    case "CONFIRM_COMPLETE":
      await rpc(sb, "confirm_session", { p_request: action.sessionId });
      return;
    case "SUBMIT_FEEDBACK":
      await rpc(sb, "submit_feedback", {
        p_request: action.sessionId,
        p_helpful: action.feedback.helpful,
        p_again: action.feedback.again,
        p_connect: action.feedback.connect,
      });
      return;
    case "CANCEL_SESSION":
      await rpc(sb, "cancel_request", { p_request: action.sessionId });
      return;
    case "JOIN_CIRCLE":
      await rpc(sb, "join_circle", { p_circle: action.circleId });
      return;
    case "LEAVE_CIRCLE":
      await rpc(sb, "leave_circle", { p_circle: action.circleId });
      return;
    case "CREATE_CIRCLE": {
      const c = action.circle;
      return (await rpc(sb, "create_circle", {
        p_name: c.name,
        p_course: c.courseId,
        p_focus: c.focus,
        p_objective: c.weeklyObjective,
        p_day: c.day,
        p_part: c.part,
        p_time: c.time,
        p_format: c.format,
        p_location: c.location,
        p_capacity: c.capacity,
      })) as string;
    }
    case "ATTEND_CIRCLE":
      await rpc(sb, "attend_circle", { p_circle: action.circleId });
      return;
    case "TOGGLE_CHALLENGE":
      await rpc(sb, "toggle_challenge", { p_challenge: action.challengeId });
      return;
    case "GO_WITH_INVITE":
      return (await rpc(sb, "go_with_invite", {
        p_to: action.toId,
        p_resource: action.resourceId,
        p_course: action.courseId,
        p_slot: action.slot,
      })) as string;
    case "GO_WITH_RESPOND":
      await rpc(sb, "go_with_respond", { p_invite: action.id, p_accept: action.accept });
      return;
    case "SET_GO_WITH_INTEREST":
      if (action.on) {
        await q(sb.from("go_with_interests").upsert({ user_id: meId, resource_id: action.resourceId, course_id: action.courseId }));
      } else {
        await q(sb.from("go_with_interests").delete().match({ user_id: meId, resource_id: action.resourceId, course_id: action.courseId }));
      }
      return;
    case "MARK_INTRO_SEEN":
      await q(sb.from("profiles").update({ intro_seen_at: new Date().toISOString() }).eq("id", meId));
      return;
    case "SET_VISIBILITY":
      await q(
        sb
          .from("profiles")
          .update({ show_circles: action.visibility.circles, show_xp: action.visibility.xp, show_interests: action.visibility.interests })
          .eq("id", meId),
      );
      return;
    case "SET_APPEARANCE":
      await q(
        sb
          .from("profiles")
          .update({ accent: action.appearance.accent, reduce_motion: action.appearance.reduceMotion, show_doodles: action.appearance.showDoodles })
          .eq("id", meId),
      );
      return;
    case "SET_AVATAR":
      await q(sb.from("profiles").update({ avatar_url: action.url }).eq("id", meId));
      return;
    case "RESET":
      return;
  }
}
