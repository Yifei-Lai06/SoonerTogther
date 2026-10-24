"use client";

// Small design-system primitives shared by every page.

import Link from "next/link";
import { forwardRef, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { Student } from "@/lib/types";
import { useStore } from "@/lib/store";
import { DoodleSparkle, DoodleStar } from "./doodles";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "accent" | "secondary" | "ghost" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-sky-600 text-white shadow-sm hover:bg-sky-700 hover:-translate-y-px hover:shadow-md active:bg-sky-800 disabled:bg-sky-300",
  // Coral: the few actions that matter most (Find a Tutor, Become a Tutor, Request connection).
  accent:
    "bg-orange-500 text-white shadow-sm hover:bg-orange-600 hover:-translate-y-px hover:shadow-md active:bg-orange-700 disabled:bg-orange-300",
  secondary:
    "bg-white text-slate-800 ring-1 ring-slate-300/80 hover:ring-slate-400 hover:bg-mist-50 active:bg-mist-100 disabled:text-slate-400",
  ghost: "text-sky-700 hover:bg-sky-50 active:bg-sky-100 disabled:text-slate-400",
  quiet: "text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:text-slate-400",
  danger: "bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 select-none",
    "active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
    variants[variant],
    sizes[size],
    extra,
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
  as: Tag = "div",
  ...rest
}: { className?: string; children: React.ReactNode; as?: "div" | "section" | "article" | "li" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cx("rounded-2xl bg-white ring-1 ring-slate-200/70 shadow-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  icon,
  action,
  description,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
          {icon && <span className="text-sky-600">{icon}</span>}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "crimson" | "sage" | "cream" | "outline";
  className?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    crimson: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    sage: "bg-teal-100 text-teal-700",
    cream: "bg-orange-100 text-orange-800",
    outline: "ring-1 ring-slate-300 text-slate-600",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({
  student,
  size = 40,
  className,
  ring,
}: {
  student: Pick<Student, "name" | "avatarColor"> & { avatarUrl?: string | null };
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  if (student.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote profile photos from the sign-in provider
      <img
        src={student.avatarUrl}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        className={cx("shrink-0 rounded-full object-cover", ring && "ring-2 ring-white", className)}
        style={{ width: size, height: size, background: student.avatarColor }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        ring && "ring-2 ring-white",
        className,
      )}
      style={{ width: size, height: size, background: student.avatarColor, fontSize: Math.max(11, size * 0.38) }}
    >
      {initials(student.name)}
    </span>
  );
}

export function AvatarStack({ students, max = 4, size = 28 }: { students: Student[]; max?: number; size?: number }) {
  const shown = students.slice(0, max);
  const rest = students.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((s) => (
        <Avatar key={s.id} student={s} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-mist-200 text-xs font-semibold text-slate-600 ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

// ── Progress ─────────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  label,
  className,
  tone = "crimson",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "crimson" | "sage";
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-200/70", className)}
    >
      <div
        className={cx(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "crimson" ? "bg-sky-600" : "bg-teal-600",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "#0284C7" : score >= 60 ? "#0D9488" : "#94A3B8";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${score}% match`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-display text-lg font-semibold text-slate-900">{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">match</span>
      </div>
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="relative mb-4">
        <DoodleStar size="sm" rotate={-14} className="absolute -left-5 -top-2 text-yellow-500" />
        <DoodleSparkle size="xs" rotate={10} className="absolute -right-4 bottom-0 text-sky-400" />
        <div className="flex size-14 rotate-[-4deg] items-center justify-center rounded-2xl bg-orange-100 text-orange-600">{icon}</div>
      </div>
      <p className="font-display text-lg font-bold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-slate-200/60", className)} />;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sky-700">
            <DoodleSparkle size="xs" className="text-orange-500" /> {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-slate-600">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  optional,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-800">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-sky-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-sky-600";

export function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150 active:scale-95",
        selected
          ? "bg-sky-600 text-white shadow-sm"
          : "bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-sky-300 hover:text-sky-700",
        disabled && "opacity-40",
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  label: string;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-full rounded-xl bg-mist-200/70 p-1 sm:w-auto">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={cx(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-600 sm:flex-none",
              on ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon}
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cx(
        "m-auto max-h-none w-[calc(100%-2rem)] overflow-hidden rounded-2xl bg-white p-0 shadow-lift open:animate-pop",
        wide ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-xl font-semibold text-slate-900">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close dialog"
            >
              <X className="size-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Visually distinct wrapper for controls that simulate the other person in demo mode. */
export function DemoControl({ children, label = "Demo control" }: { children: React.ReactNode; label?: string }) {
  const { mode } = useStore();
  if (mode === "cloud") return null; // real people answer for themselves
  return (
    <div className="rounded-xl border border-dashed border-amber-400/80 bg-amber-50/70 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-800">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
