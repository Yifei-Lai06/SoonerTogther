"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Eye, Loader2, LogOut, Pencil, PlayCircle, RotateCcw, ShieldAlert, Trash2, UserCog } from "lucide-react";
import { Button, ButtonLink, Card, Dialog, Field, inputClass, PageHeader } from "@/components/ui";
import { Term } from "@/components/help";
import { OPEN_TOUR } from "@/components/WelcomeTour";
import { useStore } from "@/lib/store";

export default function SettingsPage() {
  const { mode, authEmail } = useStore();
  return (
    <div className="max-w-2xl">
      <PageHeader eyebrow="Settings" title="Your account" description={mode === "cloud" ? `Signed in as ${authEmail ?? "you"}. Only you can see this email.` : "You're exploring the demo. Nothing here is a real account."} />
      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-slate-900">Profile</p>
            <p className="text-sm text-slate-500">Name, classes, subjects, availability and interests.</p>
          </div>
          <ButtonLink href="/onboarding" variant="secondary"><Pencil className="size-4" /> Edit</ButtonLink>
        </Card>
        <ProfileVisibility />
        <Card className="flex items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold text-slate-900">How SoonerTogether works</p>
            <p className="text-sm text-slate-500">Replay the short welcome tour any time.</p>
          </div>
          <Button variant="secondary" onClick={() => window.dispatchEvent(new Event(OPEN_TOUR))}>
            <PlayCircle className="size-4" /> Replay intro
          </Button>
        </Card>
        {mode === "cloud" ? (
          <>
            <ActivityPrivacy />
            <OuVerification />
            <Card className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-900">Sign out</p>
                <p className="text-sm text-slate-500">You&apos;ll stay signed in on your other devices.</p>
              </div>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="secondary"><LogOut className="size-4" /> Sign out</Button>
              </form>
            </Card>
            <DeleteAccount />
          </>
        ) : (
          <DemoReset />
        )}
        <p className="pt-2 text-sm text-slate-500">
          Read how we handle your data on the <Link href="/privacy" className="underline">privacy page</Link>.
        </p>
      </div>
    </div>
  );
}

function ProfileVisibility() {
  const { me, dispatch, toast } = useStore();
  const v = me.visibility ?? { circles: true, xp: true, interests: true };
  const rows: [keyof typeof v, string, string][] = [
    ["xp", "XP level and achievements", "Your level, XP and badges."],
    ["circles", "Study Circles", "Which circles you belong to."],
    ["interests", "Interests and hobbies", "The interests you picked during setup."],
  ];
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <UserCog className="size-5 text-sky-600" /> What others see on your profile
      </p>
      <p className="mt-1 text-sm text-slate-500">Your name, major, year, classes and tutoring subjects are always visible so people can find you. Your email, schedule and what you need help with are never shown.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {rows.map(([key, label, hint]) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center gap-3 py-3">
              <span className="flex-1">
                <span className="block text-sm font-medium text-slate-900">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
              <input
                type="checkbox"
                className="size-5 accent-sky-600"
                checked={v[key]}
                onChange={async (e) => {
                  const r = await dispatch({ type: "SET_VISIBILITY", visibility: { ...v, [key]: e.target.checked } });
                  if (r.ok) toast(e.target.checked ? `${label} visible to others.` : `${label} hidden from others.`, "info");
                }}
              />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ActivityPrivacy() {
  const { supabase, me, toast } = useStore();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase?.from("profiles").select("show_activity").eq("id", me.id).single().then(({ data }) => setOn(data?.show_activity ?? true));
  }, [supabase, me.id]);
  return (
    <Card className="p-5">
      <label className="flex items-start gap-4">
        <Eye className="mt-0.5 size-5 shrink-0 text-sky-600" />
        <span className="flex-1">
          <span className="block font-semibold text-slate-900">Show my milestones in the community feed</span>
          <span className="block text-sm text-slate-500">Only positive public events: joining a circle, earning a badge, starting to tutor. Never what you need help with or your private sessions.</span>
        </span>
        <input
          type="checkbox"
          className="mt-1 size-5 accent-sky-600"
          disabled={on === null}
          checked={!!on}
          onChange={async (e) => {
            const next = e.target.checked;
            setOn(next);
            const { error } = await supabase!.from("profiles").update({ show_activity: next }).eq("id", me.id);
            if (error) {
              setOn(!next);
              toast("Couldn't save that setting.", "error");
            } else toast(next ? "Your milestones are visible." : "Your milestones are hidden.", "info");
          }}
        />
      </label>
    </Card>
  );
}

function OuVerification() {
  const { me, toast, reload } = useStore();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/ou").then((r) => r.json()).then((d) => setAvailable(!!d.available)).catch(() => setAvailable(false));
  }, []);

  async function call(body: object) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/ou", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) return true;
    const messages: Record<string, string> = {
      not_an_ou_email: "Use an address that ends in ou.edu.",
      wrong_code: "That code isn't right. Check the email and try again.",
      expired: "That code expired. Send a new one.",
      too_many_attempts: "Too many tries. Send a new code.",
      rate_limited: "Please wait a few minutes before sending another code.",
      email_send_failed: "We couldn't send the email. Try again later.",
    };
    setError(messages[data?.error] ?? "Something went wrong.");
    return false;
  }

  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-semibold text-slate-900">
        <BadgeCheck className="size-5 text-sky-600" /> <Term id="ouVerified">OU student badge</Term>
      </p>
      {me.ouVerified ? (
        <p className="mt-2 text-sm text-teal-700">You&apos;re verified as an OU student. ✓</p>
      ) : available === false ? (
        <p className="mt-2 text-sm text-slate-500">
          Optional. Sign in with a Google account that uses your @ou.edu address to be verified automatically. Email-code verification isn&apos;t enabled on this server yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-500">Optional. We&apos;ll email a 6-digit code to your @ou.edu address. Typing an address alone never grants the badge.</p>
          {!sent ? (
            <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await call({ action: "start", email })) setSent(true); }}>
              <label htmlFor="ou-email" className="sr-only">OU email</label>
              <input id="ou-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sooner@ou.edu" className={inputClass} />
              <Button type="submit" disabled={busy || !email}>{busy && <Loader2 className="size-4 animate-spin" />} Send code</Button>
            </form>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await call({ action: "verify", code })) {
                  toast("Verified! Your OU badge is live.");
                  await reload();
                }
              }}
            >
              <label htmlFor="ou-code" className="sr-only">Verification code</label>
              <input id="ou-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className={inputClass} />
              <Button type="submit" disabled={busy || code.length !== 6}>Verify</Button>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-sky-700">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card className="p-5 ring-sky-200">
      <p className="flex items-center gap-2 font-semibold text-sky-800"><ShieldAlert className="size-5" /> Delete account</p>
      <p className="mt-1 text-sm text-slate-600">Permanently removes your profile, sessions, circles, XP, AI chats and settings. Messages you sent will show as &ldquo;Deleted user&rdquo;. This can&apos;t be undone.</p>
      <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}><Trash2 className="size-4" /> Delete my account</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Delete your account?" description="Type DELETE to confirm.">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const res = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: typed }) }).catch(() => null);
            setBusy(false);
            if (res?.ok) {
              router.replace("/");
              router.refresh();
            }
            else setError("Couldn't delete the account. Try again, or contact the team.");
          }}
          className="space-y-4"
        >
          <Field label="Confirmation" htmlFor="confirm-delete" error={error}>
            <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Keep my account</Button>
            <Button type="submit" disabled={typed !== "DELETE" || busy}>{busy && <Loader2 className="size-4 animate-spin" />} Delete forever</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function DemoReset() {
  const { dispatch, toast } = useStore();
  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div>
        <p className="font-semibold text-slate-900">Reset the demo</p>
        <p className="text-sm text-slate-500">Restore all sample students, circles and sessions.</p>
      </div>
      <Button variant="secondary" onClick={() => { void dispatch({ type: "RESET" }); toast("Demo reset.", "info"); }}>
        <RotateCcw className="size-4" /> Reset
      </Button>
    </Card>
  );
}
