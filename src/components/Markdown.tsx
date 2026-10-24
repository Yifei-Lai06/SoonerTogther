// Tiny, safe Markdown renderer for AI replies: paragraphs, lists, headings,
// **bold**, *italic*, `code` and fenced code blocks. Builds React elements
// (never injects HTML), so model output can't run scripts.

import { Fragment } from "react";

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith("**")) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.9em]">{t.slice(1, -1)}</code>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, pi) => {
    if (pi % 2 === 1) {
      const code = part.replace(/^[a-zA-Z0-9+-]*\n/, "");
      blocks.push(
        <pre key={`c${pi}`} className="my-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[13px] leading-relaxed text-slate-100">
          <code>{code.replace(/\n$/, "")}</code>
        </pre>,
      );
      return;
    }
    const lines = part.split("\n");
    let list: { ordered: boolean; items: string[] } | null = null;
    let para: string[] = [];
    const flushPara = () => {
      if (para.length) blocks.push(<p key={`p${pi}-${blocks.length}`} className="my-1.5">{inline(para.join(" "), `p${pi}-${blocks.length}`)}</p>);
      para = [];
    };
    const flushList = () => {
      if (!list) return;
      const Tag = list.ordered ? "ol" : "ul";
      const k = `l${pi}-${blocks.length}`;
      blocks.push(
        <Tag key={k} className={list.ordered ? "my-1.5 list-decimal space-y-1 pl-5" : "my-1.5 list-disc space-y-1 pl-5"}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it, `${k}-${i}`)}</li>
          ))}
        </Tag>,
      );
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        flushPara();
        const ordered = !!numbered;
        if (list && list.ordered !== ordered) flushList();
        list ??= { ordered, items: [] };
        list.items.push((bullet ?? numbered)![1]);
      } else if (heading) {
        flushPara();
        flushList();
        blocks.push(<p key={`h${pi}-${blocks.length}`} className="mb-1 mt-3 font-semibold">{inline(heading[1], `h${pi}`)}</p>);
      } else if (!line.trim()) {
        flushPara();
        flushList();
      } else {
        flushList();
        para.push(line.trim());
      }
    }
    flushPara();
    flushList();
  });
  return <Fragment>{blocks}</Fragment>;
}
