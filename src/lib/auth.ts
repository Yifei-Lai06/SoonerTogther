"use client";

// Client-side session helpers shared by every sign-out button and the session watcher.

import { getBrowserSupabase } from "./supabase/browser";

/** Set after a visitor finishes or skips the welcome introduction (per browser). */
export const INTRO_COOKIE = "st_intro";

export function introSeenInThisBrowser(): boolean {
  return typeof document !== "undefined" && document.cookie.split("; ").includes(`${INTRO_COOKIE}=1`);
}

export function markIntroSeenInThisBrowser() {
  document.cookie = `${INTRO_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

/** Remove anything in this browser that belongs to the signed-in person. */
export function clearUserCache() {
  try {
    sessionStorage.clear();
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("st:appearance") || key.startsWith("sb-")) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable (private mode) — nothing cached
  }
}

let signingOut = false;

/**
 * Ends the Supabase session everywhere it lives (browser storage + server cookies),
 * clears cached user data, and REPLACES the current page with Log In so the
 * Back button can't return to a private page.
 */
export async function signOut(reason: "signed_out" | "expired" = "signed_out") {
  if (signingOut) return;
  signingOut = true;
  try {
    await getBrowserSupabase()?.auth.signOut();
  } catch {
    // network trouble: still clear the local session below
  }
  await fetch("/auth/signout", { method: "POST", redirect: "manual", credentials: "same-origin" }).catch(() => undefined);
  clearUserCache();
  window.location.replace(`/login?${reason === "expired" ? "expired=1" : "signedOut=1"}`);
}
