"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleDot, Plus, Repeat, Users } from "lucide-react";
import { CircleCard } from "@/components/cards";
import { Button, Card, Chip, Dialog, EmptyState, Field, inputClass, PageHeader, Segmented, Skeleton } from "@/components/ui";
import { COURSES, courseById, DAYS, PARTS } from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { formatLabel } from "@/lib/state";
import { IntroCard, Term } from "@/components/help";
import type { Day, DayPart, MeetFormat } from "@/lib/types";

export default function CirclesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Circles />
    </Suspense>
  );
}

function Circles() {
  const params = useSearchParams();
  const { state, me } = useStore();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [course, setCourse] = useState<string>("all");
  const [creating, setCreating] = useState(params.get("create") === "1");

  const mine = state.circles.filter((c) => c.memberIds.includes(me.id));
  const list = (tab === "mine" ? mine : state.circles).filter((c) => course === "all" || c.courseId === course);
  const courses = [...new Set(state.circles.map((c) => c.courseId))];
  // Feature the busiest circle that still has room.
  const featuredId = [...state.circles]
    .filter((c) => c.memberIds.length < c.capacity && c.memberIds.length > 0)
    .sort((a, b) => b.memberIds.length - a.memberIds.length)[0]?.id;

  return (
    <div>
      <PageHeader
        eyebrow="Study Circles"
        title="Small groups. Same time every week."
        description="Circles turn one-time help into a semester-long crew. Rotate who leads, take on group challenges, and keep finding the same people."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create a circle
          </Button>
        }
      />

      <IntroCard id="circles" title="What's a Study Circle?">
        A small group of students who meet regularly to learn, discuss, and support each other.{" "}
        <strong>After you join:</strong> you get the circle&apos;s group chat, its weekly time and goal, and group
        challenges. Check in after each meeting for <Term id="xp" />. You can leave any time.
      </IntroCard>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Which circles"
          value={tab}
          onChange={setTab}
          options={[
            { value: "browse", label: `Browse · ${state.circles.length}`, icon: <CircleDot className="size-4" /> },
            { value: "mine", label: `My circles · ${mine.length}`, icon: <Users className="size-4" /> },
          ]}
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by course">
          <Chip selected={course === "all"} onClick={() => setCourse("all")}>
            All courses
          </Chip>
          {courses.map((c) => (
            <Chip key={c} selected={course === c} onClick={() => setCourse(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {list.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <CircleCard key={c.id} circle={c} featured={c.id === featuredId} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Repeat className="size-5" />}
            title={tab === "mine" ? "You're not in a circle yet" : "No circles for this course yet"}
            body="Start one — set a weekly time and a goal, and classmates can join."
            action={<Button onClick={() => setCreating(true)}>Create a circle</Button>}
          />
        </Card>
      )}

      <CreateCircleDialog open={creating} onClose={() => setCreating(false)} defaultCourse={course === "all" ? me.needsHelp[0]?.courseId : course} />
    </div>
  );
}

function CreateCircleDialog({ open, onClose, defaultCourse }: { open: boolean; onClose: () => void; defaultCourse?: string }) {
  return (
    <Dialog open={open} onClose={onClose} title="Create a Study Circle" description="You'll be the first member. Others can join until it's full." wide>
      {open && <CreateCircleForm onClose={onClose} defaultCourse={defaultCourse} />}
    </Dialog>
  );
}

function CreateCircleForm({ onClose, defaultCourse }: { onClose: () => void; defaultCourse?: string }) {
  const { dispatch, toast } = useStore();
  const router = useRouter();
  const [courseId, setCourseId] = useState(defaultCourse ?? COURSES[0].id);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [objective, setObjective] = useState("");
  const [day, setDay] = useState<Day>("wed");
  const [part, setPart] = useState<DayPart>("afternoon");
  const [time, setTime] = useState("16:00");
  const [format, setFormat] = useState<MeetFormat>("in-person");
  const [location, setLocation] = useState("Bizzell Memorial Library (suggested)");
  const [capacity, setCapacity] = useState(5);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const course = courseById(courseId)!;

  function to12h(t: string) {
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        const errs: Record<string, string> = {};
        if (name.trim().length < 3) errs.name = "Give your circle a name (at least 3 characters).";
        if (focus.length === 0) errs.focus = "Pick at least one focus topic.";
        if (!objective.trim()) errs.objective = "Add a weekly objective so people know what to expect.";
        if (capacity < 2 || capacity > 8) errs.capacity = "Circles work best with 2–8 people.";
        setErrors(errs);
        if (Object.keys(errs).length) return;
        const result = await dispatch({
          type: "CREATE_CIRCLE",
          circle: {
            name: name.trim(),
            courseId,
            focus,
            weeklyObjective: objective.trim(),
            day,
            part,
            time: to12h(time),
            format,
            location: location.trim() || (format === "online" ? "Online" : "To be decided by members"),
            capacity,
          },
        });
        if (!result.ok || !result.id) return;
        toast(`${name.trim()} is live. Invite your study connections!`);
        onClose();
        router.push(`/circles/${result.id}`);
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Circle name" htmlFor="c-name" error={errors.name}>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Derivative Dream Team" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Course" htmlFor="c-course">
          <select
            id="c-course"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setFocus([]);
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
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">Focus topics</legend>
        <div className="flex flex-wrap gap-2">
          {course.topics.map((t) => (
            <Chip key={t} selected={focus.includes(t)} onClick={() => setFocus((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))}>
              {t}
            </Chip>
          ))}
        </div>
        {errors.focus && <p className="mt-1.5 text-xs font-medium text-sky-700" role="alert">{errors.focus}</p>}
      </fieldset>

      <Field label="Weekly objective" htmlFor="c-obj" error={errors.objective}>
        <input id="c-obj" value={objective} onChange={(e) => setObjective(e.target.value)} className={inputClass} placeholder="Everyone explains one practice problem out loud." aria-invalid={!!errors.objective} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Day" htmlFor="c-day">
          <select id="c-day" value={day} onChange={(e) => setDay(e.target.value as Day)} className={inputClass}>
            {DAYS.map((d) => (
              <option key={d.id} value={d.id}>{d.long}</option>
            ))}
          </select>
        </Field>
        <Field label="Time of day" htmlFor="c-part">
          <select id="c-part" value={part} onChange={(e) => setPart(e.target.value as DayPart)} className={inputClass}>
            {PARTS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Start time" htmlFor="c-time">
          <input id="c-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Format" htmlFor="c-format">
          <select id="c-format" value={format} onChange={(e) => setFormat(e.target.value as MeetFormat)} className={inputClass}>
            {(["in-person", "online", "either"] as MeetFormat[]).map((f) => (
              <option key={f} value={f}>{formatLabel(f)}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Suggested location" htmlFor="c-loc" hint="A general spot — never share personal addresses.">
            <input id="c-loc" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
          </Field>
        </div>
      </div>

      <Field label="Maximum members" htmlFor="c-cap" error={errors.capacity}>
        <input id="c-cap" type="number" min={2} max={8} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={`${inputClass} max-w-28`} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">Create circle</Button>
      </div>
    </form>
  );
}
