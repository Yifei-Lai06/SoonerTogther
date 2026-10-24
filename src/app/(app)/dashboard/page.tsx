"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CircleDot,
  ExternalLink,
  GraduationCap,
  HandHeart,
  Heart,
  History,
  Inbox,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { LevelCard } from "@/components/AppShell";
import { BadgeGrid, circleWhen, SessionRow } from "@/components/cards";
import { Avatar, Button, ButtonLink, Card, CardHeader, EmptyState, Tag } from "@/components/ui";
import { courseById } from "@/lib/data/catalog";
import { RESOURCES } from "@/lib/data/resources";
import { useMemo } from "react";
import { useStudentMatches } from "@/lib/hooks";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DoodleCrown, DoodleSparkle, HandNote } from "@/components/doodles";
import { IntroCard, Term } from "@/components/help";
import { useMyXp, useStore } from "@/lib/store";
import { OPEN_STATUSES, studentById } from "@/lib/state";
import { computeBadges, levelInfo, tutoredSessions } from "@/lib/xp";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { state, me, dispatch, toast } = useStore();
  const xp = useMyXp();
  const lvl = levelInfo(xp);
  const badges = computeBadges(state, me.id);
  const earned = badges.filter((b) => b.earned).length;

  const incoming = state.sessions.filter((s) => s.partnerId === me.id && s.status === "requested");
  const upcoming = state.sessions.filter(
    (s) => OPEN_STATUSES.includes(s.status) && !(s.partnerId === me.id && s.status === "requested"),
  );
  const myCircles = state.circles.filter((c) => c.memberIds.includes(me.id));
  const connections = state.connections.filter((c) => c.userIds.includes(me.id)).sort((a, b) => b.since - a.since);
  const need = me.needsHelp[0];
  const recQuery = useMemo(
    () =>
      need
        ? { courseId: need.courseId, topics: need.topics, kind: "tutor" as const, mode: me.modes[0] ?? "discussion", format: me.format, useSchedule: true }
        : null,
    [need, me.modes, me.format],
  );
  const recResult = useStudentMatches(recQuery);
  const recs = recResult.data?.matches.slice(0, 3) ?? [];
  const needDepts = new Set(me.needsHelp.map((n) => courseById(n.courseId)?.dept).filter(Boolean));
  const resources = RESOURCES.filter((r) => r.depts.some((d) => needDepts.has(d))).slice(0, 2);
  const recentXp = [...state.xp].filter((e) => e.userId === me.id).sort((a, b) => b.at - a.at).slice(0, 5);
  const helped = tutoredSessions(state, me.id).length;

  return (
    <div className="space-y-6">
      <IntroCard
        id="home"
        title="Welcome to SoonerTogether"
        steps={[
          "Discover: find a tutor, study partner or Study Circle.",
          "Send a request — a private chat opens when they accept.",
          "Meet up, then you both confirm the session to earn XP.",
          "Stuck between sessions? Ask the AI Assistant for a hint.",
        ]}
      />
      {/* Welcome */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="paper relative overflow-hidden p-6 sm:p-8">
          <DoodleSparkle size="md" rotate={12} animate="twinkle" className="absolute right-6 top-6 hidden text-yellow-500 sm:block" />
          <div className="flex items-center gap-3">
            <Link href="/students/me" className="shrink-0 rounded-full">
              <Avatar student={me} size={52} className="ring-2 ring-white" />
            </Link>
            <div>
              <p className="text-sm font-medium text-slate-500">{greeting()},</p>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {me.name.split(" ")[0]}!
              </h1>
            </div>
            <HandNote rotate={-6} className="ml-1 hidden self-end pb-1 text-orange-500 sm:inline-block">good to see you</HandNote>
          </div>
          <p className="mt-2 max-w-lg text-slate-600">
            {incoming.length > 0
              ? `${studentById(state, incoming[0].requesterId)?.name.split(" ")[0]} asked for your help. Someone's counting on you today.`
              : need
                ? `Still stuck on ${need.topics[0] ?? need.courseId}? There are classmates free this week who get it.`
                : "Who will you learn with this week?"}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <ButtonLink href="/match" variant="accent">
              <Search className="size-4" /> Find Help
            </ButtonLink>
            <ButtonLink href="/sessions#incoming" variant="secondary">
              <HandHeart className="size-4" /> Offer Help
            </ButtonLink>
            <ButtonLink href="/circles" variant="secondary">
              <CircleDot className="size-4" /> Join a Study Circle
            </ButtonLink>
            <ButtonLink href="/resources" variant="secondary">
              <BookOpen className="size-4" /> Campus Resources
            </ButtonLink>
          </div>
          <Link
            href="/ai"
            className="lift mt-5 flex items-center gap-3 rounded-2xl bg-slate-900 p-3.5 text-white"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <DoodleSparkle size="md" className="text-sky-300" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Ask the AI Assistant</span>
              <span className="block truncate text-xs text-slate-300">Hints, quizzes and session prep — then bring questions to a real person.</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-slate-400" />
          </Link>
        </Card>

        <Card id="progress" className="scroll-mt-24 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <DoodleCrown size="md" rotate={-14} animate="crown" className="absolute -left-2.5 -top-4 text-yellow-500" />
              <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-900 font-display text-2xl font-extrabold text-white">
                {lvl.level}
              </div>
            </div>
            <div>
              <p className="font-display text-2xl font-semibold tabular-nums text-slate-900">
                {xp} <Term id="xp" className="text-base" />
              </p>
              <p className="text-sm text-slate-500">{lvl.title}</p>
            </div>
          </div>
          <div className="mt-5">
            <LevelCard />
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            {[
              ["Helped", helped],
              ["Connections", connections.length],
              ["Badges", `${earned}/${badges.length}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-mist-100 py-2.5">
                <dd className="font-display text-xl font-semibold tabular-nums text-slate-900">{v}</dd>
                <dt className="text-xs text-slate-500">{k}</dt>
              </div>
            ))}
          </dl>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {incoming.length > 0 && (
            <Card className="ring-sky-200">
              <CardHeader title="Requests for your help" icon={<Inbox className="size-4" />} />
              <ul className="space-y-2 p-3">
                {incoming.map((s) => {
                  const from = studentById(state, s.requesterId)!;
                  return (
                    <li key={s.id} className="flex flex-col gap-3 rounded-xl bg-sky-50/50 p-3 sm:flex-row sm:items-center">
                      <Avatar student={from} size={40} />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium text-slate-900">
                          {from.name} · {s.courseId}
                          {from.firstTimeLearner && (
                            <Tag tone="crimson" className="ml-2">
                              First-time learner
                            </Tag>
                          )}
                        </p>
                        <p className="text-slate-600">{s.topics.join(", ")}</p>
                        {s.note && <p className="mt-1 text-slate-500 italic">“{s.note}”</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            dispatch({ type: "RESPOND_REQUEST", sessionId: s.id, accept: false });
                            toast("Request declined. They won't see a reason.", "info");
                          }}
                        >
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            dispatch({ type: "RESPOND_REQUEST", sessionId: s.id, accept: true });
                            toast(`Accepted! Pick a time with ${from.name.split(" ")[0]}.`);
                          }}
                        >
                          Accept
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Upcoming sessions"
              icon={<CalendarCheck className="size-4" />}
              action={
                <Link href="/sessions" className="text-sm font-medium text-sky-700 hover:underline">
                  All sessions
                </Link>
              }
            />
            {upcoming.length > 0 ? (
              <div className="p-2">
                {upcoming.slice(0, 4).map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CalendarCheck className="size-5" />}
                title="Nothing scheduled yet"
                body="Find a tutor or study partner and your sessions will show up here."
                action={<ButtonLink href="/match" size="sm">Find help</ButtonLink>}
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recommended for you"
              icon={<Sparkles className="size-4" />}
              description={need ? `Peer tutors for ${need.courseId} · ${need.topics.join(", ")}` : undefined}
              action={
                need && (
                  <Link
                    href={`/match?course=${encodeURIComponent(need.courseId)}&topic=${encodeURIComponent(need.topics[0] ?? "")}`}
                    className="text-sm font-medium text-sky-700 hover:underline"
                  >
                    See all
                  </Link>
                )
              }
            />
            {recs.length > 0 ? (
              <ul className="grid gap-3 p-5 sm:grid-cols-3">
                {recs.map((m) => (
                  <li key={m.student.id}>
                    <Link
                      href={`/students/${m.student.id}`}
                      className="flex h-full flex-col items-center rounded-2xl bg-mist-50 p-4 text-center ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-card"
                    >
                      <Avatar student={m.student} size={52} />
                      <p className="mt-2 font-medium text-slate-900">{m.student.name}</p>
                      <p className="text-xs text-slate-500">{m.student.major}</p>
                      <p className="mt-2 font-display text-2xl font-semibold text-sky-600">{m.score}%</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{m.reasons[1] ?? m.reasons[0]}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Search className="size-5" />}
                title="Tell us what you need help with"
                body="Add a course you're struggling in to see recommended peer tutors."
                action={<ButtonLink href="/onboarding" size="sm">Update profile</ButtonLink>}
              />
            )}
          </Card>

          <ActivityFeed />

          <Card>
            <CardHeader title="Badges" icon={<Trophy className="size-4" />} description="Earned by helping, connecting and showing up." />
            <div className="p-5">
              <BadgeGrid badges={badges} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="My Study Circles"
              icon={<CircleDot className="size-4" />}
              action={
                <Link href="/circles" className="text-sm font-medium text-sky-700 hover:underline">
                  Browse
                </Link>
              }
            />
            {myCircles.length > 0 ? (
              <ul className="space-y-1 p-2">
                {myCircles.map((c) => (
                  <li key={c.id}>
                    <Link href={`/circles/${c.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-mist-100">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-mist-200 text-sky-700">
                        <Users className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{c.name}</span>
                        <span className="block text-xs text-slate-500">{circleWhen(c)}</span>
                      </span>
                      <ArrowRight className="size-4 text-slate-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<CircleDot className="size-5" />} title="No circles yet" body="Join a small group that meets every week." />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent connections"
              icon={<Heart className="size-4" />}
              action={
                <Link href="/connections" className="text-sm font-medium text-sky-700 hover:underline">
                  All
                </Link>
              }
            />
            {connections.length > 0 ? (
              <ul className="space-y-1 p-2">
                {connections.slice(0, 4).map((c) => {
                  const other = studentById(state, c.userIds.find((id) => id !== me.id)!)!;
                  return (
                    <li key={c.id}>
                      <Link href={`/students/${other.id}`} className="flex items-center gap-3 rounded-xl p-3 hover:bg-mist-100">
                        <Avatar student={other} size={36} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900">{other.name}</span>
                          <span className="block text-xs text-slate-500">
                            {c.sessionIds.length} session{c.sessionIds.length === 1 ? "" : "s"} together
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<Heart className="size-5" />} title="No connections yet" body="After a session, you can both choose to stay connected." />
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <GraduationCap className="size-4 text-sky-600" /> My subjects
            </h2>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Need help with</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {me.needsHelp.flatMap((n) => n.topics.map((t) => <Tag key={n.courseId + t} tone="crimson">{n.courseId} · {t}</Tag>))}
              {me.needsHelp.length === 0 && <span className="text-sm text-slate-500">Nothing listed</span>}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Can tutor</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {me.canTutor.flatMap((t) => t.topics.map((x) => <Tag key={t.courseId + x} tone="sage">{t.courseId} · {x}</Tag>))}
              {me.canTutor.length === 0 && <span className="text-sm text-slate-500">Nothing listed yet</span>}
            </div>
            <Link href="/onboarding" className="mt-4 inline-block text-sm font-medium text-sky-700 hover:underline">
              Edit subjects
            </Link>
          </Card>

          {resources.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <BookOpen className="size-4 text-sky-600" /> Suggested OU resources
              </h2>
              <ul className="mt-3 space-y-3">
                {resources.map((r) => (
                  <li key={r.id} className="rounded-xl bg-mist-100 p-3">
                    <p className="text-sm font-medium text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.kind}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      <Link
                        href={`/resources?resource=${r.id}${need ? `&course=${encodeURIComponent(need.courseId)}` : ""}`}
                        className="font-medium text-sky-700 hover:underline"
                      >
                        Find someone to go with
                      </Link>
                      <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800">
                        Official site <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <History className="size-4 text-sky-600" /> Recent XP
            </h2>
            <ul className="mt-3 space-y-2.5">
              {recentXp.map((e) => (
                <li key={e.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-slate-600">{e.reason}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-sky-700">+{e.amount}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
