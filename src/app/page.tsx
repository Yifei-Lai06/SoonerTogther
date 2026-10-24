import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleDot,
  Compass,
  HeartHandshake,
  Library,
  MessageCircle,
  Presentation,
  Repeat,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/Logo";
import {
  CelebrationMarks,
  DoodleArrow,
  DoodleCrown,
  DoodleHeart,
  DoodleLightning,
  DoodleSmiley,
  DoodleSparkle,
  DoodleStar,
  HandNote,
  PaperTape,
  ScribbleUnderline,
  StickerLabel,
} from "@/components/doodles";
import { WEIGHTS, FACTOR_LABELS, type FactorKey } from "@/lib/matching";
import { MODES, MODE_LIST } from "@/lib/data/catalog";
import { GLOSSARY } from "@/lib/data/glossary";
import { PHOTOS, type Photo } from "@/lib/data/photos";
import { RESOURCES } from "@/lib/data/resources";
import { REWARDS } from "@/lib/xp";
import { CLOUD_ENABLED } from "@/lib/supabase/config";

const btn = "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-150 active:scale-[0.98]";
const accent = `${btn} h-13 px-6 py-3.5 bg-orange-500 text-white shadow-[0_6px_0_-1px_#c2410c] hover:-translate-y-0.5 hover:bg-orange-600`;
const secondary = `${btn} h-13 px-6 py-3.5 bg-white text-slate-900 ring-2 ring-slate-900 shadow-[var(--shadow-sticker)] hover:-translate-y-0.5`;

const STEPS = [
  { icon: UserRound, title: "Tell us about yourself", body: "Choose your courses, interests, and how you like to learn.", doodle: <DoodleSmiley size="sm" rotate={-8} className="text-sky-500" /> },
  { icon: Search, title: "Find your people", body: "Discover tutors, study partners, and learning communities.", doodle: <DoodleStar size="sm" rotate={12} className="text-yellow-500" /> },
  { icon: Presentation, title: "Learn together", body: "Pick Teaching, Discussion, or Talk Mode — whatever fits today.", doodle: <DoodleLightning size="sm" rotate={-6} className="text-orange-500" /> },
  { icon: MessageCircle, title: "Stay connected", body: "Message your matches, join Study Circles, plan the next session.", doodle: <DoodleHeart size="sm" rotate={10} className="text-orange-400" /> },
  { icon: Users, title: "Grow your community", body: "Help others, earn XP, and build friendships that last.", doodle: <DoodleCrown size="sm" rotate={-10} className="text-yellow-500" /> },
];

const MODE_ICON = { teaching: Presentation, discussion: Users, talk: MessageCircle };

function PhotoFrame({ photo, className, tape = true, rotate = 0 }: { photo: Photo; className?: string; tape?: boolean; rotate?: number }) {
  return (
    <figure className={`relative ${className ?? ""}`} style={{ transform: `rotate(${rotate}deg)` }}>
      {tape && <PaperTape className="-top-2.5 left-1/2 z-10 -translate-x-1/2" rotate={-3} />}
      <div className="overflow-hidden rounded-[1.75rem] bg-white p-2 shadow-lift ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked Unsplash photo, credited below */}
        <img src={photo.src} alt={photo.alt} loading="lazy" className="aspect-[4/3] w-full rounded-[1.35rem] object-cover" />
      </div>
      <figcaption className="mt-1.5 text-right text-[11px] text-slate-400">
        Photo: <a href={photo.page} className="underline hover:text-slate-600" target="_blank" rel="noreferrer">{photo.credit}</a> / Unsplash
      </figcaption>
    </figure>
  );
}

export default function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Sections" className="hidden items-center gap-1 text-sm font-medium text-slate-600 md:flex">
            <a href="#how" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">How it works</a>
            <a href="#modes" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Learning modes</a>
            <a href="#circles" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">Study Circles</a>
            <a href="#resources" className="rounded-lg px-3 py-2 hover:bg-slate-100 hover:text-slate-900">OU resources</a>
          </nav>
          {CLOUD_ENABLED ? (
            <div className="ml-auto flex items-center gap-2">
              <a href="/demo" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block">Explore demo</a>
              <Link href="/login" className={`${btn} h-10 bg-slate-900 px-4 text-sm text-white hover:bg-slate-800`}>
                Sign in <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <Link href="/dashboard" className={`${btn} ml-auto h-10 bg-slate-900 px-4 text-sm text-white hover:bg-slate-800`}>
              Try the live demo <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="paper relative overflow-hidden border-b border-slate-200/70">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
            <div className="relative animate-rise">
              <StickerLabel rotate={-4} className="text-sm">
                <Sparkles className="size-4 text-orange-500" /> made by students, for students
              </StickerLabel>
              <h1 className="relative mt-7 font-display text-[2.9rem] font-extrabold leading-[0.98] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
                Learn Together.
                <br />
                Grow Together.
                <br />
                <span className="relative inline-block text-slate-900">
                  Belong
                  <ScribbleUnderline className="text-orange-500" />
                </span>{" "}
                Together.
                <DoodleStar size="lg" rotate={14} animate="twinkle" className="absolute -top-6 right-[8%] hidden text-yellow-500 sm:block" />
                <DoodleSparkle size="md" rotate={-10} animate="twinkle" className="absolute -left-7 top-[42%] hidden text-sky-500 lg:block" />
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-600">
                Struggling with a class? Find someone who understands. Share what you know, get the help you need, and
                turn study sessions into real connections.
              </p>
              <div className="relative mt-9 flex flex-col gap-4 sm:flex-row">
                <Link href="/match?kind=tutor" className={accent}>
                  <Search className="size-5" /> Find a Tutor
                </Link>
                <Link href="/circles" className={secondary}>
                  <CircleDot className="size-5" /> Join a Study Circle
                </Link>
                <span className="pointer-events-none absolute -bottom-12 left-40 hidden items-center gap-1 sm:flex" aria-hidden="true">
                  <DoodleArrow size="lg" rotate={200} className="text-slate-400" />
                  <HandNote className="text-slate-500">it&apos;s free!</HandNote>
                </span>
              </div>
              <p className="mt-14 text-sm text-slate-500 sm:mt-16">
                Want to share what you know?{" "}
                <Link href="/onboarding?role=tutor" className="font-semibold text-orange-600 underline decoration-2 underline-offset-4 hover:text-orange-700">
                  Become a Tutor
                </Link>
                {CLOUD_ENABLED && (
                  <>
                    {" "}· or <a href="/demo" className="underline">explore the demo</a> with sample students
                  </>
                )}
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms] lg:max-w-none">
              <PhotoFrame photo={PHOTOS.laughingTable} rotate={2} />
              <div className="absolute -bottom-8 -left-3 w-60 rotate-[-4deg] rounded-2xl bg-white p-3.5 shadow-lift ring-1 ring-slate-200 sm:-left-10">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">MC</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">Maya · Calc I tutor</p>
                    <p className="text-xs text-slate-500">Chain Rule · Discussion</p>
                  </div>
                  <span className="font-display text-xl font-extrabold text-sky-600">98%</span>
                </div>
              </div>
              <div className="absolute -right-2 -top-7 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lift sm:-right-6">
                <DoodleCrown size="sm" rotate={-12} animate="crown" className="text-yellow-400" /> +30 XP
              </div>
              <DoodleHeart size="md" rotate={-12} className="absolute -right-3 bottom-16 hidden text-orange-500 sm:block" />
            </div>
          </div>
        </section>

        {/* ── How it works (5 steps) ───────────────────────────── */}
        <section id="how" className="scroll-mt-20 border-b border-slate-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <SectionLabel>How it works</SectionLabel>
                <h2 className="relative mt-3 max-w-xl font-display text-4xl font-extrabold tracking-tight text-slate-900">
                  Five small steps from <span className="text-sky-600">stuck</span> to <span className="text-orange-500">together</span>.
                </h2>
              </div>
              <HandNote rotate={-3} className="text-2xl">takes about 2 minutes ✎</HandNote>
            </div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lift relative rounded-3xl bg-mist-100 p-5 ring-1 ring-slate-200/80">
                  <span className="absolute right-4 top-4">{s.doodle}</span>
                  <span className="font-hand text-3xl font-bold leading-none text-slate-300">0{i + 1}</span>
                  <span className="mt-3 flex size-11 items-center justify-center rounded-2xl bg-white text-sky-600 ring-1 ring-slate-200">
                    <s.icon className="size-5" />
                  </span>
                  <p className="mt-4 font-display text-lg font-bold leading-snug text-slate-900">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Matching ─────────────────────────────────────────── */}
        <section className="border-b border-slate-200/70 bg-mist-100">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <SectionLabel>Smart, honest matching</SectionLabel>
              <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-900">
                Every match tells you <span className="relative inline-block">why<ScribbleUnderline className="text-sky-500" animate={false} /></span>.
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Course fit and shared free time come first, so a shared love of basketball can never outrank someone who
                actually knows related rates. No ratings, no popularity scores.
              </p>
              <dl className="mt-8 grid gap-3 sm:grid-cols-2">
                {(["tutor", "tutee", "partner", "circle"] as const).map((k) => (
                  <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
                    <dt className="font-semibold text-slate-900">{GLOSSARY[k].term}</dt>
                    <dd className="mt-0.5 text-sm text-slate-600">{GLOSSARY[k].text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative rounded-3xl bg-white p-7 shadow-card ring-1 ring-slate-200/80">
              <DoodleSparkle size="md" rotate={8} className="absolute -right-3 -top-3 text-yellow-500" />
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <Compass className="size-5 text-sky-600" /> What goes into a match score
              </p>
              <dl className="mt-6 space-y-4">
                {(Object.keys(WEIGHTS) as FactorKey[]).map((k, i) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm">
                      <dt className="text-slate-700">{FACTOR_LABELS[k]}</dt>
                      <dd className="font-semibold tabular-nums text-slate-900">{WEIGHTS[k]}%</dd>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${["bg-sky-600", "bg-sky-500", "bg-teal-500", "bg-lime-500", "bg-orange-400"][i]}`}
                        style={{ width: `${WEIGHTS[k] * (100 / 35)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-xs text-slate-500">Starting product assumptions, not science — and always explained on every match card.</p>
            </div>
          </div>
        </section>

        {/* ── Modes ────────────────────────────────────────────── */}
        <section id="modes" className="scroll-mt-20 border-b border-slate-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionLabel>Three ways to learn</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-slate-900">
              Not every study session should look the same.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {MODE_LIST.map((m, i) => {
                const Icon = MODE_ICON[m];
                return (
                  <div key={m} className="lift relative flex flex-col rounded-3xl bg-mist-100 p-7 ring-1 ring-slate-200/80">
                    {i === 1 && <StickerLabel rotate={5} className="absolute -top-3 right-5 text-sm">most popular</StickerLabel>}
                    <div className={`flex size-12 items-center justify-center rounded-2xl text-white ${["bg-sky-600", "bg-orange-500", "bg-teal-600"][i]}`}>
                      <Icon className="size-5" />
                    </div>
                    <p className="mt-5 font-display text-xl font-bold text-slate-900">{MODES[m].label}</p>
                    <p className="mt-2 text-slate-600">{GLOSSARY[m].text}</p>
                    <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
                      {MODES[m].features.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-sky-500" /> {f}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-auto pt-5 font-hand text-lg text-slate-500">“{MODES[m].example}”</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Circles + XP ─────────────────────────────────────── */}
        <section id="circles" className="scroll-mt-20 border-b border-slate-200/70 bg-mist-100">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div className="relative order-2 lg:order-1">
              <PhotoFrame photo={PHOTOS.picnicStudy} rotate={-2} />
              <div className="relative mx-4 -mt-10 rounded-3xl bg-white p-5 shadow-lift ring-1 ring-slate-200 sm:mx-10">
                <DoodleStar size="md" rotate={-12} className="absolute -left-3 -top-3 text-yellow-500" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">MATH 1914</span>
                    <p className="mt-2 font-display text-lg font-bold text-slate-900">Calculus Survival Circle</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-lime-100 px-2.5 py-0.5 text-xs font-semibold text-lime-800">
                    <span className="size-1.5 rounded-full bg-lime-500" /> 4/5
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Repeat className="size-4 text-slate-400" /> Wednesdays at 4:00 PM</li>
                  <li className="flex items-center gap-2"><Library className="size-4 text-slate-400" /> Bizzell Memorial Library (suggested)</li>
                </ul>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <SectionLabel>Study Circles</SectionLabel>
              <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-900">
                The same faces, <span className="relative inline-block">every week<ScribbleUnderline className="text-orange-500" animate={false} /></span>.
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                {GLOSSARY.circle.text} Each circle has a weekly time, a group chat, rotating leaders, and challenges you
                finish together — so you keep seeing the people who get you through the semester.
              </p>
              <div className="relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <DoodleCrown size="lg" rotate={-14} animate="wiggle" className="absolute -top-8 left-2 text-yellow-500" />
                {[
                  [`+${REWARDS.sessionComplete}`, "verified session"],
                  [`+${REWARDS.firstTimeLearner}`, "first-time learner"],
                  [`+${REWARDS.circleAttend}`, "circle check-in"],
                  [`+${REWARDS.groupMilestone}`, "group milestone"],
                  [`+${REWARDS.helpfulFeedback}`, "helpful feedback"],
                ].map(([xp, label]) => (
                  <div key={label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
                    <p className="font-display text-2xl font-extrabold text-lime-600">{xp}</p>
                    <p className="text-xs text-slate-500">XP · {label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                {GLOSSARY.xp.text} Only granted after both people confirm, never twice, capped daily.
              </p>
            </div>
          </div>
        </section>

        {/* ── OU resources ─────────────────────────────────────── */}
        <section id="resources" className="scroll-mt-20 border-b border-slate-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <SectionLabel>Made for OU students</SectionLabel>
                <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-slate-900">
                  Walking into the Math Center is easier with a friend.
                </h2>
                <p className="mt-4 text-slate-600">
                  We point you to OU&apos;s own support and help you find another student who wants to go too.
                </p>
              </div>
              <Link href="/resources" className={`${btn} h-11 shrink-0 bg-white px-5 text-slate-900 ring-1 ring-slate-300 hover:ring-slate-400`}>
                <BookOpen className="size-4" /> Explore resources
              </Link>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {RESOURCES.map((r) => (
                <div key={r.id} className="lift rounded-3xl bg-mist-100 p-5 ring-1 ring-slate-200/80">
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">{r.kind}</p>
                  <p className="mt-2 font-display text-lg font-bold text-slate-900">{r.name}</p>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{r.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why people ───────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-slate-900 text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative">
              <HeartHandshake className="size-10 text-orange-400" />
              <blockquote className="mt-6 font-display text-3xl font-bold leading-snug sm:text-4xl">
                “ChatGPT can explain a problem. A tutor can help you solve it. SoonerTogether helps you find someone who
                will face the next problem with you.”
              </blockquote>
              <CelebrationMarks size="lg" rotate={-20} className="absolute -right-2 -top-4 hidden text-yellow-400 sm:block" />
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link href={CLOUD_ENABLED ? "/login" : "/dashboard"} className={`${btn} h-12 bg-orange-500 px-6 text-white hover:bg-orange-600`}>
                  Get started <ArrowRight className="size-4" />
                </Link>
                <Link href="/onboarding?role=tutor" className={`${btn} h-12 px-6 text-white ring-1 ring-slate-600 hover:bg-slate-800`}>
                  Become a Tutor
                </Link>
              </div>
            </div>
            <PhotoFrame photo={PHOTOS.coffeeGroup} rotate={2} />
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <LogoMark size={24} />
            <span>
              SoonerTogether · built by students for <span className="font-medium text-slate-700">SASEHacks for Good</span> ·{" "}
              <Link href="/privacy" className="underline">Privacy</Link>
            </span>
          </div>
          <p className="flex max-w-xl items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" />
            A student-created project. Not affiliated with, endorsed by, or operated by the University of Oklahoma.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
      <DoodleSparkle size="xs" className="text-orange-500" /> {children}
    </p>
  );
}
