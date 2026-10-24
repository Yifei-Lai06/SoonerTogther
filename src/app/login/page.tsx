"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Field, inputClass } from "@/components/ui";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { CLOUD_ENABLED, safeNext } from "@/lib/supabase/config";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.9l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

function Login() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    const sb = getBrowserSupabase();
    if (!sb) return;
    setBusy("google");
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (!sb) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That doesn't look like an email address.");
      return;
    }
    setBusy("email");
    setError(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo() } });
    setBusy(null);
    if (error) setError(error.message.includes("rate") ? "Too many emails sent recently. Try Google, or wait a few minutes." : error.message);
    else setSent(true);
  }

  return (
    <div className="paper flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-rise">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl bg-white p-7 shadow-lift ring-1 ring-slate-200/70 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">Log in or sign up</h1>
          <p className="mt-2 text-slate-600">New here? Signing in creates your account. Then we&apos;ll set up your profile in four quick steps.</p>
          {params.get("signedOut") && (
            <p role="status" className="mt-4 rounded-xl bg-teal-50 p-3 text-sm text-teal-800 ring-1 ring-teal-100">You&apos;re signed out. See you soon!</p>
          )}
          {params.get("expired") && (
            <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">Your session expired. Please sign in again.</p>
          )}

          {!CLOUD_ENABLED ? (
            <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
              Cloud sign-in isn&apos;t configured on this server yet (see SETUP_GUIDE.md). You can still explore the
              full demo below.
            </p>
          ) : sent ? (
            <div className="mt-6 rounded-xl bg-teal-100 p-4 text-sm text-teal-700">
              <p className="font-medium">Check your inbox</p>
              <p className="mt-1">We sent a sign-in link to {email}. Open it on this device to finish signing in.</p>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <button
                type="button"
                onClick={google}
                disabled={!!busy}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-sm font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-mist-50 hover:ring-slate-400 active:scale-[0.99] disabled:opacity-60"
              >
                {busy === "google" ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </button>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> or use an email link <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={magicLink} className="space-y-3" noValidate>
                <Field label="Email" htmlFor="email">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                  />
                </Field>
                <Button type="submit" variant="secondary" className="w-full" disabled={!!busy}>
                  {busy === "email" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                  Email me a sign-in link
                </Button>
              </form>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-sky-50 p-3 text-sm text-sky-800 ring-1 ring-sky-100">
              {error}
            </p>
          )}

          <ul className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-xs text-slate-500">
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0 text-slate-400" />
              Any Google account works during the beta. OU students can verify an @ou.edu email later for a badge.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="size-4 shrink-0 text-slate-400" />
              Your email is never shown to other students.
            </li>
          </ul>
        </div>

        <a
          href="/demo"
          className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Sparkles className="size-4 text-sky-300" /> Explore Demo — try it with sample students, no account
          <ArrowRight className="size-4" />
        </a>
        <p className="mt-4 text-center text-sm">
          <a href={`/welcome?replay=1${params.get("next") ? `&next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-medium text-sky-700 underline underline-offset-4 hover:text-sky-800">
            Replay the introduction
          </a>
        </p>
        <p className="mt-6 text-center text-xs text-slate-500">
          A student-created project · not affiliated with the University of Oklahoma ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
