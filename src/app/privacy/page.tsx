import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Privacy" };

const SECTIONS: [string, string[]][] = [
  ["What we store", [
    "Your profile: name, optional photo from your sign-in provider, major, year, classes, subjects you tutor, interests and bio.",
    "Private details used only for matching: your weekly availability and the topics you need help with. Other students never see these — they only see the time windows you share with them.",
    "Your sessions, Study Circle memberships, XP, badges, messages, AI chats, feedback and notifications.",
  ]],
  ["What other students can see", [
    "Your public profile, badges, XP level and Study Circles. Never your email address.",
    "Messages are visible only to the people in that conversation.",
    "Feedback after a session is private. A study connection only appears when both people choose it, and nobody is told about a “no”.",
    "The community feed shows only positive public milestones, and you can turn it off in Settings.",
  ]],
  ["AI assistant", [
    "Questions you send to the AI assistant are processed by DeepSeek to generate a reply, and saved in your account so you can come back to them. Don't share personal or sensitive information with the AI.",
  ]],
  ["Your choices", [
    "Edit your profile any time, hide your activity, block or report people, and permanently delete your account from Settings.",
  ]],
  ["Who runs this", [
    "SoonerTogether is a student-created beta project. It is not affiliated with, endorsed by, or operated by the University of Oklahoma.",
  ]],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-8 font-display text-4xl font-semibold text-slate-900">Privacy</h1>
      <p className="mt-2 text-slate-600">Plain-language summary for the SoonerTogether beta.</p>
      {SECTIONS.map(([title, items]) => (
        <section key={title} className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-slate-700">
            {items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </section>
      ))}
      <p className="mt-10 text-sm text-slate-500"><Link href="/" className="underline">Back to SoonerTogether</Link></p>
    </div>
  );
}
