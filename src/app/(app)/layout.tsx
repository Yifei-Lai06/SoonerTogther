import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// The shell reads the current pathname (for nav highlighting). Under Cache
// Components that value only exists at request time on dynamic routes, so the
// shell streams in behind a lightweight placeholder.
//
// Pages here render from browser storage (demo persistence), so they intentionally
// wait for the client before showing content. Opt the group out of instant-
// navigation validation rather than flashing seed data before hydration.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-mist-100" aria-busy="true" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
