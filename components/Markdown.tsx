import type { ReactNode } from "react";

// Display-only rendering of an AI reply's markdown: headings, paragraphs,
// (nested) bullet / numbered lists, GFM tables, fenced code, and inline
// bold / italic / code. Nothing else — no HTML passthrough, no links (a URL
// stays a URL in text), no images. Dependency-free on purpose.
//
// This is the READING view. Block splitting for transfer into the deliverable
// stays in lib/workbench/segment.ts; the two agree on the same markdown block
// boundaries (paragraphs, top-level list items, table rows) but this module
// never decides what is selectable.

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: ListItem[] }
  | { kind: "table"; headers: string[]; rows: string[][] }
  | { kind: "code"; text: string };

type ListItem = { text: string; children?: { ordered: boolean; items: ListItem[] } };

const RE_HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const RE_FENCE = /^\s*```/;
const isBlank = (l: string) => l.trim() === "";
const isPipeRow = (l: string) => l.includes("|") && l.trim() !== "";
const isSeparator = (l: string) => /^[\s|:-]+$/.test(l) && l.includes("-");

function splitCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function parseList(lines: string[], start: number): { block: Block; end: number } {
  // Collect consecutive list-item lines (a blank line ends the list; a wrapped
  // continuation line, indented and not a list item, joins the previous item).
  type Raw = { indent: number; ordered: boolean; text: string };
  const raws: Raw[] = [];
  let i = start;
  while (i < lines.length) {
    const m = RE_LIST_ITEM.exec(lines[i]);
    if (m) {
      raws.push({ indent: m[1].length, ordered: /\d/.test(m[2]), text: m[3] });
      i++;
      continue;
    }
    if (!isBlank(lines[i]) && raws.length > 0 && /^\s+/.test(lines[i])) {
      raws[raws.length - 1].text += " " + lines[i].trim();
      i++;
      continue;
    }
    break;
  }
  // Build a tree by indentation.
  function build(from: number, indent: number): { items: ListItem[]; ordered: boolean; next: number } {
    const items: ListItem[] = [];
    const ordered = raws[from]?.ordered ?? false;
    let k = from;
    while (k < raws.length && raws[k].indent >= indent) {
      if (raws[k].indent > indent && items.length > 0) {
        const sub = build(k, raws[k].indent);
        items[items.length - 1].children = { ordered: sub.ordered, items: sub.items };
        k = sub.next;
        continue;
      }
      items.push({ text: raws[k].text });
      k++;
    }
    return { items, ordered, next: k };
  }
  const tree = build(0, raws[0]?.indent ?? 0);
  return { block: { kind: "list", ordered: tree.ordered, items: tree.items }, end: i };
}

function parse(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }
    if (RE_FENCE.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !RE_FENCE.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence (or end of text)
      blocks.push({ kind: "code", text: buf.join("\n") });
      continue;
    }
    const h = RE_HEADING.exec(line);
    if (h) {
      blocks.push({ kind: "heading", level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (isPipeRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = splitCells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isPipeRow(lines[i]) && !isSeparator(lines[i])) {
        rows.push(splitCells(lines[i++]));
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    if (RE_LIST_ITEM.test(line)) {
      const { block, end } = parseList(lines, i);
      blocks.push(block);
      i = end;
      continue;
    }
    // Paragraph: consecutive non-blank lines that start nothing else. Line
    // breaks inside it are kept — replies use them for structure.
    const buf: string[] = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !RE_HEADING.test(lines[i]) &&
      !RE_LIST_ITEM.test(lines[i]) &&
      !RE_FENCE.test(lines[i]) &&
      !(isPipeRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i++]);
    }
    blocks.push({ kind: "paragraph", lines: buf });
  }
  return blocks;
}

// Inline: `code`, **bold**, __bold__, *italic*, _italic_. Left to right, one
// pass; unmatched markers stay literal.
const RE_INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|((?<!\w)\*[^*\n]+\*(?!\w))|((?<!\w)_[^_\n]+_(?!\w))/g;

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(RE_INLINE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    const key = `${keyBase}-${n++}`;
    if (m[1]) out.push(<code key={key} className="rounded-sm bg-raised px-1 font-mono text-[0.88em]">{tok.slice(1, -1)}</code>);
    else if (m[2] || m[3]) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Lines({ lines, keyBase }: { lines: string[]; keyBase: string }) {
  return (
    <>
      {lines.map((l, i) => (
        <span key={`${keyBase}-l${i}`}>
          {i > 0 && <br />}
          {inline(l, `${keyBase}-l${i}`)}
        </span>
      ))}
    </>
  );
}

function List({ ordered, items, keyBase }: { ordered: boolean; items: ListItem[]; keyBase: string }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`my-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"} space-y-1`}>
      {items.map((it, i) => (
        <li key={`${keyBase}-${i}`}>
          {inline(it.text, `${keyBase}-${i}`)}
          {it.children && (
            <List ordered={it.children.ordered} items={it.children.items} keyBase={`${keyBase}-${i}c`} />
          )}
        </li>
      ))}
    </Tag>
  );
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const blocks = parse(text);
  return (
    <div className={`space-y-2.5 ${className}`}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.kind) {
          case "heading":
            return (
              <p key={k} className="mt-3 text-[0.8rem] font-semibold uppercase tracking-[0.08em] text-ink-2 first:mt-0">
                {inline(b.text, k)}
              </p>
            );
          case "paragraph":
            return (
              <p key={k}>
                <Lines lines={b.lines} keyBase={k} />
              </p>
            );
          case "list":
            return <List key={k} ordered={b.ordered} items={b.items} keyBase={k} />;
          case "code":
            return (
              <pre key={k} className="overflow-x-auto rounded-sm bg-raised px-3 py-2 font-mono text-[0.85em] whitespace-pre-wrap">
                {b.text}
              </pre>
            );
          case "table":
            return (
              <div key={k} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-[0.92em]">
                  <thead>
                    <tr>
                      {b.headers.map((h, j) => (
                        <th key={`${k}-h${j}`} className="border-b border-hairline py-1 pr-3 align-top font-semibold text-ink-2">
                          {inline(h, `${k}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={`${k}-r${ri}`}>
                        {b.headers.map((_, j) => (
                          <td key={`${k}-r${ri}c${j}`} className="border-b border-hairline py-1 pr-3 align-top">
                            {inline(r[j] ?? "", `${k}-r${ri}c${j}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
