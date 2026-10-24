"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { IntroSteps } from "@/components/WelcomeTour";
import { markIntroSeenInThisBrowser } from "@/lib/auth";
import { safeNext } from "@/lib/supabase/config";

// First stop for signed-out visitors: the five-step introduction, then Log In / Sign Up.
// Returning visitors skip straight to Log In (the proxy checks the st_intro cookie);
// /welcome?replay=1 replays it from the Log In page.
export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  );
}

function Welcome() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "");

  return (
    <div className="paper flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="mb-6">
        <Logo />
      </div>
      <IntroSteps
        className="max-w-md rounded-[2rem] ring-1 ring-slate-200"
        finishLabel="Sign up or log in"
        onDone={() => {
          markIntroSeenInThisBrowser();
          router.replace(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
        }}
      />
      <a href="/demo" className="mt-6 text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900">
        Or explore the demo with sample students
      </a>
    </div>
  );
}
