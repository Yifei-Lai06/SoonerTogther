"use client";

import { CalendarCheck, CalendarClock, CheckCircle2, Hourglass, Inbox, XCircle } from "lucide-react";
import { SessionRow } from "@/components/cards";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { IntroCard } from "@/components/help";
import type { Session } from "@/lib/types";

export default function SessionsPage() {
  const { state } = useStore();
  const meId = state.meId;
  const by = (fn: (s: Session) => boolean) => state.sessions.filter(fn);

  const groups = [
    {
      id: "incoming",
      title: "Requests for your help",
      icon: <Inbox className="size-4" />,
      items: by((s) => s.status === "requested" && s.partnerId === meId),
      empty: "No one has asked yet. Add subjects you can tutor to show up in matches.",
    },
    {
      id: "pick",
      title: "Pick a time",
      icon: <CalendarClock className="size-4" />,
      items: by((s) => s.status === "accepted"),
    },
    {
      id: "upcoming",
      title: "Scheduled",
      icon: <CalendarCheck className="size-4" />,
      items: by((s) => s.status === "scheduled"),
    },
    {
      id: "waiting",
      title: "Waiting for a reply",
      icon: <Hourglass className="size-4" />,
      items: by((s) => s.status === "requested" && s.requesterId === meId),
    },
    {
      id: "past",
      title: "Completed",
      icon: <CheckCircle2 className="size-4" />,
      items: by((s) => s.status === "completed").sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    },
    {
      id: "closed",
      title: "Declined or cancelled",
      icon: <XCircle className="size-4" />,
      items: by((s) => s.status === "declined" || s.status === "cancelled"),
    },
  ];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div>
      <PageHeader
        eyebrow="My sessions"
        title="Sessions"
        description="Every request, from first ask to completed session. Times are weekly windows you both marked as free — there's no built-in video call or calendar sync."
        action={<ButtonLink href="/match">Request a session</ButtonLink>}
      />
      <IntroCard
        id="sessions"
        title="How a session works"
        steps={["Someone accepts your request (or you accept theirs).", "Pick a time you're both free and chat in Messages.", "Meet in person or online and use the shared workspace.", "Both confirm it happened — that's a verified session (+30 XP)."]}
      />
      {total === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck className="size-5" />}
            title="No sessions yet"
            body="Find a tutor or study partner to get started."
            action={<ButtonLink href="/match">Find help</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {groups
            .filter((g) => g.items.length > 0 || g.id === "incoming")
            .map((g) => (
              <Card key={g.id} id={g.id} as="section" className="scroll-mt-24">
                <CardHeader title={`${g.title}${g.items.length ? ` · ${g.items.length}` : ""}`} icon={g.icon} />
                {g.items.length > 0 ? (
                  <div className="p-2">
                    {g.items.map((s) => (
                      <SessionRow key={s.id} session={s} />
                    ))}
                  </div>
                ) : (
                  <p className="px-5 pb-5 pt-2 text-sm text-slate-500">{g.empty}</p>
                )}
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
