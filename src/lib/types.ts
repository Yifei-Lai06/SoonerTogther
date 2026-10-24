// Core domain types for SoonerTogether. Pure data — no React here, so the
// matching, XP and state logic can be unit-tested with plain Node.

export type Mode = "teaching" | "discussion" | "talk";
export type MeetFormat = "in-person" | "online" | "either";
export type MatchKind = "tutor" | "partner" | "circle";

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type DayPart = "morning" | "afternoon" | "evening";
export type SlotId = `${Day}-${DayPart}`;

export type Year = "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate";

export interface Course {
  id: string; // e.g. "MATH 1914"
  title: string;
  dept: string;
  topics: string[];
}

export interface TutorSubject {
  courseId: string;
  topics: string[];
  /** Self-described, never verified credentials. */
  experience: string;
}

export interface HelpNeed {
  courseId: string;
  topics: string[];
}

export interface Student {
  id: string;
  name: string;
  avatarColor: string;
  email?: string; // private: never rendered on public surfaces
  major: string;
  year: Year;
  courses: string[];
  needsHelp: HelpNeed[];
  canTutor: TutorSubject[];
  modes: Mode[];
  availability: SlotId[]; // private: only overlaps are shown to others
  interests: string[];
  format: MeetFormat;
  bio: string;
  /** Has never had a peer session before — tutors who help them get a bonus. */
  firstTimeLearner?: boolean;
  /** Cloud only: Google profile photo (https). */
  avatarUrl?: string | null;
  /** Cloud only: server-maintained XP total (for other people's profiles). */
  xp?: number;
  /** Cloud only: verified through a confirmed @ou.edu address. */
  ouVerified?: boolean;
  /** Cloud only: badges earned (from the achievements table). */
  badges?: string[];
  /** Has seen the guided intro (stored on the account, so it follows the user across devices). */
  introSeen?: boolean;
  /** What other students may see on this profile. Missing = everything visible. */
  visibility?: ProfileVisibility;
  /** Personal look & feel (synced to the account in cloud mode). */
  appearance?: Appearance;
}

export type Accent = "blue" | "teal" | "coral";

export interface Appearance {
  accent: Accent;
  reduceMotion: boolean;
  showDoodles: boolean;
}

export const DEFAULT_APPEARANCE: Appearance = { accent: "blue", reduceMotion: false, showDoodles: true };

export interface ProfileVisibility {
  circles: boolean;
  xp: boolean;
  interests: boolean;
}

export interface MatchRequest {
  courseId: string;
  topics: string[];
  kind: MatchKind;
  mode: Mode;
  format: MeetFormat;
  slots: SlotId[];
}

export type SessionStatus =
  | "requested"
  | "accepted"
  | "scheduled"
  | "completed"
  | "declined"
  | "cancelled";

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface SessionFeedback {
  helpful: boolean;
  again: boolean;
  connect: boolean;
}

export interface Session {
  id: string;
  /** Who asked for the session. */
  requesterId: string;
  /** Who was asked (tutor or study partner). */
  partnerId: string;
  /** The participant who teaches in Teaching Mode, if any. */
  tutorId: string | null;
  kind: "tutor" | "partner";
  courseId: string;
  topics: string[];
  mode: Mode;
  note: string;
  status: SessionStatus;
  slot: SlotId | null;
  createdAt: number;
  completedAt: number | null;
  goals: string;
  checklist: ChecklistItem[];
  notes: string;
  reflection: string;
  confirmations: Record<string, boolean>;
  /** Private per participant. Never shown to the other person. */
  feedback: Record<string, SessionFeedback>;
}

export interface Challenge {
  id: string;
  text: string;
  doneBy: string[];
}

export interface Circle {
  id: string;
  name: string;
  courseId: string;
  focus: string[];
  weeklyObjective: string;
  day: Day;
  time: string; // display only, e.g. "4:00 PM"
  part: DayPart;
  format: MeetFormat;
  location: string;
  capacity: number;
  memberIds: string[];
  creatorId: string;
  challenges: Challenge[];
  /** weekKey → userIds who checked in that week */
  attendance: Record<string, string[]>;
  /** Rotation of who leads (teaches) each meeting. */
  leadRotation: string[];
}

export interface Connection {
  id: string;
  userIds: [string, string];
  since: number;
  sessionIds: string[];
}

export interface XpEvent {
  /** Unique key — the same key can never be awarded twice. */
  key: string;
  userId: string;
  amount: number;
  reason: string;
  at: number;
}

export interface GoTogether {
  id: string;
  resourceId: string;
  courseId: string;
  fromId: string;
  toId: string;
  slot: SlotId;
  status: "invited" | "confirmed" | "declined";
  createdAt: number;
}

/** Another student's standing interest in visiting a campus resource. */
export interface GoWithInterest {
  studentId: string;
  resourceId: string;
  courseId: string;
}

export interface AppState {
  version: number;
  meId: string;
  onboarded: boolean;
  students: Student[];
  sessions: Session[];
  circles: Circle[];
  connections: Connection[];
  xp: XpEvent[];
  goTogether: GoTogether[];
  goWithInterests: GoWithInterest[];
  nextId: number;
}
