"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCheck,
  CircleDot,
  Flag,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Search,
  SendHorizontal,
  Users,
} from "lucide-react";
import { Avatar, Button, cx, Dialog, EmptyState, Field, inputClass, Skeleton } from "./ui";
import { IntroCard } from "./help";
import { DoodleHeart, DoodleSparkle } from "./doodles";
import { useStore } from "@/lib/store";
import { useInbox, type InboxItem } from "@/lib/hooks";
import { studentById } from "@/lib/state";
import type { Student } from "@/lib/types";

const PAGE = 40;
const MAX_LEN = 2000;

interface Msg {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  body: string;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Demo-mode inbox (local only) ───────────────────────────────────────────

interface DemoThread {
  id: string;
  title: string;
  kind: "direct" | "circle";
  other?: Student;
}

function useDemoThreads(): DemoThread[] {
  const { state } = useStore();
  return useMemo(() => {
    const direct = state.connections
      .filter((c) => c.userIds.includes(state.meId))
      .map((c) => studentById(state, c.userIds.find((u) => u !== state.meId)!))
      .filter((s): s is Student => !!s)
      .map((s) => ({ id: `demo-${s.id}`, title: s.name, kind: "direct" as const, other: s }));
    const circles = state.circles
      .filter((c) => c.memberIds.includes(state.meId))
      .map((c) => ({ id: `demo-circle-${c.id}`, title: c.name, kind: "circle" as const }));
    return [...direct, ...circles];
  }, [state]);
}

// ── Inbox ──────────────────────────────────────────────────────────────────

export function Inbox({ activeId }: { activeId?: string }) {
  const { mode } = useStore();
  const [query, setQuery] = useState("");
  const inbox = useInbox();
  const demo = useDemoThreads();

  const items =
    mode === "cloud"
      ? (inbox.data ?? []).map((c) => ({
          id: c.id,
          title: (c.kind === "circle" ? c.title : c.other_name) || "Classmate",
          kind: c.kind,
          preview: c.last_body,
          at: c.last_body ? c.last_message_at : null,
          unread: c.unread,
          avatar: c.kind === "direct" ? { name: c.other_name || "?", avatarColor: c.other_color || "#0284C7", avatarUrl: c.other_avatar } : null,
        }))
      : demo.map((t) => ({ id: t.id, title: t.title, kind: t.kind, preview: null, at: null, unread: 0, avatar: t.other ?? null }));

  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.title.toLowerCase().includes(q) || (i.preview ?? "").toLowerCase().includes(q)) : items;

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-5 sm:px-5">
        <h1 className="font-display text-2xl font-semibold text-slate-900">Messages</h1>
        <label className="relative mt-3 block">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className={cx(inputClass, "bg-slate-100 pl-9 ring-0")} />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-24 lg:pb-4">
        {mode === "cloud" && inbox.loading && !inbox.data ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : inbox.error ? (
          <p className="p-4 text-sm text-sky-700">{inbox.error}</p>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="size-5" />}
            title={q ? "No conversations match" : "No conversations yet"}
            body={q ? "Try another name." : "A private chat opens automatically when someone accepts your session request, or when you join a Study Circle."}
            action={!q ? <Link href="/match" className="text-sm font-medium text-sky-700 underline">Find a study partner</Link> : undefined}
          />
        ) : (
          <ul>
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  aria-current={activeId === c.id ? "page" : undefined}
                  className={cx("flex items-center gap-3 rounded-xl px-3 py-2.5 transition", activeId === c.id ? "bg-slate-100" : "hover:bg-slate-50")}
                >
                  {c.avatar ? (
                    <Avatar student={c.avatar} size={52} />
                  ) : (
                    <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-mist-200 text-sky-700">
                      <Users className="size-6" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-sm", c.unread ? "font-semibold text-slate-900" : "font-medium text-slate-800")}>{c.title}</span>
                    <span className={cx("block truncate text-sm", c.unread ? "font-medium text-slate-900" : "text-slate-500")}>
                      {c.preview ?? (c.kind === "circle" ? "Study Circle group chat" : "Say hi 👋")}
                      {c.at && <span className="text-slate-400"> · {timeLabel(c.at)}</span>}
                    </span>
                  </span>
                  {c.unread > 0 && <span className="size-2.5 shrink-0 rounded-full bg-sky-600" aria-label={`${c.unread} unread`} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Chat ───────────────────────────────────────────────────────────────────

export function ChatView({ conversationId }: { conversationId: string }) {
  const { mode } = useStore();
  return mode === "cloud" ? <CloudChat key={conversationId} conversationId={conversationId} /> : <DemoChat key={conversationId} conversationId={conversationId} />;
}

function ChatHeader({ title, subtitle, avatar, href, menu }: { title: string; subtitle?: string; avatar: React.ReactNode; href?: string; menu?: React.ReactNode }) {
  const inner = (
    <>
      {avatar}
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-900">{title}</span>
        {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2.5">
      <Link href="/messages" className="rounded-full p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Back to messages">
        <ArrowLeft className="size-5" />
      </Link>
      {href ? (
        <Link href={href} className="flex min-w-0 items-center gap-3 rounded-xl p-1 hover:bg-slate-50">{inner}</Link>
      ) : (
        <span className="flex min-w-0 items-center gap-3 p-1">{inner}</span>
      )}
      <div className="ml-auto">{menu}</div>
    </div>
  );
}

function Composer({ onSend, disabled }: { onSend: (body: string) => Promise<boolean>; disabled?: boolean }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const over = body.length > MAX_LEN;
  async function submit() {
    const text = body.trim();
    if (!text || over || sending) return;
    setSending(true);
    setBody("");
    const ok = await onSend(text);
    if (!ok) setBody(text);
    setSending(false);
    ref.current?.focus();
  }
  return (
    <form
      className="border-t border-slate-200/80 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-end gap-2 rounded-3xl bg-slate-100 py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-sky-600">
        <label htmlFor="composer" className="sr-only">Message</label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={body}
          disabled={disabled}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={disabled ? "You can't message this person" : "Message…"}
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!body.trim() || over || sending || disabled}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:bg-slate-300"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </div>
      {body.length > MAX_LEN - 200 && (
        <p className={cx("mt-1 px-2 text-right text-xs", over ? "text-sky-700" : "text-slate-400")}>{body.length}/{MAX_LEN}</p>
      )}
    </form>
  );
}

function Bubbles({ messages, meId, nameOf, showNames, otherReadAt }: { messages: Msg[]; meId: string; nameOf: (id: string | null) => Student | undefined; showNames: boolean; otherReadAt: string | null }) {
  const lastMine = [...messages].reverse().find((m) => m.sender_id === meId && !m.pending);
  return (
    <ol className="space-y-1.5 px-3 py-4 sm:px-5">
      {messages.map((m, i) => {
        const mine = m.sender_id === meId;
        const prev = messages[i - 1];
        const gap = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 15 * 60_000;
        const sender = nameOf(m.sender_id);
        const firstOfRun = !prev || prev.sender_id !== m.sender_id || gap;
        return (
          <li key={m.id}>
            {gap && <p className="py-3 text-center text-xs text-slate-400">{new Date(m.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>}
            <div className={cx("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
              {!mine && <span className="w-7 shrink-0">{firstOfRun && sender && <Avatar student={sender} size={28} />}</span>}
              <div className="max-w-[78%]">
                {!mine && showNames && firstOfRun && <p className="mb-0.5 ml-1 text-xs text-slate-500">{sender?.name ?? "Deleted user"}</p>}
                <p
                  title={new Date(m.created_at).toLocaleString()}
                  className={cx(
                    "whitespace-pre-wrap break-words rounded-3xl px-4 py-2 text-[15px] leading-snug",
                    mine ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-900",
                    m.pending && "opacity-60",
                    m.failed && "bg-sky-100 text-sky-900 ring-1 ring-sky-300",
                  )}
                >
                  {m.body}
                </p>
                {m.failed && <p className="mr-2 mt-0.5 text-right text-xs text-sky-700">Not sent</p>}
              </div>
            </div>
            {lastMine?.id === m.id && (
              <p className="mr-2 mt-0.5 flex items-center justify-end gap-1 text-[11px] text-slate-400">
                {otherReadAt && new Date(otherReadAt) >= new Date(m.created_at) ? (
                  <><CheckCheck className="size-3.5 text-sky-500" /> Seen</>
                ) : (
                  <><Check className="size-3.5" /> Sent</>
                )}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CloudChat({ conversationId }: { conversationId: string }) {
  const { supabase, state, me, toast, refreshInbox } = useStore();
  const inbox = useInbox();
  const info: InboxItem | undefined = inbox.data?.find((c) => c.id === conversationId);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const markRead = useCallback(async () => {
    if (!supabase || document.visibilityState !== "visible") return;
    await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
    void refreshInbox();
  }, [supabase, conversationId, refreshInbox]);

  useEffect(() => {
    if (info?.other_read_at) setOtherReadAt(info.other_read_at); // eslint-disable-line react-hooks/set-state-in-effect -- seeded from the inbox row
  }, [info?.other_read_at]);

  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(PAGE)
      .then(({ data, error }) => {
        if (!live) return;
        if (error) return setError("Couldn't load this conversation.");
        setMessages(((data ?? []) as Msg[]).reverse());
        setHasMore((data ?? []).length === PAGE);
        void markRead();
      });
    if (info?.other_id) {
      supabase.from("blocks").select("blocked_id").eq("blocked_id", info.other_id).then(({ data }) => live && setBlocked(!!data?.length));
    }

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (p) => {
        const m = p.new as Msg;
        setMessages((list) => (list ? [...list.filter((x) => x.id !== m.id && !(x.pending && x.body === m.body && m.sender_id === me.id)), m] : [m]));
        if (m.sender_id !== me.id) void markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversation_members", filter: `conversation_id=eq.${conversationId}` }, (p) => {
        const row = p.new as { user_id: string; last_read_at: string };
        if (row.user_id !== me.id) setOtherReadAt(row.last_read_at);
      })
      .subscribe();
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me.id, markRead, info?.other_id]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!supabase || !messages?.length) return;
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    stick.current = false;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((data ?? []) as Msg[]).reverse();
    setHasMore(older.length === PAGE);
    setMessages((list) => [...older, ...(list ?? [])]);
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  async function send(body: string): Promise<boolean> {
    if (!supabase) return false;
    stick.current = true;
    const temp: Msg = { id: `tmp-${Date.now()}`, conversation_id: conversationId, sender_id: me.id, body, created_at: new Date().toISOString(), pending: true };
    setMessages((list) => [...(list ?? []), temp]);
    const { data, error } = await supabase.rpc("send_message", { p_conversation: conversationId, p_body: body });
    if (error) {
      setMessages((list) => (list ?? []).map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      toast(error.message.includes("rate_limited") ? "You're sending messages very fast. Take a breath!" : error.message.includes("unavailable") ? "This person isn't accepting messages." : "Message not sent. Check your connection.", "error");
      return false;
    }
    setMessages((list) => (list ?? []).map((m) => (m.id === temp.id ? { ...m, id: data as string, pending: false } : m)));
    return true;
  }

  const nameOf = (id: string | null) => (id ? studentById(state, id) : undefined);
  const other = info?.other_id ? studentById(state, info.other_id) : undefined;
  const circle = info?.circle_id ? state.circles.find((c) => c.id === info.circle_id) : undefined;

  if (inbox.data && !info) {
    return (
      <EmptyState className="h-full justify-center" icon={<MessageCircle className="size-5" />} title="Conversation not found" body="You may not be a member of this chat anymore." action={<Link href="/messages" className="text-sm font-medium text-sky-700 underline">Back to messages</Link>} />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        title={info ? (info.kind === "circle" ? info.title ?? "Study Circle" : info.other_name ?? "Classmate") : "Loading…"}
        subtitle={info?.kind === "circle" ? `Group chat · ${circle?.memberIds.length ?? ""} members` : other ? `${other.year} · ${other.major}` : undefined}
        href={info?.kind === "circle" ? `/circles/${info.circle_id}` : info?.other_id ? `/students/${info.other_id}` : undefined}
        avatar={
          info?.kind === "circle" ? (
            <span className="flex size-10 items-center justify-center rounded-full bg-mist-200 text-sky-700"><CircleDot className="size-5" /></span>
          ) : info ? (
            <Avatar student={{ name: info.other_name ?? "?", avatarColor: info.other_color ?? "#0284C7", avatarUrl: info.other_avatar }} size={40} />
          ) : (
            <Skeleton className="size-10 rounded-full" />
          )
        }
        menu={
          info?.kind === "direct" && (
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Conversation options" className="rounded-full p-2 text-slate-600 hover:bg-slate-100">
                <MoreHorizontal className="size-5" />
              </button>
              {menu && (
                <div className="absolute right-0 top-full z-30 mt-1 w-52 animate-pop rounded-xl bg-white p-1 shadow-lift ring-1 ring-slate-200">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={async () => {
                      setMenu(false);
                      const { error } = await supabase!.rpc("block_user", { p_user: info.other_id, p_block: !blocked });
                      if (!error) {
                        setBlocked(!blocked);
                        toast(blocked ? "Unblocked." : "Blocked. They can't message you or send requests.", "info");
                      }
                    }}
                  >
                    <Ban className="size-4" /> {blocked ? "Unblock" : "Block"}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sky-700 hover:bg-sky-50" onClick={() => { setMenu(false); setReporting(true); }}>
                    <Flag className="size-4" /> Report
                  </button>
                </div>
              )}
            </div>
          )
        }
      />
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-white"
      >
        {hasMore && (
          <div className="pt-3 text-center">
            <Button variant="quiet" size="sm" onClick={loadOlder}>Load earlier messages</Button>
          </div>
        )}
        {error ? (
          <p className="p-6 text-center text-sm text-sky-700">{error}</p>
        ) : messages === null ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="ml-auto h-9 w-40" />
            <Skeleton className="h-9 w-56" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <span className="relative mb-3">
              <DoodleHeart size="lg" rotate={-10} className="text-orange-400" />
              <DoodleSparkle size="xs" rotate={12} className="absolute -right-3 -top-1 text-yellow-500" />
            </span>
            <p className="font-display text-lg font-bold text-slate-900">Start the conversation</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              {info?.kind === "circle" ? "Say hi to your circle and share what you're working on this week." : "Introduce yourself and agree on where to meet. Never share passwords or financial info."}
            </p>
          </div>
        ) : (
          <Bubbles messages={messages} meId={me.id} nameOf={nameOf} showNames={info?.kind === "circle"} otherReadAt={info?.kind === "direct" ? otherReadAt : null} />
        )}
      </div>
      <Composer onSend={send} disabled={blocked} />
      {info?.other_id && (
        <ReportDialog open={reporting} onClose={() => setReporting(false)} userId={info.other_id} conversationId={conversationId} name={info.other_name ?? "this person"} />
      )}
    </div>
  );
}

function ReportDialog({ open, onClose, userId, conversationId, name }: { open: boolean; onClose: () => void; userId: string; conversationId: string; name: string }) {
  const { supabase, toast } = useStore();
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onClose={onClose} title={`Report ${name}`} description="Reports go to the SoonerTogether team only. The other person isn't told who reported them.">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!reason.trim() || !supabase) return;
          const { error } = await supabase.rpc("report_user", { p_user: userId, p_conversation: conversationId, p_message: null, p_reason: reason });
          if (error) toast("Couldn't send the report. Try again.", "error");
          else {
            toast("Report sent. Thank you for keeping the community safe.", "info");
            setReason("");
            onClose();
          }
        }}
        className="space-y-4"
      >
        <Field label="What happened?" htmlFor="report-reason">
          <textarea id="report-reason" rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
        <p className="text-xs text-slate-500">If you feel unsafe, you can also block them from the same menu. In an emergency, contact local emergency services.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!reason.trim()}>Send report</Button>
        </div>
      </form>
    </Dialog>
  );
}

function DemoChat({ conversationId }: { conversationId: string }) {
  const { me, state } = useStore();
  const thread = useDemoThreads().find((t) => t.id === conversationId);
  const key = `st:demo-chat:${conversationId}`;
  const [messages, setMessages] = useState<Msg[]>([]);
  useEffect(() => {
    try {
      setMessages(JSON.parse(window.localStorage.getItem(key) ?? "[]")); // eslint-disable-line react-hooks/set-state-in-effect -- local demo history
    } catch {
      // ignore
    }
  }, [key]);
  if (!thread) {
    return <EmptyState className="h-full justify-center" icon={<MessageCircle className="size-5" />} title="Conversation not found" body="Pick a conversation from the list." />;
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        title={thread.title}
        subtitle={thread.kind === "circle" ? "Group chat (demo)" : "Demo chat"}
        href={thread.other ? `/students/${thread.other.id}` : undefined}
        avatar={thread.other ? <Avatar student={thread.other} size={40} /> : <span className="flex size-10 items-center justify-center rounded-full bg-mist-200 text-sky-700"><CircleDot className="size-5" /></span>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 pt-4">
          <IntroCard id="demo-chat" title="This is a demo chat">
            Messages stay in this browser and nobody replies. Sign in to message real students in real time.
          </IntroCard>
        </div>
        <Bubbles messages={messages} meId={me.id} nameOf={(id) => (id ? studentById(state, id) : undefined)} showNames={false} otherReadAt={null} />
      </div>
      <Composer
        onSend={async (body) => {
          const next = [...messages, { id: `d-${Date.now()}`, conversation_id: conversationId, sender_id: me.id, body, created_at: new Date().toISOString() }];
          setMessages(next);
          try {
            window.localStorage.setItem(key, JSON.stringify(next.slice(-100)));
          } catch {
            // ignore
          }
          return true;
        }}
      />
    </div>
  );
}
