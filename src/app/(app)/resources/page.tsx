"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, ExternalLink, Footprints, Info, MapPinned, UserRoundSearch, Users } from "lucide-react";
import { Avatar, Button, Card, cx, DemoControl, Dialog, EmptyState, Field, inputClass, PageHeader, Skeleton, Tag } from "@/components/ui";
import { COURSES, courseById, slotLabel, slotShort } from "@/lib/data/catalog";
import { RESOURCES, resourceById, type CampusResource } from "@/lib/data/resources";
import { useGoWithCandidates } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { studentById } from "@/lib/state";
import type { SlotId, Student } from "@/lib/types";

export default function ResourcesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Resources />
    </Suspense>
  );
}

function Resources() {
  const params = useSearchParams();
  const { state, me } = useStore();
  const initial = resourceById(params.get("resource") ?? "");
  const [goWith, setGoWith] = useState<{ resource: CampusResource; courseId: string } | null>(
    initial ? { resource: initial, courseId: courseById(params.get("course") ?? "")?.id ?? defaultCourse(initial, me) } : null,
  );
  const needDepts = new Set(me.needsHelp.map((n) => courseById(n.courseId)?.dept));
  const plans = state.goTogether.filter((g) => g.fromId === me.id || g.toId === me.id);

  return (
    <div>
      <PageHeader
        eyebrow="OU campus resources"
        title="You don't have to walk in alone"
        description="OU already offers great academic support. We help you find it — and find another student to go with."
      />

      <p className="mb-6 flex items-start gap-2 rounded-2xl bg-mist-200/60 p-4 text-sm text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
        Descriptions summarize each resource&apos;s official page. Always check the official site for current hours and
        locations. SoonerTogether is a student project and isn&apos;t affiliated with OU or these services.
      </p>

      {plans.length > 0 && <Plans />}

      <div className="grid gap-5 md:grid-cols-2">
        {RESOURCES.map((r) => {
          const recommended = r.depts.some((d) => needDepts.has(d));
          return (
            <Card key={r.id} as="article" className="flex animate-rise flex-col p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">{r.kind}</p>
                  <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">{r.name}</h2>
                </div>
                {recommended && <Tag tone="crimson">Recommended for you</Tag>}
              </div>
              <p className="mt-3 text-slate-600">{r.summary}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Good for</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.goodFor.map((g) => <Tag key={g}>{g}</Tag>)}
              </ul>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                <Button onClick={() => setGoWith({ resource: r, courseId: defaultCourse(r, me) })}>
                  <Footprints className="size-4" /> Find someone to go with
                </Button>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-sky-700"
                >
                  {r.urlLabel} <ExternalLink className="size-3.5" />
                  <span className="sr-only">(opens official site in a new tab)</span>
                </a>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!goWith}
        onClose={() => setGoWith(null)}
        title={goWith ? `Go to ${goWith.resource.name} together` : ""}
        description="We'll pair you with another student who wants to visit too. This is not an official appointment."
        wide
      >
        {goWith && <GoWithFinder key={goWith.resource.id} resource={goWith.resource} initialCourse={goWith.courseId} onDone={() => setGoWith(null)} />}
      </Dialog>
    </div>
  );
}

function defaultCourse(r: CampusResource, me: Student): string {
  const fit = me.needsHelp.find((n) => r.depts.includes(courseById(n.courseId)?.dept ?? ""));
  return fit?.courseId ?? me.needsHelp[0]?.courseId ?? me.courses[0] ?? COURSES[0].id;
}

function GoWithFinder({ resource, initialCourse, onDone }: { resource: CampusResource; initialCourse: string; onDone: () => void }) {
  const { state, me, dispatch, toast } = useStore();
  const [courseId, setCourseId] = useState(initialCourse);
  const [picked, setPicked] = useState<Record<string, SlotId>>({});
  const found = useGoWithCandidates(resource.id, courseId);
  const candidates = found.data ?? [];
  const interested = state.goWithInterests.some(
    (g) => g.studentId === me.id && g.resourceId === resource.id && g.courseId === courseId,
  );

  const invited = (id: string) =>
    state.goTogether.some((g) => g.fromId === me.id && g.toId === id && g.resourceId === resource.id && g.status !== "declined");

  return (
    <div className="space-y-5">
      <Field label="For which class?" htmlFor="gw-course">
        <select id="gw-course" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputClass}>
          {COURSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id} — {c.title}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-3 rounded-xl bg-mist-100 p-3 text-sm">
        <input
          type="checkbox"
          checked={interested}
          onChange={(e) => {
            void dispatch({ type: "SET_GO_WITH_INTEREST", resourceId: resource.id, courseId, on: e.target.checked });
            toast(e.target.checked ? "Others looking to go can now find you." : "You're no longer listed.", "info");
          }}
          className="mt-0.5 size-4 accent-sky-600"
        />
        <span>
          <span className="font-medium text-slate-900">I&apos;d like to go too — let classmates find me</span>
          <span className="block text-xs text-slate-500">Shows only your name, major and the times you share with them. You can turn this off any time.</span>
        </span>
      </label>

      {found.loading && !found.data ? (
        <Skeleton className="h-24" />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={<UserRoundSearch className="size-5" />}
          title="No one is looking to go yet"
          body={`Nobody with a shared free time has asked to visit ${resource.name} for ${courseId} yet. Try another class or check back later.`}
        />
      ) : (
        <ul className="space-y-3">
          {candidates.map(({ student, slots }) => {
            const slot = picked[student.id] ?? slots[0];
            const done = invited(student.id);
            return (
              <li key={student.id} className="rounded-2xl p-4 ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <Avatar student={student} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{student.name}</p>
                    <p className="text-sm text-slate-500">
                      {student.year} · {student.major} · also wants help with {courseId}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label htmlFor={`slot-${student.id}`} className="mb-1 block text-xs font-medium text-slate-600">
                      You&apos;re both free
                    </label>
                    <select
                      id={`slot-${student.id}`}
                      value={slot}
                      disabled={done}
                      onChange={(e) => setPicked((p) => ({ ...p, [student.id]: e.target.value as SlotId }))}
                      className={inputClass}
                    >
                      {slots.map((s) => (
                        <option key={s} value={s}>
                          {slotLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    disabled={done}
                    onClick={async () => {
                      const r = await dispatch({ type: "GO_WITH_INVITE", resourceId: resource.id, courseId, toId: student.id, slot, at: Date.now() });
                      if (r.ok) toast(`Invite sent to ${student.name.split(" ")[0]}.`);
                    }}
                  >
                    {done ? "Invited" : "Invite to go together"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-mist-100 p-3 text-xs text-slate-600">
        <MapPinned className="mt-0.5 size-4 shrink-0 text-sky-600" />
        This only pairs you with a classmate. It doesn&apos;t book anything with {resource.name} — check their official
        site for hours and whether you need an appointment.
      </p>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Plans() {
  const { state, me, dispatch, toast } = useStore();
  const plans = state.goTogether.filter((g) => g.fromId === me.id || g.toId === me.id);
  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 px-5 pt-5">
        <Users className="size-4 text-sky-600" />
        <h2 className="text-[15px] font-semibold text-slate-900">Your go-together plans</h2>
      </div>
      <ul className="space-y-2 p-3">
        {plans.map((g) => {
          const other = studentById(state, g.fromId === me.id ? g.toId : g.fromId)!;
          const r = resourceById(g.resourceId)!;
          const first = other.name.split(" ")[0];
          return (
            <li key={g.id} className="flex flex-col gap-3 rounded-xl bg-mist-50 p-3 ring-1 ring-slate-200/70 sm:flex-row sm:items-center">
              <Avatar student={other} size={40} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium text-slate-900">
                  {r.name} with {other.name}
                </p>
                <p className="flex items-center gap-1.5 text-slate-500">
                  <CalendarClock className="size-3.5" /> {slotShort(g.slot)} · {g.courseId}
                </p>
              </div>
              {g.status === "invited" && g.toId === me.id ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void dispatch({ type: "GO_WITH_RESPOND", id: g.id, accept: false })}>
                    Not this time
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const res = await dispatch({ type: "GO_WITH_RESPOND", id: g.id, accept: true });
                      if (res.ok) toast(`You're going to ${r.name} with ${first}! Say hi in Messages.`);
                    }}
                  >
                    Count me in
                  </Button>
                </div>
              ) : g.status === "invited" ? (
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <Tag tone="cream">Waiting for {first}</Tag>
                  <DemoControl label={`Demo · act as ${first}`}>
                    <Button
                      size="sm"
                      onClick={() => {
                        dispatch({ type: "GO_WITH_RESPOND", id: g.id, accept: true });
                        toast(`${first} is in! You're going to ${r.name} together.`);
                      }}
                    >
                      Simulate yes
                    </Button>
                  </DemoControl>
                </div>
              ) : (
                <Tag tone={g.status === "confirmed" ? "sage" : "outline"} className={cx(g.status === "confirmed" && "text-sm")}>
                  {g.status === "confirmed" ? "Going together ✓" : "Not this time"}
                </Tag>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
