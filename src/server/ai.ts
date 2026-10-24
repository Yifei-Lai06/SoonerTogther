import "server-only";

// All DeepSeek calls live here (server only). The key is read from
// DEEPSEEK_API_KEY and never sent to the browser or written to logs.
// API: OpenAI-compatible chat completions — https://api-docs.deepseek.com

const BASE_URL = "https://api.deepseek.com/chat/completions";
export const AI_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";
export const MAX_INPUT = 2000;
export const MAX_OUTPUT_TOKENS = 900;
const TIMEOUT_MS = 60_000;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function aiConfigured(): boolean {
  if (process.env.AI_MOCK === "1") return true;
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  return !!key && key.length > 10;
}

export function systemPrompt(context: string | null): string {
  return [
    "You are the SoonerTogether AI Study Assistant. You are an AI, not a human tutor — say so if asked, and never pretend otherwise.",
    "You help college students (often at the University of Oklahoma) actually learn: explain concepts step by step, check understanding with a short question, and build on what the student already knows.",
    "Prefer hints and guiding questions over complete answers. If a request looks like graded homework or an exam question, don't just hand over the final answer: work a similar example, then guide the student through their own problem.",
    "You can generate practice questions, summarize concepts, help prepare for a peer tutoring session, and suggest discussion prompts for a study group.",
    "Keep replies focused: usually under 250 words, short paragraphs, simple Markdown (bold, bullet lists, fenced code blocks for code). Write math in plain text (x^2, sqrt(x), dy/dt).",
    "When it would help, encourage the student to work with a classmate, their Study Circle, or OU's official academic resources (such as the Math Center or Writing Center) — don't invent hours, rooms or services.",
    "You are not a counselor. If a student seems distressed, respond kindly and encourage them to reach out to people they trust and to campus support services.",
    context ? `Context from the app (may be empty or partial): ${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Streams the assistant's reply as plain text chunks. */
export async function streamChat(history: ChatTurn[], context: string | null): Promise<ReadableStream<string>> {
  if (process.env.AI_MOCK === "1") return mockStream(history[history.length - 1]?.content ?? "");

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.5,
      thinking: { type: "disabled" },
      messages: [{ role: "system", content: systemPrompt(context) }, ...history],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok || !res.body) {
    // Status only — never the request body.
    throw new Error(`deepseek_http_${res.status}`);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  return res.body.pipeThrough(
    new TransformStream<Uint8Array, string>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const data = t.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) controller.enqueue(delta);
          } catch {
            // ignore keep-alive or partial lines
          }
        }
      },
    }),
  );
}

/** Deterministic offline reply for tests and demos (AI_MOCK=1). */
function mockStream(question: string): ReadableStream<string> {
  const words = `(Practice mode — AI_MOCK is on.) Good question! Let's break "${question.slice(0, 80)}" into small steps. **Step 1:** what do you already know about it? Tell me, and I'll build from there.`.split(" ");
  let i = 0;
  return new ReadableStream<string>({
    async pull(controller) {
      if (i >= words.length) return controller.close();
      await new Promise((r) => setTimeout(r, 15));
      controller.enqueue((i ? " " : "") + words[i++]);
    },
  });
}
