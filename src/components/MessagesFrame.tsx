"use client";

import { MessageCircle } from "lucide-react";
import { Inbox } from "./messages";
import { cx } from "./ui";

/** Two panes on desktop; one full-screen pane at a time on phones. */
export function MessagesFrame({ activeId, children }: { activeId?: string; children?: React.ReactNode }) {
  return (
    <div className="grid h-full min-h-0 lg:grid-cols-[360px_1fr]">
      <section aria-label="Conversations" className={cx("min-h-0 border-slate-200/80 lg:block lg:border-r", activeId ? "hidden" : "block")}>
        <Inbox activeId={activeId} />
      </section>
      <section aria-label="Chat" className={cx("min-h-0 lg:block", activeId ? "block" : "hidden")} data-chat={activeId ? "" : undefined}>
        {children ?? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <span className="flex size-16 items-center justify-center rounded-full ring-2 ring-slate-900">
              <MessageCircle className="size-8" />
            </span>
            <p className="mt-4 font-display text-xl font-semibold text-slate-900">Your messages</p>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Chats open when a session request is accepted, and every Study Circle has a group chat.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
