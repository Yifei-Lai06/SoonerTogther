// SoonerTogether doodle library — small, hand-authored SVG marks (no image
// generation, no raster art). Every doodle:
//   • is decorative: aria-hidden, never focusable, never covers text or controls
//     (place it with absolute positioning in a padded corner, or inline beside text);
//   • inherits color from `currentColor`, so color it with a text-* class;
//   • uses the same stroke weight family (1.8 at 24px) and rounded joins;
//   • animates only when asked, and stops under prefers-reduced-motion.
//
// Sizes: xs 14 · sm 18 · md 24 · lg 34 · xl 48. Rotate a few degrees so they feel hand-placed.

import type { CSSProperties, ReactNode } from "react";

type Size = "xs" | "sm" | "md" | "lg" | "xl";
const SIZES: Record<Size, number> = { xs: 14, sm: 18, md: 24, lg: 34, xl: 48 };

export interface DoodleProps {
  size?: Size | number;
  /** Degrees. A small tilt (−15…15) looks hand-placed. */
  rotate?: number;
  animate?: "wiggle" | "twinkle" | "crown" | "none";
  className?: string;
  style?: CSSProperties;
}

function cn(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}

function Svg({ size = "md", rotate = 0, animate = "none", className, style, children, viewBox = "0 0 24 24" }: DoodleProps & { children: ReactNode; viewBox?: string }) {
  const px = typeof size === "number" ? size : SIZES[size];
  const anim = animate === "wiggle" ? "animate-wiggle" : animate === "twinkle" ? "animate-twinkle" : animate === "crown" ? "animate-crown" : "";
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={px}
      height={px}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("doodle pointer-events-none inline-block shrink-0 select-none", anim, className)}
      style={{ transform: `rotate(${rotate}deg)`, ["--r" as string]: `${rotate}deg`, ...style }}
    >
      {children}
    </svg>
  );
}

export function DoodleCrown(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="M3.2 17.2 4.6 7.4l4.7 4.9L12.1 4.6l2.6 7.8 4.6-4.6 1.4 9.4Z" fill="currentColor" fillOpacity={0.22} />
      <path d="M4 20.3c5.4-.6 10.9-.5 16.4.2" />
      <circle cx="12.1" cy="3.4" r=".6" fill="currentColor" />
    </Svg>
  );
}

export function DoodleStar(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="m12 2.9 2.5 6 6.4.6-5 4.1 1.7 6.5-5.7-3.7-5.4 3.8 1.5-6.5-5-4.2 6.5-.5Z" fill="currentColor" fillOpacity={0.18} />
    </Svg>
  );
}

export function DoodleHeart(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path
        d="M12 20.3C5.2 15.8 2.7 12.2 3.2 8.5 3.7 5.3 7.4 4 9.7 5.7c1 .8 1.8 1.9 2.3 2.9.6-1.1 1.4-2.2 2.7-2.9 2.5-1.4 6-.1 6.3 3.3.2 3.6-2.4 7-9 11.3Z"
        fill="currentColor"
        fillOpacity={0.2}
      />
    </Svg>
  );
}

export function DoodleArrow({ flip, ...p }: DoodleProps & { flip?: boolean }) {
  return (
    <Svg {...p} style={{ ...(flip ? { scale: "-1 1" } : null), ...p.style }}>
      <path d="M2.8 18.4c3.6-8.6 9.6-11.2 17.2-9.2" />
      <path d="m15.3 5.6 4.9 3.7-3.9 4.4" />
    </Svg>
  );
}

export function DoodleSparkle(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.4c.6 6 2.1 8.3 8.8 9.6-6.7 1.4-8.2 3.7-8.8 9.6-.6-5.9-2.1-8.2-8.9-9.6C9.9 10.7 11.4 8.4 12 2.4Z" fill="currentColor" fillOpacity={0.25} />
    </Svg>
  );
}

export function DoodleLightning(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="M13.8 2.3 5.2 13.4h6.1l-1.8 8.3 9.3-12.3h-6.2l1.2-7.1Z" fill="currentColor" fillOpacity={0.22} />
    </Svg>
  );
}

export function DoodleSmiley(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="M12.2 3.1c5.1-.2 8.9 3.6 8.7 8.8-.2 5-4 8.9-9 8.9-5 0-8.8-3.9-8.7-9 .1-4.9 4-8.5 9-8.7Z" />
      <path d="M8.6 9.4v1.1M15.2 9.2v1.1" />
      <path d="M7.9 14.2c2.2 2.6 5.8 2.7 8.2.1" />
    </Svg>
  );
}

/** Three short "pop" marks, e.g. beside a success message. */
export function CelebrationMarks(p: DoodleProps) {
  return (
    <Svg {...p}>
      <path d="M5 9.5 2.6 7.3M8.8 6.1 8.2 2.9M12.9 7.1l2.2-2.4" />
      <path d="M6.4 21.2c.9-4.6 3.5-8.2 8.3-9.7" strokeOpacity={0.35} />
    </Svg>
  );
}

/**
 * Hand-drawn underline. Put it inside a `relative` inline element:
 *   <span className="relative inline-block">Belong<ScribbleUnderline className="text-orange-500" /></span>
 */
export function ScribbleUnderline({ className, animate = true }: { className?: string; animate?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 200 18"
      preserveAspectRatio="none"
      className={cn("doodle pointer-events-none absolute -bottom-[0.18em] left-[-2%] h-[0.32em] w-[104%]", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      <path
        d="M3 11.5C46 5.2 112 3.4 197 6.4M14 15.5c48-4.4 101-5.4 170-3"
        strokeWidth={4.5}
        pathLength={1}
        strokeDasharray="1"
        className={animate ? "animate-draw" : undefined}
      />
    </svg>
  );
}

/** Loose circle drawn around a word or number. Put it inside a `relative` element. */
export function SketchyCircle({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 62"
      preserveAspectRatio="none"
      className={cn("doodle pointer-events-none absolute -inset-x-[14%] -inset-y-[28%] h-[156%] w-[128%]", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
    >
      <path d="M52 5c27-1 44 13 43 28-1 16-24 25-48 24C21 56 4 46 5 31 6 15 27 5 60 7" pathLength={1} strokeDasharray="1" className="animate-draw" />
    </svg>
  );
}

/** Washi-tape strip for "taped on" cards. Place absolutely at a card's top edge. */
export function PaperTape({ className, rotate = -4, color = "bg-orange-100/90" }: { className?: string; rotate?: number; color?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("doodle pointer-events-none absolute block h-5 w-16 rounded-[2px] shadow-sm", color, className)}
      style={{
        transform: `rotate(${rotate}deg)`,
        maskImage: "linear-gradient(90deg, transparent 0 2px, #000 2px calc(100% - 2px), transparent calc(100% - 2px))",
      }}
    />
  );
}

/** Sticker-style label (real text, so it IS read by screen readers). */
export function StickerLabel({ children, className, rotate = -3 }: { children: ReactNode; className?: string; rotate?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border-2 border-slate-900 bg-white px-2 py-0.5 font-hand text-base font-bold leading-tight text-slate-900 shadow-[var(--shadow-sticker)]",
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}

/** A handwritten note, e.g. "you've got this!" next to a heading. */
export function HandNote({ children, className, rotate = -4 }: { children: ReactNode; className?: string; rotate?: number }) {
  return (
    <span className={cn("doodle inline-block font-hand text-xl leading-none text-sky-700", className)} style={{ transform: `rotate(${rotate}deg)` }}>
      {children}
    </span>
  );
}
