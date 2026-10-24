"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, ChevronDown, Heart, Quote } from "lucide-react";
import { Avatar, Button, Card, cx, ScoreRing, Tag } from "./ui";
import { DoodleCrown } from "./doodles";
import { MODES, slotShort } from "@/lib/data/catalog";
import { FACTOR_LABELS, type StudentMatch } from "@/lib/matching";
import type { MatchKind } from "@/lib/types";

export function FactorBreakdown({ factors }: { factors: StudentMatch["factors"] }) {
  return (
    <dl className="space-y-2.5">
      {factors.map((f) => (
        <div key={f.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-slate-600">{FACTOR_LABELS[f.key]}</dt>
            <dd className="tabular-nums text-slate-500">
              <span className="font-semibold text-slate-800">{f.points}</span> / {f.weight}
            </dd>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500" style={{ width: `${f.fraction * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{f.detail}</p>
        </div>
      ))}
    </dl>
  );
}

export function MatchCard({
  match,
  kind,
  courseId,
  rank,
  onRequest,
  connected,
}: {
  match: StudentMatch;
  kind: MatchKind;
  courseId: string;
  rank: number;
  onRequest: () => void;
  connected?: boolean;
}) {
  const [open, setOpen] = useState(rank === 0);
  const s = match.student;
  const teachTopics = kind === "tutor" ? (s.canTutor.find((t) => t.courseId === courseId)?.topics ?? []) : [];

  return (
    <Card as="article" className="lift relative animate-rise overflow-hidden" style={{ animationDelay: `${rank * 60}ms` }}>
      <div className="flex gap-4 p-5">
        <Link href={`/students/${s.id}`} className="shrink-0 rounded-full">
          <Avatar student={s} size={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/students/${s.id}`} className="font-semibold text-slate-900 hover:text-sky-700">
              {s.name}
            </Link>
            {rank === 0 && (
              <Tag tone="crimson">
                <DoodleCrown size={13} rotate={-10} className="text-yellow-500" /> Top match
              </Tag>
            )}
            {connected && (
              <Tag tone="sage">
                <Heart className="size-3" /> Connection
              </Tag>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {s.year} · {s.major}
            {s.ouVerified && <span className="ml-1.5 font-medium text-teal-700">· OU verified</span>}
          </p>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>
              <span className="font-medium text-slate-700">Learns by:</span> {s.modes.map((m) => MODES[m].label.replace(" Mode", "")).join(", ") || "—"}
            </span>
            {s.courses.length > 0 && (
              <span>
                <span className="font-medium text-slate-700">Taking:</span> {s.courses.slice(0, 3).join(", ")}
              </span>
            )}
          </p>
          {kind === "tutor" ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {teachTopics.map((t) => (
                <Tag key={t} tone={match.relevantTopics.includes(t) ? "crimson" : "neutral"}>
                  {t}
                </Tag>
              ))}
            </div>
          ) : (
            match.relevantTopics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {match.relevantTopics.map((t) => (
                  <Tag key={t} tone="crimson">
                    {t}
                  </Tag>
                ))}
              </div>
            )
          )}
        </div>
        <ScoreRing score={match.score} />
      </div>

      {match.experience && (
        <p className="mx-5 -mt-1 mb-4 flex gap-2 rounded-xl bg-mist-100 px-3 py-2.5 text-sm text-slate-700">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
          <span>
            {match.experience} <span className="text-xs text-slate-400">(self-described)</span>
          </span>
        </p>
      )}

      <div className="grid gap-3 px-5 pb-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2 text-slate-600">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <span>
            <span className="text-slate-500">Both free: </span>
            {match.sharedSlots.length > 0 ? match.sharedSlots.slice(0, 3).map(slotShort).join(", ") : "—"}
            {match.sharedSlots.length > 3 && ` +${match.sharedSlots.length - 3}`}
          </span>
        </div>
        <div className="flex items-start gap-2 text-slate-600">
          <Heart className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <span>
            <span className="text-slate-500">Shared interests: </span>
            {match.sharedInterests.length > 0 ? match.sharedInterests.join(", ") : "none listed"}
          </span>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-mist-50/60">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 hover:text-sky-700"
        >
          Why this match?
          <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="animate-rise px-5 pb-5">
            <FactorBreakdown factors={match.factors} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <p className="hidden text-xs text-slate-500 sm:block">{match.reasons[1] ?? match.reasons[0]}</p>
        <div className="ml-auto flex gap-2">
          <Link
            href={`/students/${s.id}`}
            className="inline-flex h-9 items-center rounded-xl px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Profile
          </Link>
          <Button onClick={onRequest} variant="accent" size="md" className="h-9">
            Request connection
          </Button>
        </div>
      </div>
    </Card>
  );
}
