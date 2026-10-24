"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eraser, PartyPopper, Plus, Trash2 } from "lucide-react";
import { MODE_ICONS } from "@/components/RequestDialog";
import { Avatar, Button, ButtonLink, Card, Chip, cx, Field, inputClass, Segmented, Skeleton } from "@/components/ui";
import { COURSES, courseById, DAYS, INTERESTS, MAJORS, MODE_LIST, MODES, PARTS } from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { formatLabel } from "@/lib/state";
import { GLOSSARY } from "@/lib/data/glossary";
import type { HelpNeed, MeetFormat, Mode, SlotId, Student, TutorSubject, Year } from "@/lib/types";

const YEARS: Year[] = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
const COLORS = ["#0284C7", "#F97316", "#0D9488", "#0F172A", "#7C3AED", "#DB2777", "#4D7C0F", "#A16207", "#075985", "#475569"];
const STEPS = ["About you", "Classes", "How you learn", "Interests"];

type Draft = Omit<Student, "id" | "firstTimeLearner">;

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Onboarding />
    </Suspense>
  );
}

function Onboarding() {
  const params = useSearchParams();
  const { me, dispatch, toast, mode, state } = useStore();
  const firstTime = mode === "cloud" && !state.onboarded;
  const tutorIntent = params.get("role") === "tutor";
  const startStep = tutorIntent && !firstTime ? 1 : Math.max(0, Math.min(3, Number(params.get("step") ?? 1) - 1));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(startStep);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [d, setD] = useState<Draft>(() => {
    const { id: _id, firstTimeLearner: _f, ...rest } = me; // eslint-disable-line @typescript-eslint/no-unused-vars
    return structuredClone(rest);
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (d.name.trim().length < 2) e.name = "Please tell us your name.";
      if (d.email && !/^[^\s@]+@([a-z0-9-]+\.)*ou\.edu$/i.test(d.email.trim()))
        e.email = "Use an @ou.edu address, or leave it blank for the demo.";
    }
    if (s === 1) {
      if (d.courses.length === 0) e.courses = "Pick at least one class you're taking.";
      if (d.needsHelp.some((n) => n.topics.length === 0)) e.needs = "Choose at least one topic for each class you need help in.";
      if (d.canTutor.some((t) => t.topics.length === 0)) e.tutor = "Choose at least one topic for each class you can tutor.";
    }
    if (s === 2) {
      if (d.modes.length === 0) e.modes = "Pick at least one way you like to learn.";
      if (d.availability.length === 0) e.availability = "Pick at least one time you're usually free — it's how we find overlaps.";
    }
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else void save();
  }

  async function save() {
    setSaving(true);
    // In cloud mode the sign-in email is managed by the auth provider and never stored on the profile.
    const { email, ...rest } = d;
    const patch = mode === "cloud" ? rest : { ...rest, email: email?.trim() || undefined };
    const a = await dispatch({ type: "UPDATE_PROFILE", patch: { ...patch, name: d.name.trim(), bio: d.bio.trim() } });
    const b = a.ok ? await dispatch({ type: "COMPLETE_ONBOARDING" }) : a;
    setSaving(false);
    if (!b.ok) return;
    toast("Profile saved.");
    setSaved(true);
  }

  if (saved) {
    return (
      <Card className="mx-auto max-w-xl animate-pop p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-600 text-white">
          <PartyPopper className="size-7" />
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold text-slate-900">You&apos;re all set, {d.name.split(" ")[0]}!</h1>
        <p className="mt-2 text-slate-600">
          {d.canTutor.length > 0
            ? "You'll show up when classmates need help with your subjects — and you can find help for yours."
            : "Now let's find someone who gets the class you're stuck in."}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <ButtonLink href="/match">Find help</ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary">Go to dashboard</ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">{tutorIntent ? "Become a tutor" : "Your profile"}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {tutorIntent ? "Share what you know" : "Tell us about you"}
          </h1>
          <p className="mt-2 text-slate-600">
            {firstTime
              ? "Four quick steps so we can match you with the right people. Most students are both a tutor and a learner."
              : mode === "cloud"
                ? "Update anything below. Changes apply to your matches right away."
                : "Most students are both a tutor and a learner. Pre-filled with the demo student Alex — edit anything, or start fresh."}
          </p>
        </div>
        {mode === "demo" && <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            setD({ name: "", avatarColor: COLORS[1], major: MAJORS[0], year: "Freshman", courses: [], needsHelp: [], canTutor: [], modes: [], availability: [], interests: [], format: "either", bio: "", email: "" });
            setStep(0);
            setErrors({});
          }}
        >
          <Eraser className="size-4" /> Start fresh
        </Button>}
      </div>

      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? "step" : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <div className={cx("h-1.5 rounded-full transition-colors", i <= step ? "bg-sky-600" : "bg-slate-200")} />
              <span className={cx("mt-1.5 block text-xs font-medium", i <= step ? "text-slate-800" : "text-slate-400")}>
                {i < step && <Check className="mr-0.5 inline size-3" />}
                {s}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="p-5 sm:p-7">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <div key={step} className="animate-rise space-y-6">
            {step === 0 && <StepAbout d={d} set={set} errors={errors} cloud={mode === "cloud"} />}
            {step === 1 && <StepClasses d={d} set={set} errors={errors} highlightTutor={tutorIntent} />}
            {step === 2 && <StepLearn d={d} set={set} errors={errors} />}
            {step === 3 && <StepInterests d={d} set={set} />}
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            <Button variant="quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
            <Button type="submit" disabled={saving}>
              {step === STEPS.length - 1 ? (
                <>
                  <Check className="size-4" /> Save profile
                </>
              ) : (
                <>
                  Continue <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

type StepProps = {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  errors?: Record<string, string>;
};

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function StepAbout({ d, set, errors = {}, cloud }: StepProps & { cloud?: boolean }) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar student={{ name: d.name || "?", avatarColor: d.avatarColor }} size={64} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Avatar color</legend>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Avatar color ${c}`}
                aria-pressed={d.avatarColor === c}
                onClick={() => set("avatarColor", c)}
                className={cx("size-7 rounded-full ring-offset-2 transition", d.avatarColor === c ? "ring-2 ring-slate-900" : "hover:scale-110")}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input id="name" value={d.name} onChange={(e) => set("name", e.target.value)} className={inputClass} autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        {cloud ? (
          <div className="rounded-xl bg-mist-100 p-3 text-xs text-slate-600 sm:self-end">
            Your sign-in email is never shown to other students. OU students can verify an @ou.edu address in Settings for a badge.
          </div>
        ) : (
          <Field label="OU email" htmlFor="email" optional error={errors.email} hint="Not required for the demo. Never shown to other students.">
            <input id="email" type="email" value={d.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputClass} placeholder="sooner@ou.edu" autoComplete="email" aria-invalid={!!errors.email} />
          </Field>
        )}
        <Field label="Major" htmlFor="major">
          <select id="major" value={d.major} onChange={(e) => set("major", e.target.value)} className={inputClass}>
            {[...new Set([d.major, ...MAJORS])].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Academic year" htmlFor="year">
          <select id="year" value={d.year} onChange={(e) => set("year", e.target.value as Year)} className={inputClass}>
            {YEARS.map((y) => <option key={y}>{y}</option>)}
          </select>
        </Field>
      </div>
    </>
  );
}

function SubjectRows<T extends HelpNeed | TutorSubject>({
  title,
  description,
  rows,
  onChange,
  make,
  withExperience,
  error,
  highlight,
}: {
  title: string;
  description: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  make: (courseId: string) => T;
  withExperience?: boolean;
  error?: string;
  highlight?: boolean;
}) {
  const unused = COURSES.filter((c) => !rows.some((r) => r.courseId === c.id));
  const [adding, setAdding] = useState(unused[0]?.id ?? "");
  return (
    <section className={cx("rounded-2xl p-4 ring-1", highlight ? "bg-sky-50/40 ring-sky-200" : "ring-slate-200")}>
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
      <ul className="mt-4 space-y-4">
        {rows.map((r, i) => {
          const course = courseById(r.courseId);
          return (
            <li key={r.courseId} className="rounded-xl bg-white p-3 ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-900">
                  {r.courseId} <span className="font-normal text-slate-500">· {course?.title}</span>
                </p>
                <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-sky-700" aria-label={`Remove ${r.courseId}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {course?.topics.map((t) => (
                  <Chip key={t} selected={r.topics.includes(t)} onClick={() => onChange(rows.map((x, j) => (j === i ? { ...x, topics: toggle(x.topics, t) } : x)))}>
                    {t}
                  </Chip>
                ))}
              </div>
              {withExperience && (
                <div className="mt-3">
                  <label htmlFor={`exp-${r.courseId}`} className="text-xs font-medium text-slate-600">
                    Relevant experience <span className="font-normal text-slate-400">(self-described, shown on your profile)</span>
                  </label>
                  <input
                    id={`exp-${r.courseId}`}
                    value={(r as TutorSubject).experience}
                    onChange={(e) => onChange(rows.map((x, j) => (j === i ? { ...x, experience: e.target.value } : x)))}
                    className={`${inputClass} mt-1`}
                    placeholder="Got an A last semester; I like explaining with diagrams."
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {unused.length > 0 && (
        <div className="mt-3 flex gap-2">
          <label htmlFor={`add-${title}`} className="sr-only">Add a class</label>
          <select id={`add-${title}`} value={adding} onChange={(e) => setAdding(e.target.value)} className={inputClass}>
            {unused.map((c) => <option key={c.id} value={c.id}>{c.id} — {c.title}</option>)}
          </select>
          <Button
            variant="secondary"
            onClick={() => {
              const id = unused.some((c) => c.id === adding) ? adding : unused[0].id;
              onChange([...rows, make(id)]);
              setAdding(unused.find((c) => c.id !== id)?.id ?? "");
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-sky-700" role="alert">{error}</p>}
    </section>
  );
}

function StepClasses({ d, set, errors = {}, highlightTutor }: StepProps & { highlightTutor?: boolean }) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Classes you&apos;re taking this semester</legend>
        <div className="flex flex-wrap gap-2">
          {COURSES.map((c) => (
            <Chip key={c.id} selected={d.courses.includes(c.id)} onClick={() => set("courses", toggle(d.courses, c.id))}>
              {c.id}
            </Chip>
          ))}
        </div>
        {errors.courses && <p className="mt-2 text-xs font-medium text-sky-700" role="alert">{errors.courses}</p>}
      </fieldset>
      <SubjectRows<TutorSubject>
        title="I can tutor"
        description="A tutor is a student who shares their knowledge and helps others understand a subject. Add classes you've done well in."
        rows={d.canTutor}
        onChange={(rows) => set("canTutor", rows)}
        make={(courseId) => ({ courseId, topics: [], experience: "" })}
        withExperience
        error={errors.tutor}
        highlight={highlightTutor}
      />
      <SubjectRows<HelpNeed>
        title="I need help with"
        description="Here you're the tutee — the student receiving help. Private: used only for matching, never shown on your profile."
        rows={d.needsHelp}
        onChange={(rows) => set("needsHelp", rows)}
        make={(courseId) => ({ courseId, topics: [] })}
        error={errors.needs}
      />
    </>
  );
}

function StepLearn({ d, set, errors = {} }: StepProps) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">How do you like to learn?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_LIST.map((m: Mode) => {
            const Icon = MODE_ICONS[m];
            const on = d.modes.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => set("modes", toggle(d.modes, m))}
                className={cx("flex flex-col gap-1 rounded-xl p-3 text-left ring-1 transition", on ? "bg-sky-50 ring-sky-400" : "bg-white ring-slate-200 hover:ring-slate-300")}
              >
                <Icon className={cx("size-4", on ? "text-sky-600" : "text-slate-500")} />
                <span className="text-sm font-medium text-slate-900">{MODES[m].label}</span>
                <span className="text-xs text-slate-500">{GLOSSARY[m].text}</span>
              </button>
            );
          })}
        </div>
        {errors.modes && <p className="mt-2 text-xs font-medium text-sky-700" role="alert">{errors.modes}</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Preferred meeting format</legend>
        <Segmented
          label="Meeting format"
          value={d.format}
          onChange={(v: MeetFormat) => set("format", v)}
          options={(["in-person", "online", "either"] as MeetFormat[]).map((f) => ({ value: f, label: formatLabel(f) }))}
        />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">When are you usually free?</legend>
        <p className="mb-3 text-xs text-slate-500">Private: others only ever see the times you both share.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
            <thead>
              <tr>
                <th className="w-24" />
                {DAYS.map((day) => (
                  <th key={day.id} scope="col" className="text-xs font-medium text-slate-500">{day.short}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PARTS.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="pr-2 text-left text-xs font-medium text-slate-600">
                    {p.label}
                    <span className="block font-normal text-slate-400">{p.hours}</span>
                  </th>
                  {DAYS.map((day) => {
                    const slot = `${day.id}-${p.id}` as SlotId;
                    const on = d.availability.includes(slot);
                    return (
                      <td key={slot}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${day.long} ${p.label.toLowerCase()}`}
                          onClick={() => set("availability", toggle(d.availability, slot))}
                          className={cx("h-10 w-full rounded-lg transition active:scale-95", on ? "bg-sky-600 text-white" : "bg-mist-200/70 hover:bg-sky-100")}
                        >
                          {on && <Check className="mx-auto size-4" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.availability && <p className="mt-2 text-xs font-medium text-sky-700" role="alert">{errors.availability}</p>}
      </fieldset>
    </>
  );
}

function StepInterests({ d, set }: StepProps) {
  return (
    <>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Interests and hobbies</legend>
        <p className="mb-3 text-xs text-slate-500">Only a small tie-breaker in matching — mostly a conversation starter.</p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Chip key={i} selected={d.interests.includes(i)} onClick={() => set("interests", toggle(d.interests, i))}>
              {i}
            </Chip>
          ))}
        </div>
      </fieldset>
      <Field label="Short bio" htmlFor="bio" optional hint="One or two sentences. What should a study partner know about you?">
        <textarea id="bio" rows={3} maxLength={200} value={d.bio} onChange={(e) => set("bio", e.target.value)} className={inputClass} />
      </Field>
    </>
  );
}
