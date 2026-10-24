import type { Course, Day, DayPart, Mode, SlotId } from "../types.ts";

export const COURSES: Course[] = [
  {
    id: "MATH 1914",
    title: "Differential & Integral Calculus I",
    dept: "Mathematics",
    topics: [
      "Limits",
      "Continuity",
      "Derivative rules",
      "Chain Rule",
      "Implicit differentiation",
      "Related rates",
      "Linear approximation",
      "Optimization",
      "Integrals",
    ],
  },
  {
    id: "MATH 2924",
    title: "Differential & Integral Calculus II",
    dept: "Mathematics",
    topics: ["Integration by parts", "Trig substitution", "Series", "Convergence tests", "Parametric curves"],
  },
  {
    id: "CS 1323",
    title: "Introduction to Computer Programming",
    dept: "Computer Science",
    topics: ["Java basics", "Arrays", "For-loops", "Methods", "Objects", "Debugging"],
  },
  {
    id: "CS 2413",
    title: "Data Structures",
    dept: "Computer Science",
    topics: ["Linked lists", "Stacks & queues", "Trees", "Big-O", "Hash tables", "Recursion"],
  },
  {
    id: "CHEM 1315",
    title: "General Chemistry",
    dept: "Chemistry",
    topics: ["Stoichiometry", "Gas laws", "Thermochemistry", "Electron configuration", "Bonding"],
  },
  {
    id: "PHYS 2514",
    title: "General Physics for Engineering & Science Majors I",
    dept: "Physics",
    topics: ["Kinematics", "Newton's laws", "Work & energy", "Momentum", "Rotational motion"],
  },
  {
    id: "ENGL 1113",
    title: "Principles of English Composition I",
    dept: "English",
    topics: ["Thesis statements", "Essay structure", "Citations", "Revision", "Argument"],
  },
  {
    id: "ECON 1123",
    title: "Principles of Economics: Micro",
    dept: "Economics",
    topics: ["Supply & demand", "Elasticity", "Market structures", "Consumer choice", "Graph reading"],
  },
];

export function courseById(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id);
}

export const DAYS: { id: Day; short: string; long: string }[] = [
  { id: "mon", short: "Mon", long: "Monday" },
  { id: "tue", short: "Tue", long: "Tuesday" },
  { id: "wed", short: "Wed", long: "Wednesday" },
  { id: "thu", short: "Thu", long: "Thursday" },
  { id: "fri", short: "Fri", long: "Friday" },
  { id: "sat", short: "Sat", long: "Saturday" },
  { id: "sun", short: "Sun", long: "Sunday" },
];

export const PARTS: { id: DayPart; label: string; hours: string }[] = [
  { id: "morning", label: "Morning", hours: "8–12" },
  { id: "afternoon", label: "Afternoon", hours: "12–5" },
  { id: "evening", label: "Evening", hours: "5–9" },
];

export function slotLabel(slot: SlotId): string {
  const [d, p] = slot.split("-") as [Day, DayPart];
  const day = DAYS.find((x) => x.id === d)?.long ?? d;
  const part = PARTS.find((x) => x.id === p)?.label ?? p;
  return `${day} ${part.toLowerCase()}`;
}

export function slotShort(slot: SlotId): string {
  const [d, p] = slot.split("-") as [Day, DayPart];
  const day = DAYS.find((x) => x.id === d)?.short ?? d;
  const part = PARTS.find((x) => x.id === p)?.label ?? p;
  return `${day} ${part}`;
}

/** Slots in a stable calendar order, so lists never shuffle. */
export function sortSlots(slots: SlotId[]): SlotId[] {
  const order = (s: SlotId) => {
    const [d, p] = s.split("-");
    return DAYS.findIndex((x) => x.id === d) * 3 + PARTS.findIndex((x) => x.id === p);
  };
  return [...slots].sort((a, b) => order(a) - order(b));
}

export const MODES: Record<
  Mode,
  { label: string; tagline: string; description: string; example: string; features: string[] }
> = {
  teaching: {
    label: "Teaching Mode",
    tagline: "One explains, one learns",
    description: "Structured peer tutoring with clear goals and a topic checklist.",
    example: "A tutor walks a beginner through Java arrays.",
    features: ["Session goals", "Topic checklist", "Shared notes", "Completion confirmation"],
  },
  discussion: {
    label: "Discussion Mode",
    tagline: "Work it out together",
    description: "Collaborative problem-solving where both of you reason through the concepts.",
    example: "Two students untangle a related-rates problem side by side.",
    features: ["Discussion prompts", "Collaborative questions", "Shared learning goals", "Reflection"],
  },
  talk: {
    label: "Talk Mode",
    tagline: "Study life, together",
    description:
      "A relaxed conversation about study habits, motivation and college life. Peer connection — not counseling.",
    example: "Comparing how you each survived your first exam week.",
    features: ["Icebreakers", "Conversation topics", "Shared interests", "Casual meetup ideas"],
  },
};

export const MODE_LIST: Mode[] = ["teaching", "discussion", "talk"];

export const MAJORS = [
  "Computer Science",
  "Mechanical Engineering",
  "Biology",
  "Chemistry",
  "Mathematics",
  "Psychology",
  "Business",
  "Journalism",
  "Economics",
  "Undecided",
];

export const INTERESTS = [
  "Gaming",
  "Music",
  "Basketball",
  "Football",
  "Hiking",
  "Cooking",
  "Anime",
  "Photography",
  "Coffee",
  "Reading",
  "Running",
  "Film",
  "Art",
  "Volunteering",
];

/** Prompts for the session workspace, keyed by mode. Original content. */
export const DISCUSSION_PROMPTS = [
  "Each of you: explain the problem in your own words before touching any formula.",
  "What quantities change? Which ones stay fixed? Write them down together.",
  "Where exactly does it stop making sense? Point to the step.",
  "Try a tiny example with simple numbers. Does it behave the way you expect?",
  "Swap roles: the person who understood less explains the solution back.",
];

export const ICEBREAKERS = [
  "What class surprised you most this semester — good or bad?",
  "Where on campus do you actually get work done?",
  "What's one study habit you'd tell your first-week self?",
  "What do you do to reset after a rough exam?",
  "If you could add one thing to campus, what would it be?",
];

export const TALK_TOPICS = [
  "Managing time when everything is due the same week",
  "Asking for help without feeling behind",
  "Finding your people on a big campus",
  "Staying motivated after a bad grade",
  "Balancing work, classes and sleep",
];

export const MEETUP_IDEAS = [
  "Grab coffee before your next study block",
  "Walk to class together on a shared day",
  "Catch a campus event together",
  "Try a new study spot in the library together",
];
