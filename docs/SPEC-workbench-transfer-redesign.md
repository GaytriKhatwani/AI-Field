# SPEC — Workbench Transfer Redesign

> Consolidated from a `/grill-me` design session (5 rounds), a final design package, **15 binding amendments**, and **3 approved corrections**. All conflicts resolved in favour of the amendments/corrections. Authoritative publication target (no issue tracker is configured for this repo). Superseded alternatives and the round-by-round discussion are intentionally omitted.

## Problem Statement

Inside a practice scenario, the Workbench separates the **AI conversation + materials** (left) from the **user-owned deliverable** (right). The user is meant to direct the AI, inspect and challenge its output, decide what is useful, and turn selected material into a structured deliverable they own — the judgment the scenario assesses (Context, Direction, Iteration, Verification, Synthesis).

Today the bridge between "the AI produced something useful" and "I deliberately incorporated it" is the weakest part of the product, and it rewards the wrong behavior:

- The **thoughtful path is hidden and hard**: getting a portion of an AI reply into the deliverable requires discovering that *highlighting text* reveals a floating action. It's undocumented, fiddly with a trackpad, collapses under normal selection, fights copy, is poor on touch, and is effectively unusable by keyboard.
- The **careless path is the easy one**: the only keyboard-reachable action inserts the **entire AI reply** into a single section — producing badly structured deliverables and directly contradicting the Practice Review, which later criticises wholesale acceptance of AI output.

So the interface makes the assessed-as-poor behavior obvious and the assessed-as-good behavior obscure.

## Solution

Replace the transfer interaction with a **visible, low-friction, block-level** bridge. Activating a persistent **Use in deliverable** action on any completed AI reply puts *that one reply* into an inline selection mode: the reply is mechanically split into the blocks it already expresses (paragraphs, list items, nested groups, table rows), each block gets a persistent checkbox, and a sticky action bar lets the user send a batch of chosen blocks to **one** deliverable section — then send another batch elsewhere, without leaving the mode. All editing and refinement happen in the deliverable, where authorship lives.

Mechanical friction drops to near zero; the deliberate decisions that carry the assessment stay explicit — *which* blocks are useful, *which* section they belong in, and *how* they must be edited or verified. The interface never classifies, rewrites, summarises, extracts, ranks, pre-selects, or suggests a destination — it only moves material the user chose. No AI-vs-user provenance is kept in the deliverable or sent to the judge. The **Practice Review**, not the interface, remains the only place careless or incomplete work is judged.

## User Stories

1. As a practising professional, I want an obvious, always-visible way to move AI output into my deliverable, so that I don't have to discover a hidden highlighting gesture.
2. As a user, I want to treat an AI reply as a set of workable blocks rather than one indivisible message, so that I can take exactly the parts I judge useful.
3. As a user, I want to select one or several blocks from a reply, so that I can pull multiple useful points at once.
4. As a user, I want to select non-contiguous blocks, so that I can skip the commentary and take only the substantive points.
5. As a user, I want a "Select all" option for a reply, so that legitimate bulk cases are fast — but I still choose the destination, so wholesale dumping into one section is never the default.
6. As a user, I want to send a batch of selected blocks to a specific section (Decisions, Action items, etc.), so that different portions land where they belong.
7. As a user, I want to keep selecting from the same reply after a commit, so that I can route different portions to different sections without re-opening the flow.
8. As a user, I want the same block to be usable in more than one section, so that a point that's both a decision and an open question can appear in both.
9. As a user, I want blocks to append in the reply's original order, so that the result isn't scrambled by my selection order.
10. As a user, I want to edit any transferred item in the deliverable, so that I can refine wording, trim, or correct it.
11. As a user, I want to split a transferred blob into two items in the deliverable, so that two ideas that arrived together can be separated.
12. As a user, I want transferred and hand-typed items to look and behave identically, so that the deliverable reads as my own work.
13. As a user, I want to remove a transferred item, so that a mistaken addition is easy to reverse.
14. As a user, I want a shallow Undo immediately after a commit, so that a wrong-section or too-many mistake is a single action to reverse.
15. As a user, I want Undo to survive while I keep adjusting my selection, so that I have a moment to notice an incorrect destination before it expires.
16. As a user, I want Undo to stop deleting anything once I've edited a transferred item, so that my new work is never destroyed.
17. As a user, I want a brief, in-context confirmation of what was added and where, so that I know the transfer happened without losing my place.
18. As a user, I want the destination section to briefly emphasise the newly added items, so that I can see exactly what's new.
19. As a user working through a long reply, I want the action bar to stay reachable while I scroll, so that I can commit without hunting for the control.
20. As a user, I want to select a precise passage by highlighting when I need sub-block precision, so that the old capability remains as an optional shortcut.
21. As a keyboard-only user, I want every selection and transfer action reachable by keyboard, so that I never need a mouse for any essential step.
22. As a screen-reader user, I want concise, meaningful labels for blocks and actions, so that the interface is usable without seeing it and without hearing full paragraphs read twice.
23. As a touch user, I want large tap targets and a full-screen selection surface, so that selecting and placing blocks is reliable on a phone.
24. As a mobile user, I want to peek at the deliverable and come back without losing my selection, so that I can check placement mid-flow.
25. As a mobile user, I want a restrained "Updated" marker on the deliverable after a commit, so that I know something changed without being yanked out of selection mode.
26. As a user who prefers reduced motion, I want non-animated emphasis, so that new-item feedback doesn't rely on movement or colour alone.
27. As a user, I want to build a section by typing directly, so that I can author content the AI never produced.
28. As a user, I want each empty section to offer a clearly named creation action ("Add a decision"), so that I understand what the section holds and can start without confusion.
29. As a user, I want one short explanation that the deliverable is mine to write or fill from the AI and stays editable, so that I understand the two-part model at a glance.
30. As a user, I want *What matters* and *Materials* to collapse into compact summaries once I've started the conversation, so that the transcript becomes the primary working surface.
31. As a user, I want to expand *Materials* again mid-session to share or remove a resource, so that deciding context stays a live, reversible act.
32. As a user, I want honest reassurance that my unfinished work is saved on this device, so that I trust it will survive a refresh without being misled about cloud sync.
33. As a user, I want a clear, persistent warning if a save fails, so that I know to keep the tab open rather than lose work silently.
34. As a user, I want to finish practice only when my deliverable has real content, so that I don't submit an empty artifact by accident.
35. As a user, I want finishing to be a conscious, confirmed step, so that I don't hand in work I meant to keep editing.
36. As a user, I want to be able to finish imperfect or incomplete work, so that my genuine choices are what the Practice Review evaluates.
37. As a user, I don't want the interface to tell me whether my answer is complete or correct before I finish, so that the scenario doesn't reveal what it expects me to discover.
38. As a user transferring an AI table row, I want its cells preserved in order with empty positions shown, so that missing values are legible and nothing is silently dropped or invented.
39. As a user, I want a transferred AI row to land as readable text in a section's primary column so I can redistribute it myself, so that reading and placing each value stays my judgment.
40. As the product owner, I want no provenance metadata (copied/typed/edited) to reach the judge, so that assessment stays anchored to the artifact and the visible process, not interface telemetry.
41. As the product owner, I want the interface never to classify, rewrite, or suggest destinations, so that the Synthesis and Verification work the scenario assesses is never done for the user.

## Implementation Decisions

**Two pure modules (approved seams), independent of React and the DOM. The Workbench component becomes a thin shell over them.**

**Module `lib/workbench/segment.ts`** — mechanical segmentation.
- `segment(messageId, text): Block[]`. `messageId` feeds stable block ids (`\`${messageId}:${index}\``).
- Splits on markdown block boundaries the reply already expresses: blank-line paragraphs; each top-level list item; a nested list stays with its parent as one multi-line block; each table row is one `tableRow` block.
- Headings become non-selectable **context labels**, associated *mechanically* with following blocks until the next heading of equal/higher level; shown while those blocks are selected; **never transferred by ordinary capture**. The segmenter makes no "needed for sense" judgment.
- Cleaning is mechanical only (strip bullet/heading/table-border/emphasis markers; preserve wording, order, qualifiers, meaningful line breaks). It must **not** paraphrase, summarise, merge, reorder, dedupe, complete, alter cells, drop qualifiers, discard empty cells, or change meaningful punctuation. A **dedicated block-cleaner** is written for this; the existing debrief plaintext cleaner is only reused if verified not to over-normalise.
- Ambiguous/unparseable input → one block. Blocks are offered only on completed messages (never while streaming, never on error messages).

```ts
type Block = {
  id: string;                 // `${messageId}:${index}`
  kind: "text" | "tableRow";
  text: string;               // mechanically cleaned readable text
  contextLabel?: string;      // associated heading; shown, never auto-transferred
  source?: { headers: string[]; cells: string[] }; // tableRow only
};
```

**Module `lib/workbench/transfer.ts`** — editable deliverable model + all pure transfer logic.
- Editable model with **stable IDs** (minted on creation — manual *or* transfer — via `crypto.randomUUID()`; stable through edit/reorder; never array index, never content match):
```ts
type EditableListItem = { id: string; text: string };
type EditableTableRow = { id: string; cells: Record<string, string> };
type EditableDeliverable = {
  lists:  Record<string, EditableListItem[]>;
  tables: Record<string, EditableTableRow[]>;
};
```
- **One shared emptiness/meaningful-content rule** — the sole authority for both the Finish gate and submit-sanitisation, so they can never diverge:
```ts
const isEmptyItem = (i: EditableListItem) => i.text.trim() === "";
const isEmptyRow  = (r: EditableTableRow) => Object.values(r.cells).every((c) => c.trim() === "");
function hasMeaningfulContent(d: EditableDeliverable): boolean; // ∃ a non-empty item OR non-empty row
```
  Finish is enabled iff `hasMeaningfulContent`. Submission drops every `isEmptyItem` and `isEmptyRow`; **partially-completed non-empty rows are kept**.
- **Block→section mapping** (split-only, no interpretation): ordinary block → list = one item (block text); ordinary block → table = one row, text in the section's primary content column, other columns empty. AI-table row → list = one item in **labelled mechanical form**; AI-table row → table = one row, labelled form in the primary column, other columns empty. **No cell→column mapping, ever, even on matching headers.**
- **Labelled mechanical form**: with headers, `Owner: Priya · Task: [empty] · Due: Friday` — preserve cell order and empty positions, `[empty]` for blanks, never infer a value. Without headers, join cells with ` — ` preserving empties.
- **Atomic commit**: all selected blocks added or none; on failure, selection and pre-commit deliverable are preserved and the user is told to retry.
- **Shallow Undo**: reverses the last commit by exact item IDs (not position/content). Expires on ~8s, next commit, leaving selection mode, Done, navigation, or editing an affected item; does **not** expire on checking/unchecking, scrolling, opening the destination menu, or expanding Materials/What matters. Editing an affected item removes the Undo action without deleting anything.
- **Ephemeral source sidecar** `rowSourceByItemId: Record<itemId, { headers; cells; messageId; blockId }>` — client-session only, powering a **deferred** future user-driven cell-mapping. It is structurally impossible for this data to enter `toSubmitPayload`.
- **`toSubmitPayload(EditableDeliverable)`**: transforms to the existing API shape `{ lists: Record<id,string[]>, tables: Record<id,Row[]> }`, stripping all client IDs and the sidecar and filtering empties via the shared predicate. The `/api/submit` contract and judge input are **unchanged**.
- **`migrateDraft`**: draft schema bumps to `v:2`; a legacy `v:1` draft (bare strings/rows) gets IDs assigned to every item/row on hydration; `v:2` loads as-is.

**Interaction model (component shell over the modules).**
- Persistent **Use in deliverable** action on each completed AI reply (replaces the whole-message picker). One reply in selection mode at a time.
- Sticky action bar: **Select all / Clear · Add to [section ▾] · Done**. Bar stays reachable while scrolling a reply taller than the viewport (bound to the instrument column's own scroll region, not the window).
- Switching to another reply while an uncommitted selection exists offers **"Keep selecting from this response"** vs **"Discard selection and switch"** (no "retain"); no uncommitted selection switches silently.
- Raw text selection remains an optional precision shortcut: a **Use selection** action treats the passage as one temporary synthetic block routed through the same destination/commit/Undo path, without entering full selection mode.
- **All section IDs, labels, and manual-creation labels are derived from each mission's `deliverable.fields` config** — no mission-specific strings in the component. Create labels derive from the field label ("Add a{n} {singularised label}", generic fallback). The acceptance matrix wording below is illustrative.
- After the first successful send, *What matters* and *Materials* auto-collapse once into compact summary rows (expandable, independently, with manual re-collapse thereafter). Fixed composer footer and independent column scrolling are retained.
- No new analytics events; the existing locked analytics contract is untouched. No backend, route, judge, rubric, or schema changes.

## Testing Decisions

**What makes a good test here:** exercise external behavior of the two pure modules — given input blocks/text/deliverable/draft, assert the output data — never internal wiring. The modules are pure and DOM-free specifically so this is possible without a component harness.

**Prior art:** the repo has **no unit-test framework**; its convention is standalone tsx scripts run via `npx tsx` — `scripts/verify-*.ts` (behavior/DB-boundary checks) and `scripts/gate-*.ts` (judge discrimination via `scripts/gate-harness.ts`). This spec follows that convention exactly and adds **no** test dependency.

**New script `scripts/verify-workbench-transfer.ts`** (plain assertions, `npx tsx`) covering the risk-bearing pure logic:
- `segment`: paragraph, flat list, nested list, table, mixed, heading→contextLabel association, single-blob fallback, mechanical cleanup (assert wording/order/qualifiers preserved; no merge/dedupe/reorder); headings never emitted as transferable blocks.
- Mapping: block→list; block→table (primary column, others empty); AI-row→list (labelled form, empty cells preserved); AI-row→table (no column mapping; sidecar populated); empty **middle** cell preserved as `[empty]`.
- Model: `hasMeaningfulContent` true/false cases; `isEmptyItem`/`isEmptyRow`; partially-filled row counts as meaningful.
- Commit: atomicity (failure leaves state untouched); append order; multi-section reuse.
- Undo: reverses exact IDs after a reorder; survives a new selection; expires on affected-item edit (no deletion).
- Migration: `v1→v2` assigns IDs losslessly.
- Submission: `toSubmitPayload` strips client IDs + sidecar, filters empties, reproduces the existing API shape; **source table structure can never reach `/api/submit`**; retry uses the latest in-memory draft.

**Manual live-flow checklist** (kept manual because the repo has no component-test harness; mobile needs the user's device — the Chrome tool renders at a fixed ~1633px viewport): desktop full transfer flow; keyboard-only flow; screen-reader labels/announcements; reduced-motion emphasis; sticky bar with a viewport-taller reply; left-column collapse and mid-session re-share; save states incl. a forced failure; mobile full-screen mode, "Updated" marker, tab-switch preservation, browser-back and rotation; and the four-scenario acceptance matrix.

**Four-scenario acceptance matrix** (section names illustrative; derived from config at runtime):
- **Meeting Chaos** (Decisions·list, Action items·table owner/task/due, Open questions·list): bulleted decisions → batch to Decisions; an AI actions **table** → each row a block → Action items, row text in `task`, owner/due empty, **no invented dates/owners auto-filled**; one mixed reply routed to two sections in one session.
- **The Bad Prompt** (Subject·list, Body·list — no tables): subject-options list → Subject; body paragraphs each a block → Body. Exercises list-only + paragraph segmentation.
- **From Ask to Brief** (Positioning·list, Head-to-head·table axis/us/them, Assumptions·list): an AI comparison **table** → rows as blocks → Head to head, text in `axis`, us/them empty → user fills; assumptions → Assumptions. Exercises a 3-column table target.
- **Don't Trust the AI** (Summary·list, Caught & removed·list — no tables): verified lines → Summary; the invented enterprise figure flagged → Caught & removed; **no readiness/structural hint reveals the invented number.**

Verification gate for each phase: `npx tsc --noEmit` clean (never `npm run build` while the user's `next dev` runs) and the relevant `verify-workbench-transfer.ts` cases green.

## Out of Scope

Automatic field/column mapping · a post-transfer "Split item" action · reordering on the selection surface · server-backed / cross-device drafts · an "unedited since captured" nudge · a numeric mobile badge · new analytics events · **any** readiness/quality/completeness guidance before Finish · **any** assessment, judge, rubric, route, or schema change · a timer · broader visual redesign · installing a unit-test framework or an issue tracker. (The source sidecar retains structure so a future *user-driven* cell-mapping stays possible, but that affordance is not built now.)

## Further Notes

- **Preserved, non-negotiable:** inline block selection via **Use in deliverable**; one active response and one destination per commit; repeated commits without leaving selection mode; split-only segmentation with no classification/rewrite/suggestion; editing only in the deliverable; optional raw-selection fallback; shallow Undo by stable ID; atomic commits; no provenance to the deliverable or judge; accessible desktop/mobile/keyboard/screen-reader/reduced-motion behavior; criteria+materials collapse after the first message; config-derived section/create labels; honest device-local save; Finish gated only on meaningful content; empty-entry filtering before submission; validation across all four live scenarios.
- **Unresolved technical risks to watch during build:** (R1) the AI isn't forced to emit markdown, so `segment` may often yield a single block — the single-block fallback is the honest floor; verify against real reply output early. (R2) the sticky bar must bind to the instrument column's scroll region, not the window; verify with a viewport-taller reply. (R3) `v1→v2` migration must be lossless for testers' in-progress drafts. (R4) raw-selection and block checkboxes coexist in one reply during selection mode; interaction precedence needs care. (R5) the editing-model→API transform must reproduce the exact current shape so judge input is unchanged. (R6) resolved by the single shared emptiness predicate.
- **Stop conditions:** proceed through the phases unless code inspection reveals a genuine conflict affecting **data safety, submission compatibility, assessment integrity, or accessibility** — then stop and surface it.
