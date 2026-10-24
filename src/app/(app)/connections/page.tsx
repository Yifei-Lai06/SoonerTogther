"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, CircleDot, HeartHandshake, History, Lock, MessageCircle, Milestone, Users } from "lucide-react";
import { RequestDialog, type RequestDraft } from "@/components/RequestDialog";
import { Avatar, Button, ButtonLink, Card, EmptyState, PageHeader, Tag } from "@/components/ui";
import { MODES, slotLabel } from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { openSessionWith, studentById } from "@/lib/state";
import type { Connection, Student } from "@/lib/types";

function milestones(sessions: number, sharedCircles: number) {
  return [
    { label: "First session", reached: sessions >= 1 },
    { label: "3 sessions together", reached: sessions >= 3 },
    { label: "5 sessions together", reached: sessions >= 5 },
    { label: "Same Study Circle", reached: sharedCircles > 0 },
  ];
}

export default function ConnectionsPage() {
  const { state, me } = useStore();
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const mine = state.connections.filter((c) => c.userIds.includes(me.id)).sort((a, b) => b.since - a.since);

  return (
    <div>
      <PageHeader
        eyebrow="Connections"
        title="Your study people"
        description="Connections form only when both people say yes after a session. Nobody ever sees who said no."
      />
      <p className="mb-6 flex items-start gap-2 rounded-2xl bg-mist-200/60 p-4 text-sm text-slate-600">
        <Lock className="mt-0.5 size-4 shrink-0 text-sky-600" />
        Your connections list is private. There are no follower counts, ratings or public rankings — this isn&apos;t a
        popularity contest.
      </p>

      {mine.length === 0 ? (
        <Card>
          <EmptyState
            icon={<HeartHandshake className="size-5" />}
            title="No connections yet"
            body="After your next session, choose “add as a study connection”. If they choose it too, they'll appear here."
            action={<ButtonLink href="/match">Find someone to study with</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {mine.map((c) => (
            <ConnectionCard key={c.id} connection={c} onBook={setDraft} />
          ))}
        </div>
      )}
      <RequestDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function ConnectionCard({ connection, onBook }: { connection: Connection; onBook: (d: RequestDraft) => void }) {
  const { state, me } = useStore();
  const other = studentById(state, connection.userIds.find((id) => id !== me.id)!) as Student;
  const history = state.sessions
    .filter(
      (s) =>
        s.status === "completed" &&
        [s.requesterId, s.partnerId].includes(me.id) &&
        [s.requesterId, s.partnerId].includes(other.id),
    )
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const sharedCircles = state.circles.filter((c) => c.memberIds.includes(me.id) && c.memberIds.includes(other.id));
  const theirCircles = state.circles.filter(
    (c) => c.memberIds.includes(other.id) && !c.memberIds.includes(me.id) && c.memberIds.length < c.capacity,
  );
  const last = history[0];
  const courseId = last?.courseId ?? other.canTutor[0]?.courseId ?? me.needsHelp[0]?.courseId ?? "MATH 1914";
  const open = openSessionWith(state, me.id, other.id, courseId);
  const since = new Date(connection.since).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Card as="article" className="animate-rise overflow-hidden">
      <div className="flex items-start gap-4 p-5">
        <Link href={`/students/${other.id}`} className="rounded-full">
          <Avatar student={other} size={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/students/${other.id}`} className="font-semibold text-slate-900 hover:text-sky-700">
            {other.name}
          </Link>
          <p className="text-sm text-slate-500">
            {other.year} · {other.major}
          </p>
          <p className="mt-1 text-xs text-slate-500">Connected since {since}</p>
        </div>
        <Tag tone="sage">
          <HeartHandshake className="size-3" /> Mutual
        </Tag>
      </div>

      <div className="grid gap-4 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Milestone className="size-3.5" /> Milestones
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {milestones(history.length, sharedCircles.length).map((m) => (
              <li key={m.label} className={m.reached ? "text-slate-800" : "text-slate-400"}>
                {m.reached ? "✓" : "○"} {m.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <History className="size-3.5" /> Shared history
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {history.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link href={`/sessions/${s.id}`} className="text-slate-700 hover:text-sky-700">
                  {s.courseId} · {s.topics[0] ?? MODES[s.mode].label}
                  {s.slot && <span className="text-slate-400"> · {slotLabel(s.slot)}</span>}
                </Link>
              </li>
            ))}
            {history.length === 0 && <li className="text-slate-400">No sessions yet</li>}
          </ul>
        </div>
      </div>

      {(sharedCircles.length > 0 || theirCircles.length > 0) && (
        <div className="border-t border-slate-100 px-5 py-4 text-sm">
          {sharedCircles.length > 0 && (
            <p className="flex items-center gap-2 text-slate-700">
              <Users className="size-4 text-sky-600" /> Together in{" "}
              {sharedCircles.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ", "}
                  <Link href={`/circles/${c.id}`} className="font-medium hover:text-sky-700">{c.name}</Link>
                </span>
              ))}
            </p>
          )}
          {theirCircles.slice(0, 1).map((c) => (
            <p key={c.id} className="mt-1 flex items-center gap-2 text-slate-600">
              <CircleDot className="size-4 text-slate-400" /> {other.name.split(" ")[0]} is in{" "}
              <Link href={`/circles/${c.id}`} className="font-medium text-sky-700 hover:underline">{c.name}</Link> — there&apos;s a seat open.
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-mist-50/60 px-5 py-3">
        <ButtonLink href={`/students/${other.id}`} variant="quiet" size="sm">
          Profile
        </ButtonLink>
        <ButtonLink href={`/messages?with=${other.id}`} variant="secondary" size="sm">
          <MessageCircle className="size-4" /> Message
        </ButtonLink>
        {open ? (
          <ButtonLink href={`/sessions/${open.id}`} size="sm">
            <CalendarCheck className="size-4" /> Open session
          </ButtonLink>
        ) : (
          <Button
            size="sm"
            onClick={() =>
              onBook({
                partner: other,
                kind: other.canTutor.some((t) => t.courseId === courseId) ? "tutor" : "partner",
                courseId,
                topics: last?.topics ?? [],
                mode: last?.mode ?? "discussion",
              })
            }
          >
            <CalendarCheck className="size-4" /> Request another session
          </Button>
        )}
      </div>
    </Card>
  );
}
