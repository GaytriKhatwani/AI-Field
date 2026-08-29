// Credential-free proof of the pure Workbench transfer logic (SPEC:
// docs/SPEC-workbench-transfer-redesign.md). No component harness, no DOM — the
// modules are pure by design so their external behaviour is asserted directly.
// Run: `npx tsx scripts/verify-workbench-transfer.ts`.
//
// This covers the T1 foundation (editable model, shared emptiness rule, lossless
// migration, submit sanitisation). Segmentation, mapping, commit, and Undo cases
// are added alongside their tickets.

import type { DeliverableField } from "../lib/missions/types";
import {
  emptyDeliverable,
  newListItem,
  newTableRow,
  isEmptyItem,
  isEmptyRow,
  hasMeaningfulContent,
  migrateDeliverable,
  toSubmitPayload,
  mintId,
  primaryColumn,
  mapBlockToField,
  commitBlocks,
  undoCommit,
  undoRecordFor,
  type EditableDeliverable,
  type RowSourceSidecar,
  type AddedBlockRegistry,
} from "../lib/workbench/transfer";
import { segment, labelledRowText, type Block } from "../lib/workbench/segment";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
  if (!cond) failures++;
}

// Mirrors Meeting Chaos in shape: two lists + one 3-column table.
const FIELDS: DeliverableField[] = [
  { id: "decisions", kind: "list", label: "Decisions", placeholder: "" },
  {
    id: "actions",
    kind: "table",
    label: "Action items",
    columns: [
      { id: "owner", label: "Owner", placeholder: "" },
      { id: "task", label: "Task", placeholder: "" },
      { id: "due", label: "Due", placeholder: "" },
    ],
  },
  { id: "questions", kind: "list", label: "Open questions", placeholder: "" },
];
const COLS = ["owner", "task", "due"];

// ---- ids ------------------------------------------------------------------
{
  const a = mintId();
  const b = mintId();
  check("mintId returns a non-empty string", typeof a === "string" && a.length > 0);
  check("mintId is unique across calls", a !== b);
  check("newListItem mints an id", newListItem("x").id.length > 0);
  check("newTableRow mints an id", newTableRow(COLS).id.length > 0);
}

// ---- empty deliverable ----------------------------------------------------
{
  const d = emptyDeliverable(FIELDS);
  check(
    "emptyDeliverable creates a bucket per field",
    Object.keys(d.lists).length === 2 &&
      Object.keys(d.tables).length === 1 &&
      d.lists.decisions.length === 0 &&
      d.tables.actions.length === 0,
  );
}

// ---- newTableRow fills every column ---------------------------------------
{
  const r = newTableRow(COLS, { task: "Ship it", nonsense: "ignored" });
  check(
    "newTableRow fills every column, blanks the rest, ignores unknown keys",
    r.cells.owner === "" && r.cells.task === "Ship it" && r.cells.due === "" && !("nonsense" in r.cells),
  );
}

// ---- emptiness predicates -------------------------------------------------
{
  check("isEmptyItem: blank text is empty", isEmptyItem({ id: "1", text: "   " }));
  check("isEmptyItem: real text is not empty", !isEmptyItem({ id: "1", text: "Decide X" }));
  check(
    "isEmptyRow: all-blank cells is empty",
    isEmptyRow({ id: "1", cells: { owner: "", task: "  ", due: "" } }),
  );
  check(
    "isEmptyRow: a partially filled row is NOT empty",
    !isEmptyRow({ id: "1", cells: { owner: "", task: "Draft", due: "" } }),
  );
}

// ---- hasMeaningfulContent (the Finish gate) -------------------------------
{
  const empty = emptyDeliverable(FIELDS);
  check("hasMeaningfulContent: fresh deliverable is false", !hasMeaningfulContent(empty));

  const onlyBlanks: EditableDeliverable = {
    lists: { decisions: [newListItem("  ")], questions: [] },
    tables: { actions: [newTableRow(COLS)] },
  };
  check("hasMeaningfulContent: only blank entries is false", !hasMeaningfulContent(onlyBlanks));

  const oneItem: EditableDeliverable = {
    lists: { decisions: [newListItem("Move launch to Friday")], questions: [] },
    tables: { actions: [] },
  };
  check("hasMeaningfulContent: one non-empty item is true", hasMeaningfulContent(oneItem));

  const partialRow: EditableDeliverable = {
    lists: { decisions: [], questions: [] },
    tables: { actions: [newTableRow(COLS, { task: "Follow up" })] },
  };
  check("hasMeaningfulContent: a partially filled row is true", hasMeaningfulContent(partialRow));
}

// ---- migration v1 → v2 (lossless) -----------------------------------------
{
  // Legacy bare draft: plain strings and plain row objects, no ids.
  const legacy = {
    lists: { decisions: ["Ship Friday", "Freeze scope"], questions: ["Who signs off?"] },
    tables: { actions: [{ owner: "Priya", task: "Draft brief", due: "Fri" }, { owner: "", task: "QA", due: "" }] },
  };
  const migrated = migrateDeliverable(legacy, FIELDS);

  check(
    "migrate v1: list strings become items with text preserved",
    migrated.lists.decisions.length === 2 &&
      migrated.lists.decisions[0].text === "Ship Friday" &&
      migrated.lists.decisions[1].text === "Freeze scope",
  );
  check(
    "migrate v1: every migrated item gets a non-empty id",
    migrated.lists.decisions.every((i) => i.id.length > 0) &&
      migrated.tables.actions.every((r) => r.id.length > 0),
  );
  check(
    "migrate v1: ids are unique",
    new Set([
      ...migrated.lists.decisions.map((i) => i.id),
      ...migrated.tables.actions.map((r) => r.id),
    ]).size === 4,
  );
  check(
    "migrate v1: bare rows become {id,cells} with cells preserved",
    migrated.tables.actions[0].cells.owner === "Priya" &&
      migrated.tables.actions[0].cells.task === "Draft brief" &&
      migrated.tables.actions[0].cells.due === "Fri",
  );
  check(
    "migrate v1: a partially filled bare row keeps its blanks",
    migrated.tables.actions[1].cells.owner === "" &&
      migrated.tables.actions[1].cells.task === "QA" &&
      migrated.tables.actions[1].cells.due === "",
  );
}

// ---- migration v2 loads as-is (ids preserved) -----------------------------
{
  const v2 = {
    lists: { decisions: [{ id: "keep-me", text: "Existing" }], questions: [] },
    tables: { actions: [{ id: "row-keep", cells: { owner: "A", task: "B", due: "C" } }] },
  };
  const migrated = migrateDeliverable(v2, FIELDS);
  check(
    "migrate v2: existing item id is preserved",
    migrated.lists.decisions[0].id === "keep-me" && migrated.lists.decisions[0].text === "Existing",
  );
  check("migrate v2: existing row id is preserved", migrated.tables.actions[0].id === "row-keep");
}

// ---- migration self-heals against a config change -------------------------
{
  // Draft references a field the mission no longer has, and omits one it now has.
  const stale = {
    lists: { decisions: ["Kept"], removed_field: ["orphan"] },
    tables: {},
  };
  const migrated = migrateDeliverable(stale, FIELDS);
  check(
    "migrate: a dropped field is ignored, a new field starts empty",
    !("removed_field" in migrated.lists) &&
      migrated.lists.decisions[0].text === "Kept" &&
      Array.isArray(migrated.lists.questions) &&
      migrated.lists.questions.length === 0 &&
      Array.isArray(migrated.tables.actions) &&
      migrated.tables.actions.length === 0,
  );
}

// ---- migration is robust to junk ------------------------------------------
{
  check(
    "migrate: null/garbage input yields a valid empty deliverable",
    (() => {
      const m = migrateDeliverable(null, FIELDS);
      return m.lists.decisions.length === 0 && m.tables.actions.length === 0;
    })(),
  );
}

// ---- toSubmitPayload: shape, id-stripping, empty-filtering -----------------
{
  const d: EditableDeliverable = {
    lists: {
      decisions: [newListItem("Real decision"), newListItem("   "), newListItem("Another")],
      questions: [newListItem("")],
    },
    tables: {
      actions: [
        newTableRow(COLS, { owner: "Priya", task: "Ship", due: "Fri" }),
        newTableRow(COLS), // all blank — dropped
        newTableRow(COLS, { task: "Partial only" }), // partial — kept
      ],
    },
  };
  const payload = toSubmitPayload(d);

  check(
    "submit: exact top-level shape (lists + tables only)",
    JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(["lists", "tables"]),
  );
  check(
    "submit: lists become string[] with empties dropped",
    Array.isArray(payload.lists.decisions) &&
      payload.lists.decisions.length === 2 &&
      payload.lists.decisions[0] === "Real decision" &&
      payload.lists.decisions[1] === "Another" &&
      payload.lists.questions.length === 0,
  );
  check(
    "submit: all-blank row dropped, partial row kept",
    payload.tables.actions.length === 2 &&
      payload.tables.actions[0].task === "Ship" &&
      payload.tables.actions[1].task === "Partial only" &&
      payload.tables.actions[1].owner === "" &&
      payload.tables.actions[1].due === "",
  );
  check(
    "submit: no client id or sidecar structure leaks into a row",
    payload.tables.actions.every((r) => {
      const keys = Object.keys(r).sort();
      return JSON.stringify(keys) === JSON.stringify(["due", "owner", "task"]);
    }),
  );
  check(
    "submit: list entries are plain strings, never {id,text} objects",
    payload.lists.decisions.every((x) => typeof x === "string"),
  );
}

// ---- round-trip: migrate a legacy draft then submit reproduces the input --
{
  const legacy = {
    lists: { decisions: ["A", "B"], questions: [] },
    tables: { actions: [{ owner: "P", task: "T", due: "D" }] },
  };
  const payload = toSubmitPayload(migrateDeliverable(legacy, FIELDS));
  check(
    "round-trip: migrate→submit reproduces the legacy payload exactly",
    JSON.stringify(payload) ===
      JSON.stringify({
        lists: { decisions: ["A", "B"], questions: [] },
        tables: { actions: [{ owner: "P", task: "T", due: "D" }] },
      }),
  );
}

// ==========================================================================
// T2 — segmentation + block→section mapping
// ==========================================================================

// ---- segment: single paragraph blob ---------------------------------------
{
  const b = segment("m1", "Just one flowing sentence with no structure at all.");
  check("segment: a plain blob is one text block", b.length === 1 && b[0].kind === "text");
  check("segment: block id is `${messageId}:${index}`", b[0].id === "m1:0");
  check(
    "segment: plain blob text preserved",
    b[0].text === "Just one flowing sentence with no structure at all.",
  );
}

// ---- segment: soft-wrapped paragraph collapses -----------------------------
{
  const b = segment("m", "First line\nsecond line of the same paragraph.");
  check(
    "segment: soft wraps within a paragraph join with a space",
    b.length === 1 && b[0].text === "First line second line of the same paragraph.",
  );
}

// ---- segment: blank-line separated paragraphs ------------------------------
{
  const b = segment("m", "Para one.\n\nPara two.\n\nPara three.");
  check(
    "segment: blank-line paragraphs become separate blocks in order",
    b.length === 3 &&
      b[0].text === "Para one." &&
      b[1].text === "Para two." &&
      b[2].text === "Para three." &&
      b.map((x) => x.id).join(",") === "m:0,m:1,m:2",
  );
}

// ---- segment: flat list, one block per item, markers stripped --------------
{
  const b = segment("m", "- Ship Friday\n- Freeze the scope\n- Tell the client");
  check("segment: flat list yields one block per item", b.length === 3);
  check(
    "segment: bullet markers stripped, wording + order preserved",
    b[0].text === "Ship Friday" &&
      b[1].text === "Freeze the scope" &&
      b[2].text === "Tell the client",
  );
  check("segment: list items are text blocks", b.every((x) => x.kind === "text"));
}

// ---- segment: numbered list ------------------------------------------------
{
  const b = segment("m", "1. First\n2. Second\n3) Third");
  check(
    "segment: numbered markers (1. 2. 3)) stripped",
    b.length === 3 && b[0].text === "First" && b[1].text === "Second" && b[2].text === "Third",
  );
}

// ---- segment: nested list stays with its parent as one block ---------------
{
  const b = segment("m", "- Parent point\n  - child a\n  - child b\n- Second parent");
  check("segment: a nested list stays with its parent (2 blocks, not 4)", b.length === 2);
  check(
    "segment: parent block keeps its nested lines (order preserved, markers stripped)",
    b[0].text === "Parent point\n  child a\n  child b" && b[1].text === "Second parent",
  );
}

// ---- segment: does NOT dedupe, merge, or reorder ---------------------------
{
  const b = segment("m", "- Same\n- Same\n- Different");
  check(
    "segment: duplicate items are NOT deduped",
    b.length === 3 && b[0].text === "Same" && b[1].text === "Same" && b[2].text === "Different",
  );
}

// ---- segment: qualifiers and punctuation preserved -------------------------
{
  const b = segment("m", "- Maybe ship Friday, but only if QA passes (see note).");
  check(
    "segment: qualifiers/punctuation preserved verbatim",
    b[0].text === "Maybe ship Friday, but only if QA passes (see note).",
  );
}

// ---- segment: headings become context labels, never blocks -----------------
{
  const b = segment("m", "## Decisions\n- Ship Friday\n\n## Open questions\n- Who signs off?");
  check("segment: headings are not emitted as blocks", b.length === 2);
  check(
    "segment: each block carries its nearest heading as contextLabel",
    b[0].text === "Ship Friday" &&
      b[0].contextLabel === "Decisions" &&
      b[1].text === "Who signs off?" &&
      b[1].contextLabel === "Open questions",
  );
  check("segment: heading text never appears as a transferable block", !b.some((x) => x.text === "Decisions"));
}

// ---- segment: table rows -> tableRow blocks with source --------------------
{
  const md = [
    "| Owner | Task | Due |",
    "| --- | --- | --- |",
    "| Priya | Draft brief | Fri |",
    "| | QA pass | |",
  ].join("\n");
  const b = segment("m", md);
  check("segment: header row is not a block; each body row is one", b.length === 2);
  check("segment: body rows are tableRow blocks", b.every((x) => x.kind === "tableRow"));
  check(
    "segment: source headers + cells captured in order",
    JSON.stringify(b[0].source) ===
      JSON.stringify({ headers: ["Owner", "Task", "Due"], cells: ["Priya", "Draft brief", "Fri"] }),
  );
  check(
    "segment: empty cells preserved (not dropped), padded to header width",
    JSON.stringify(b[1].source!.cells) === JSON.stringify(["", "QA pass", ""]),
  );
  check(
    "segment: tableRow text is the labelled form with [empty] for blanks",
    b[0].text === "Owner: Priya · Task: Draft brief · Due: Fri" &&
      b[1].text === "Owner: [empty] · Task: QA pass · Due: [empty]",
  );
}

// ---- segment: mixed reply (list + table + paragraph under headings) --------
{
  const md = [
    "## Decisions",
    "- Move launch to Friday",
    "",
    "## Action items",
    "| Owner | Task |",
    "| --- | --- |",
    "| Sam | Book venue |",
    "",
    "Some closing thoughts here.",
  ].join("\n");
  const b = segment("m", md);
  check("segment: mixed reply splits into 3 blocks", b.length === 3);
  check(
    "segment: mixed reply block kinds + contexts",
    b[0].kind === "text" &&
      b[0].contextLabel === "Decisions" &&
      b[1].kind === "tableRow" &&
      b[1].contextLabel === "Action items" &&
      b[2].kind === "text" &&
      b[2].contextLabel === "Action items" &&
      b[2].text === "Some closing thoughts here.",
  );
}

// ---- segment: emphasis + inline code stripped, content intact --------------
{
  const b = segment("m", "This is **bold** and *italic* and `code` text.");
  check(
    "segment: emphasis/code markers stripped, words kept",
    b[0].text === "This is bold and italic and code text.",
  );
}

// ---- segment: pipes without a separator are NOT a table --------------------
{
  const b = segment("m", "The ratio is 3 | 4 | 5 in that column.");
  check(
    "segment: pipe chars without a separator row stay a text block",
    b.length === 1 && b[0].kind === "text",
  );
}

// ---- segment: empty / whitespace input -------------------------------------
{
  check("segment: empty string yields no blocks", segment("m", "").length === 0);
  check("segment: whitespace-only yields no blocks", segment("m", "   \n\n  ").length === 0);
}

// ---- labelledRowText forms -------------------------------------------------
{
  check(
    "labelledRowText: with headers uses `H: v` joined by ·, [empty] for blanks",
    labelledRowText(["A", "B"], ["x", ""]) === "A: x · B: [empty]",
  );
  check(
    "labelledRowText: without headers joins cells with — preserving empties",
    labelledRowText([], ["x", "", "z"]) === "x —  — z",
  );
}

// ---- primaryColumn ---------------------------------------------------------
{
  check(
    "primaryColumn: picks the content-like column over an Owner key",
    primaryColumn([
      { id: "owner", label: "Owner" },
      { id: "task", label: "Task" },
      { id: "due", label: "Due" },
    ]) === "task",
  );
  check(
    "primaryColumn: falls back to the first column when none match",
    primaryColumn([
      { id: "col_a", label: "Alpha" },
      { id: "col_b", label: "Beta" },
    ]) === "col_a",
  );
  check(
    "primaryColumn: matches 'axis' via the 'what'/content heuristic? (axis has no match -> first)",
    primaryColumn([
      { id: "axis", label: "Axis" },
      { id: "us", label: "Us" },
      { id: "them", label: "Them" },
    ]) === "axis",
  );
}

// ---- mapping: ordinary block → list ----------------------------------------
{
  const block: Block = { id: "m:0", kind: "text", text: "Ship Friday" };
  const listField = FIELDS[0]; // decisions
  const mapped = mapBlockToField(block, listField);
  check(
    "map: ordinary block → list is one item with the block text, no source",
    mapped.kind === "list" &&
      mapped.item.text === "Ship Friday" &&
      mapped.item.id.length > 0 &&
      mapped.source === undefined,
  );
}

// ---- mapping: ordinary block → table (primary col, others empty) -----------
{
  const block: Block = { id: "m:0", kind: "text", text: "Book the venue" };
  const tableField = FIELDS[1]; // actions (owner/task/due)
  const mapped = mapBlockToField(block, tableField);
  check(
    "map: ordinary block → table lands text in the primary column, others empty",
    mapped.kind === "table" &&
      mapped.row.cells.task === "Book the venue" &&
      mapped.row.cells.owner === "" &&
      mapped.row.cells.due === "" &&
      mapped.source === undefined,
  );
}

// ---- mapping: AI table row → list (labelled form, sidecar populated) --------
{
  const block: Block = {
    id: "m:3",
    kind: "tableRow",
    text: "Owner: Priya · Task: [empty] · Due: Fri",
    source: { headers: ["Owner", "Task", "Due"], cells: ["Priya", "", "Fri"] },
  };
  const mapped = mapBlockToField(block, FIELDS[0]); // → decisions (list)
  check(
    "map: AI-row → list is one item in labelled form",
    mapped.kind === "list" && mapped.item.text === "Owner: Priya · Task: [empty] · Due: Fri",
  );
  check(
    "map: AI-row → list populates the sidecar keyed by the new item id, empties preserved",
    mapped.source !== undefined &&
      mapped.kind === "list" &&
      JSON.stringify(mapped.source!.cells) === JSON.stringify(["Priya", "", "Fri"]) &&
      mapped.source!.blockId === "m:3" &&
      mapped.source!.messageId === "m",
  );
}

// ---- mapping: AI table row → table (NO cell→column mapping) -----------------
{
  const block: Block = {
    id: "m:5",
    kind: "tableRow",
    text: "Owner: Sam · Task: Ship · Due: Mon",
    source: { headers: ["Owner", "Task", "Due"], cells: ["Sam", "Ship", "Mon"] },
  };
  const mapped = mapBlockToField(block, FIELDS[1]); // → actions (table)
  check(
    "map: AI-row → table puts the whole labelled form in the primary column, NOT cell-by-cell",
    mapped.kind === "table" &&
      mapped.row.cells.task === "Owner: Sam · Task: Ship · Due: Mon" &&
      mapped.row.cells.owner === "" &&
      mapped.row.cells.due === "",
  );
  check(
    "map: AI-row → table populates the sidecar for the future cell-mapping affordance",
    mapped.source !== undefined && JSON.stringify(mapped.source!.headers) === JSON.stringify(["Owner", "Task", "Due"]),
  );
}

// ---- the sidecar can never reach the submit payload ------------------------
{
  // Even with a fully mapped table-sourced row in the deliverable, toSubmitPayload
  // sees only EditableDeliverable — the sidecar type has no path into it.
  const block: Block = {
    id: "m:0",
    kind: "tableRow",
    text: "Owner: Priya · Task: X · Due: Fri",
    source: { headers: ["Owner", "Task", "Due"], cells: ["Priya", "X", "Fri"] },
  };
  const mapped = mapBlockToField(block, FIELDS[1]);
  const d: EditableDeliverable = {
    lists: { decisions: [], questions: [] },
    tables: { actions: [mapped.kind === "table" ? mapped.row : newTableRow(COLS)] },
  };
  const payload = toSubmitPayload(d);
  const row = payload.tables.actions[0];
  check(
    "map+submit: a table-sourced row carries no headers/cells/source into the payload",
    JSON.stringify(Object.keys(row).sort()) === JSON.stringify(["due", "owner", "task"]),
  );
}

// ==========================================================================
// T3/T4 — atomic commit, persistent multi-section session, shallow Undo
// ==========================================================================

// ---- commit: append order follows the reply, not the selection order -------
{
  const blocks: Block[] = [
    { id: "m:2", kind: "text", text: "third" },
    { id: "m:0", kind: "text", text: "first" },
    { id: "m:1", kind: "text", text: "second" },
  ];
  const d0 = emptyDeliverable(FIELDS);
  const res = commitBlocks(d0, {}, {}, blocks, FIELDS[0]);
  check(
    "commit: batch appends in reply order regardless of selection order",
    res.deliverable.lists.decisions.map((i) => i.text).join(",") === "first,second,third",
  );
  check("commit: addedIds match the appended entries", res.addedIds.length === 3);
  check("commit: does not mutate the input deliverable", d0.lists.decisions.length === 0);
}

// ---- commit: appends after existing items ----------------------------------
{
  const d0: EditableDeliverable = {
    lists: { decisions: [newListItem("existing")], questions: [] },
    tables: { actions: [] },
  };
  const res = commitBlocks(d0, {}, {}, [{ id: "m:0", kind: "text", text: "added" }], FIELDS[0]);
  check(
    "commit: new batch appends after existing content",
    res.deliverable.lists.decisions.map((i) => i.text).join(",") === "existing,added",
  );
}

// ---- persistent session: two commits to two sections -----------------------
{
  let d = emptyDeliverable(FIELDS);
  let side: RowSourceSidecar = {};
  let reg: AddedBlockRegistry = {};
  const r1 = commitBlocks(d, side, reg, [{ id: "m:0", kind: "text", text: "A decision" }], FIELDS[0]);
  d = r1.deliverable;
  side = r1.sidecar;
  reg = r1.registry;
  const r2 = commitBlocks(d, side, reg, [{ id: "m:1", kind: "text", text: "A question" }], FIELDS[2]);
  d = r2.deliverable;
  check(
    "session: successive commits route to different sections",
    d.lists.decisions[0].text === "A decision" && d.lists.questions[0].text === "A question",
  );
}

// ---- multi-section reuse: same block committed to two sections --------------
{
  const block: Block = { id: "m:0", kind: "text", text: "Both a decision and a question" };
  let d = emptyDeliverable(FIELDS);
  const r1 = commitBlocks(d, {}, {}, [block], FIELDS[0]);
  d = r1.deliverable;
  const r2 = commitBlocks(d, r1.sidecar, r1.registry, [block], FIELDS[2]);
  d = r2.deliverable;
  check(
    "reuse: one block can land in two sections",
    d.lists.decisions[0].text === "Both a decision and a question" &&
      d.lists.questions[0].text === "Both a decision and a question",
  );
  check(
    "reuse: the two entries have distinct ids",
    d.lists.decisions[0].id !== d.lists.questions[0].id,
  );
}

// ---- duplicate guard: the SAME block into the SAME section is rejected -----
// by commitBlocks itself — not a caller pre-filter (the launch-blocker fix:
// "Added to Assumptions to verify" was still addable to that same section).
{
  const block: Block = { id: "m:9", kind: "text", text: "Verify the Q3 revenue figure" };
  const first = commitBlocks(emptyDeliverable(FIELDS), {}, {}, [block], FIELDS[0]);
  check("dup-guard: the first commit succeeds", first.addedIds.length === 1);

  // Re-commit the identical block to the identical field, passing the SAME
  // block object and the registry the first commit produced — exactly what a
  // second "Add to Decisions" click on the same reply does.
  const second = commitBlocks(first.deliverable, first.sidecar, first.registry, [block], FIELDS[0]);
  check(
    "dup-guard: a repeat commit to the SAME section adds nothing",
    second.addedIds.length === 0 && second.skippedBlockIds.join(",") === "m:9",
  );
  check(
    "dup-guard: the deliverable is unchanged by the rejected repeat",
    second.deliverable.lists.decisions.length === 1,
  );

  // The same block into a DIFFERENT section must still be allowed.
  const third = commitBlocks(second.deliverable, second.sidecar, second.registry, [block], FIELDS[2]);
  check(
    "dup-guard: the same block can still land in a different section",
    third.addedIds.length === 1 && third.deliverable.lists.questions.length === 1,
  );

  // A mixed batch: one fresh block plus one already-added block into the same
  // section — the fresh one still lands, the duplicate is silently dropped.
  const other: Block = { id: "m:10", kind: "text", text: "A second, unrelated point" };
  const mixed = commitBlocks(third.deliverable, third.sidecar, third.registry, [block, other], FIELDS[0]);
  check(
    "dup-guard: a mixed batch keeps the fresh block and drops only the duplicate",
    mixed.addedIds.length === 1 &&
      mixed.skippedBlockIds.join(",") === "m:9" &&
      mixed.deliverable.lists.decisions.length === 2,
  );
}

// ---- duplicate guard: raw-selection blocks are exempt (no text matching) ---
{
  // Two raw-selection commits of literally the same text are two different,
  // non-tracked synthetic block ids — never deduped by content.
  const raw1: Block = { id: "raw:1", kind: "text", text: "Same text, pasted twice" };
  const raw2: Block = { id: "raw:2", kind: "text", text: "Same text, pasted twice" };
  const r1 = commitBlocks(emptyDeliverable(FIELDS), {}, {}, [raw1], FIELDS[0]);
  const r2 = commitBlocks(r1.deliverable, r1.sidecar, r1.registry, [raw2], FIELDS[0]);
  check(
    "dup-guard: raw-selection blocks are never tracked or deduped by text",
    r2.addedIds.length === 1 && r2.deliverable.lists.decisions.length === 2,
  );
}

// ---- undo reverses the duplicate guard: freed blocks can be re-added -------
{
  const block: Block = { id: "m:1", kind: "text", text: "Undo then re-add" };
  const committed = commitBlocks(emptyDeliverable(FIELDS), {}, {}, [block], FIELDS[0]);
  const blocked = commitBlocks(
    committed.deliverable,
    committed.sidecar,
    committed.registry,
    [block],
    FIELDS[0],
  );
  check("undo-precondition: the repeat is blocked before undo", blocked.addedIds.length === 0);

  const undone = undoCommit(
    committed.deliverable,
    committed.sidecar,
    committed.registry,
    undoRecordFor(committed),
  );
  check(
    "undo: reverses the duplicate-guard registry, not just the deliverable",
    undone.deliverable.lists.decisions.length === 0 && Object.keys(undone.registry).length === 0,
  );

  const readded = commitBlocks(undone.deliverable, undone.sidecar, undone.registry, [block], FIELDS[0]);
  check(
    "undo: the freed block can be committed to that same section again",
    readded.addedIds.length === 1 && readded.deliverable.lists.decisions.length === 1,
  );
}

// ---- commit: table-sourced batch populates sidecar for the batch -----------
{
  const blocks: Block[] = [
    {
      id: "m:0",
      kind: "tableRow",
      text: "Owner: Priya · Task: X · Due: Fri",
      source: { headers: ["Owner", "Task", "Due"], cells: ["Priya", "X", "Fri"] },
    },
    {
      id: "m:1",
      kind: "tableRow",
      text: "Owner: Sam · Task: Y · Due: Mon",
      source: { headers: ["Owner", "Task", "Due"], cells: ["Sam", "Y", "Mon"] },
    },
  ];
  const res = commitBlocks(emptyDeliverable(FIELDS), {}, {}, blocks, FIELDS[1]);
  check(
    "commit: sidecar records every table-sourced row by its new id",
    res.addedIds.every((id) => res.sidecar[id] !== undefined) &&
      Object.keys(res.sidecar).length === 2,
  );
  check(
    "commit: submit still drops all sidecar structure",
    toSubmitPayload(res.deliverable).tables.actions.every(
      (r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(["due", "owner", "task"]),
    ),
  );
}

// ---- undo: reverses the exact ids, even after a reorder ---------------------
{
  let d = emptyDeliverable(FIELDS);
  d.lists.decisions = [newListItem("kept before")];
  const res = commitBlocks(d, {}, {}, [
    { id: "m:0", kind: "text", text: "batch 1" },
    { id: "m:1", kind: "text", text: "batch 2" },
  ], FIELDS[0]);
  d = res.deliverable;
  // Simulate the user reordering the list (moving the pre-existing item to the end).
  const [firstKept, ...rest] = d.lists.decisions;
  d = { ...d, lists: { ...d.lists, decisions: [...rest, firstKept] } };
  const undone = undoCommit(d, res.sidecar, res.registry, undoRecordFor(res));
  check(
    "undo: removes exactly the committed ids after a reorder, leaving prior work",
    undone.deliverable.lists.decisions.length === 1 &&
      undone.deliverable.lists.decisions[0].text === "kept before",
  );
}

// ---- undo: survives a subsequent unrelated selection/commit elsewhere -------
{
  let d = emptyDeliverable(FIELDS);
  const r1 = commitBlocks(d, {}, {}, [{ id: "m:0", kind: "text", text: "target" }], FIELDS[0]);
  d = r1.deliverable;
  // A later commit to a *different* section happens; the first undo record is
  // still valid because it references ids, not positions.
  const r2 = commitBlocks(d, r1.sidecar, r1.registry, [{ id: "m:1", kind: "text", text: "other" }], FIELDS[2]);
  d = r2.deliverable;
  const undone = undoCommit(d, r2.sidecar, r2.registry, undoRecordFor(r1));
  check(
    "undo: an older record still reverses its own commit after an unrelated one",
    undone.deliverable.lists.decisions.length === 0 &&
      undone.deliverable.lists.questions[0].text === "other",
  );
}

// ---- undo: clears the sidecar entries it removes ---------------------------
{
  const block: Block = {
    id: "m:0",
    kind: "tableRow",
    text: "Owner: Priya · Task: X · Due: Fri",
    source: { headers: ["Owner", "Task", "Due"], cells: ["Priya", "X", "Fri"] },
  };
  const res = commitBlocks(emptyDeliverable(FIELDS), {}, {}, [block], FIELDS[1]);
  check("undo-precondition: sidecar has the row", Object.keys(res.sidecar).length === 1);
  const undone = undoCommit(res.deliverable, res.sidecar, res.registry, undoRecordFor(res));
  check(
    "undo: removes the row AND its sidecar entry",
    undone.deliverable.tables.actions.length === 0 &&
      Object.keys(undone.sidecar).length === 0,
  );
}

// ---- undo: an already-removed entry is skipped, not an error ----------------
{
  const res = commitBlocks(emptyDeliverable(FIELDS), {}, {}, [
    { id: "m:0", kind: "text", text: "a" },
    { id: "m:1", kind: "text", text: "b" },
  ], FIELDS[0]);
  // User manually removes one of the two before undoing.
  let d = res.deliverable;
  d = { ...d, lists: { ...d.lists, decisions: d.lists.decisions.slice(0, 1) } };
  const undone = undoCommit(d, res.sidecar, res.registry, undoRecordFor(res));
  check(
    "undo: tolerates an entry the user already removed",
    undone.deliverable.lists.decisions.length === 0,
  );
}

// ==========================================================================
// T8 — four-scenario acceptance, driven by the REAL mission configs
// ==========================================================================

import { getMission } from "../lib/missions";

function field(missionId: string, fieldId: string): DeliverableField {
  const m = getMission(missionId);
  if (!m) throw new Error(`mission ${missionId} not found`);
  const f = m.deliverable.fields.find((x) => x.id === fieldId);
  if (!f) throw new Error(`field ${fieldId} not found in ${missionId}`);
  return f;
}

// ---- Meeting Chaos: list + AI actions TABLE (no invented owners/dates) -----
{
  const reply = [
    "## Decisions",
    "- Move the launch to Friday",
    "- Freeze scope on v1",
    "",
    "## Action items",
    "| Owner | Task | Due |",
    "| --- | --- | --- |",
    "| Priya | Draft the brief | Fri |",
    "| | Book the venue | |",
    "",
    "## Open questions",
    "- Who signs off on pricing?",
  ].join("\n");
  const b = segment("mc1", reply);
  const decisions = b.filter((x) => x.contextLabel === "Decisions");
  const actions = b.filter((x) => x.contextLabel === "Action items");
  const questions = b.filter((x) => x.contextLabel === "Open questions");

  let d = emptyDeliverable(getMission("meeting-chaos")!.deliverable.fields);
  let side: RowSourceSidecar = {};
  let reg: AddedBlockRegistry = {};
  for (const [batch, fid] of [
    [decisions, "decisions"],
    [actions, "actions"],
    [questions, "questions"],
  ] as const) {
    const res = commitBlocks(d, side, reg, batch, field("meeting-chaos", fid));
    d = res.deliverable;
    side = res.sidecar;
    reg = res.registry;
  }

  check(
    "meeting-chaos: decisions land as list items",
    d.lists.decisions.map((i) => i.text).join(" | ") ===
      "Move the launch to Friday | Freeze scope on v1",
  );
  check(
    "meeting-chaos: AI table rows land text in the `task` column",
    d.tables.actions[0].cells.task === "Owner: Priya · Task: Draft the brief · Due: Fri",
  );
  check(
    "meeting-chaos: owner/due stay EMPTY — no invented owner or date",
    d.tables.actions.every((r) => r.cells.owner === "" && r.cells.due === ""),
  );
  check(
    "meeting-chaos: a partially-empty AI row is preserved with [empty] markers",
    d.tables.actions[1].cells.task === "Owner: [empty] · Task: Book the venue · Due: [empty]",
  );
  check("meeting-chaos: open question lands as a list item", d.lists.questions.length === 1);
  check(
    "meeting-chaos: submit reproduces the API shape",
    (() => {
      const p = toSubmitPayload(d);
      return (
        p.lists.decisions.length === 2 &&
        p.tables.actions.length === 2 &&
        p.lists.questions.length === 1 &&
        p.tables.actions.every(
          (r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(["due", "owner", "task"]),
        )
      );
    })(),
  );
}

// ---- The Bad Prompt: list-only, paragraph + option segmentation ------------
{
  const reply = [
    "Here are some subject options:",
    "",
    "- New feature: dark mode is here",
    "- Introducing dark mode",
    "",
    "And the body:",
    "",
    "We just shipped dark mode.",
    "",
    "It's on by default at night.",
  ].join("\n");
  const b = segment("bp1", reply);
  const subjects = b.filter((x) => x.text.startsWith("New feature") || x.text === "Introducing dark mode");
  const bodyParas = b.filter((x) => x.text.startsWith("We just shipped") || x.text.startsWith("It's on"));

  let d = emptyDeliverable(getMission("the-bad-prompt")!.deliverable.fields);
  let side: RowSourceSidecar = {};
  let reg: AddedBlockRegistry = {};
  let res = commitBlocks(d, side, reg, subjects, field("the-bad-prompt", "subject"));
  d = res.deliverable;
  side = res.sidecar;
  reg = res.registry;
  res = commitBlocks(d, side, reg, bodyParas, field("the-bad-prompt", "body"));
  d = res.deliverable;

  check("the-bad-prompt: two subject options captured", d.lists.subject.length === 2);
  check(
    "the-bad-prompt: body paragraphs each become their own list item",
    d.lists.body.length === 2 &&
      d.lists.body[0].text === "We just shipped dark mode." &&
      d.lists.body[1].text === "It's on by default at night.",
  );
}

// ---- From Ask to Brief: 3-column comparison TABLE -> `axis` primary column --
{
  const reply = [
    "| Axis | Us | Them |",
    "| --- | --- | --- |",
    "| Price | $9 | $19 |",
    "| Onboarding | Guided | Self-serve |",
  ].join("\n");
  const b = segment("br1", reply);
  const res = commitBlocks(
    emptyDeliverable(getMission("the-brief")!.deliverable.fields),
    {},
    {},
    b,
    field("the-brief", "compare"),
  );
  const d = res.deliverable;
  check(
    "the-brief: primaryColumn resolves to `axis` (content heuristic) for the comparison table",
    primaryColumn(
      (field("the-brief", "compare") as { columns: { id: string; label: string }[] }).columns,
    ) === "axis",
  );
  check(
    "the-brief: comparison rows land labelled text in `axis`, us/them EMPTY for the user to fill",
    d.tables.compare.length === 2 &&
      d.tables.compare[0].cells.axis === "Axis: Price · Us: $9 · Them: $19" &&
      d.tables.compare.every((r) => r.cells.us === "" && r.cells.them === ""),
  );
}

// ---- Don't Trust the AI: verified lines vs a flagged invented figure -------
{
  const reply = [
    "- Revenue grew quarter over quarter.",
    "- We now serve enterprise customers generating $4.2M ARR.",
    "- The team shipped three releases.",
  ].join("\n");
  const b = segment("dt1", reply);
  const verified = [b[0], b[2]]; // the two supportable lines
  const invented = [b[1]]; // the fabricated enterprise figure the user caught

  let d = emptyDeliverable(getMission("dont-trust-the-ai")!.deliverable.fields);
  let side: RowSourceSidecar = {};
  let reg: AddedBlockRegistry = {};
  let res = commitBlocks(d, side, reg, verified, field("dont-trust-the-ai", "summary"));
  d = res.deliverable;
  side = res.sidecar;
  reg = res.registry;
  res = commitBlocks(d, side, reg, invented, field("dont-trust-the-ai", "caught"));
  d = res.deliverable;

  check(
    "dont-trust-the-ai: verified lines go to Summary, the flagged figure to Caught & removed",
    d.lists.summary.length === 2 &&
      d.lists.caught.length === 1 &&
      d.lists.caught[0].text.includes("$4.2M ARR"),
  );
  check(
    "dont-trust-the-ai: segmentation adds no readiness/quality hint — text is verbatim",
    d.lists.caught[0].text === "We now serve enterprise customers generating $4.2M ARR.",
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
