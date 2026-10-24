"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { ChatView } from "@/components/messages";
import { MessagesFrame } from "@/components/MessagesFrame";

export default function ConversationPage() {
  return (
    <Suspense fallback={null}>
      <Conversation />
    </Suspense>
  );
}

function Conversation() {
  const { id } = useParams<{ id: string }>();
  return (
    <MessagesFrame activeId={id}>
      <ChatView conversationId={id} />
    </MessagesFrame>
  );
}
