"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, CircleDot, Flag, GraduationCap, Sparkles } from "lucide-react";
import { Avatar, Card, CardHeader, Skeleton } from "./ui";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Item {
  id: string;
  type: "joined_circle" | "badge" | "milestone" | "started_tutoring" | "created_circle";
  payload: Record<string, string>;
  created_at: string;
  actor: Pick<Student, "id" | "name" | "avatarColor"> & { avatarUrl?: string | null };
}

const BADGE_NAMES: Record<string, string> = {
  "first-helper": "First Helper",
  "peer-mentor": "Peer Mentor",
  "study-connector": "Study Connector",
  "community-builder": "Community Builder",
  "knowledge-sharer": "Knowledge Sharer",
};

function describe(i: Item): { text: React.ReactNode; icon: React.ReactNode } {
  const p = i.payload;
  switch (i.type) {
    case "joined_circle":
      return { icon: <CircleDot className="size-3.5" />, text: <>joined <Link className="font-medium hover:underline" href={`/circles/${p.circle}`}>{p.name}</Link></> };
    case "created_circle":
      return { icon: <CircleDot className="size-3.5" />, text: <>started a new circle, <Link className="font-medium hover:underline" href={`/circles/${p.circle}`}>{p.name}</Link></> };
    case "badge":
      return { icon: <Award className="size-3.5" />, text: <>earned the <span className="font-medium">{BADGE_NAMES[p.badge] ?? p.badge}</span> badge</> };
    case "milestone":
      return { icon: <Flag className="size-3.5" />, text: <>helped <span className="font-medium">{p.name}</span> hit a group milestone</> };
    case "started_tutoring":
      return { icon: <GraduationCap className="size-3.5" />, text: <>is now tutoring <span className="font-medium">{p.course}</span></> };
  }
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

/** Positive, public milestones only — never struggles or private sessions. */
export function ActivityFeed() {
  const { mode, supabase, state } = useStore();
  const [items, setItems] = useState<Item[] | null>(null);

  const demoItems = useMemo<Item[]>(() => {
    const base = Date.UTC(2026, 9, 20);
    const list: Item[] = [];
    state.circles.forEach((c, ci) =>
      c.memberIds.filter((id) => id !== state.meId).slice(0, 2).forEach((id, mi) => {
        const s = state.students.find((x) => x.id === id);
        if (s) list.push({ id: `${c.id}-${id}`, type: "joined_circle", payload: { circle: c.id, name: c.name }, created_at: new Date(base - (ci * 3 + mi) * 3_600_000).toISOString(), actor: s });
      }),
    );
    return list.slice(0, 6);
  }, [state]);

  useEffect(() => {
    if (mode !== "cloud" || !supabase) return;
    supabase
      .from("activity")
      .select("id, type, payload, created_at, actor:profiles(id, display_name, avatar_color, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) =>
        setItems(
          ((data ?? []) as unknown as (Omit<Item, "actor"> & { actor: { id: string; display_name: string; avatar_color: string; avatar_url: string | null } | null })[])
            .filter((r) => r.actor)
            .map((r) => ({ ...r, actor: { id: r.actor!.id, name: r.actor!.display_name || "A Sooner", avatarColor: r.actor!.avatar_color, avatarUrl: r.actor!.avatar_url } })),
        ),
      );
  }, [mode, supabase]);

  const list = mode === "cloud" ? items : demoItems;

  return (
    <Card>
      <CardHeader title="Around campus" icon={<Sparkles className="size-4" />} description="What the community is up to. You can hide your own activity in Settings." />
      {list === null ? (
        <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : list.length === 0 ? (
        <p className="px-5 pb-5 pt-2 text-sm text-slate-500">Quiet so far. Join a circle or start tutoring a subject and you&apos;ll be the first post!</p>
      ) : (
        <ul className="divide-y divide-slate-100 px-5 pb-2">
          {list.map((i) => {
            const d = describe(i);
            return (
              <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
                <Link href={`/students/${i.actor.id === state.meId ? "me" : i.actor.id}`} className="relative shrink-0 rounded-full">
                  <Avatar student={i.actor} size={36} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-sky-600 text-white ring-2 ring-white">{d.icon}</span>
                </Link>
                <p className="min-w-0 flex-1 text-slate-700">
                  <Link href={`/students/${i.actor.id === state.meId ? "me" : i.actor.id}`} className="font-semibold text-slate-900 hover:underline">{i.actor.name}</Link> {d.text}
                </p>
                <span className="shrink-0 text-xs text-slate-400">{ago(i.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
