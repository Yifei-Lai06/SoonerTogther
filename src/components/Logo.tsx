import Link from "next/link";

/** Two overlapping circles: two people, one shared space. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0F172A" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#38BDF8" strokeWidth="2.4" />
      <circle cx="19.5" cy="16" r="6.5" fill="none" stroke="#F97316" strokeWidth="2.4" />
      <path d="M24.6 6.2l.7 1.6 1.7.2-1.3 1.1.4 1.7-1.5-.9-1.5.9.4-1.7-1.3-1.1 1.7-.2z" fill="#EAB308" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-lg" aria-label="SoonerTogether home">
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-slate-900">
        Sooner<span className="text-sky-600">Together</span>
      </span>
    </Link>
  );
}
