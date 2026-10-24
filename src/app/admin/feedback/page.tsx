import { Suspense } from "react";
import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getVerifiedUser } from "@/lib/supabase/server";

export const metadata = { title: "Beta feedback" };

// Protected: only emails listed in ADMIN_EMAILS (comma-separated, server env) can view.
export default function AdminFeedbackPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-slate-900">Beta feedback</h1>
      <Suspense fallback={<p className="mt-6 text-slate-500">Loading…</p>}>
        <FeedbackTable />
      </Suspense>
    </div>
  );
}

async function FeedbackTable() {
  const auth = await getVerifiedUser();
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!auth || !auth.user.email || !admins.includes(auth.user.email.toLowerCase())) {
    return <p className="mt-6 text-slate-600">You don&apos;t have access to this page. <Link href="/dashboard" className="underline">Go home</Link></p>;
  }
  const admin = getAdminSupabase();
  if (!admin) return <p className="mt-6 text-slate-600">SUPABASE_SECRET_KEY isn&apos;t configured.</p>;
  const [{ data: feedback }, { data: reports }] = await Promise.all([
    admin.from("feedback").select("*").order("created_at", { ascending: false }).limit(300),
    admin.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const rows = feedback ?? [];
  const rated = rows.filter((r) => r.rating);
  const avg = rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : "—";

  return (
    <>
      <p className="mt-2 text-slate-600">{rows.length} responses · average rating {avg} / 5</p>
      <div className="mt-6 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="p-3">When</th><th className="p-3">Type</th><th className="p-3">Rating</th><th className="p-3">Message</th><th className="p-3">Page</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap p-3 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3">{r.category}</td>
                <td className="p-3">{r.rating ?? "—"}</td>
                <td className="whitespace-pre-wrap p-3 text-slate-800">{r.message}</td>
                <td className="p-3 text-slate-500">{r.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 text-xl font-semibold text-slate-900">Reports ({reports?.length ?? 0})</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {(reports ?? []).map((r) => (
          <li key={r.id} className="rounded-xl bg-slate-50 p-3">
            <span className="text-slate-500">{new Date(r.created_at).toLocaleString()} · reported user {r.reported_id ?? "deleted"}</span>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{r.reason}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
