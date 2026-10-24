"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BadgeCheck, BookOpen, CalendarDays, MessageCircle, GraduationCap, Heart, HeartHandshake, Lock, MapPin, Pencil, SearchX, Sparkles } from "lucide-react";
import { BadgeGrid, FormatTag } from "@/components/cards";
import { MODE_ICONS, RequestDialog, type RequestDraft } from "@/components/RequestDialog";
import { Avatar, Button, ButtonLink, Card, EmptyState, Skeleton, Tag } from "@/components/ui";
import { courseById, MODES, slotShort, sortSlots } from "@/lib/data/catalog";
import { intersect } from "@/lib/matching";
import { useStore } from "@/lib/store";
import { connectionBetween, studentById, xpFor } from "@/lib/state";
import { computeBadges, levelInfo, tutoredSessions } from "@/lib/xp";
import { useSharedSlots } from "@/lib/hooks";
import { DoodleCrown } from "@/components/doodles";
import { Term } from "@/components/help";

export default function StudentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Profile />
    </Suspense>
  );
}

function Profile() {
  const { id } = useParams<{ id: string }>();
  const { state, me } = useStore();
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const student = studentById(state, id === "me" ? me.id : id);
  const sharedQ = useSharedSlots(student);

  if (!student) {
    return (
      <Card>
        <EmptyState icon={<SearchX className="size-5" />} title="Student not found" body="This profile doesn't exist in the demo." action={<ButtonLink href="/match">Find help</ButtonLink>} />
      </Card>
    );
  }

  const isMe = student.id === me.id;
  // Owners always see everything; others see what the owner chose to share.
  const show = isMe ? { circles: true, xp: true, interests: true } : (student.visibility ?? { circles: true, xp: true, interests: true });
  const connection = isMe ? undefined : connectionBetween(state, me.id, student.id);
  const shared = sharedQ.data ?? [];
  const sharedInterests = intersect(me.interests, student.interests);
  const xp = xpFor(state, student.id);
  const lvl = levelInfo(xp);
  const helped = tutoredSessions(state, student.id);
  const circles = state.circles.filter((c) => c.memberIds.includes(student.id));
  const myNeeds = new Set(me.needsHelp.map((n) => n.courseId));
  const bestSubject = student.canTutor.find((t) => myNeeds.has(t.courseId)) ?? student.canTutor[0];

  return (
    <div>
      <Card className="paper mb-6 overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar student={student} size={96} className="shadow-lift" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">{student.name}</h1>
              {connection && (
                <Tag tone="sage">
                  <HeartHandshake className="size-3" /> Study connection
                </Tag>
              )}
              {isMe && <Tag tone="crimson">You</Tag>}
              {student.ouVerified && (
                <Tag tone="cream">
                  <BadgeCheck className="size-3.5 text-sky-600" /> <Term id="ouVerified">OU verified</Term>
                </Tag>
              )}
            </div>
            <p className="mt-1 flex items-center gap-2 text-slate-600">
              <GraduationCap className="size-4 text-slate-400" /> {student.year} · {student.major}
            </p>
            <p className="mt-3 max-w-2xl text-slate-700">{student.bio}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {student.modes.map((m) => {
                const Icon = MODE_ICONS[m];
                return (
                  <Tag key={m} tone="cream">
                    <Icon className="size-3.5" /> {MODES[m].label}
                  </Tag>
                );
              })}
              <FormatTag format={student.format} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {isMe ? (
              <ButtonLink href="/onboarding" variant="secondary">
                <Pencil className="size-4" /> Edit profile
              </ButtonLink>
            ) : null}
            {!isMe && connection && (
              <ButtonLink href={`/messages?with=${student.id}`} variant="secondary">
                <MessageCircle className="size-4" /> Message
              </ButtonLink>
            )}
            {isMe ? null : bestSubject ? (
              <Button
                onClick={() =>
                  setDraft({
                    partner: student,
                    kind: "tutor",
                    courseId: bestSubject.courseId,
                    topics: intersect(me.needsHelp.find((n) => n.courseId === bestSubject.courseId)?.topics ?? [], bestSubject.topics),
                    mode: student.modes.includes(me.modes[0]) ? me.modes[0] : student.modes[0],
                  })
                }
              >
                Request a session
              </Button>
            ) : (
              <ButtonLink href={`/match?kind=partner&course=${encodeURIComponent(student.courses[0] ?? "")}`} variant="secondary">
                Find study partners
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Sparkles className="size-4 text-sky-600" /> Can help with
            </h2>
            {student.canTutor.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {student.canTutor.map((t) => (
                  <li key={t.courseId} className="rounded-2xl bg-mist-50 p-4 ring-1 ring-slate-200/70">
                    <p className="font-medium text-slate-900">
                      {t.courseId} <span className="font-normal text-slate-500">· {courseById(t.courseId)?.title}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.topics.map((x) => <Tag key={x} tone="crimson">{x}</Tag>)}
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      {t.experience} <span className="text-xs text-slate-400">(self-described, not verified)</span>
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {isMe ? "You haven't listed anything yet — everyone knows something worth sharing." : "Not tutoring yet — but always up for studying together."}
              </p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <BookOpen className="size-4 text-sky-600" /> {isMe ? "What I'm working on" : "Currently taking"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {student.courses.map((c) => <Tag key={c}>{c}</Tag>)}
            </div>
            {isMe ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Need help with</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {student.needsHelp.flatMap((n) => n.topics.map((t) => <Tag key={n.courseId + t} tone="crimson">{n.courseId} · {t}</Tag>))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Lock className="size-3.5" /> Only used for matching. Others see that you&apos;re looking for study
                  partners, never your specific weak spots.
                </p>
              </div>
            ) : (
              student.needsHelp.length > 0 && (
                <p className="mt-3 text-sm text-slate-600">
                  Looking for study partners in {student.needsHelp.map((n) => n.courseId).join(", ")}.
                </p>
              )
            )}
          </Card>

          {!isMe && show.xp && (student.badges?.length ?? 0) > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="relative flex items-center gap-2 font-semibold text-slate-900">
                <DoodleCrown size="sm" rotate={-12} animate="crown" className="text-yellow-500" /> Achievements
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {computeBadges(state, me.id)
                  .filter((b) => student.badges!.includes(b.id))
                  .map((b) => <Tag key={b.id} tone="crimson">{b.name}</Tag>)}
              </div>
            </Card>
          )}

          {isMe && (
            <Card className="p-5 sm:p-6">
              <h2 className="relative flex items-center gap-2 font-semibold text-slate-900">
                <DoodleCrown size="sm" rotate={-12} animate="crown" className="text-yellow-500" /> Achievements
              </h2>
              <div className="mt-4">
                <BadgeGrid badges={computeBadges(state, student.id)} />
              </div>
            </Card>
          )}

          {isMe && helped.length > 0 && (
            <Card className="p-5 sm:p-6">
              <h2 className="font-semibold text-slate-900">Tutoring contributions</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {helped.map((s) => {
                  const learner = studentById(state, s.requesterId === student.id ? s.partnerId : s.requesterId);
                  return (
                    <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                      <Link href={`/sessions/${s.id}`} className="text-slate-700 hover:text-sky-700">
                        Helped {learner?.name.split(" ")[0]} with {s.topics.join(", ")} ({s.courseId})
                      </Link>
                      {s.completedAt && (
                        <span className="text-slate-400">
                          {new Date(s.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          {show.xp && <Card className="p-5">
            <p className="text-sm text-slate-500">Level {lvl.level}</p>
            <p className="font-display text-2xl font-semibold text-slate-900">{lvl.title}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-mist-100 py-2.5">
                <dd className="font-display text-xl font-semibold tabular-nums">{xp}</dd>
                <dt className="text-xs text-slate-500">XP</dt>
              </div>
              <div className="rounded-xl bg-mist-100 py-2.5">
                <dd className="font-display text-xl font-semibold tabular-nums">{helped.length}</dd>
                <dt className="text-xs text-slate-500">Sessions taught</dt>
              </div>
            </dl>
          </Card>}

          <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <CalendarDays className="size-4 text-sky-600" /> {isMe ? "My availability" : "When you're both free"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(isMe ? sortSlots(student.availability) : shared).map((s) => <Tag key={s} tone="cream">{slotShort(s)}</Tag>)}
              {!isMe && shared.length === 0 && <span className="text-slate-500">No overlapping time windows.</span>}
            </div>
            {!isMe && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="size-3.5" /> Full schedules and contact info stay private.
              </p>
            )}
          </Card>

          {show.interests && <Card className="p-5 text-sm">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Heart className="size-4 text-sky-600" /> Interests
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {student.interests.map((i) => (
                <Tag key={i} tone={!isMe && sharedInterests.includes(i) ? "crimson" : "neutral"}>{i}</Tag>
              ))}
            </div>
            {!isMe && sharedInterests.length > 0 && <p className="mt-2 text-xs text-slate-500">Highlighted: you both like these.</p>}
          </Card>}

          {show.circles && circles.length > 0 && (
            <Card className="p-5 text-sm">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <MapPin className="size-4 text-sky-600" /> Study Circles
              </h2>
              <ul className="mt-3 space-y-1.5">
                {circles.map((c) => (
                  <li key={c.id}>
                    <Link href={`/circles/${c.id}`} className="text-slate-700 hover:text-sky-700">
                      {c.name} <span className="text-slate-400">· {c.courseId}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
      <RequestDialog draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}
