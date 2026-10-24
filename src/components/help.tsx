"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HelpCircle, Lightbulb, X } from "lucide-react";
import { GLOSSARY, type GlossaryKey } from "@/lib/data/glossary";
import { cx } from "./ui";

/** A term with a tap/hover/focus definition. Works with keyboard and touch. */
export function Term({ id, children, className }: { id: GlossaryKey; children?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const g = GLOSSARY[id];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={ref} className={cx("relative inline-flex items-center", className)}>
      {children ?? g.term}
      <button
        type="button"
        aria-label={`What is ${g.term}?`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex rounded-full text-slate-400 transition hover:text-sky-600 focus-visible:text-sky-600"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 animate-pop rounded-xl bg-slate-900 px-3 py-2.5 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-100 shadow-lift"
        >
          <span className="mb-0.5 block font-semibold text-white">{g.term}</span>
          {g.text}
        </span>
      )}
    </span>
  );
}

/** Short "how this works" card, dismissible once per browser. */
export function IntroCard({
  id,
  title,
  children,
  steps,
}: {
  id: string;
  title: string;
  children?: React.ReactNode;
  steps?: string[];
}) {
  const key = `st:intro:${id}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(key) === "1";
    } catch {
      // private mode: just show it
    }
    setHidden(dismissed); // eslint-disable-line react-hooks/set-state-in-effect -- reads browser storage after mount
  }, [key]);
  if (hidden) return null;
  return (
    <div className="mb-6 flex animate-rise gap-4 rounded-2xl bg-sky-50/70 p-4 ring-1 ring-sky-100 sm:p-5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 ring-1 ring-sky-100">
        <Lightbulb className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{title}</p>
        {children && <div className="mt-1">{children}</div>}
        {steps && (
          <ol className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(key, "1");
          } catch {
            // ignore
          }
          setHidden(true);
        }}
        className="self-start rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
        aria-label="Dismiss tip"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
