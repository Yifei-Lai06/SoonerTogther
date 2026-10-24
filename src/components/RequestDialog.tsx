"use client";

import Link from "next/link";
import { useState } from "react";
import { MessageCircle, Presentation, Users } from "lucide-react";
import { Avatar, Button, ButtonLink, Chip, cx, Dialog, Field, inputClass } from "./ui";
import { courseById, MODE_LIST, MODES } from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { openSessionWith } from "@/lib/state";
import type { Mode, Student } from "@/lib/types";

export const MODE_ICONS: Record<Mode, React.ComponentType<{ className?: string }>> = {
  teaching: Presentation,
  discussion: Users,
  talk: MessageCircle,
};

export interface RequestDraft {
  partner: Student;
  kind: "tutor" | "partner";
  courseId: string;
  topics: string[];
  mode: Mode;
}

/** Sends a session request. The same dialog is used from matches, profiles and connections. */
export function RequestDialog({ draft, onClose }: { draft: RequestDraft | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!draft}
      onClose={onClose}
      title={draft ? `Request a session with ${draft.partner.name.split(" ")[0]}` : ""}
      description="They'll see your request and can accept or decline. Your contact info is never shared."
    >
      {draft && <RequestForm key={`${draft.partner.id}-${draft.courseId}`} draft={draft} onClose={onClose} />}
    </Dialog>
  );
}

function RequestForm({ draft, onClose }: { draft: RequestDraft; onClose: () => void }) {
  const { state, dispatch, toast, mode: backend } = useStore();
  const course = courseById(draft.courseId);
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [topics, setTopics] = useState<string[]>(draft.topics);
  const [note, setNote] = useState("");
  const [sentId, setSentId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const existing = openSessionWith(state, state.meId, draft.partner.id, draft.courseId);

  if (sentId || existing) {
    const id = sentId ?? existing!.id;
    return (
      <div className="animate-rise text-center">
        <div className="mx-auto mb-3 flex w-fit items-center">
          <Avatar student={state.students.find((s) => s.id === state.meId)!} size={44} ring />
          <span className="-mx-1 h-0.5 w-8 bg-sky-300" />
          <Avatar student={draft.partner} size={44} ring />
        </div>
        <p className="font-medium text-slate-900">
          {sentId ? "Request sent!" : "You already have an open request with them."}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {backend === "cloud"
            ? `${draft.partner.name.split(" ")[0]} gets a notification. When they accept, a private chat opens in Messages.`
            : `Track it in Sessions. In demo mode you can simulate ${draft.partner.name.split(" ")[0]}'s response there.`}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            Keep browsing
          </Button>
          <ButtonLink href={`/sessions/${id}`} onClick={onClose}>
            Open session
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        const result = await dispatch({
          type: "REQUEST_SESSION",
          partnerId: draft.partner.id,
          kind: draft.kind,
          courseId: draft.courseId,
          topics,
          mode,
          note,
          at: Date.now(),
        });
        setSending(false);
        if (!result.ok || !result.id) return;
        setSentId(result.id);
        toast(`Request sent to ${draft.partner.name.split(" ")[0]}`);
      }}
      className="space-y-5"
    >
      <div className="flex items-center gap-3 rounded-xl bg-mist-100 p-3">
        <Avatar student={draft.partner} size={40} />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-900">{draft.partner.name}</p>
          <p className="text-slate-500">
            {draft.kind === "tutor" ? "Peer tutor" : "Study partner"} · {draft.courseId}
            {course && ` · ${course.title}`}
          </p>
        </div>
      </div>

      {course && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">What do you want to work on?</legend>
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
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">How do you want to learn?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_LIST.map((m) => {
            const Icon = MODE_ICONS[m];
            const on = m === mode;
            return (
              <label
                key={m}
                className={cx(
                  "flex cursor-pointer flex-col gap-1 rounded-xl p-3 text-left ring-1 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600",
                  on ? "bg-sky-50 ring-sky-400" : "bg-white ring-slate-200 hover:ring-slate-300",
                )}
              >
                <input type="radio" name="mode" className="sr-only" checked={on} onChange={() => setMode(m)} />
                <Icon className={cx("size-4", on ? "text-sky-600" : "text-slate-500")} />
                <span className="text-sm font-medium text-slate-900">{MODES[m].label.replace(" Mode", "")}</span>
                <span className="text-xs text-slate-500">{MODES[m].tagline}</span>
              </label>
            );
          })}
        </div>
        {!draft.partner.modes.includes(mode) && (
          <p className="mt-2 text-xs text-slate-500">
            Heads up: {draft.partner.name.split(" ")[0]} usually prefers{" "}
            {draft.partner.modes.map((m) => MODES[m].label).join(" or ")}. You can still ask.
          </p>
        )}
      </fieldset>

      <Field label="A short note" htmlFor="req-note" optional hint="What's confusing you? A sentence is plenty.">
        <textarea
          id="req-note"
          rows={3}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
          placeholder="I get the Chain Rule on simple problems but lose track when there are three layers…"
        />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/students/${draft.partner.id}`} className="text-sm font-medium text-sky-700 hover:underline" onClick={onClose}>
          View profile
        </Link>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending}>{sending ? "Sending…" : "Send request"}</Button>
        </div>
      </div>
    </form>
  );
}
