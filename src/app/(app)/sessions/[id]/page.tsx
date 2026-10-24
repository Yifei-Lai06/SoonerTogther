"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CheckCircle2,
  Coffee,
  Heart,
  HeartHandshake,
  Lock,
  MessageCircle,
  MessageSquareQuote,
  Plus,
  RefreshCw,
  SearchX,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { MODE_ICONS, RequestDialog, type RequestDraft } from "@/components/RequestDialog";
import { SessionStatusTag } from "@/components/cards";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  cx,
  DemoControl,
  EmptyState,
  Field,
  inputClass,
  Segmented,
  Skeleton,
  Tag,
} from "@/components/ui";
import {
  DISCUSSION_PROMPTS,
  ICEBREAKERS,
  MEETUP_IDEAS,
  MODE_LIST,
  MODES,
  slotLabel,
  sortSlots,
  TALK_TOPICS,
} from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { connectionBetween, mutualSlots, openSessionWith, otherId, studentById } from "@/lib/state";
import type { Mode, Session, SessionFeedback, SlotId, Student } from "@/lib/types";

export default function SessionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SessionDetail />
    </Suspense>
  );
}

const STEPS = ["Requested", "Accepted", "Scheduled", "Completed", "Reflect"];

function stepIndex(s: Session, meId: string): number {
  switch (s.status) {
    case "requested":
      return 0;
    case "accepted":
      return 1;
    case "scheduled":
      return 2;
    case "completed":
      return s.feedback[meId] ? 5 : 3;
    default:
      return 0;
  }
}

function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const session = state.sessions.find((s) => s.id === id);
  if (!session || (session.requesterId !== state.meId && session.partnerId !== state.meId)) {
    return (
      <Card>
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Session not found"
          body="It may have been reset with the demo."
          action={<ButtonLink href="/sessions">Back to sessions</ButtonLink>}
        />
      </Card>
    );
  }
  const other = studentById(state, otherId(session, state.meId))!;
  const me = studentById(state, state.meId)!;
  const Icon = MODE_ICONS[session.mode];
  const role =
    session.tutorId === me.id
      ? "You're the tutor"
      : session.tutorId
        ? `${other.name.split(" ")[0]} is your tutor`
        : "Learning side by side";
  const step = stepIndex(session, me.id);
  const closed = session.status === "declined" || session.status === "cancelled";

  return (
    <div>
      <Link href="/sessions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-sky-700">
        <ArrowLeft className="size-4" /> All sessions
      </Link>

      <Card className="paper mb-6 overflow-hidden p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center">
            <Avatar student={me} size={52} ring />
            <Avatar student={other} size={52} ring className="-ml-3" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-slate-900">
                {session.courseId}
                {session.topics.length > 0 && <span className="text-slate-500"> · {session.topics.join(", ")}</span>}
              </h1>
              <SessionStatusTag session={session} meId={me.id} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>
                with{" "}
                <Link href={`/students/${other.id}`} className="font-medium text-slate-900 hover:text-sky-700">
                  {other.name}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon className="size-4 text-sky-600" /> {MODES[session.mode].label}
              </span>
              <span>{role}</span>
              {session.slot && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-4 text-slate-400" /> {slotLabel(session.slot)}
                </span>
              )}
            </p>
          </div>
        </div>

        {!closed && (
          <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Session progress">
            {STEPS.map((label, i) => (
              <li key={label} aria-current={i === step ? "step" : undefined}>
                <div className={cx("h-1.5 rounded-full transition-colors duration-500", i < step ? "bg-sky-600" : i === step ? "bg-sky-300" : "bg-slate-200")} />
                <p className={cx("mt-1.5 text-[11px] font-medium sm:text-xs", i <= step ? "text-slate-800" : "text-slate-400")}>
                  {i < step && <Check className="mr-0.5 inline size-3" />}
                  {label}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <StatusPanel session={session} me={me} other={other} />
          {(session.status === "scheduled" || session.status === "completed") && (
            <Workspace session={session} me={me} other={other} />
          )}
        </div>
        <aside className="space-y-4">
          <Card className="flex flex-col gap-2 p-4">
            {["accepted", "scheduled", "completed"].includes(session.status) && (
              <ButtonLink href={`/messages?with=${other.id}`} variant="secondary">
                <MessageCircle className="size-4" /> Message {other.name.split(" ")[0]}
              </ButtonLink>
            )}
            <ButtonLink
              href={`/ai?context=${encodeURIComponent(`Preparing for a ${MODES[session.mode].label} peer session on ${session.courseId}${session.topics.length ? `: ${session.topics.join(", ")}` : ""}`)}&prompt=${encodeURIComponent(`Help me prepare for my study session on ${session.topics.join(", ") || session.courseId}. What should I review and what questions should I bring?`)}`}
              variant="quiet"
            >
              <Sparkles className="size-4" /> Prep with the AI Assistant
            </ButtonLink>
          </Card>
          {["requested", "accepted", "scheduled"].includes(session.status) && <ModeSwitcher session={session} />}
          <Card className="p-5 text-sm">
            <h2 className="font-semibold text-slate-900">Details</h2>
            <dl className="mt-3 space-y-2.5">
              <Row k="Course" v={session.courseId} />
              <Row k="Topics" v={session.topics.join(", ") || "Open"} />
              <Row k="Mode" v={MODES[session.mode].label} />
              <Row k="Time" v={session.slot ? slotLabel(session.slot) : "Not picked yet"} />
              {session.note && <Row k="Note" v={`“${session.note}”`} />}
            </dl>
          </Card>
          <Card className="p-5 text-sm text-slate-600">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <Lock className="size-4 text-sky-600" /> Privacy
            </p>
            <p className="mt-2">
              Contact info and full schedules are never shared. Decide where to meet once you&apos;re both comfortable.
              Feedback after the session is private.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right text-slate-800">{v}</dd>
    </div>
  );
}

function ModeSwitcher({ session }: { session: Session }) {
  const { dispatch, toast } = useStore();
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">Learning mode</h2>
      <p className="mb-3 mt-1 text-xs text-slate-500">You can switch modes any time before the session wraps up.</p>
      <Segmented
        label="Learning mode"
        value={session.mode}
        onChange={(m: Mode) => {
          dispatch({ type: "SET_MODE", sessionId: session.id, mode: m });
          toast(`Switched to ${MODES[m].label}`, "info");
        }}
        options={MODE_LIST.map((m) => ({ value: m, label: MODES[m].label.replace(" Mode", "") }))}
      />
    </Card>
  );
}

function StatusPanel({ session, me, other }: { session: Session; me: Student; other: Student }) {
  const { dispatch, toast } = useStore();
  const first = other.name.split(" ")[0];
  const iRequested = session.requesterId === me.id;

  if (session.status === "requested" && iRequested) {
    return (
      <Card className="p-5 sm:p-6">
        <p className="font-display text-lg font-semibold text-slate-900">Waiting for {first} to reply</p>
        <p className="mt-1 text-sm text-slate-600">
          {first} can accept or decline. Either way, no one sees a reason — it&apos;s never personal.
        </p>
        <div className="mt-5 space-y-3">
          <DemoControl label={`Demo control · act as ${first}`}>
            <Button
              size="sm"
              onClick={() => {
                dispatch({ type: "RESPOND_REQUEST", sessionId: session.id, accept: true });
                toast(`${first} accepted! Pick a time.`);
              }}
            >
              Simulate {first} accepting
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                dispatch({ type: "RESPOND_REQUEST", sessionId: session.id, accept: false });
                toast(`${first} can't make it this time.`, "info");
              }}
            >
              Simulate declining
            </Button>
          </DemoControl>
          <Button variant="quiet" size="sm" onClick={() => dispatch({ type: "CANCEL_SESSION", sessionId: session.id })}>
            Cancel request
          </Button>
        </div>
      </Card>
    );
  }

  if (session.status === "requested") {
    return (
      <Card className="p-5 ring-sky-200 sm:p-6">
        <p className="font-display text-lg font-semibold text-slate-900">{first} asked for your help</p>
        {other.firstTimeLearner && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            <Sparkles className="size-3.5" /> First time asking for help · +20 XP bonus for a completed session
          </p>
        )}
        {session.note && <p className="mt-3 rounded-xl bg-mist-100 p-3 text-sm italic text-slate-700">“{session.note}”</p>}
        <div className="mt-5 flex gap-2">
          <Button
            onClick={() => {
              dispatch({ type: "RESPOND_REQUEST", sessionId: session.id, accept: true });
              toast(`Accepted! Now pick a time with ${first}.`);
            }}
          >
            Accept
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              dispatch({ type: "RESPOND_REQUEST", sessionId: session.id, accept: false });
              toast("Declined. They won't see a reason.", "info");
            }}
          >
            Decline
          </Button>
        </div>
      </Card>
    );
  }

  if (session.status === "accepted") return <SlotPicker session={session} me={me} other={other} />;

  if (session.status === "scheduled") {
    const mine = !!session.confirmations[me.id];
    const theirs = !!session.confirmations[other.id];
    return (
      <Card className="p-5 sm:p-6">
        <p className="font-display text-lg font-semibold text-slate-900">
          Scheduled for {slotLabel(session.slot!)}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Meet in person or on whatever you both already use — SoonerTogether doesn&apos;t host calls. Afterwards,
          you both confirm it happened. XP is awarded once both confirmations are in.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            [me, mine, "You"],
            [other, theirs, first],
          ].map(([s, ok, label]) => (
            <li key={(s as Student).id} className="flex items-center gap-3 rounded-xl bg-mist-100 p-3 text-sm">
              <Avatar student={s as Student} size={32} />
              <span className="flex-1 font-medium text-slate-800">{label as string}</span>
              {ok ? (
                <span className="inline-flex items-center gap-1 text-teal-700">
                  <CheckCircle2 className="size-4" /> Confirmed
                </span>
              ) : (
                <span className="text-slate-500">Not yet</span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-col gap-3">
          {!mine && (
            <Button
              className="self-start"
              onClick={() => {
                dispatch({ type: "CONFIRM_COMPLETE", sessionId: session.id, userId: me.id, at: Date.now() });
                if (!theirs) toast(`Confirmed. Waiting for ${first} to confirm too.`, "info");
              }}
            >
              <CheckCircle2 className="size-4" /> We met — confirm completion
            </Button>
          )}
          {!theirs && (
            <DemoControl label={`Demo control · act as ${first}`}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => dispatch({ type: "CONFIRM_COMPLETE", sessionId: session.id, userId: other.id, at: Date.now() })}
              >
                Simulate {first} confirming
              </Button>
            </DemoControl>
          )}
          <Button variant="quiet" size="sm" className="self-start" onClick={() => dispatch({ type: "CANCEL_SESSION", sessionId: session.id })}>
            Cancel session
          </Button>
        </div>
      </Card>
    );
  }

  if (session.status === "completed") return <CompletedPanel session={session} me={me} other={other} />;

  // declined / cancelled
  return (
    <Card>
      <EmptyState
        icon={<RefreshCw className="size-5" />}
        title={session.status === "declined" ? `${first} can't take this one` : "This session was cancelled"}
        body="No reasons are shared — people's weeks fill up. There are other classmates who can help."
        action={
          <ButtonLink href={`/match?course=${encodeURIComponent(session.courseId)}&topic=${encodeURIComponent(session.topics[0] ?? "")}&mode=${session.mode}`}>
            Find another match
          </ButtonLink>
        }
      />
    </Card>
  );
}

function SlotPicker({ session, me, other }: { session: Session; me: Student; other: Student }) {
  const { dispatch, toast } = useStore();
  const slots = sortSlots(mutualSlots(me, other));
  const [slot, setSlot] = useState<SlotId | null>(slots[0] ?? null);
  return (
    <Card className="p-5 sm:p-6">
      <p className="font-display text-lg font-semibold text-slate-900">Pick a time you&apos;re both free</p>
      <p className="mt-1 text-sm text-slate-600">
        Only overlapping windows are shown — neither of you sees the other&apos;s full schedule.
      </p>
      {slots.length > 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!slot) return;
            dispatch({ type: "SCHEDULE_SESSION", sessionId: session.id, slot });
            toast(`Scheduled for ${slotLabel(slot)}. It's on both dashboards.`);
          }}
        >
          <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Mutual time windows</legend>
            {slots.map((s) => (
              <label
                key={s}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-xl p-3 text-sm ring-1 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600",
                  slot === s ? "bg-sky-50 ring-sky-400" : "bg-white ring-slate-200 hover:ring-slate-300",
                )}
              >
                <input type="radio" name="slot" className="sr-only" checked={slot === s} onChange={() => setSlot(s)} />
                <CalendarClock className={cx("size-4", slot === s ? "text-sky-600" : "text-slate-400")} />
                <span className="font-medium text-slate-800">{slotLabel(s)}</span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" className="mt-5" disabled={!slot}>
            Confirm time
          </Button>
          <p className="mt-2 text-xs text-slate-500">Simulated time slots for the demo — no calendar sync.</p>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-mist-100 p-3 text-sm text-slate-600">
          You don&apos;t share any time windows right now. Update your availability in your profile.
        </p>
      )}
    </Card>
  );
}

function CompletedPanel({ session, me, other }: { session: Session; me: Student; other: Student }) {
  const { state, dispatch, toast } = useStore();
  const first = other.name.split(" ")[0];
  const xpHere = state.xp.filter((e) => e.userId === me.id && e.key.split(":")[1] === session.id);
  const mine = session.feedback[me.id];
  const theirs = session.feedback[other.id];
  const connection = connectionBetween(state, me.id, other.id);
  const [form, setForm] = useState<SessionFeedback>({ helpful: true, again: true, connect: true });
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const open = openSessionWith(state, me.id, other.id, session.courseId);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 bg-sky-600 p-5 text-white sm:p-6">
          <div className="flex size-12 animate-pop items-center justify-center rounded-2xl bg-white/15">
            <Sparkles className="size-6" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">Session complete</p>
            <p className="text-sm text-sky-100">
              {xpHere.length > 0
                ? `You earned ${xpHere.reduce((s, e) => s + e.amount, 0)} XP for this session.`
                : "Verified by both of you."}
            </p>
          </div>
        </div>
        {xpHere.length > 0 && (
          <ul className="divide-y divide-slate-100 px-5 sm:px-6">
            {xpHere.map((e) => (
              <li key={e.key} className="flex justify-between py-3 text-sm">
                <span className="text-slate-600">{e.reason}</span>
                <span className="font-semibold tabular-nums text-sky-700">+{e.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {connection ? (
        <Card className="animate-rise p-6 text-center ring-teal-600/30">
          <div className="mx-auto flex w-fit items-center">
            <Avatar student={me} size={52} ring />
            <span className="z-10 -mx-2 flex size-8 items-center justify-center rounded-full bg-teal-600 text-white ring-2 ring-white">
              <HeartHandshake className="size-4" />
            </span>
            <Avatar student={other} size={52} ring />
          </div>
          <p className="mt-4 font-display text-xl font-semibold text-slate-900">You and {first} are study connections</p>
          <p className="mt-1 text-sm text-slate-600">
            You both said yes. Find each other easily, book again, and join circles together.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <ButtonLink href="/connections" variant="secondary">
              See connections
            </ButtonLink>
            {open ? (
              <ButtonLink href={`/sessions/${open.id}`}>Open next session</ButtonLink>
            ) : (
              <Button onClick={() => setDraft({ partner: other, kind: session.kind, courseId: session.courseId, topics: session.topics, mode: session.mode })}>
                Book another session
              </Button>
            )}
          </div>
        </Card>
      ) : mine ? (
        <Card className="p-5 sm:p-6">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <Lock className="size-4 text-sky-600" /> Your feedback is saved privately
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {mine.connect
              ? `If ${first} also wants to connect, you'll both be notified. If not, nothing happens — no one is ever told about a "no".`
              : "Thanks for sharing. Nothing you said is shown to anyone."}
          </p>
          {!theirs && (
            <div className="mt-4">
              <DemoControl label={`Demo control · ${first}'s private answer`}>
                <Button
                  size="sm"
                  onClick={() =>
                    dispatch({
                      type: "SUBMIT_FEEDBACK",
                      sessionId: session.id,
                      userId: other.id,
                      feedback: { helpful: true, again: true, connect: true },
                      at: Date.now(),
                    })
                  }
                >
                  <Heart className="size-3.5" /> {first} also wants to connect
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    dispatch({
                      type: "SUBMIT_FEEDBACK",
                      sessionId: session.id,
                      userId: other.id,
                      feedback: { helpful: true, again: false, connect: false },
                      at: Date.now(),
                    });
                    toast("Recorded. In the real app you'd never see this.", "info");
                  }}
                >
                  {first} prefers not to
                </Button>
              </DemoControl>
            </div>
          )}
          {theirs && !connection && (
            <p className="mt-3 text-xs text-slate-500">
              Demo note: {first}&apos;s answer is recorded but kept hidden, exactly as it would be for real.
            </p>
          )}
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <CardHeaderLite
            title={`How was studying with ${first}?`}
            body={`Only you see your answers. A connection forms only if you and ${first} both choose it.`}
          />
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              dispatch({ type: "SUBMIT_FEEDBACK", sessionId: session.id, userId: me.id, feedback: form, at: Date.now() });
              toast("Saved privately.");
            }}
          >
            {(
              [
                ["helpful", "This session was helpful", "Gives them +10 XP. Never a public rating."],
                ["again", `I'd study with ${first} again`, "Helps us suggest them first next time."],
                ["connect", `Add ${first} as a study connection`, "Only becomes real if they say yes too."],
              ] as const
            ).map(([key, label, hint]) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-slate-200 transition hover:ring-slate-300 has-[:checked]:bg-sky-50/60 has-[:checked]:ring-sky-300"
              >
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                  className="mt-0.5 size-4 accent-sky-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{label}</span>
                  <span className="block text-xs text-slate-500">{hint}</span>
                </span>
              </label>
            ))}
            <Button type="submit" className="mt-3">
              Save privately
            </Button>
          </form>
        </Card>
      )}
      <RequestDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function CardHeaderLite({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-display text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
    </div>
  );
}

// ── Mode workspaces ──────────────────────────────────────────────────────────

function Workspace({ session, me, other }: { session: Session; me: Student; other: Student }) {
  if (session.mode === "teaching") return <TeachingWorkspace session={session} />;
  if (session.mode === "discussion") return <DiscussionWorkspace session={session} />;
  return <TalkWorkspace session={session} me={me} other={other} />;
}

function useWorkspace(session: Session) {
  const { dispatch } = useStore();
  return (patch: Partial<Pick<Session, "goals" | "notes" | "reflection" | "checklist">>) =>
    dispatch({ type: "UPDATE_WORKSPACE", sessionId: session.id, patch });
}

function TeachingWorkspace({ session }: { session: Session }) {
  const update = useWorkspace(session);
  const [newItem, setNewItem] = useState("");
  const done = session.checklist.filter((c) => c.done).length;
  return (
    <Card>
      <CardHeader title="Teaching workspace" icon={<MODE_ICONS.teaching className="size-4" />} description="Shared by both of you. Saves as you type." />
      <div className="space-y-5 p-5">
        <Field label="Session goal" htmlFor="goal">
          <textarea id="goal" rows={2} value={session.goals} onChange={(e) => update({ goals: e.target.value })} className={inputClass} />
        </Field>
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium text-slate-800">Topic checklist</p>
            <p className="text-xs tabular-nums text-slate-500">
              {done}/{session.checklist.length} covered
            </p>
          </div>
          <ul className="space-y-1.5">
            {session.checklist.map((c, i) => (
              <li key={i}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-mist-50 px-3 py-2.5 text-sm ring-1 ring-slate-200/70">
                  <input
                    type="checkbox"
                    checked={c.done}
                    onChange={() =>
                      update({ checklist: session.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })
                    }
                    className="size-4 accent-sky-600"
                  />
                  <span className={cx(c.done && "text-slate-400 line-through")}>{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newItem.trim()) return;
              update({ checklist: [...session.checklist, { text: newItem.trim(), done: false }] });
              setNewItem("");
            }}
          >
            <label htmlFor="new-item" className="sr-only">
              Add a checklist item
            </label>
            <input id="new-item" value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a topic…" className={inputClass} />
            <Button type="submit" variant="secondary" aria-label="Add item">
              <Plus className="size-4" />
            </Button>
          </form>
        </div>
        <Field label="Shared notes" htmlFor="notes" hint="Key ideas, worked steps, things to practice later.">
          <textarea id="notes" rows={5} value={session.notes} onChange={(e) => update({ notes: e.target.value })} className={inputClass} placeholder="The Chain Rule: derivative of the outside, times the derivative of the inside…" />
        </Field>
      </div>
    </Card>
  );
}

function DiscussionWorkspace({ session }: { session: Session }) {
  const update = useWorkspace(session);
  return (
    <Card>
      <CardHeader title="Discussion workspace" icon={<MODE_ICONS.discussion className="size-4" />} description="Reason it out together — nobody is the teacher." />
      <div className="space-y-5 p-5">
        <Field label="Shared learning goal" htmlFor="goal">
          <textarea id="goal" rows={2} value={session.goals} onChange={(e) => update({ goals: e.target.value })} className={inputClass} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-800">Discussion prompts</p>
          <ol className="space-y-2">
            {DISCUSSION_PROMPTS.map((p, i) => (
              <li key={p} className="flex gap-3 rounded-xl bg-mist-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                <span className="font-display font-semibold text-sky-400">{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </div>
        <Field label="Questions we're working on" htmlFor="notes">
          <textarea id="notes" rows={4} value={session.notes} onChange={(e) => update({ notes: e.target.value })} className={inputClass} placeholder="Why do we multiply by the inner derivative and not add it?" />
        </Field>
        {session.status === "completed" && (
          <Field label="Reflection" htmlFor="reflection" hint="What clicked? What's still fuzzy? Only the two of you see this.">
            <textarea id="reflection" rows={3} value={session.reflection} onChange={(e) => update({ reflection: e.target.value })} className={inputClass} />
          </Field>
        )}
      </div>
    </Card>
  );
}

function TalkWorkspace({ session, me, other }: { session: Session; me: Student; other: Student }) {
  const [i, setI] = useState(0);
  const shared = me.interests.filter((x) => other.interests.includes(x));
  const update = useWorkspace(session);
  return (
    <Card>
      <CardHeader title="Talk Mode" icon={<MODE_ICONS.talk className="size-4" />} description="Peer connection, not counseling. Keep it easy." />
      <div className="space-y-5 p-5">
        <div className="rounded-2xl bg-sky-600 p-5 text-white">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-100">
            <MessageSquareQuote className="size-4" /> Icebreaker
          </p>
          <p key={i} className="mt-2 animate-rise font-display text-xl font-medium">
            {ICEBREAKERS[i % ICEBREAKERS.length]}
          </p>
          <button type="button" onClick={() => setI((x) => x + 1)} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">
            <Shuffle className="size-3.5" /> Another one
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">Conversation topics</p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {TALK_TOPICS.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-800">You both like</p>
            <div className="flex flex-wrap gap-1.5">
              {shared.length > 0 ? shared.map((s) => <Tag key={s} tone="crimson">{s}</Tag>) : <span className="text-sm text-slate-500">Ask what they&apos;re into!</span>}
            </div>
            <p className="mb-2 mt-4 text-sm font-medium text-slate-800">Optional meetup ideas</p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {MEETUP_IDEAS.map((t) => (
                <li key={t} className="flex gap-2">
                  <Coffee className="mt-0.5 size-3.5 shrink-0 text-slate-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Field label="Shared notes" htmlFor="notes" optional>
          <textarea id="notes" rows={3} value={session.notes} onChange={(e) => update({ notes: e.target.value })} className={inputClass} placeholder="Study tips worth remembering…" />
        </Field>
        <p className="rounded-xl bg-mist-100 p-3 text-xs text-slate-600">
          If you or a friend is struggling, OU has professional support services. Talk Mode is for peer connection and
          is not a substitute for counseling.
        </p>
      </div>
    </Card>
  );
}
