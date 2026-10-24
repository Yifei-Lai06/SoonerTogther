"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessagesFrame } from "@/components/MessagesFrame";
import { useInbox } from "@/lib/hooks";
import { useStore } from "@/lib/store";

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Messages />
    </Suspense>
  );
}

/** /messages?with=<userId> jumps straight to your chat with that person, if one exists. */
function Messages() {
  const params = useSearchParams();
  const router = useRouter();
  const { mode } = useStore();
  const inbox = useInbox();
  const withUser = params.get("with");
  const circle = params.get("circle");

  useEffect(() => {
    if (circle) {
      const hit = inbox.data?.find((c) => c.kind === "circle" && c.circle_id === circle);
      if (hit) router.replace(`/messages/${hit.id}`);
      return;
    }
    if (!withUser) return;
    if (mode === "demo") return router.replace(`/messages/demo-${withUser}`);
    const hit = inbox.data?.find((c) => c.kind === "direct" && c.other_id === withUser);
    if (hit) router.replace(`/messages/${hit.id}`);
  }, [withUser, circle, mode, inbox.data, router]);

  return <MessagesFrame />;
}
