"use client";

// One store, two backends:
//  • demo  — the pure reducer from state.ts + localStorage (no account needed)
//  • cloud — Supabase: state is loaded under Row Level Security, actions run as
//            server-side RPCs, and Realtime pushes changes from other people.
// Pages only see `state` and `dispatch`, so they work the same in both modes.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { seedState, STATE_VERSION } from "./data/seed";
import { friendlyError, loadCloudState, runCloudAction } from "./cloud";
import { getBrowserSupabase } from "./supabase/browser";
import { me as selectMe, reducer, type Action } from "./state";
import { DEFAULT_APPEARANCE, type AppState, type Student } from "./types";
import { signOut } from "./auth";
import { totalXp } from "./xp";

const STORAGE_KEY = "soonertogether:demo:v1";

type Internal = Action | { type: "HYDRATE"; state: AppState };

function rootReducer(state: AppState, action: Internal): AppState {
  if (action.type === "HYDRATE") return action.state;
  return reducer(state, action);
}

export type BackendMode = "demo" | "cloud";

export interface Toast {
  id: number;
  message: string;
  tone: "success" | "info" | "xp" | "error";
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface DispatchResult {
  ok: boolean;
  id?: string;
  error?: string;
}

interface StoreValue {
  state: AppState;
  me: Student;
  ready: boolean;
  mode: BackendMode;
  authEmail: string | null;
  supabase: SupabaseClient | null;
  dispatch: (action: Action) => Promise<DispatchResult>;
  reload: () => Promise<void>;
  toast: (message: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  storageError: boolean;
  loadError: string | null;
  notifications: AppNotification[];
  markNotificationsRead: () => Promise<void>;
  unreadMessages: number;
  refreshInbox: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

function loadDemo(): AppState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as AppState;
  return parsed?.version === STATE_VERSION && Array.isArray(parsed.students) ? parsed : null;
}

const REALTIME_TABLES = ["match_requests", "study_sessions", "session_confirmations", "connections", "go_together"];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(rootReducer, undefined, seedState);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<BackendMode>("demo");
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const toastId = useRef(0);
  const stateRef = useRef(state);
  const sbRef = useRef<SupabaseClient | null>(null);
  const meIdRef = useRef<string | null>(null);
  const reloadTimer = useRef<number | null>(null);
  const workspaceTimers = useRef(new Map<string, number>());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const reload = useCallback(async () => {
    const sb = sbRef.current;
    const uid = meIdRef.current;
    if (!sb || !uid) return;
    try {
      rawDispatch({ type: "HYDRATE", state: await loadCloudState(sb, uid) });
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => void reload(), 400);
  }, [reload]);

  const loadNotifications = useCallback(async () => {
    const sb = sbRef.current;
    if (!sb) return;
    const { data } = await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
    setNotifications((data as AppNotification[]) ?? []);
  }, []);

  const refreshInbox = useCallback(async () => {
    const sb = sbRef.current;
    if (!sb) return;
    const { data } = await sb.rpc("my_conversations");
    setUnreadMessages(((data as { unread: number }[]) ?? []).reduce((s, c) => s + (c.unread ?? 0), 0));
  }, []);

  const markNotificationsRead = useCallback(async () => {
    const sb = sbRef.current;
    if (!sb) return;
    const unread = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!unread.length) return;
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread);
    setNotifications((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })));
  }, [notifications]);

  // Decide the backend once, after mount.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let authWatch: { unsubscribe: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const sb = getBrowserSupabase();
      const user = sb ? (await sb.auth.getUser()).data.user : null;
      if (cancelled) return;
      if (sb && user) {
        sbRef.current = sb;
        meIdRef.current = user.id;
        setMode("cloud");
        setSupabase(sb);
        setAuthEmail(user.email ?? null);
        await Promise.all([reload(), loadNotifications(), refreshInbox()]);
        channel = sb.channel(`app-${user.id}`);
        for (const table of REALTIME_TABLES) {
          channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleReload);
        }
        channel
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => {
            const n = p.new as AppNotification;
            setNotifications((list) => [n, ...list].slice(0, 30));
            toast(n.title, "info");
            scheduleReload();
          })
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => void refreshInbox())
          .subscribe();
        // Session ended elsewhere (expired refresh token, sign-out in another tab): leave right away.
        authWatch = sb.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") void signOut("expired");
        }).data.subscription;
      } else {
        try {
          const saved = loadDemo();
          if (saved) rawDispatch({ type: "HYDRATE", state: saved });
        } catch {
          setStorageError(true);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      if (channel) void sbRef.current?.removeChannel(channel);
      authWatch?.unsubscribe();
    };
  }, [reload, loadNotifications, refreshInbox, scheduleReload, toast]);

  // Back/forward cache: a private page restored after sign-out must not stay on screen.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const sb = getBrowserSupabase();
      if (!sb || document.cookie.split("; ").includes("st_demo=1")) return;
      void sb.auth.getSession().then(({ data }) => {
        if (!data.session) window.location.replace("/login");
      });
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Apply personal appearance to <html> (and cache it so the next load paints correctly).
  const appearance = selectMe(state)?.appearance ?? DEFAULT_APPEARANCE;
  useEffect(() => {
    if (!ready) return;
    const el = document.documentElement;
    el.dataset.accent = appearance.accent;
    el.dataset.motion = appearance.reduceMotion ? "reduce" : "full";
    el.dataset.doodles = appearance.showDoodles ? "on" : "off";
    try {
      localStorage.setItem("st:appearance", JSON.stringify(appearance));
    } catch {
      // storage unavailable: still applied for this visit
    }
  }, [ready, appearance]);

  // Persist the demo locally (cloud data lives in the database).
  useEffect(() => {
    if (!ready || mode !== "demo") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setStorageError(true); // eslint-disable-line react-hooks/set-state-in-effect -- surfaced once in the demo bar
    }
  }, [state, ready, mode]);

  // Celebrate new XP no matter which page, person or demo control caused it.
  const lastXp = useRef<{ count: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const mine = [...state.xp].filter((e) => e.userId === state.meId).sort((a, b) => a.at - b.at);
    if (lastXp.current && mine.length > lastXp.current.count) {
      for (const e of mine.slice(lastXp.current.count)) toast(`+${e.amount} XP · ${e.reason}`, "xp");
    }
    lastXp.current = { count: mine.length };
  }, [state.xp, state.meId, ready, toast]);

  const dispatch = useCallback(
    async (action: Action): Promise<DispatchResult> => {
      const sb = sbRef.current;
      const uid = meIdRef.current;
      if (!sb || !uid) {
        const before = stateRef.current.nextId;
        rawDispatch(action);
        const id =
          action.type === "REQUEST_SESSION" ? `s-${before}` : action.type === "CREATE_CIRCLE" ? `circle-${before}` : undefined;
        return { ok: true, id };
      }
      if (action.type === "UPDATE_WORKSPACE") {
        // Typing in shared notes: update instantly, save after a short pause.
        rawDispatch(action);
        const timers = workspaceTimers.current;
        const prev = timers.get(action.sessionId);
        if (prev) window.clearTimeout(prev);
        timers.set(
          action.sessionId,
          window.setTimeout(() => {
            const s = stateRef.current.sessions.find((x) => x.id === action.sessionId);
            if (!s) return;
            runCloudAction(sb, uid, {
              type: "UPDATE_WORKSPACE",
              sessionId: s.id,
              patch: { goals: s.goals, notes: s.notes, reflection: s.reflection, checklist: s.checklist },
            }).catch((e) => toast(friendlyError((e as Error).message), "error"));
          }, 700),
        );
        return { ok: true };
      }
      try {
        const id = await runCloudAction(sb, uid, action);
        await reload();
        return { ok: true, id };
      } catch (e) {
        const message = friendlyError((e as Error).message);
        toast(message, "error");
        return { ok: false, error: message };
      }
    },
    [reload, toast],
  );

  const value = useMemo<StoreValue>(
    () => ({
      state,
      me: selectMe(state) ?? seedState().students[0],
      ready,
      mode,
      authEmail,
      supabase,
      dispatch,
      reload,
      toast,
      toasts,
      dismissToast,
      storageError,
      loadError,
      notifications,
      markNotificationsRead,
      unreadMessages,
      refreshInbox,
    }),
    [state, ready, mode, authEmail, supabase, dispatch, reload, toast, toasts, dismissToast, storageError, loadError, notifications, markNotificationsRead, unreadMessages, refreshInbox],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useMyXp(): number {
  const { state } = useStore();
  return totalXp(state.xp, state.meId);
}
