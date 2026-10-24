"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, CircleDot, Compass, HandHeart, PartyPopper, Users } from "lucide-react";
import {
  CelebrationMarks,
  DoodleArrow,
  DoodleCrown,
  DoodleHeart,
  DoodleSmiley,
  DoodleSparkle,
  DoodleStar,
} from "./doodles";
import { cx } from "./ui";
import { useStore } from "@/lib/store";
import { introSeenInThisBrowser } from "@/lib/auth";

/** Open the tour from anywhere (Settings, the More menu): window.dispatchEvent(new Event(OPEN_TOUR)). */
export const OPEN_TOUR = "st:open-tour";

// Edit the introduction copy here — both the pre-login welcome page and the in-app replay use it.
export const INTRO_SCREENS = [
  {
    icon: Users,
    tint: "bg-sky-600",
    title: "Welcome to SoonerTogether!",
    body: "Find academic support and meaningful connections in one place.",
    doodles: [<DoodleSparkle key="a" size="md" rotate={-10} className="absolute -left-6 -top-3 text-yellow-500" />, <DoodleSmiley key="b" size="sm" rotate={12} className="absolute -right-5 bottom-0 text-sky-500" />],
  },
  {
    icon: Compass,
    tint: "bg-orange-500",
    title: "Find your study people",
    body: "Connect with tutors, study partners, and students who understand your challenges.",
    doodles: [<DoodleArrow key="a" size="lg" rotate={20} className="absolute -left-10 top-0 text-slate-400" />, <DoodleHeart key="b" size="sm" rotate={-12} className="absolute -right-5 -top-2 text-orange-400" />],
  },
  {
    icon: CircleDot,
    tint: "bg-teal-600",
    title: "Join a Study Circle",
    body: "Learn with a small group of students who meet regularly — with a group chat and weekly goals.",
    doodles: [<DoodleStar key="a" size="md" rotate={14} className="absolute -right-6 -top-4 text-yellow-500" />, <DoodleStar key="b" size="xs" rotate={-8} className="absolute -left-4 bottom-1 text-sky-400" />],
  },
  {
    icon: HandHeart,
    tint: "bg-lime-600",
    title: "Help others, earn XP",
    body: "Share what you know and get recognized for supporting your community. XP only counts verified sessions.",
    doodles: [<DoodleCrown key="a" size="lg" rotate={-12} animate="crown" className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-500" />],
  },
  {
    icon: PartyPopper,
    tint: "bg-slate-900",
    title: "You're ready!",
    body: "Start with Discover to find someone for a class you're working on — or join a Study Circle.",
    doodles: [<CelebrationMarks key="a" size="lg" rotate={-30} className="absolute -left-8 -top-5 text-orange-500" />, <CelebrationMarks key="b" size="lg" rotate={120} className="absolute -right-8 -top-5 text-sky-500" />],
  },
];

/**
 * The five-screen introduction card: progress, Back, Next, Skip, completion.
 * `onDone(skipped)` fires on the last screen's button or on Skip.
 */
export function IntroSteps({ onDone, finishLabel = "Start exploring", className }: { onDone: (skipped: boolean) => void; finishLabel?: string; className?: string }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [i]);
  const s = INTRO_SCREENS[i];
  const last = i === INTRO_SCREENS.length - 1;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone(true);
        if (e.key === "ArrowRight" && !last) setI(i + 1);
        if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
      }}
      className={cx("relative flex w-full flex-col overflow-hidden bg-white shadow-lift outline-none", className)}
    >
      <div className="paper flex items-center justify-between px-6 pt-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {i + 1} of {INTRO_SCREENS.length}
        </span>
        {!last && (
          <button type="button" onClick={() => onDone(true)} className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            Skip
          </button>
        )}
      </div>

      <div key={i} className="paper animate-slide-in px-8 pb-8 pt-10 text-center">
        <div className="relative mx-auto w-fit">
          {s.doodles}
          <span className={cx("flex size-24 items-center justify-center rounded-[1.75rem] text-white shadow-lift", s.tint)} style={{ transform: `rotate(${i % 2 ? 4 : -4}deg)` }}>
            <s.icon className="size-11" strokeWidth={1.8} />
          </span>
        </div>
        <h2 id="tour-title" className="mt-9 font-display text-[1.7rem] font-extrabold leading-tight text-slate-900">
          {s.title}
        </h2>
        <p id="tour-body" className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-slate-600">
          {s.body}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={() => setI(i - 1)}
          disabled={i === 0}
          aria-label="Back"
          className="flex size-11 items-center justify-center rounded-full text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:invisible"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex flex-1 justify-center gap-1.5" role="progressbar" aria-label="Intro progress" aria-valuemin={1} aria-valuemax={INTRO_SCREENS.length} aria-valuenow={i + 1}>
          {INTRO_SCREENS.map((_, n) => (
            <span key={n} className={cx("h-2 rounded-full transition-all", n === i ? "w-6 bg-sky-600" : n < i ? "w-2 bg-sky-300" : "w-2 bg-slate-200")} />
          ))}
        </div>
        {last ? (
          <button type="button" onClick={() => onDone(false)} className="flex h-11 items-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-orange-600">
            {finishLabel} <ArrowRight className="size-4" />
          </button>
        ) : (
          <button type="button" onClick={() => setI(i + 1)} className="flex h-11 items-center gap-2 rounded-full bg-sky-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-sky-700">
            Next <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** In-app overlay: auto-shows once for new users, and can be replayed from Settings or the menu. */
export function WelcomeTour() {
  const { ready, mode, state, me, dispatch } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current || me.introSeen || pathname === "/onboarding") return;
    if (mode === "cloud" && !state.onboarded) return;
    handled.current = true;
    if (introSeenInThisBrowser()) {
      // They already watched it before signing in: remember that on the account, don't repeat it.
      void dispatch({ type: "MARK_INTRO_SEEN" });
      return;
    }
    setOpen(true); // eslint-disable-line react-hooks/set-state-in-effect -- first-visit trigger
  }, [ready, mode, state.onboarded, me.introSeen, pathname, dispatch]);

  useEffect(() => {
    const replay = () => {
      setRound((r) => r + 1);
      setOpen(true);
    };
    window.addEventListener(OPEN_TOUR, replay);
    return () => window.removeEventListener(OPEN_TOUR, replay);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <IntroSteps
        key={round}
        className="max-h-dvh rounded-t-[2rem] pb-[env(safe-area-inset-bottom)] sm:max-w-md sm:rounded-[2rem]"
        onDone={() => {
          setOpen(false);
          if (!me.introSeen) void dispatch({ type: "MARK_INTRO_SEEN" });
        }}
      />
    </div>
  );
}
