"use client";

import Link from "next/link";
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpenCheck,
  HelpCircle,
  ListChecks,
  Loader2,
  MessagesSquare,
  NotebookPen,
  Plus,
  SendHorizontal,
  Users,
} from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { AiMark } from "@/components/AiMark";
import { DoodleArrow, DoodleStar } from "@/components/doodles";
import { Term } from "@/components/help";
import { Avatar, cx, Skeleton } from "@/components/ui";
import { useStore } from "@/lib/store";

interface Turn {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

interface AiChat {
  id: string;
  title: string;
  updated_at: string;
}

const QUICK = [
  { icon: BookOpenCheck, label: "Explain step by step", prompt: "Explain this step by step, starting from the basics: " },
  { icon: HelpCircle, label: "Give me a hint", prompt: "I'm stuck. Give me a hint (not the full answer) for: " },
  { icon: ListChecks, label: "Quiz me", prompt: "Write 3 practice questions (easy → harder) about: " },
  { icon: NotebookPen, label: "Summarize a concept", prompt: "Summarize the key ideas I need to remember about: " },
  { icon: Users, label: "Prep for a session", prompt: "Help me prepare questions to bring to my peer tutoring session on: " },
  { icon: MessagesSquare, label: "Discussion prompts", prompt: "Suggest 4 discussion prompts for a study group working on: " },
];

const ERRORS: Record<string, string> = {
  ai_not_configured: "The AI assistant isn't set up on this server yet. Everything else still works.",
  user_limit: "You've reached today's AI limit. It resets at midnight UTC — a great time to ask a classmate!",
  global_limit: "The AI assistant is very busy today and has paused for everyone. Try again tomorrow.",
  slow_down: "You're sending questions very quickly. Wait a few seconds and try again.",
  message_too_long: "That message is too long — keep it under 2,000 characters.",
  not_authenticated: "Please sign in again to use the AI assistant.",
  ai_unavailable: "The AI service didn't respond. Please try again in a moment.",
};

export default function AiPage() {
  return (
    <Suspense fallback={null}>
      <Assistant />
    </Suspense>
  );
}

function Assistant() {
  const params = useSearchParams();
  const { mode, supabase, me } = useStore();
  const [chats, setChats] = useState<AiChat[] | null>(mode === "cloud" ? null : []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(params.get("prompt") ?? "");
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const context = params.get("context");
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/ai").then((r) => r.json()).then((d) => setConfigured(!!d.configured)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (mode !== "cloud" || !supabase) return;
    supabase
      .from("ai_conversations")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setChats((data as AiChat[]) ?? []));
  }, [mode, supabase, activeId]);

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  async function openChat(id: string) {
    if (!supabase) return;
    setActiveId(id);
    setLoadingChat(true);
    const { data } = await supabase.from("ai_messages").select("role, content").eq("conversation_id", id).order("created_at").limit(100);
    setTurns((data as Turn[]) ?? []);
    setLoadingChat(false);
  }

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const history = turns.filter((t) => !t.error);
    setTurns([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: activeId, context, history: mode === "cloud" ? undefined : history.slice(-12) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(ERRORS[err.error as string] ?? "Something went wrong. Please try again.");
      }
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== activeId) setActiveId(newId);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTurns((t) => [...t.slice(0, -1), { role: "assistant", content: acc }]);
      }
      if (!acc.trim()) throw new Error(ERRORS.ai_unavailable);
    } catch (e) {
      setTurns((t) => [...t.slice(0, -1), { role: "assistant", content: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function newChat() {
    setActiveId(null);
    setTurns([]);
    inputRef.current?.focus();
  }

  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[260px_1fr]">
      {/* History */}
      <aside className="hidden min-h-0 flex-col border-r border-slate-200/80 lg:flex">
        <div className="p-4">
          <button type="button" onClick={newChat} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            <Plus className="size-4" /> New chat
          </button>
        </div>
        <p className="px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent</p>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {chats === null ? (
            <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : chats.length === 0 ? (
            <p className="px-3 text-sm text-slate-500">{mode === "cloud" ? "Your AI chats will appear here." : "Demo chats aren't saved."}</p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openChat(c.id)}
                className={cx("block w-full truncate rounded-lg px-3 py-2 text-left text-sm", activeId === c.id ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50")}
              >
                {c.title}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat */}
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3">
          <AiMark size={40} />
          <div className="min-w-0">
            <p className="flex items-center font-semibold text-slate-900">
              <Term id="ai">AI Study Assistant</Term>
            </p>
            <p className="text-xs text-slate-500">An AI, not a human tutor · can make mistakes — double-check important answers</p>
          </div>
          <button type="button" onClick={newChat} className="ml-auto rounded-full p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="New chat">
            <Plus className="size-5" />
          </button>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
          {configured === false && (
            <p className="m-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{ERRORS.ai_not_configured}</p>
          )}
          {loadingChat ? (
            <div className="space-y-3 p-6"><Skeleton className="h-10 w-2/3" /><Skeleton className="ml-auto h-10 w-1/2" /></div>
          ) : turns.length === 0 ? (
            <div className="mx-auto max-w-2xl px-4 py-8">
              <div className="relative text-center">
                <DoodleStar size="sm" rotate={-12} className="absolute left-[18%] top-0 text-yellow-500" />
                <DoodleArrow size="lg" rotate={150} className="absolute right-[14%] top-6 hidden text-slate-300 sm:block" />
                <span className="mx-auto block w-fit"><AiMark size={56} /></span>
                <h1 className="mt-3 font-display text-2xl font-semibold text-slate-900">What are you working on?</h1>
                <p className="mt-1 text-sm text-slate-500">
                  I&apos;ll explain, hint and quiz — you do the thinking. Bring what you learn to your study partner.
                </p>
                {context && <p className="mx-auto mt-3 w-fit rounded-full bg-mist-200 px-3 py-1 text-xs text-slate-700">Context: {context}</p>}
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {QUICK.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setInput(q.prompt);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-3 rounded-2xl p-3.5 text-left text-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:ring-slate-300"
                  >
                    <q.icon className="size-5 shrink-0 text-sky-600" />
                    <span className="font-medium text-slate-800">{q.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => ask("I don't understand Java arrays.")} className="mx-auto mt-5 block text-sm text-sky-700 underline">
                Try: “I don&apos;t understand Java arrays.”
              </button>
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-5 px-4 py-6">
              {turns.map((t, i) => (
                <li key={i} className={cx("flex gap-3", t.role === "user" && "justify-end")}>
                  {t.role === "assistant" && (
                    <span className="mt-0.5 flex flex-col items-center gap-1">
                      <AiMark size={32} />
                      <span className="rounded bg-slate-900 px-1 text-[9px] font-bold uppercase tracking-wider text-white">AI</span>
                    </span>
                  )}
                  <div
                    className={cx(
                      "max-w-[85%] text-[15px] leading-relaxed",
                      t.role === "user" ? "whitespace-pre-wrap rounded-3xl bg-slate-100 px-4 py-2.5 text-slate-900" : "text-slate-800",
                      t.error && "rounded-2xl bg-sky-50 px-4 py-3 text-sky-900 ring-1 ring-sky-100",
                    )}
                  >
                    {t.role === "assistant" && !t.error ? (
                      t.content ? <Markdown text={t.content} /> : <Loader2 className="size-5 animate-spin text-slate-400" aria-label="Thinking" />
                    ) : (
                      t.content
                    )}
                  </div>
                  {t.role === "user" && <Avatar student={me} size={32} className="mt-0.5" />}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="border-t border-slate-200/80 p-3"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl bg-slate-100 py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-sky-600">
            <label htmlFor="ai-input" className="sr-only">Ask the AI assistant</label>
            <textarea
              id="ai-input"
              ref={inputRef}
              rows={1}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              placeholder="Ask a question or paste what's confusing you…"
              disabled={configured === false}
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-slate-400"
            />
            <button type="submit" disabled={!input.trim() || busy || configured === false} aria-label="Send" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white hover:bg-sky-700 disabled:bg-slate-300">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-slate-400">
            The AI helps you learn — it won&apos;t do graded work for you. Prefer a person?{" "}
            <Link href="/match" className="underline">Find a study partner</Link>.
          </p>
        </form>
      </section>
    </div>
  );
}
