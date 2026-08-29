// Mechanical segmentation of a completed AI reply into selectable blocks (SPEC:
// docs/SPEC-workbench-transfer-redesign.md, T2). Splits only on the markdown
// block boundaries the reply already expresses — paragraphs, top-level list
// items (a nested list stays with its parent as one block), and table rows — and
// cleans formatting markers only. It never paraphrases, summarises, merges,
// reorders, dedupes, completes, or alters cell values. Headings become
// non-selectable context labels, never transferable blocks. Pure and DOM-free.
//
// The repo's debrief `plainText` cleaner is deliberately NOT reused: it collapses
// all whitespace and strips fenced code, which would destroy the meaningful line
// breaks a nested list block must keep.

export type Block = {
  id: string; // `${messageId}:${index}`
  kind: "text" | "tableRow";
  text: string; // mechanically cleaned readable text
  contextLabel?: string; // nearest preceding heading; shown, never auto-transferred
  source?: { headers: string[]; cells: string[] }; // tableRow only
};

// ---- line classifiers -----------------------------------------------------

const RE_BLANK = /^\s*$/;
const RE_HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_LIST_ITEM = /^(\s*)(?:[-*+]|\d+[.)])\s+/;

const isBlank = (l: string) => RE_BLANK.test(l);
const isHeading = (l: string) => RE_HEADING.test(l);
const isListItem = (l: string) => RE_LIST_ITEM.test(l);
const indentOf = (l: string) => (RE_LIST_ITEM.exec(l)?.[1].length ?? 0);
const isPipeRow = (l: string) => l.includes("|") && l.trim() !== "";
// A GFM separator row: only dashes, colons, pipes, and spaces, with a dash.
const isSeparator = (l: string) => /^[\s|:-]+$/.test(l) && l.includes("-");
const isTableStart = (lines: string[], i: number) =>
  isPipeRow(lines[i]) && i + 1 < lines.length && isSeparator(lines[i + 1]);

// ---- mechanical cleaning (formatting markers only) ------------------------

// Strip emphasis + inline-code markers. Deliberately does NOT trim, so callers
// that must preserve leading indentation (nested list blocks) can.
function stripMarkers(s: string): string {
  return s
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1");
}

const cleanInline = (s: string) => stripMarkers(s).trim();

// A paragraph's soft wraps are not meaningful line breaks — collapse them to a
// single flowing line.
function cleanParagraph(lines: string[]): string {
  return stripMarkers(lines.join(" ")).replace(/\s+/g, " ").trim();
}

// A list block keeps its structure: strip the leading marker from each line
// (preserving indentation so nesting stays visible), preserve meaningful line
// breaks between the parent and its nested lines.
function cleanListBlock(lines: string[]): string {
  return lines
    .map((l) => stripMarkers(l.replace(/^(\s*)(?:[-*+]|\d+[.)])\s+/, "$1")))
    .join("\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Split a pipe row into trimmed, cleaned cells, preserving empty positions.
function splitCells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((c) => cleanInline(c));
}

// Render a table row as readable text. With headers, `Owner: Priya · Task:
// [empty] · Due: Friday` — one shared form used both for a block's display text
// and for the transfer mapping (transfer.ts imports this). Empty cells are shown
// as `[empty]`; a value is never inferred. Without usable headers, cells join
// with ` — ` preserving empties.
export function labelledRowText(headers: string[], cells: string[]): string {
  const hasHeaders = headers.length === cells.length && headers.some((h) => h.trim() !== "");
  if (hasHeaders) {
    return cells.map((c, i) => `${headers[i]}: ${c.trim() === "" ? "[empty]" : c}`).join(" · ");
  }
  return cells.join(" — ");
}

// ---- parsers --------------------------------------------------------------

// A table: header row, separator row, then zero or more body rows — each body
// row becomes one tableRow block. The header row defines columns; it is not a
// transferable data row.
function parseTable(
  lines: string[],
  start: number,
): { rows: { text: string; source: { headers: string[]; cells: string[] } }[]; next: number } {
  const headers = splitCells(lines[start]);
  let i = start + 2; // skip header + separator
  const rows: { text: string; source: { headers: string[]; cells: string[] } }[] = [];
  while (i < lines.length && isPipeRow(lines[i]) && !isSeparator(lines[i]) && !isBlank(lines[i])) {
    const raw = splitCells(lines[i]);
    // Normalise to the header width, preserving every present cell and padding
    // missing positions with empties — nothing is dropped or invented.
    const cells =
      headers.length > 0
        ? Array.from({ length: headers.length }, (_, c) => raw[c] ?? "")
        : raw;
    rows.push({ text: labelledRowText(headers, cells), source: { headers, cells } });
    i++;
  }
  return { rows, next: i };
}

// A list: consecutive list items at a base indent. A more-indented item or a
// non-list continuation line stays with the current item as one multi-line
// block. A blank line, heading, or table ends the list group.
function parseList(lines: string[], start: number): { items: string[]; next: number } {
  const baseIndent = indentOf(lines[start]);
  const items: string[] = [];
  let current: string[] = [];
  let i = start;
  const flush = () => {
    if (current.length) {
      const text = cleanListBlock(current);
      if (text !== "") items.push(text);
      current = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line) || isHeading(line) || isTableStart(lines, i)) break;
    if (isListItem(line) && indentOf(line) <= baseIndent) {
      flush();
      current.push(line);
    } else {
      // deeper list item OR continuation line → part of the current item
      current.push(line);
    }
    i++;
  }
  flush();
  return { items, next: i };
}

// ---- the segmenter --------------------------------------------------------

export function segment(messageId: string, text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: Omit<Block, "id">[] = [];
  let context: string | undefined;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const t = cleanParagraph(para);
      if (t !== "") out.push({ kind: "text", text: t, contextLabel: context });
    }
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      flushPara();
      i++;
      continue;
    }
    if (isHeading(line)) {
      flushPara();
      context = cleanInline(RE_HEADING.exec(line)![2]) || undefined;
      i++;
      continue;
    }
    if (isTableStart(lines, i)) {
      flushPara();
      const { rows, next } = parseTable(lines, i);
      for (const r of rows)
        out.push({ kind: "tableRow", text: r.text, contextLabel: context, source: r.source });
      i = next;
      continue;
    }
    if (isListItem(line)) {
      flushPara();
      const { items, next } = parseList(lines, i);
      for (const it of items) out.push({ kind: "text", text: it, contextLabel: context });
      i = next;
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();

  // Ambiguous / unparseable / heading-only input → one honest block, so the
  // reply is never un-transferable when it plainly has content.
  if (out.length === 0 && text.trim() !== "") {
    out.push({ kind: "text", text: cleanParagraph(text.split("\n")) });
  }

  return out.map((b, index) => ({ ...b, id: `${messageId}:${index}` }));
}
