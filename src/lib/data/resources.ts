// Official OU resources. Descriptions summarize the public pages only:
// no hours, rooms or appointment availability are stated here on purpose —
// students should always check the official site for current details.

export interface CampusResource {
  id: string;
  name: string;
  kind: string;
  summary: string;
  goodFor: string[];
  /** Course departments this resource is most relevant to. */
  depts: string[];
  url: string;
  urlLabel: string;
}

export const RESOURCES: CampusResource[] = [
  {
    id: "math-center",
    name: "OU Math Center",
    kind: "Drop-in math help",
    summary:
      "Free drop-in tutoring for lower-division math courses on the Norman campus, focused on building understanding rather than just getting answers.",
    goodFor: ["Calculus questions", "Homework concepts", "Exam prep that starts early"],
    depts: ["Mathematics", "Physics", "Economics"],
    url: "https://www.ou.edu/cas/mathcenter",
    urlLabel: "ou.edu/cas/mathcenter",
  },
  {
    id: "writing-center",
    name: "OU Writing Center",
    kind: "Writing consultations",
    summary:
      "One-on-one and small-group writing support, in person or remote. They teach writing — they are not a proofreading or grading service.",
    goodFor: ["Essay structure", "Thesis feedback", "Citation questions"],
    depts: ["English", "Journalism", "Psychology", "Economics"],
    url: "https://www.ou.edu/writingcenter",
    urlLabel: "ou.edu/writingcenter",
  },
  {
    id: "tutor-sooner",
    name: "Tutor Sooner",
    kind: "Campus tutoring hub",
    summary:
      "OU's central hub for tutoring options across many subjects, including math, writing and the sciences. Search by subject to find the right center.",
    goodFor: ["Finding a tutoring center", "Science courses", "Any subject"],
    depts: ["Mathematics", "Computer Science", "Chemistry", "Physics", "English", "Economics"],
    url: "https://www.ou.edu/tutoring",
    urlLabel: "ou.edu/tutoring",
  },
  {
    id: "bizzell",
    name: "Bizzell Memorial Library",
    kind: "Study spaces",
    summary:
      "OU's main library, with group study rooms and quiet spaces. Check OU Libraries for which rooms can be reserved and who can reserve them.",
    goodFor: ["Group study sessions", "Quiet focus time", "Study Circle meetups"],
    depts: ["Mathematics", "Computer Science", "Chemistry", "Physics", "English", "Economics"],
    url: "https://libraries.ou.edu/visit-study/rooms-spaces",
    urlLabel: "libraries.ou.edu",
  },
];

export function resourceById(id: string): CampusResource | undefined {
  return RESOURCES.find((r) => r.id === id);
}
