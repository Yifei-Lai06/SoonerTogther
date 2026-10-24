// Plain-language definitions shown in tooltips, intro cards and onboarding.
// One wording per term, used everywhere.

export const GLOSSARY = {
  tutor: { term: "Tutor", text: "A student who shares their knowledge and helps others understand a subject." },
  tutee: { term: "Tutee", text: "A student who receives academic help from another student." },
  partner: { term: "Study Partner", text: "Someone you regularly study and solve problems with." },
  circle: { term: "Study Circle", text: "A small group of students who meet regularly to learn, discuss, and support each other." },
  teaching: { term: "Teaching Mode", text: "Learn through structured explanations from a peer tutor." },
  discussion: { term: "Discussion Mode", text: "Work through problems together and exchange ideas." },
  talk: { term: "Talk Mode", text: "Connect casually, share college experiences, and build friendships." },
  xp: { term: "XP", text: "Experience points earned by contributing positively to the learning community." },
  ai: { term: "AI Assistant", text: "An AI-powered study companion that explains concepts and helps you prepare for learning sessions." },
  connection: { term: "Study connection", text: "A classmate you both chose to keep studying with. It only forms when you both say yes." },
  match: { term: "Match score", text: "How well someone fits your request, from course fit, topics, learning style, schedule and shared interests." },
  verified: { term: "Verified session", text: "A session both people confirmed happened. Only verified sessions earn XP." },
  ouVerified: { term: "OU verified", text: "This student confirmed an @ou.edu email address. It's optional." },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
