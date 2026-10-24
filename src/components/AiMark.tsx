// The AI assistant's mark: an abstract geometric symbol, never a face or a human avatar,
// so AI chats can't be mistaken for conversations with real students.
export function AiMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <rect width="40" height="40" rx="12" fill="#0F172A" />
      <path d="M20 8.5c.7 6.3 2.4 8.8 9.6 10.4-7.2 1.6-8.9 4.1-9.6 10.6-.7-6.5-2.4-9-9.7-10.6 7.3-1.6 9-4.1 9.7-10.4Z" fill="#38BDF8" />
      <circle cx="30" cy="10.5" r="2.2" fill="#F97316" />
      <circle cx="10.5" cy="30" r="1.6" fill="#84CC16" />
    </svg>
  );
}
