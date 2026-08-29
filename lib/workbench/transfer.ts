// Editable deliverable model + pure transfer logic for the Workbench.
//
// This is the T1 foundation of the transfer redesign (see
// docs/SPEC-workbench-transfer-redesign.md): the data model the deliverable
// column edits, the single emptiness rule that governs both the Finish gate and
// submission, lossless draft migration, and the transform back to the exact
// `/api/submit` shape. Block→section mapping, atomic commit, and shallow Undo
// build on this in later tickets. Deliberately React- and DOM-free so it can be
// exercised by `scripts/verify-workbench-transfer.ts` without a component
// harness.

import type { DeliverableField } from "@/lib/missions/types";
import type { Block } from "@/lib/workbench/segment";

// ---- editable model -------------------------------------------------------

// Every item and row carries a stable id minted on creation (manual add or
// transfer). Ids are stable through edits and reordering — never the array
// index, never a content hash — so Undo can reverse a commit by exact id even
// after the user has reordered or edited around it.
export type EditableListItem = { id: string; text: string };
export type EditableTableRow = { id: string; cells: Record<string, string> };
export type EditableDeliverable = {
  lists: Record<string, EditableListItem[]>;
  tables: Record<string, EditableTableRow[]>;
};

// The persisted draft envelope carries this version. Legacy `v:1` drafts hold a
// bare deliverable (plain strings / plain row objects, no ids); `v:2` holds the
// editable model above. `migrateDeliverable` reads either losslessly.
export const DRAFT_VERSION = 2 as const;

// The one place an id is created. crypto.randomUUID is the intended source; the
// fallback keeps a non-secure browser context or an ancient runtime from
// throwing mid-restore (a lost draft is worse than a non-crypto id here).
export function mintId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the Math.random path */
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function newListItem(text = ""): EditableListItem {
  return { id: mintId(), text };
}

// A row always carries a cell for every column of its section (empty string for
// unfilled), so the editor and the emptiness rule never hit an undefined cell.
// `cells` overlays initial values; unknown keys are ignored.
export function newTableRow(
  columnIds: string[],
  cells: Record<string, string> = {},
): EditableTableRow {
  const filled: Record<string, string> = {};
  for (const id of columnIds) filled[id] = cells[id] ?? "";
  return { id: mintId(), cells: filled };
}

export function emptyDeliverable(fields: DeliverableField[]): EditableDeliverable {
  const lists: Record<string, EditableListItem[]> = {};
  const tables: Record<string, EditableTableRow[]> = {};
  for (const f of fields) {
    if (f.kind === "list") lists[f.id] = [];
    else tables[f.id] = [];
  }
  return { lists, tables };
}

// ---- the single emptiness / meaningful-content rule -----------------------
//
// The sole authority for both the Finish gate and submit-sanitisation, so the
// two can never diverge (SPEC R6). An item is empty when its text is blank; a
// row is empty only when *every* cell is blank — a partially filled row counts
// as real content and is kept.

export const isEmptyItem = (i: EditableListItem): boolean => i.text.trim() === "";

export const isEmptyRow = (r: EditableTableRow): boolean =>
  Object.values(r.cells).every((c) => c.trim() === "");

export function hasMeaningfulContent(d: EditableDeliverable): boolean {
  for (const items of Object.values(d.lists)) {
    if (items.some((i) => !isEmptyItem(i))) return true;
  }
  for (const rows of Object.values(d.tables)) {
    if (rows.some((r) => !isEmptyRow(r))) return true;
  }
  return false;
}

// ---- draft migration (v1 → v2, lossless) ----------------------------------
//
// Reads a stored deliverable of either version against the mission's current
// fields and returns the editable model. Legacy bare entries get ids assigned;
// entries that already carry an id are preserved as-is. Field-aware so a draft
// saved before a mission-config change self-heals (a dropped field is ignored,
// a new field starts empty) instead of desyncing the model from the UI.

type RawLike = {
  lists?: Record<string, unknown>;
  tables?: Record<string, unknown>;
};

function toListItem(entry: unknown): EditableListItem | null {
  if (typeof entry === "string") return newListItem(entry);
  if (entry && typeof entry === "object") {
    const e = entry as { id?: unknown; text?: unknown };
    if (typeof e.text === "string") {
      return { id: typeof e.id === "string" && e.id ? e.id : mintId(), text: e.text };
    }
  }
  return null; // unrecognisable — drop rather than crash the restore
}

function toTableRow(entry: unknown, columnIds: string[]): EditableTableRow | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as { id?: unknown; cells?: unknown };
  // v2 shape: { id, cells }
  if (e.cells && typeof e.cells === "object") {
    return newTableRowFrom(
      typeof e.id === "string" && e.id ? e.id : mintId(),
      columnIds,
      e.cells as Record<string, unknown>,
    );
  }
  // v1 shape: a bare Record<string,string> row
  return newTableRowFrom(mintId(), columnIds, entry as Record<string, unknown>);
}

function newTableRowFrom(
  id: string,
  columnIds: string[],
  cells: Record<string, unknown>,
): EditableTableRow {
  const filled: Record<string, string> = {};
  for (const col of columnIds) {
    const v = cells[col];
    filled[col] = typeof v === "string" ? v : "";
  }
  return { id, cells: filled };
}

export function migrateDeliverable(
  raw: unknown,
  fields: DeliverableField[],
): EditableDeliverable {
  const src = (raw && typeof raw === "object" ? raw : {}) as RawLike;
  const srcLists = (src.lists && typeof src.lists === "object" ? src.lists : {}) as Record<
    string,
    unknown
  >;
  const srcTables = (src.tables && typeof src.tables === "object" ? src.tables : {}) as Record<
    string,
    unknown
  >;

  const out = emptyDeliverable(fields);
  for (const f of fields) {
    if (f.kind === "list") {
      const entries = srcLists[f.id];
      if (Array.isArray(entries)) {
        out.lists[f.id] = entries
          .map(toListItem)
          .filter((i): i is EditableListItem => i !== null);
      }
    } else {
      const columnIds = f.columns.map((c) => c.id);
      const entries = srcTables[f.id];
      if (Array.isArray(entries)) {
        out.tables[f.id] = entries
          .map((e) => toTableRow(e, columnIds))
          .filter((r): r is EditableTableRow => r !== null);
      }
    }
  }
  return out;
}

// ---- submit sanitisation --------------------------------------------------
//
// Transforms the editable model back into the exact shape `/api/submit` and the
// judge already expect: `{ lists: Record<id,string[]>, tables: Record<id,Row[]> }`.
// Strips every client id, drops empty entries via the shared predicate above,
// and keeps partially filled rows. Because the input type is EditableDeliverable
// — which has no place for the ephemeral row-source sidecar — that provenance is
// structurally unable to reach this payload (SPEC: no provenance to the judge).

export type SubmitPayload = {
  lists: Record<string, string[]>;
  tables: Record<string, Record<string, string>[]>;
};

export function toSubmitPayload(d: EditableDeliverable): SubmitPayload {
  const lists: Record<string, string[]> = {};
  for (const [id, items] of Object.entries(d.lists)) {
    lists[id] = items.filter((i) => !isEmptyItem(i)).map((i) => i.text);
  }
  const tables: Record<string, Record<string, string>[]> = {};
  for (const [id, rows] of Object.entries(d.tables)) {
    tables[id] = rows.filter((r) => !isEmptyRow(r)).map((r) => ({ ...r.cells }));
  }
  return { lists, tables };
}

// ---- block → section mapping (split-only, no interpretation) ---------------
//
// The interface only moves material the user chose; it never classifies,
// rewrites, or maps cells to columns. A block becomes exactly one list item or
// one table row. A table becomes readable text via the single labelled form
// (segment.labelledRowText); its structure is recorded in an ephemeral session
// sidecar (below) that can never reach the submit payload.

// Which column an ordinary block, or a labelled table row, lands in: the one
// that reads as the row's content (task / description / …) rather than an
// Owner/Who key. Falls back to the first column. Single source of this rule.
export function primaryColumn(columns: { id: string; label: string }[]): string {
  const CONTENT = /task|desc|detail|item|note|summary|answer|content|what|text|question/i;
  const match = columns.find((c) => CONTENT.test(c.id) || CONTENT.test(c.label));
  return (match ?? columns[0]).id;
}

// Ephemeral, client-session-only provenance for a transferred table row. Keyed
// by the new item/row id. Powers a DEFERRED future user-driven cell mapping. It
// is structurally impossible for this to enter EditableDeliverable or
// toSubmitPayload (SPEC: no provenance to the judge).
export type RowSource = {
  headers: string[];
  cells: string[];
  messageId: string;
  blockId: string;
};
export type RowSourceSidecar = Record<string, RowSource>;

// The result of mapping one block into one section: the new entry (list item or
// table row) plus, for a table-sourced row, the sidecar record to remember it by.
export type MappedEntry =
  | { kind: "list"; item: EditableListItem; source?: RowSource }
  | { kind: "table"; row: EditableTableRow; source?: RowSource };

function sourceFor(block: Block, entryId: string): RowSource | undefined {
  if (block.kind !== "tableRow" || !block.source) return undefined;
  const [messageId] = block.id.split(":");
  return {
    headers: block.source.headers,
    cells: block.source.cells,
    messageId,
    blockId: block.id,
  };
}

// Map one block into the given field. Ordinary block and table row are handled
// identically at the destination (the row's readable text is already in
// block.text); a table row additionally yields a sidecar record.
export function mapBlockToField(block: Block, field: DeliverableField): MappedEntry {
  if (field.kind === "list") {
    const item = newListItem(block.text);
    return { kind: "list", item, source: sourceFor(block, item.id) };
  }
  const target = primaryColumn(field.columns);
  const row = newTableRow(
    field.columns.map((c) => c.id),
    { [target]: block.text },
  );
  return { kind: "table", row, source: sourceFor(block, row.id) };
}

// ---- atomic commit + shallow Undo (T3/T4 pure core) ------------------------
//
// Commit maps every selected block and appends the batch to one section in the
// reply's original order (never the user's selection order), returning fresh
// deliverable + sidecar objects — all-or-nothing by construction. Repeated
// commits build a persistent multi-section session; the same block committed
// twice mints two independent entries, so one point can live in two sections.

// Original position of a block within its reply, from `${messageId}:${index}`.
// Synthetic raw-selection blocks (no numeric index) sort to the front as one.
function blockOrder(id: string): number {
  const n = Number(id.slice(id.indexOf(":") + 1));
  return Number.isFinite(n) ? n : -1;
}

export type CommitResult = {
  deliverable: EditableDeliverable;
  sidecar: RowSourceSidecar;
  addedIds: string[]; // the new entries, for Undo and new-item emphasis
  fieldId: string;
  kind: "list" | "table";
};

export function commitBlocks(
  d: EditableDeliverable,
  sidecar: RowSourceSidecar,
  blocks: Block[],
  field: DeliverableField,
): CommitResult {
  const ordered = [...blocks].sort((a, b) => blockOrder(a.id) - blockOrder(b.id));
  const mapped = ordered.map((b) => mapBlockToField(b, field));
  const nextSidecar: RowSourceSidecar = { ...sidecar };

  if (field.kind === "list") {
    const items: EditableListItem[] = [];
    for (const m of mapped) {
      if (m.kind !== "list") continue; // unreachable: field.kind pins the shape
      items.push(m.item);
      if (m.source) nextSidecar[m.item.id] = m.source;
    }
    const nextList = [...(d.lists[field.id] ?? []), ...items];
    return {
      deliverable: { ...d, lists: { ...d.lists, [field.id]: nextList } },
      sidecar: nextSidecar,
      addedIds: items.map((i) => i.id),
      fieldId: field.id,
      kind: "list",
    };
  }

  const rows: EditableTableRow[] = [];
  for (const m of mapped) {
    if (m.kind !== "table") continue; // unreachable: field.kind pins the shape
    rows.push(m.row);
    if (m.source) nextSidecar[m.row.id] = m.source;
  }
  const nextTable = [...(d.tables[field.id] ?? []), ...rows];
  return {
    deliverable: { ...d, tables: { ...d.tables, [field.id]: nextTable } },
    sidecar: nextSidecar,
    addedIds: rows.map((r) => r.id),
    fieldId: field.id,
    kind: "table",
  };
}

// What a shallow Undo needs to reverse exactly one commit — by id, never by
// position or content, so it survives edits and reorders elsewhere.
export type UndoRecord = { fieldId: string; kind: "list" | "table"; addedIds: string[] };

export function undoRecordFor(r: CommitResult): UndoRecord {
  return { fieldId: r.fieldId, kind: r.kind, addedIds: r.addedIds };
}

// Remove exactly the entries a commit added (by id) and forget their sidecar
// records. Entries already gone (e.g. the user removed one) are simply skipped.
export function undoCommit(
  d: EditableDeliverable,
  sidecar: RowSourceSidecar,
  rec: UndoRecord,
): { deliverable: EditableDeliverable; sidecar: RowSourceSidecar } {
  const removed = new Set(rec.addedIds);
  const nextSidecar: RowSourceSidecar = { ...sidecar };
  for (const id of rec.addedIds) delete nextSidecar[id];

  if (rec.kind === "list") {
    const arr = (d.lists[rec.fieldId] ?? []).filter((i) => !removed.has(i.id));
    return { deliverable: { ...d, lists: { ...d.lists, [rec.fieldId]: arr } }, sidecar: nextSidecar };
  }
  const arr = (d.tables[rec.fieldId] ?? []).filter((r) => !removed.has(r.id));
  return { deliverable: { ...d, tables: { ...d.tables, [rec.fieldId]: arr } }, sidecar: nextSidecar };
}
