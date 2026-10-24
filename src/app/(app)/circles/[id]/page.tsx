"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CheckCircle2,
  Crown,
  Flag,
  LogOut,
  MapPin,
  MessageCircle,
  Repeat,
  SearchX,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { circleWhen } from "@/components/cards";
import { Avatar, Button, ButtonLink, Card, CardHeader, cx, Dialog, EmptyState, ProgressBar, Skeleton, Tag } from "@/components/ui";
import { useStore } from "@/lib/store";
import { challengeComplete, connectionBetween, formatLabel, studentById } from "@/lib/state";
import type { Student } from "@/lib/types";
import { REWARDS, weekKey } from "@/lib/xp";

export default function CirclePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <CircleDetail />
    </Suspense>
  );
}

function CircleDetail() {
  const { id } = useParams<{ id: string }>();
  const { state, me, dispatch, toast, mode } = useStore();
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Captured once per visit so "this week" stays stable across re-renders.
  const [now] = useState(Date.now);
  const circle = state.circles.find((c) => c.id === id);

  if (!circle) {
    return (
      <Card>
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="Circle not found"
          body="It may have been removed when the demo was reset."
          action={<ButtonLink href="/circles">Browse circles</ButtonLink>}
        />
      </Card>
    );
  }

  const members = circle.memberIds.map((m) => studentById(state, m)).filter((s): s is Student => !!s);
  const isMember = circle.memberIds.includes(me.id);
  const full = circle.memberIds.length >= circle.capacity;
  const wk = weekKey(now);
  const checkedIn = (circle.attendance[wk] ?? []).includes(me.id);
  const attendedWeeks = Object.values(circle.attendance).filter((ids) => ids.includes(me.id)).length;
  const weekNumber = Number(wk.split("-W")[1]);
  const lead = circle.leadRotation.length > 0 ? circle.leadRotation[weekNumber % circle.leadRotation.length] : null;
  const leadStudent = lead ? studentById(state, lead) : null;
  const completedChallenges = circle.challenges.filter((c) => challengeComplete(circle, c.doneBy));
  const chatHref = mode === "cloud" ? `/messages?circle=${circle.id}` : `/messages/demo-circle-${circle.id}`;
  const groupXp = state.xp.filter((e) => e.key.startsWith(`milestone:${circle.id}:`) || e.key.startsWith(`circle:${circle.id}:`));

  return (
    <div>
      <Link href="/circles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-sky-700">
        <ArrowLeft className="size-4" /> All circles
      </Link>

      <Card className="paper mb-6 p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Tag tone="cream">{circle.courseId}</Tag>
              <Tag tone="outline">{formatLabel(circle.format)}</Tag>
              {isMember && (
                <Tag tone="sage">
                  <Check className="size-3" /> You&apos;re a member
                </Tag>
              )}
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{circle.name}</h1>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2"><Repeat className="size-4 text-sky-600" /> {circleWhen(circle)}</li>
              <li className="flex items-center gap-2"><MapPin className="size-4 text-sky-600" /> {circle.location}</li>
              <li className="flex items-center gap-2"><Users className="size-4 text-sky-600" /> {circle.memberIds.length}/{circle.capacity} members</li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isMember ? (
              <>
                <Button
                  disabled={checkedIn}
                  onClick={() => dispatch({ type: "ATTEND_CIRCLE", circleId: circle.id, userId: me.id, at: now })}
                >
                  {checkedIn ? <><CheckCircle2 className="size-4" /> Checked in this week</> : <><CalendarCheck className="size-4" /> I attended this week</>}
                </Button>
                <ButtonLink href={chatHref} variant="secondary">
                  <MessageCircle className="size-4" /> Group chat
                </ButtonLink>
                <Button variant="quiet" onClick={() => setConfirmLeave(true)}>
                  <LogOut className="size-4" /> Leave
                </Button>
              </>
            ) : (
              <Button
                size="lg"
                disabled={full}
                onClick={() => {
                  dispatch({ type: "JOIN_CIRCLE", circleId: circle.id, userId: me.id });
                  toast(`Welcome to ${circle.name}! See you ${circleWhen(circle)}.`);
                }}
              >
                {full ? "This circle is full" : "Join this circle"}
              </Button>
            )}
          </div>
        </div>
        {isMember && !checkedIn && (
          <p className="mt-4 text-xs text-slate-500">Check in after each meeting: +{REWARDS.circleAttend} XP, once per week.</p>
        )}
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600">
              <Target className="size-4" /> This week&apos;s objective
            </p>
            <p className="mt-2 font-display text-xl font-medium text-slate-900">{circle.weeklyObjective}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {circle.focus.map((f) => <Tag key={f}>{f}</Tag>)}
            </div>
            {leadStudent && (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-mist-100 p-3">
                <Avatar student={leadStudent} size={36} />
                <p className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">{leadStudent.id === me.id ? "You lead" : `${leadStudent.name.split(" ")[0]} leads`}</span>{" "}
                  this week&apos;s explanation. Roles rotate every meeting so everyone teaches and everyone learns.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Group challenges"
              icon={<Flag className="size-4" />}
              description={`A challenge becomes a group milestone once ${Math.min(3, circle.memberIds.length)} members finish it (+${REWARDS.groupMilestone} XP each).`}
            />
            <ul className="space-y-3 p-5">
              {circle.challenges.map((ch) => {
                const doneByMembers = ch.doneBy.filter((x) => circle.memberIds.includes(x));
                const target = Math.min(3, circle.memberIds.length);
                const complete = challengeComplete(circle, ch.doneBy);
                const mine = ch.doneBy.includes(me.id);
                return (
                  <li key={ch.id} className={cx("rounded-2xl p-4 ring-1", complete ? "bg-teal-100/60 ring-teal-600/20" : "bg-white ring-slate-200")}>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        disabled={!isMember}
                        aria-pressed={mine}
                        aria-label={mine ? `Mark "${ch.text}" as not done` : `Mark "${ch.text}" as done`}
                        onClick={() => dispatch({ type: "TOGGLE_CHALLENGE", circleId: circle.id, challengeId: ch.id, userId: me.id, at: Date.now() })}
                        className={cx(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg ring-1 transition",
                          mine ? "bg-sky-600 text-white ring-sky-600" : "bg-white ring-slate-300 hover:ring-sky-400",
                          !isMember && "cursor-not-allowed opacity-50",
                        )}
                      >
                        {mine && <Check className="size-4" strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{ch.text}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <ProgressBar value={Math.min(1, doneByMembers.length / target)} label={`${ch.text} progress`} tone={complete ? "sage" : "crimson"} className="max-w-48" />
                          <span className="text-xs tabular-nums text-slate-500">
                            {Math.min(doneByMembers.length, target)}/{target}
                          </span>
                          {complete && <Tag tone="sage"><Trophy className="size-3" /> Milestone</Tag>}
                        </div>
                      </div>
                      <div className="hidden -space-x-1.5 sm:flex">
                        {doneByMembers.map((uid) => {
                          const s = studentById(state, uid);
                          return s ? <Avatar key={uid} student={s} size={24} ring /> : null;
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!isMember && <p className="px-5 pb-5 text-sm text-slate-500">Join the circle to take on challenges together.</p>}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Members" icon={<Users className="size-4" />} />
            <ul className="space-y-1 p-2">
              {members.map((m) => {
                const connected = m.id !== me.id && !!connectionBetween(state, me.id, m.id);
                return (
                  <li key={m.id}>
                    <Link href={`/students/${m.id === me.id ? "me" : m.id}`} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-mist-100">
                      <Avatar student={m} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {m.id === me.id ? `${m.name} (you)` : m.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">{m.major}</span>
                      </span>
                      {m.id === circle.creatorId && <Crown className="size-4 text-amber-500" aria-label="Founder" />}
                      {connected && <Tag tone="sage">Connection</Tag>}
                    </Link>
                  </li>
                );
              })}
              {Array.from({ length: circle.capacity - members.length }).map((_, i) => (
                <li key={`open-${i}`} className="flex items-center gap-3 rounded-xl p-2.5 text-sm text-slate-400">
                  <span className="size-9 rounded-full border-2 border-dashed border-slate-300" /> Open seat
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Trophy className="size-4 text-sky-600" /> Group achievements
            </h2>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Milestones", completedChallenges.length],
                ["Check-ins", groupXp.filter((e) => e.key.startsWith("circle:")).length],
                ["You attended", attendedWeeks],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-mist-100 py-2.5">
                  <dd className="font-display text-xl font-semibold tabular-nums text-slate-900">{v}</dd>
                  <dt className="text-[11px] text-slate-500">{k}</dt>
                </div>
              ))}
            </dl>
            {completedChallenges.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {completedChallenges.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" /> {c.text}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)} title={`Leave ${circle.name}?`} description="You can rejoin later if there's an open seat. Your XP and history stay.">
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>Stay</Button>
          <Button
            variant="danger"
            onClick={() => {
              dispatch({ type: "LEAVE_CIRCLE", circleId: circle.id, userId: me.id });
              setConfirmLeave(false);
              toast(`You left ${circle.name}.`, "info");
            }}
          >
            Leave circle
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
