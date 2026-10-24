"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  CalendarClock,
  Check,
  HandHeart,
  Lock,
  MapPin,
  Network,
  Repeat,
  Sprout,
  Target,
  Users,
} from "lucide-react";
import { Avatar, AvatarStack, Button, Card, cx, ProgressBar, Tag } from "./ui";
import { DAYS, MODES, slotLabel } from "@/lib/data/catalog";
import { useStore } from "@/lib/store";
import { formatLabel, otherId, studentById } from "@/lib/state";
import type { Circle, Session, Student } from "@/lib/types";
import type { BadgeId, BadgeStatus } from "@/lib/xp";
import { MODE_ICONS } from "./RequestDialog";
import { DoodleStar, StickerLabel } from "./doodles";

export function circleWhen(c: Circle): string {
  const day = DAYS.find((d) => d.id === c.day)?.long ?? c.day;
  return `${day}s at ${c.time}`;
}

export function CircleCard({ circle, reasons, featured }: { circle: Circle; reasons?: string[]; featured?: boolean }) {
  const { state, dispatch, toast } = useStore();
  const members = circle.memberIds.map((id) => studentById(state, id)).filter((s): s is Student => !!s);
  const isMember = circle.memberIds.includes(state.meId);
  const full = circle.memberIds.length >= circle.capacity;
  const seatsLeft = circle.capacity - circle.memberIds.length;

  return (
    <Card as="article" className={cx("lift relative flex animate-rise flex-col", featured && "ring-2 ring-yellow-300")}>
      {featured && (
        <>
          <DoodleStar size="md" rotate={-14} animate="twinkle" className="absolute -left-2.5 -top-3 z-10 text-yellow-500" />
          <StickerLabel rotate={4} className="absolute -top-3 right-4 z-10 text-sm">popular this week</StickerLabel>
        </>
      )}
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Tag tone="cream">{circle.courseId}</Tag>
            <Link
              href={`/circles/${circle.id}`}
              className="mt-2 block font-display text-lg font-semibold leading-snug text-slate-900 hover:text-sky-700"
            >
              {circle.name}
            </Link>
          </div>
          {isMember && (
            <Tag tone="sage">
              <Check className="size-3" /> Member
            </Tag>
          )}
        </div>

        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <Repeat className="size-4 text-slate-400" /> {circleWhen(circle)}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 text-slate-400" /> {circle.location}
          </li>
          <li className="flex items-start gap-2">
            <Target className="mt-0.5 size-4 shrink-0 text-slate-400" /> <span>{circle.weeklyObjective}</span>
          </li>
        </ul>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {circle.focus.map((f) => (
            <Tag key={f}>{f}</Tag>
          ))}
        </div>

        {reasons && reasons.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">{reasons.slice(1, 3).join(" · ")}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-mist-100 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <AvatarStack students={members} />
          <span className="text-sm tabular-nums text-slate-600">
            {circle.memberIds.length}/{circle.capacity}
          </span>
        </div>
        {isMember ? (
          <Link
            href={`/circles/${circle.id}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline"
          >
            Open <ArrowRight className="size-3.5" />
          </Link>
        ) : (
          <Button
            size="sm"
            disabled={full}
            onClick={() => {
              dispatch({ type: "JOIN_CIRCLE", circleId: circle.id, userId: state.meId });
              toast(`You joined ${circle.name}! Say hi in its group chat — see you ${circleWhen(circle)}.`);
            }}
          >
            {full ? "Full" : `Join · ${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}
          </Button>
        )}
      </div>
    </Card>
  );
}

const STATUS: Record<Session["status"], { label: string; tone: "neutral" | "crimson" | "sage" | "cream" | "outline" }> = {
  requested: { label: "Requested", tone: "cream" },
  accepted: { label: "Pick a time", tone: "crimson" },
  scheduled: { label: "Scheduled", tone: "crimson" },
  completed: { label: "Completed", tone: "sage" },
  declined: { label: "Declined", tone: "outline" },
  cancelled: { label: "Cancelled", tone: "outline" },
};

export function SessionStatusTag({ session, meId }: { session: Session; meId: string }) {
  const incoming = session.status === "requested" && session.partnerId === meId;
  const s = incoming ? { label: "Needs your reply", tone: "crimson" as const } : STATUS[session.status];
  return <Tag tone={s.tone}>{s.label}</Tag>;
}

export function SessionRow({ session }: { session: Session }) {
  const { state } = useStore();
  const other = studentById(state, otherId(session, state.meId));
  if (!other) return null;
  const Icon = MODE_ICONS[session.mode];
  const role =
    session.tutorId === state.meId
      ? "You're the tutor"
      : session.tutorId
        ? `${other.name.split(" ")[0]} is your tutor`
        : "Study partners";
  return (
    <Link
      href={`/sessions/${session.id}`}
      className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-mist-100"
    >
      <Avatar student={other} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {other.name} <span className="font-normal text-slate-500">· {session.courseId}</span>
        </p>
        <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
          <Icon className="size-3.5 shrink-0" />
          {MODES[session.mode].label} · {role}
          {session.slot && (
            <>
              {" · "}
              <CalendarClock className="size-3.5 shrink-0" />
              {slotLabel(session.slot)}
            </>
          )}
        </p>
      </div>
      <SessionStatusTag session={session} meId={state.meId} />
      <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-600" />
    </Link>
  );
}

const BADGE_ICONS: Record<BadgeId, React.ComponentType<{ className?: string }>> = {
  "first-helper": HandHeart,
  "peer-mentor": Award,
  "study-connector": Network,
  "community-builder": Users,
  "knowledge-sharer": Sprout,
};

export function BadgeGrid({ badges, compact }: { badges: BadgeStatus[]; compact?: boolean }) {
  return (
    <ul className={cx("grid gap-3", compact ? "grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
      {badges.map((b) => {
        const Icon = BADGE_ICONS[b.id];
        return (
          <li key={b.id} className={cx("flex flex-col items-center text-center", !compact && "rounded-2xl bg-mist-50 p-4 ring-1 ring-slate-200/70")}>
            <div
              className={cx(
                "relative flex items-center justify-center rounded-full",
                compact ? "size-11" : "size-14",
                b.earned ? "bg-sky-600 text-white shadow-md shadow-sky-900/20" : "bg-slate-100 text-slate-400",
              )}
              title={`${b.name}: ${b.description}`}
            >
              <Icon className={compact ? "size-5" : "size-6"} />
              {!b.earned && (
                <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
                  <Lock className="size-3 text-slate-400" />
                </span>
              )}
            </div>
            <p className={cx("mt-2 font-medium leading-tight", compact ? "text-[11px]" : "text-sm", b.earned ? "text-slate-900" : "text-slate-500")}>
              {b.name}
            </p>
            {!compact && (
              <>
                <p className="mt-1 text-xs text-slate-500">{b.description}</p>
                {!b.earned && (
                  <div className="mt-2 w-full">
                    <ProgressBar value={b.progress / b.target} label={`${b.name} progress`} className="h-1.5" />
                    <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                      {b.progress}/{b.target}
                    </p>
                  </div>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FormatTag({ format }: { format: Student["format"] }) {
  return <Tag tone="outline">{formatLabel(format)}</Tag>;
}
