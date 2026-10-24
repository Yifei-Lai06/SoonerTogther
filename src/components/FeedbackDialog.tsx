"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bug, Lightbulb, Loader2, MessageSquareHeart, Sparkles, Star } from "lucide-react";
import { Button, cx, Dialog, Field, inputClass } from "./ui";
import { useStore } from "@/lib/store";

const CATEGORIES = [
  { id: "general", label: "General", icon: MessageSquareHeart },
  { id: "feature", label: "A feature", icon: Sparkles },
  { id: "bug", label: "Bug", icon: Bug },
  { id: "suggestion", label: "Idea", icon: Lightbulb },
] as const;

export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Send feedback" description="This is a beta — tell us what's confusing, broken or great. Only the team can read it.">
      {open && <FeedbackForm onClose={onClose} />}
    </Dialog>
  );
}

function FeedbackForm({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { toast } = useStore();
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return setError("Write a sentence or two first.");
    setBusy(true);
    setError(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, category, message, page: pathname }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      toast("Thanks! Your feedback was sent.");
      onClose();
    } else if (res?.status === 503) {
      setError("Feedback storage isn't connected on this server yet. Please tell the team directly for now.");
    } else if (res?.status === 429) {
      setError("You've sent a lot of feedback recently — try again in a few minutes.");
    } else {
      setError("Couldn't send right now. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">How is SoonerTogether so far?</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className="rounded-lg p-1 transition hover:scale-110"
            >
              <Star className={cx("size-7", rating && n <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-800">What&apos;s it about?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={cx(
                "flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium ring-1 transition",
                category === c.id ? "bg-sky-50 text-sky-700 ring-sky-300" : "text-slate-600 ring-slate-200 hover:ring-slate-300",
              )}
            >
              <c.icon className="size-4" />
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Your feedback" htmlFor="fb-message" error={error}>
        <textarea
          id="fb-message"
          rows={4}
          maxLength={3000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClass}
          placeholder={category === "bug" ? "What did you do, what happened, and what did you expect?" : "What should we keep, fix or add?"}
        />
      </Field>
      <p className="text-xs text-slate-500">We save the page you were on and your browser type to help reproduce bugs. No screenshots are collected.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Send feedback
        </Button>
      </div>
    </form>
  );
}
