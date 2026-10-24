"use client";

// Data hooks that work in both modes: demo computes locally from seeded data,
// cloud asks the server (which can see private fields the browser must not).

import { useEffect, useMemo, useState } from "react";
import { sortSlots } from "./data/catalog";
import { intersect, matchStudents, type MatchResult, type StudentMatch } from "./matching";
import { useStore } from "./store";
import { studentById } from "./state";
import type { MatchRequest, SlotId, Student } from "./types";

interface Async<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export type MatchQuery = Omit<MatchRequest, "slots" | "kind"> & { kind: "tutor" | "partner"; useSchedule: boolean };

export function useStudentMatches(query: MatchQuery | null): Async<{ matches: StudentMatch[]; excluded: { reason: string }[] }> {
  const { state, me, mode } = useStore();
  const key = query ? JSON.stringify(query) : "";

  const local = useMemo<MatchResult | null>(() => {
    if (!query || mode !== "demo") return null;
    return matchStudents(me, state.students, { ...query, slots: query.useSchedule ? me.availability : [] });
  }, [query, mode, me, state.students]);

  const [remote, setRemote] = useState<Async<{ matches: StudentMatch[]; excluded: { reason: string }[] }>>({
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (mode !== "cloud" || !key) return;
    const ctrl = new AbortController();
    setRemote((r) => ({ ...r, loading: true, error: null })); // eslint-disable-line react-hooks/set-state-in-effect -- request lifecycle
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(res.status === 429 ? "You're searching very fast — wait a moment." : "Couldn't load matches.");
        setRemote({ data: await res.json(), loading: false, error: null });
      } catch (e) {
        if (!ctrl.signal.aborted) setRemote({ data: null, loading: false, error: (e as Error).message });
      }
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // Re-run when the user's own profile changes too (their schedule affects results).
  }, [mode, key, state.students.length, me.availability.length]);

  if (mode === "demo") return { data: local, loading: false, error: null };
  return remote;
}

export function useSharedSlots(other: Student | undefined): Async<SlotId[]> {
  const { me, mode } = useStore();
  const [remote, setRemote] = useState<Async<SlotId[]>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (mode !== "cloud" || !other || other.id === me.id) return;
    let live = true;
    fetch(`/api/overlap?user=${other.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => live && setRemote({ data: d.shared as SlotId[], loading: false, error: null }))
      .catch(() => live && setRemote({ data: [], loading: false, error: "Couldn't compare schedules." }));
    return () => {
      live = false;
    };
  }, [mode, other, me.id, me.availability]);
  if (!other) return { data: [], loading: false, error: null };
  if (mode === "demo") return { data: sortSlots(intersect(me.availability, other.availability)), loading: false, error: null };
  return remote;
}

export interface GoWithCandidate {
  student: Student;
  slots: SlotId[];
}

export function useGoWithCandidates(resourceId: string, courseId: string, refreshKey = 0): Async<GoWithCandidate[]> {
  const { state, me, mode } = useStore();
  const local = useMemo(() => {
    if (mode !== "demo") return null;
    return state.goWithInterests
      .filter((g) => g.resourceId === resourceId && g.courseId === courseId && g.studentId !== me.id)
      .map((g) => studentById(state, g.studentId))
      .filter((s): s is Student => !!s)
      .map((s) => ({ student: s, slots: sortSlots(intersect(me.availability, s.availability)) }))
      .filter((c) => c.slots.length > 0)
      .sort((a, b) => b.slots.length - a.slots.length || a.student.name.localeCompare(b.student.name));
  }, [mode, state, resourceId, courseId, me]);

  const [remote, setRemote] = useState<Async<GoWithCandidate[]>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (mode !== "cloud") return;
    let live = true;
    setRemote((r) => ({ ...r, loading: true })); // eslint-disable-line react-hooks/set-state-in-effect -- request lifecycle
    fetch(`/api/go-with?resource=${encodeURIComponent(resourceId)}&course=${encodeURIComponent(courseId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => live && setRemote({ data: d.candidates, loading: false, error: null }))
      .catch(() => live && setRemote({ data: [], loading: false, error: "Couldn't load classmates." }));
    return () => {
      live = false;
    };
  }, [mode, resourceId, courseId, refreshKey]);

  if (mode === "demo") return { data: local, loading: false, error: null };
  return remote;
}

export interface InboxItem {
  id: string;
  kind: "direct" | "circle";
  circle_id: string | null;
  title: string | null;
  other_id: string | null;
  other_name: string | null;
  other_color: string | null;
  other_avatar: string | null;
  last_body: string | null;
  last_sender: string | null;
  last_message_at: string;
  unread: number;
  other_read_at: string | null;
}

/** The signed-in user's conversations (cloud only). Refreshes when messages arrive. */
export function useInbox(): Async<InboxItem[]> & { refresh: () => void } {
  const { supabase, mode, unreadMessages } = useStore();
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<Async<InboxItem[]>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (mode !== "cloud" || !supabase) return;
    let live = true;
    supabase.rpc("my_conversations").then(({ data, error }) => {
      if (!live) return;
      setState(error ? { data: null, loading: false, error: "Couldn't load your messages." } : { data: data as InboxItem[], loading: false, error: null });
    });
    return () => {
      live = false;
    };
  }, [mode, supabase, tick, unreadMessages]);
  return { ...state, refresh: () => setTick((t) => t + 1) };
}
