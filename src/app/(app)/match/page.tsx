"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleDot, EyeOff, GraduationCap, Info, SearchX, UserRound, Users } from "lucide-react";
import { CircleCard } from "@/components/cards";
import { MatchCard } from "@/components/MatchCard";
import { MODE_ICONS, RequestDialog, type RequestDraft } from "@/components/RequestDialog";
import { Card, Chip, cx, EmptyState, Field, inputClass, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { COURSES, courseById, MODE_LIST, MODES } from "@/lib/data/catalog";
import { matchCircles } from "@/lib/matching";
import { useStudentMatches } from "@/lib/hooks";
import { IntroCard, Term } from "@/components/help";
import { useStore } from "@/lib/store";
import { connectionBetween, formatLabel } from "@/lib/state";
import type { MatchKind, MeetFormat, Mode } from "@/lib/types";

export default function MatchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Matcher />
    </Suspense>
  );
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function Matcher() {
  const params = useSearchParams();
  const { state, me } = useStore();
  const defaultCourse = me.needsHelp[0]?.courseId ?? "MATH 1914";
  const initialCourse = courseById(params.get("course") ?? "")?.id ?? defaultCourse;

  const [courseId, setCourseId] = useState(initialCourse);
  const [topics, setTopics] = useState<string[]>(() => {
    const t = params.get("topic");
    const course = courseById(initialCourse);
    return t && course?.topics.includes(t) ? [t] : [];
  });
  const [kind, setKind] = useState<MatchKind>(pick<MatchKind>(params.get("kind"), ["tutor", "partner", "circle"], "tutor"));
  const [mode, setMode] = useState<Mode>(pick(params.get("mode"), MODE_LIST, me.modes[0] ?? "discussion"));
  const [format, setFormat] = useState<MeetFormat>(me.format);
  const [useMySchedule, setUseMySchedule] = useState(true);
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [showExcluded, setShowExcluded] = useState(false);

  const course = courseById(courseId)!;
  const request = useMemo(
    () => ({ courseId, topics, kind, mode, format, slots: useMySchedule ? me.availability : [] }),
    [courseId, topics, kind, mode, format, useMySchedule, me.availability],
  );
  const studentQuery = useMemo(
    () => (kind === "circle" ? null : { courseId, topics, kind, mode, format, useSchedule: useMySchedule }),
    [kind, courseId, topics, mode, format, useMySchedule],
  );
  const remote = useStudentMatches(studentQuery);
  const students = kind === "circle" ? null : remote.data;
  const circles = useMemo(
    () => (kind === "circle" ? matchCircles(me, state.circles, state.students, request) : null),
    [kind, me, state.circles, state.students, request],
  );

  const excludedSummary = useMemo(() => {
    const list = students?.excluded.map((e) => e.reason) ?? circles?.excluded.map((e) => e.reason) ?? [];
    const counts = new Map<string, number>();
    for (const r of list) {
      const key = r.startsWith("Meets") ? "Meeting format or time doesn't fit" : r.startsWith("Different course") ? "Different course" : r;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [students, circles]);

  const resultCount = students?.matches.length ?? circles?.matches.length ?? 0;
  const kindLabel = kind === "tutor" ? "peer tutors" : kind === "partner" ? "study partners" : "Study Circles";

  return (
    <div>
      <PageHeader
        eyebrow="Discover"
        title="Find your study person"
        description="Tell us where you're stuck. Matches update instantly, and every score explains itself."
      />
      <IntroCard
        id="discover"
        title="How matching works"
        steps={[
          "Pick the course and the topics you're stuck on.",
          "Choose a tutor, a study partner, or a Study Circle.",
          "Pick how you like to learn: teaching, discussion, or talk.",
          "Send a request. When they accept, you can chat and pick a time.",
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        {/* Request builder */}
        <Card className="space-y-6 p-5 lg:sticky lg:top-24">
          <Field label="1 · Which course?" htmlFor="course">
            <select
              id="course"
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setTopics([]);
              }}
              className={inputClass}
            >
              {COURSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.title}
                </option>
              ))}
            </select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-800">2 · What are you struggling with?</legend>
            <div className="flex flex-wrap gap-2">
              {course.topics.map((t) => (
                <Chip
                  key={t}
                  selected={topics.includes(t)}
                  onClick={() => setTopics((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
                >
                  {t}
                </Chip>
              ))}
            </div>
            {topics.length === 0 && <p className="mt-2 text-xs text-slate-500">Pick one or more topics for sharper matches.</p>}
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-800">3 · Who are you looking for?</legend>
            <p className="-mt-1 mb-2 flex flex-wrap gap-x-3 text-xs text-slate-500">
              <Term id="tutor" /> <Term id="partner" /> <Term id="circle" />
            </p>
            <Segmented
              label="Match type"
              value={kind}
              onChange={setKind}
              options={[
                { value: "tutor", label: "Tutor", icon: <GraduationCap className="size-4" /> },
                { value: "partner", label: "Partner", icon: <UserRound className="size-4" /> },
                { value: "circle", label: "Circle", icon: <CircleDot className="size-4" /> },
              ]}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-800">4 · How do you want to learn?</legend>
            <div className="space-y-2">
              {MODE_LIST.map((m) => {
                const Icon = MODE_ICONS[m];
                const on = mode === m;
                return (
                  <label
                    key={m}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600",
                      on ? "bg-sky-50 ring-sky-400" : "bg-white ring-slate-200 hover:ring-slate-300",
                    )}
                  >
                    <input type="radio" name="mode" className="sr-only" checked={on} onChange={() => setMode(m)} />
                    <span className={cx("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", on ? "bg-sky-600 text-white" : "bg-mist-200 text-slate-600")}>
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{MODES[m].label}</span>
                      <span className="block text-xs text-slate-500">{MODES[m].description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 border-t border-slate-100 pt-5">
            <Field label="Meeting format" htmlFor="format">
              <select id="format" value={format} onChange={(e) => setFormat(e.target.value as MeetFormat)} className={inputClass}>
                {(["either", "in-person", "online"] as MeetFormat[]).map((f) => (
                  <option key={f} value={f}>
                    {formatLabel(f)}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={useMySchedule}
                onChange={(e) => setUseMySchedule(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-sky-600"
              />
              <span>
                <span className="font-medium text-slate-800">Only show people free when I am</span>
                <span className="block text-xs text-slate-500">
                  Using your {me.availability.length} time windows.{" "}
                  <Link href="/onboarding?step=3" className="text-sky-700 underline">
                    Edit
                  </Link>
                </span>
              </span>
            </label>
          </div>
        </Card>

        {/* Results */}
        <section aria-labelledby="results-title" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-title" className="font-display text-xl font-semibold text-slate-900">
              {resultCount} {kindLabel} for {courseId}
              {topics.length > 0 && <span className="text-slate-500"> · {topics.join(", ")}</span>}
            </h2>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="size-3.5" /> Ranked by fit, never by popularity or ratings
            </p>
          </div>

          <div className="space-y-4">
            {kind !== "circle" && remote.loading && !students && (
              <>
                <Skeleton className="h-56" />
                <Skeleton className="h-56" />
              </>
            )}
            {kind !== "circle" && remote.error && (
              <p role="alert" className="rounded-xl bg-sky-50 p-3 text-sm text-sky-800 ring-1 ring-sky-100">{remote.error}</p>
            )}
            {students?.matches.map((m, i) => (
              <MatchCard
                key={m.student.id}
                match={m}
                kind={kind}
                courseId={courseId}
                rank={i}
                connected={!!connectionBetween(state, me.id, m.student.id)}
                onRequest={() =>
                  setDraft({ partner: m.student, kind: kind === "partner" ? "partner" : "tutor", courseId, topics, mode })
                }
              />
            ))}
            {circles && (
              <div className="grid gap-4 md:grid-cols-2">
                {circles.matches.map((m) => (
                  <div key={m.circle.id} className="relative">
                    <span className="absolute right-4 top-4 z-10 rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {m.score}% fit
                    </span>
                    <CircleCard circle={m.circle} reasons={m.reasons} />
                  </div>
                ))}
              </div>
            )}

            {resultCount === 0 && !(kind !== "circle" && (remote.loading || remote.error)) && (
              <Card>
                <EmptyState
                  icon={kind === "circle" ? <Users className="size-5" /> : <SearchX className="size-5" />}
                  title={`No ${kindLabel} fit this request yet`}
                  body={
                    kind === "circle"
                      ? "You could start one — the first member is the hardest to find."
                      : "Try another meeting format, turn off the schedule filter, or look for a Study Circle instead."
                  }
                  action={
                    kind === "circle" ? (
                      <Link href="/circles?create=1" className="text-sm font-medium text-sky-700 underline">
                        Create a {courseId} circle
                      </Link>
                    ) : undefined
                  }
                />
              </Card>
            )}
          </div>

          {excludedSummary.length > 0 && (
            <div className="mt-6 rounded-2xl bg-mist-200/50 p-4 text-sm">
              <button
                type="button"
                onClick={() => setShowExcluded((v) => !v)}
                aria-expanded={showExcluded}
                className="flex w-full items-center gap-2 font-medium text-slate-700"
              >
                <EyeOff className="size-4" />
                {excludedSummary.reduce((s, [, n]) => s + n, 0)} not shown — why?
              </button>
              {showExcluded && (
                <ul className="mt-3 space-y-1 text-slate-600">
                  {excludedSummary.map(([reason, n]) => (
                    <li key={reason} className="flex justify-between">
                      <span>{reason}</span>
                      <span className="tabular-nums">{n}</span>
                    </li>
                  ))}
                  <li className="pt-2 text-xs text-slate-500">
                    Course fit, meeting format and shared availability are requirements. Names aren&apos;t listed to
                    protect everyone&apos;s privacy.
                  </li>
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <RequestDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}
