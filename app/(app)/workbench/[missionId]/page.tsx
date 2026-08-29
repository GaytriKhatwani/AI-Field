"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMission, missionVersion } from "@/lib/missions";
import type { DeliverableField } from "@/lib/missions/types";
import { track, EVENTS } from "@/lib/analytics/client";
import { Arrow, Back, Check } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { segment, type Block } from "@/lib/workbench/segment";
import {
  emptyDeliverable,
  migrateDeliverable,
  toSubmitPayload,
  hasMeaningfulContent,
  newListItem,
  newTableRow,
  commitBlocks,
  undoCommit,
  undoRecordFor,
  DRAFT_VERSION,
  type EditableDeliverable,
  type EditableListItem,
  type EditableTableRow,
  type RowSourceSidecar,
  type UndoRecord,
  type AddedBlockRegistry,
} from "@/lib/workbench/transfer";

const HARD_CEILING = 12;
const UNDO_MS = 8000;
const FLASH_MS = 2200;

type Msg = { id: string; role: "user" | "ai"; text: string; error?: boolean };

// Config-derived creation label: "Add a decision" / "Add an action item",
// singularised from the field label so no mission-specific string lives here.
function singularise(label: string): string {
  const l = label.trim();
  if (/ies$/i.test(l)) return l.replace(/ies$/i, "y");
  if (/ss$/i.test(l)) return l; // "progress" — not a plural
  if (/s$/i.test(l)) return l.replace(/s$/i, "");
  return l;
}
function createLabel(field: DeliverableField): string {
  const s = singularise(field.label);
  if (!s) return field.kind === "table" ? "Add a row" : "Add an item";
  const article = /^[aeiou]/i.test(s) ? "an" : "a";
  return `Add ${article} ${s.toLowerCase()}`;
}

function errorText(code: string | undefined): string {
  switch (code) {
    case "ceiling_reached":
      return "[You've reached this session's message limit. Finish practice when your deliverable is ready.]";
    case "rate_limited":
      return "[You're sending messages too quickly. Wait a moment and try again.]";
    case "unauthenticated":
      return "[Your session expired. Reload the page to continue.]";
    default:
      return "[The AI could not respond. Try again.]";
  }
}

export default function Workbench() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const mission = getMission(params.missionId);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [given, setGiven] = useState<string[]>([]);
  const [openResource, setOpenResource] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Mobile lands on the instrument: you direct the AI before there's anything
  // to curate, and the deliverable starts empty.
  const [mode, setMode] = useState<"instrument" | "deliverable">("instrument");
  const [deliverable, setDeliverable] = useState<EditableDeliverable>(() =>
    mission ? emptyDeliverable(mission.deliverable.fields) : { lists: {}, tables: {} },
  );
  // Ephemeral, session-only provenance for transferred table rows (SPEC): never
  // persisted, structurally unable to reach the submit payload.
  const sidecarRef = useRef<RowSourceSidecar>({});
  // Which block produced each transferred entry (entryId → block + section). Lets
  // removing an entry — by hand or via Undo — free that block's section
  // membership so it can be transferred again. Session-only, like addedBlocks.
  const entryOriginRef = useRef<Record<string, { blockId: string; fieldId: string }>>({});
  // The duplicate-commit guard's live value (blockId → field ids already holding
  // it), enforced inside commitBlocks/undoCommit themselves — not just a UI
  // pre-filter. A ref, not state: commit() reads it synchronously so two calls
  // in the same tick (e.g. a fast double-click) can never both see a stale
  // "not yet added" snapshot. `addedBlocks` state below mirrors it for render.
  const addedBlocksRef = useRef<AddedBlockRegistry>({});

  const idRef = useRef(0);

  // ---- block-level selection ----
  // One AI reply is in selection mode at a time; `checked` holds the chosen
  // block ids within it. The sticky action bar commits a batch to one section
  // and the user keeps selecting without leaving the mode.
  const [selecting, setSelecting] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [switchTo, setSwitchTo] = useState<string | null>(null);

  // ---- feedback + shallow Undo ----
  // record.blockIds/record.fieldId (from undoRecordFor) let Undo also reverse
  // the duplicate-guard registry for the exact blocks this commit transferred,
  // re-opening them for re-adding to that same field.
  const [undo, setUndo] = useState<{
    record: UndoRecord;
    label: string;
    count: number;
  } | null>(null);
  const [flashItems, setFlashItems] = useState<Set<string>>(new Set());
  const [flashField, setFlashField] = useState<string | null>(null);
  const [updatedMarker, setUpdatedMarker] = useState(false);
  // While the Undo control is focused, its expiry pauses so a keyboard user
  // can reach it without it vanishing (SPEC §7.1).
  const [undoFocused, setUndoFocused] = useState(false);
  // On leaving selection mode, return focus to the reply's action (SPEC §7.1).
  const [refocusMsgId, setRefocusMsgId] = useState<string | null>(null);

  // ---- raw-selection precision fallback ----
  const [capture, setCapture] = useState<{ text: string; x: number; y: number } | null>(null);

  // ---- left-column collapse ----
  const [collapseMatters, setCollapseMatters] = useState(false);
  const [collapseMaterials, setCollapseMaterials] = useState(false);
  const collapsedOnce = useRef(false);

  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Render-facing mirror of addedBlocksRef (React state can't be read
  // synchronously by commit(), so the ref is the actual guard — see above).
  // Powers the "already added" marker in selection mode and the destination
  // menu's disabled/marked state. Session-only, reversed on Undo; never
  // persisted and structurally unable to reach the deliverable or submit payload.
  const [addedBlocks, setAddedBlocks] = useState<AddedBlockRegistry>({});
  // one polite live region drives every screen-reader status announcement.
  const [announce, setAnnounce] = useState("");

  const transcriptRef = useRef<HTMLOListElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // First-visit-only orientation cue.
  const [showGuide, setShowGuide] = useState(false);
  const [restored, setRestored] = useState(false);
  const draftKey = `aifield:wb:${params.missionId}`;

  useEffect(() => {
    try {
      if (localStorage.getItem("aifield.wbGuideSeen") !== "1") setShowGuide(true);
    } catch {
      /* private mode — just skip the cue */
    }
  }, []);

  function dismissGuide() {
    try {
      localStorage.setItem("aifield.wbGuideSeen", "1");
    } catch {
      /* ignore */
    }
    setShowGuide(false);
  }

  // ---- Undo lifecycle ----
  // Undo expires ~8s after the commit that set it (SPEC user story 14/15). It is
  // replaced by a new commit and cleared on navigation (unmount) and on editing an
  // affected item — see those handlers. It deliberately SURVIVES ordinary selection
  // changes, including leaving selection mode with Done, so the 8s window is the
  // sole gate. While the Undo control is focused, expiry pauses (timer not
  // scheduled).
  useEffect(() => {
    if (!undo || undoFocused) return;
    const t = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, undoFocused]);

  // Escape exits selection mode (SPEC §7.1). Bound only while a reply is in
  // selection mode; focus return is handled by the refocus effect below. Guarded
  // so it never fires while the switch-response prompt or a menu is the concern.
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (addOpen) {
          setAddOpen(false);
          return;
        }
        doneSelecting();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecting, addOpen]);

  // After leaving selection mode, move focus back to that reply's "Use in
  // deliverable" action, so a keyboard user lands where they were (SPEC §7.1).
  useEffect(() => {
    if (selecting || !refocusMsgId) return;
    const btn = document.querySelector<HTMLButtonElement>(
      `[data-use-btn="${refocusMsgId}"]`,
    );
    btn?.focus();
    setRefocusMsgId(null);
  }, [selecting, refocusMsgId]);

  // clear the new-item emphasis after it plays (works under reduced motion too,
  // since it's a state change, not a CSS animation).
  useEffect(() => {
    if (flashItems.size === 0 && flashField === null) return;
    const t = setTimeout(() => {
      setFlashItems(new Set());
      setFlashField(null);
    }, FLASH_MS);
    return () => clearTimeout(t);
  }, [flashItems, flashField]);

  // the raw-selection toolbar is anchored to viewport coords — dismiss on layout
  // shift or Escape; move focus into it on open so it's keyboard-reachable.
  useEffect(() => {
    if (!capture) return;
    captureRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = () => setCapture(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCapture(null);
        transcriptRef.current?.focus();
      }
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [capture]);

  // rehydrate a saved draft once on mount. Accepts both the legacy v1 envelope
  // (bare deliverable) and the current v2 (editable, with ids); migrateDeliverable
  // assigns ids to a v1 draft losslessly and preserves them for v2.
  useEffect(() => {
    if (!mission) {
      setRestored(true);
      return;
    }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && (d.v === 1 || d.v === DRAFT_VERSION)) {
          if (typeof d.attemptId === "string") setAttemptId(d.attemptId);
          if (Array.isArray(d.messages)) {
            setMessages(d.messages);
            idRef.current = d.messages.length;
          }
          if (Array.isArray(d.given)) setGiven(d.given);
          if (d.deliverable) {
            setDeliverable(migrateDeliverable(d.deliverable, mission.deliverable.fields));
          }
        }
      }
    } catch {
      /* private mode / quota / malformed draft — start clean */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // persist once restore has run and the AI isn't mid-stream. Honest device-local
  // save: on success flag "saved"; on failure flag "error" so the UI can warn.
  // The ephemeral sidecar is deliberately not persisted.
  useEffect(() => {
    if (!restored || thinking || submitting) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ v: DRAFT_VERSION, attemptId, messages, given, deliverable }),
      );
      // The write already happened; show a brief "Saving…" that settles into
      // "Saved on this device" beside the deliverable title. While the user keeps
      // typing, deps change and the timer restarts, so it reads "Saving…" until
      // ~600ms after the last change.
      setSaveState("saving");
      const t = setTimeout(() => setSaveState("saved"), 600);
      return () => clearTimeout(t);
    } catch {
      setSaveState("error");
    }
  }, [restored, thinking, submitting, attemptId, messages, given, deliverable, draftKey]);

  // Auto-collapse "What matters" and "Materials" once, after the conversation
  // starts, so the transcript becomes the primary surface. Manual toggles after.
  useEffect(() => {
    if (collapsedOnce.current) return;
    if (messages.length > 0) {
      collapsedOnce.current = true;
      setCollapseMatters(true);
      setCollapseMaterials(true);
    }
  }, [messages.length]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const atCeiling = userTurns >= HARD_CEILING;

  // The blocks of the reply currently in selection mode (mechanical split).
  const selectingText = selecting ? messages.find((m) => m.id === selecting)?.text ?? "" : "";
  const blocks = useMemo<Block[]>(
    () => (selecting ? segment(selecting, selectingText) : []),
    [selecting, selectingText],
  );

  if (!mission) {
    return (
      <main className="mx-auto max-w-reading px-6 py-24">
        <p className="text-ink-2">That scenario isn&rsquo;t available.</p>
        <button className="btn--quiet mt-4" onClick={() => router.push("/field")}>
          Back to the Field
        </button>
      </main>
    );
  }

  const spec = mission.deliverable;
  const canFinish = hasMeaningfulContent(deliverable);

  function giveResource(id: string) {
    if (given.includes(id)) return;
    track(EVENTS.RESOURCE_ATTACHED, {
      mission_id: mission!.id,
      mission_version: missionVersion(mission!),
      resource_id: id,
      ...(attemptId ? { attempt_id: attemptId } : {}),
    });
    setGiven((g) => (g.includes(id) ? g : [...g, id]));
  }
  function ungiveResource(id: string) {
    setGiven((g) => g.filter((x) => x !== id));
  }

  async function send() {
    const text = draft.trim();
    if (!text || thinking || atCeiling) return;
    const userMsg: Msg = { id: `u_${++idRef.current}`, role: "user", text };
    const aiId = `a_${++idRef.current}`;
    setMessages((m) => [...m, userMsg, { id: aiId, role: "ai", text: "" }]);
    setDraft("");
    setThinking(true);

    try {
      const res = await fetch("/api/workbench", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          missionId: mission!.id,
          message: text,
          givenResourceIds: given,
        }),
      });

      const hdr = res.headers.get("X-Attempt-Id");
      if (hdr) setAttemptId((a) => a ?? hdr);

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setMessages((m) =>
          m.map((x) => (x.id === aiId ? { ...x, text: errorText(err.error), error: true } : x)),
        );
        return;
      }

      const aid = attemptId ?? hdr;
      if (aid) {
        track(EVENTS.WORKBENCH_MESSAGE_SENT, {
          mission_id: mission!.id,
          mission_version: missionVersion(mission!),
          attempt_id: aid,
          turn_index: userTurns + 1,
        });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, text: acc } : x)));
      }
    } catch {
      setMessages((m) =>
        m.map((x) => (x.id === aiId ? { ...x, text: errorText(undefined), error: true } : x)),
      );
    } finally {
      setThinking(false);
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // exact existing API shape — ids/sidecar stripped, empties filtered.
        body: JSON.stringify({
          attemptId,
          missionId: mission!.id,
          deliverable: toSubmitPayload(deliverable),
        }),
      });
      const data = await res.json().catch(() => ({}));
      const id = res.ok ? (data.attemptId ?? attemptId) : null;
      if (!id) {
        setSubmitError(
          "Couldn't finish practice just now. Your work is safe — try again in a moment.",
        );
        setAnnounce("Couldn't finish practice. Try again.");
        setSubmitting(false);
        return;
      }
      track(EVENTS.DELIVERABLE_SUBMITTED, {
        mission_id: mission!.id,
        mission_version: missionVersion(mission!),
        attempt_id: id,
      });
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      router.push(`/evaluating?attemptId=${id}`);
    } catch {
      setSubmitError(
        "Couldn't start your practice review. Your work is safe — check your connection and try again.",
      );
      setAnnounce("Couldn't finish practice. Try again.");
      setSubmitting(false);
    }
  }

  // ---- selection mode ----
  function useInDeliverable(messageId: string) {
    if (selecting && selecting !== messageId && checked.size > 0) {
      setSwitchTo(messageId); // ask before dropping an uncommitted selection
      return;
    }
    setSelecting(messageId);
    setChecked(new Set());
    setAddOpen(false);
  }
  function confirmSwitch(discard: boolean) {
    if (discard && switchTo) {
      setSelecting(switchTo);
      setChecked(new Set());
      setAddOpen(false);
    }
    setSwitchTo(null);
  }
  function toggleBlock(id: string) {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function selectAll() {
    setChecked(new Set(blocks.map((b) => b.id)));
  }
  function clearChecked() {
    setChecked(new Set());
  }
  function doneSelecting() {
    if (selecting) setRefocusMsgId(selecting); // return focus to the reply's action
    setSelecting(null);
    setChecked(new Set());
    setAddOpen(false);
    // Undo is intentionally NOT cleared here — it survives leaving selection mode.
  }

  // Land a batch (or a single synthetic raw-selection block) into one section,
  // atomically, and set up feedback + Undo. Shared by block selection and the
  // raw-selection fallback so they can never drift apart. The duplicate guard
  // is enforced INSIDE commitBlocks itself (keyed by block id, never text) —
  // reading addedBlocksRef.current, not the `addedBlocks` state, so two calls
  // in the same tick can't both act on a stale "not yet added" snapshot.
  function commit(chosen: Block[], field: DeliverableField, opts?: { fromSelection?: boolean }) {
    if (chosen.length === 0) return;
    try {
      const res = commitBlocks(deliverable, sidecarRef.current, addedBlocksRef.current, chosen, field);
      if (res.addedIds.length === 0) {
        // Every chosen block was already committed to this exact section — the
        // commit logic rejected them, not just a UI pre-filter.
        setAnnounce(
          `Already added to ${field.label}${chosen.length > 1 ? " — nothing new to add" : ""}.`,
        );
        if (opts?.fromSelection) setAddOpen(false);
        return;
      }
      setDeliverable(res.deliverable);
      sidecarRef.current = res.sidecar;
      addedBlocksRef.current = res.registry;
      setAddedBlocks(res.registry);
      // Pair each new entry with its source block so a later removal frees it.
      for (const { entryId, blockId } of res.origins) {
        entryOriginRef.current[entryId] = { blockId, fieldId: field.id };
      }
      setUndo({ record: undoRecordFor(res), label: field.label, count: res.addedIds.length });
      setFlashItems(new Set(res.addedIds));
      setFlashField(field.id);
      setAnnounce(`Added ${res.addedIds.length} to ${field.label}.`);
      if (opts?.fromSelection) {
        setChecked(new Set()); // clear selection, stay in the mode
        setAddOpen(false);
      }
      if (mode === "instrument") setUpdatedMarker(true); // mobile: don't yank away
      requestAnimationFrame(() =>
        fieldRefs.current[field.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
      );
    } catch {
      // atomic: the deliverable and selection are untouched on failure.
      setAnnounce("Couldn't add those just now. Your selection is safe — try again.");
    }
  }
  function commitCheckedTo(field: DeliverableField) {
    const chosen = blocks.filter((b) => checked.has(b.id));
    commit(chosen, field, { fromSelection: true });
  }

  function doUndo() {
    if (!undo) return;
    const res = undoCommit(deliverable, sidecarRef.current, addedBlocksRef.current, undo.record);
    setDeliverable(res.deliverable);
    sidecarRef.current = res.sidecar;
    addedBlocksRef.current = res.registry;
    setAddedBlocks(res.registry);
    for (const id of undo.record.addedIds) delete entryOriginRef.current[id];
    setUndo(null);
  }

  // Free a removed entry's block, so a block deleted from the deliverable by hand
  // can be transferred again (otherwise the dedupe would wrongly keep blocking it).
  function freeBlockFor(entryId: string) {
    const origin = entryOriginRef.current[entryId];
    if (!origin) return;
    delete entryOriginRef.current[entryId];
    const { blockId, fieldId } = origin;
    const fields = addedBlocksRef.current[blockId];
    if (!fields) return;
    const remaining = fields.filter((f) => f !== fieldId);
    const next = { ...addedBlocksRef.current };
    if (remaining.length > 0) next[blockId] = remaining;
    else delete next[blockId];
    addedBlocksRef.current = next;
    setAddedBlocks(next);
  }

  // ---- raw-selection precision fallback ----
  function readSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !transcriptRef.current) {
      setCapture(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) {
      setCapture(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    const aiMsg = el?.closest('[data-role="ai"]');
    if (!aiMsg || !transcriptRef.current.contains(aiMsg)) {
      setCapture(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setCapture({ text, x: rect.left + rect.width / 2, y: rect.top });
  }
  function useRawSelectionInto(field: DeliverableField) {
    if (!capture) return;
    // one temporary synthetic block through the same commit/Undo path.
    const synthetic: Block = { id: `raw:${idRef.current}`, kind: "text", text: capture.text };
    commit([synthetic], field);
    setCapture(null);
    window.getSelection()?.removeAllRanges();
    transcriptRef.current?.focus();
  }

  // ---- deliverable editors (id-based) ----
  function editInvalidatesUndo(id: string) {
    if (undo && undo.record.addedIds.includes(id)) setUndo(null);
  }
  function updateListItem(fieldId: string, id: string, value: string) {
    editInvalidatesUndo(id);
    setDeliverable((d) => ({
      ...d,
      lists: {
        ...d.lists,
        [fieldId]: d.lists[fieldId].map((i) => (i.id === id ? { ...i, text: value } : i)),
      },
    }));
  }
  function addListItem(fieldId: string) {
    setDeliverable((d) => ({
      ...d,
      lists: { ...d.lists, [fieldId]: [...d.lists[fieldId], newListItem("")] },
    }));
  }
  function removeListItem(fieldId: string, id: string) {
    delete sidecarRef.current[id];
    freeBlockFor(id);
    setDeliverable((d) => ({
      ...d,
      lists: { ...d.lists, [fieldId]: d.lists[fieldId].filter((i) => i.id !== id) },
    }));
  }
  function updateCell(fieldId: string, id: string, col: string, value: string) {
    editInvalidatesUndo(id);
    setDeliverable((d) => ({
      ...d,
      tables: {
        ...d.tables,
        [fieldId]: d.tables[fieldId].map((r) =>
          r.id === id ? { ...r, cells: { ...r.cells, [col]: value } } : r,
        ),
      },
    }));
  }
  function addRow(fieldId: string, cols: string[]) {
    setDeliverable((d) => ({
      ...d,
      tables: { ...d.tables, [fieldId]: [...d.tables[fieldId], newTableRow(cols)] },
    }));
  }
  function removeRow(fieldId: string, id: string) {
    delete sidecarRef.current[id];
    freeBlockFor(id);
    setDeliverable((d) => ({
      ...d,
      tables: { ...d.tables, [fieldId]: d.tables[fieldId].filter((r) => r.id !== id) },
    }));
  }

  const hint = useMemo(() => {
    if (atCeiling)
      return "You've reached this session's message limit. Finish practice when your deliverable is ready.";
    if (userTurns > 8)
      return "Past the usual 4–8 messages — that's fine. Finish when your deliverable holds up.";
    return "Most people finish in 4–8 messages.";
  }, [atCeiling, userTurns]);

  const checkedCount = checked.size;
  // True once every currently checked block is already in that field — lets a
  // destination control mark/disable itself instead of silently no-opping the
  // click (SPEC: the commit logic rejects the repeat either way; this is the
  // UI's honest reflection of that, not the enforcement).
  function allCheckedAlreadyIn(fieldId: string): boolean {
    if (checkedCount === 0) return false;
    for (const id of checked) {
      if (!(addedBlocks[id] ?? []).includes(fieldId)) return false;
    }
    return true;
  }

  return (
    <main className="flex h-screen [height:100dvh] flex-col overflow-hidden">
      <a href="#composer" className="skip-link">
        Skip to the composer
      </a>
      {/* orientation bar — persistent */}
      <header className="flex flex-none items-center gap-4 border-b border-hairline px-[clamp(1rem,3vw,1.75rem)] py-3">
        <button
          type="button"
          onClick={() => router.push("/field")}
          aria-label="Leave the workbench"
          className="-ml-2.5 flex h-11 w-11 flex-none items-center justify-center text-ink-3 transition-colors hover:text-accent"
        >
          <Back />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col lg:flex-row lg:items-baseline lg:gap-3">
            <h1 className="heading m-0 whitespace-nowrap text-[1.05rem] text-ink">
              {mission.title}
            </h1>
            {/* task description is redundant across the whole tabbed range (mobile
                and tablet) — only the two-pane desktop layout has room for it */}
            <span
              title={mission.briefing.objective}
              className="hidden truncate text-[0.85rem] text-ink-2 lg:block"
            >
              {mission.briefing.objective}
            </span>
          </div>
        </div>
        {/* theme control relocated off the header for the whole tabbed range (mobile
            and tablet) to keep it to back/title/Finish */}
        <span className="hidden lg:inline-flex">
          <ThemeToggle />
        </span>
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setConfirming(true);
          }}
          disabled={submitting || confirming || !canFinish}
          title={canFinish ? undefined : "Add something to your deliverable before finishing."}
          className="btn flex-none"
          style={{ padding: "0.6em 1.2em", fontSize: "0.9rem" }}
        >
          {submitting ? "Finishing…" : "Finish practice"}
          <Arrow className="arr" width={15} />
        </button>
      </header>

      {/* first-visit orientation cue */}
      {showGuide && (
        <div className="flex flex-none flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline bg-raised px-[clamp(1rem,3vw,1.75rem)] py-2.5 animate-fadeUp">
          <p className="meta flex-none text-ink-2">How the Workbench works</p>
          <ol className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 list-none p-0 text-[0.82rem] leading-snug text-ink">
            {[
              "Choose useful materials",
              "Ask the AI for help",
              "Check and improve its work",
              "Build your deliverable",
            ].map((s, i) => (
              <li key={s} className="flex items-baseline gap-1.5">
                <span aria-hidden className="num text-ink-3">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <button type="button" onClick={dismissGuide} className="btn--quiet flex-none">
            Got it
          </button>
        </div>
      )}

      {/* finish confirmation */}
      {confirming && (
        <div className="flex flex-none flex-wrap items-center gap-x-5 gap-y-3 border-b border-hairline bg-raised px-[clamp(1rem,3vw,1.75rem)] py-3 animate-fadeUp">
          <p className="min-w-0 flex-1 text-[0.9rem] leading-snug text-ink">
            <span className="font-semibold">Ready to finish?</span>{" "}
            <span className="text-ink-2">
              Your deliverable will be reviewed along with how you worked — you
              can&rsquo;t edit it afterward.
            </span>
          </p>
          {submitError && (
            <p role="alert" className="w-full text-[0.85rem] leading-snug" style={{ color: "var(--warn)" }}>
              {submitError}
            </p>
          )}
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setSubmitError(null);
              }}
              disabled={submitting}
              className="btn--ghost"
              style={{ padding: "0.5em 1em", fontSize: "0.85rem" }}
            >
              Keep working
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="btn flex-none"
              style={{ padding: "0.55em 1.1em", fontSize: "0.85rem" }}
            >
              {submitting ? "Finishing…" : submitError ? "Try again" : "Finish and review"}
              <Arrow className="arr" width={14} />
            </button>
          </div>
        </div>
      )}

      {/* finish gate — a calm, quiet line while the deliverable has no real
          content, explaining the disabled Finish. Clears once content exists. */}
      {!canFinish && !confirming && (
        <div
          role="status"
          className="flex flex-none items-center border-b border-hairline px-[clamp(1rem,3vw,1.75rem)] py-2"
        >
          <p className="text-[0.82rem] leading-snug text-ink-2">
            Add something to your deliverable before finishing.
          </p>
        </div>
      )}

      {/* device-local save failure — persistent until it recovers */}
      {saveState === "error" && (
        <div
          role="alert"
          className="flex flex-none items-center gap-3 border-b border-l-2 border-hairline bg-raised px-[clamp(1rem,3vw,1.75rem)] py-2"
          style={{ borderLeftColor: "var(--warn)" }}
        >
          <p className="min-w-0 flex-1 text-[0.82rem] leading-snug" style={{ color: "var(--warn)" }}>
            This device couldn&rsquo;t save your latest changes. Keep this tab open
            and finish practice when you&rsquo;re ready.
          </p>
        </div>
      )}

      {/* mode switch — tabbed through tablet; two panes appear only at lg (≥1024px) */}
      <div className="flex flex-none border-b border-hairline lg:hidden">
        {(["deliverable", "instrument"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              if (m === "deliverable") setUpdatedMarker(false);
            }}
            aria-pressed={mode === m}
            aria-controls={m === "deliverable" ? "deliverable-panel" : "instrument-panel"}
            className="relative flex-1 py-2.5 text-[0.75rem] font-semibold uppercase tracking-[0.12em] transition-colors aria-[pressed=true]:text-ink text-ink-2"
            style={{
              boxShadow:
                mode === m ? "inset 0 -2px 0 var(--accent)" : "inset 0 -2px 0 transparent",
            }}
          >
            {m === "deliverable" ? "Deliverable" : "Work with AI"}
            {m === "deliverable" && updatedMarker && mode !== "deliverable" && (
              <span
                aria-label="Updated"
                className="absolute right-3 top-2 h-2 w-2 rounded-full"
                style={{ background: "var(--accent)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* working regions */}
      <div className="grid min-h-0 flex-1 grid-rows-1 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        {/* INSTRUMENT column */}
        <section
          id="instrument-panel"
          className={`min-h-0 flex-col border-hairline lg:flex lg:border-r ${
            mode === "instrument" ? "flex" : "hidden lg:flex"
          }`}
          aria-label="Materials and the AI"
        >
          <div
            className="min-h-0 flex-1 overflow-y-auto px-[clamp(1rem,2.5vw,1.5rem)] py-5"
            onScroll={() => capture && setCapture(null)}
          >
            {/* working rules — collapsible after the conversation starts */}
            {mission.briefing.constraints.length > 0 && (
              <div className="mb-7">
                <button
                  type="button"
                  onClick={() => setCollapseMatters((v) => !v)}
                  aria-expanded={!collapseMatters}
                  className="mb-2.5 flex w-full items-center gap-2 text-left"
                >
                  <h2 className="section-label m-0">What matters</h2>
                  {collapseMatters && (
                    <span className="meta text-ink-3">({mission.briefing.constraints.length})</span>
                  )}
                  <span
                    aria-hidden
                    className="ml-auto text-ink-3 transition-transform"
                    style={{ transform: collapseMatters ? "rotate(0deg)" : "rotate(90deg)" }}
                  >
                    ›
                  </span>
                </button>
                {!collapseMatters && (
                  <ul className="m-0 list-none space-y-1.5 p-0">
                    {mission.briefing.constraints.map((c, i) => (
                      <li key={i} className="flex gap-2.5 text-[0.82rem] leading-snug text-ink-2">
                        <span
                          aria-hidden
                          className="mt-[0.5em] h-[4px] w-[4px] flex-none rounded-full bg-ink-3"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* materials — collapsible; expandable mid-session to share/remove */}
            <button
              type="button"
              onClick={() => setCollapseMaterials((v) => !v)}
              aria-expanded={!collapseMaterials}
              className="mb-2 flex w-full items-center gap-2 text-left"
            >
              <h2 className="section-label m-0">Materials</h2>
              {collapseMaterials && (
                <span className="meta text-ink-3">
                  {given.length > 0 ? `${given.length} shared` : "none shared"}
                </span>
              )}
              <span
                aria-hidden
                className="ml-auto text-ink-3 transition-transform"
                style={{ transform: collapseMaterials ? "rotate(0deg)" : "rotate(90deg)" }}
              >
                ›
              </span>
            </button>
            {!collapseMaterials && (
              <>
                <p className="mb-4 max-w-[42ch] text-[0.82rem] leading-snug text-ink-2">
                  Choose what the AI needs. It only receives the materials you share
                  with it.
                </p>
                <ul className="m-0 list-none space-y-2 p-0">
                  {mission.resources.map((r) => {
                    const isGiven = given.includes(r.id);
                    const isOpen = openResource === r.id;
                    return (
                      <li key={r.id} className="rounded-sm border border-hairline bg-raised">
                        <div className="flex items-start gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => setOpenResource(isOpen ? null : r.id)}
                            className="min-w-0 flex-1 text-left"
                            aria-expanded={isOpen}
                          >
                            <span className="block text-[0.95rem] font-semibold text-ink">
                              {r.label}
                            </span>
                            <span className="mt-0.5 block text-[0.82rem] leading-snug text-ink-2">
                              {r.summary}
                            </span>
                          </button>
                          {isGiven ? (
                            <button
                              type="button"
                              onClick={() => ungiveResource(r.id)}
                              aria-label={`Remove ${r.label} from the AI`}
                              title="Remove from AI"
                              className="group/give flex min-h-[44px] flex-none items-center gap-[0.5ch] whitespace-nowrap rounded-sm px-1.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.09em] transition-colors hover:text-ink"
                              style={{ color: "var(--good)" }}
                            >
                              <Check width={12} height={10} />
                              <span className="group-hover/give:hidden">Shared with AI</span>
                              <span className="hidden group-hover/give:inline">Remove from AI</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => giveResource(r.id)}
                              aria-label={`Share ${r.label} with the AI`}
                              className="btn btn--ghost flex-none"
                              style={{ padding: "0.5em 0.85em", fontSize: "0.8rem", minHeight: "44px" }}
                            >
                              Share with AI
                            </button>
                          )}
                        </div>
                        {isOpen && (
                          <pre className="m-0 max-h-56 overflow-auto border-t border-hairline px-3 py-3 font-sans text-[0.82rem] leading-relaxed text-ink-2 whitespace-pre-wrap">
                            {r.content}
                          </pre>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* work with the AI / transcript */}
            <h2 className="section-label mb-1.5 mt-8">Work with the AI</h2>
            <p className="mb-3 max-w-[42ch] text-[0.82rem] leading-snug text-ink-2">
              Tell the AI what you need. It will follow your instructions, but it
              won&rsquo;t fill in missing context or correct weak decisions for you.
            </p>
            <div className="min-h-0">
              {messages.length === 0 && !thinking ? null : (
                <ol
                  ref={transcriptRef}
                  onMouseUp={readSelection}
                  onKeyUp={readSelection}
                  tabIndex={-1}
                  role="log"
                  aria-live="polite"
                  aria-busy={thinking}
                  aria-label="Your exchange with the AI"
                  className="m-0 list-none space-y-4 p-0 outline-none"
                >
                  {messages.map((m, mi) => {
                    // A reply is selectable only once it's finished — never while
                    // it's still streaming (the last message during `thinking`).
                    const streaming = thinking && mi === messages.length - 1;
                    const complete = m.role === "ai" && !m.error && m.text.length > 0 && !streaming;
                    const inSelection = selecting === m.id;
                    return (
                      <li key={m.id} data-role={m.role} className="animate-fadeUp">
                        <span
                          className="meta"
                          style={{
                            color: m.error
                              ? "var(--warn)"
                              : m.role === "user"
                                ? "var(--accent)"
                                : "var(--ink-3)",
                          }}
                        >
                          {m.error ? "Couldn't respond" : m.role === "user" ? "You" : "AI"}
                        </span>
                        {m.text ? (
                          m.error ? (
                            <p
                              role="alert"
                              className="mt-1 text-[0.9rem] italic leading-relaxed"
                              style={{ color: "var(--ink-2)" }}
                            >
                              {m.text.replace(/^\[|\]$/g, "")}
                            </p>
                          ) : inSelection ? (
                            <SelectionView
                              blocks={blocks}
                              checked={checked}
                              onToggle={toggleBlock}
                              added={addedBlocks}
                              fields={spec.fields}
                            />
                          ) : (
                            <>
                              <p className="mt-1 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-ink">
                                {m.text}
                              </p>
                              {m.role === "ai" &&
                                complete &&
                                (switchTo === m.id ? (
                                  <span className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-sm border border-hairline bg-raised p-2 text-[0.82rem]">
                                    <span className="text-ink-2">
                                      You have an unsent selection.
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => confirmSwitch(false)}
                                      className="btn--ghost"
                                      style={{ padding: "0.35em 0.7em", fontSize: "0.8rem" }}
                                    >
                                      Keep selecting from that response
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => confirmSwitch(true)}
                                      className="btn"
                                      style={{ padding: "0.35em 0.7em", fontSize: "0.8rem" }}
                                    >
                                      Discard selection and switch
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    data-use-btn={m.id}
                                    onClick={() => useInDeliverable(m.id)}
                                    className="mt-1.5 inline-flex min-h-[24px] items-center py-1 text-[0.78rem] font-semibold text-ink-3 transition-colors hover:text-accent"
                                  >
                                    + Use in deliverable
                                  </button>
                                ))}
                            </>
                          )
                        ) : (
                          <p className="mt-1 flex items-center gap-1.5">
                            <span className="sr-only" role="status">
                              The AI is responding…
                            </span>
                            <span
                              aria-hidden
                              className="hidden text-[0.82rem] italic text-ink-3 motion-reduce:inline"
                            >
                              Thinking…
                            </span>
                            {[0, 1, 2].map((i) => (
                              <span
                                key={i}
                                aria-hidden
                                className="h-[6px] w-[6px] rounded-full bg-ink-3 animate-breathe motion-reduce:hidden"
                                style={{ animationDelay: `${i * 0.18}s` }}
                              />
                            ))}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>

          {/* commit feedback + shallow Undo — its own row so it's reachable after
              a raw-selection commit too, not only inside selection mode */}
          {undo && (
            <div className="flex-none border-t border-hairline bg-raised px-[clamp(1rem,2.5vw,1.5rem)] py-2">
              <div
                className="flex items-center gap-3 rounded-sm px-2 py-1.5 text-[0.82rem]"
                style={{ background: "color-mix(in oklab, var(--accent) 10%, transparent)" }}
              >
                <span className="min-w-0 flex-1 text-ink-2">
                  Added {undo.count} to <span className="font-semibold text-ink">{undo.label}</span>.
                </span>
                <button
                  type="button"
                  onClick={doUndo}
                  onFocus={() => setUndoFocused(true)}
                  onBlur={() => setUndoFocused(false)}
                  className="flex-none font-semibold text-accent hover:underline"
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {/* sticky selection action bar — flex-none, bound to this column so it
              stays reachable while a tall reply scrolls above it. On tablet/mobile
              the destinations become full-width buttons and the composer collapses
              so selecting is the clear, single task. */}
          {selecting && (
            <div className="flex-none border-t border-hairline bg-raised px-[clamp(1rem,2.5vw,1.5rem)] py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[0.9rem] font-semibold text-ink"
                  role="status"
                  aria-live="polite"
                >
                  {checkedCount > 0 ? `${checkedCount} selected` : "Select the parts you want"}
                </span>
                <button
                  type="button"
                  onClick={checkedCount === blocks.length ? clearChecked : selectAll}
                  className="btn--ghost"
                  style={{ padding: "0.4em 0.75em", fontSize: "0.82rem", minHeight: "40px" }}
                >
                  {checkedCount === blocks.length && blocks.length > 0 ? "Clear" : "Select all"}
                </button>

                {/* desktop: a compact destination menu */}
                <div className="relative hidden lg:block">
                  <button
                    type="button"
                    onClick={() => setAddOpen((v) => !v)}
                    disabled={checkedCount === 0}
                    aria-haspopup="true"
                    aria-expanded={addOpen}
                    aria-label={
                      checkedCount > 0
                        ? `Add ${checkedCount} selected block${checkedCount > 1 ? "s" : ""} to a deliverable section`
                        : "Add selected blocks to a deliverable section"
                    }
                    className="btn"
                    style={{ padding: "0.4em 0.85em", fontSize: "0.82rem", minHeight: "40px" }}
                  >
                    Add to…
                  </button>
                  {addOpen && checkedCount > 0 && (
                    <div className="absolute bottom-full left-0 z-10 mb-1 min-w-[12rem] rounded-sm border border-hairline bg-raised p-1 shadow-layer">
                      {spec.fields.map((f) => {
                        const already = allCheckedAlreadyIn(f.id);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => commitCheckedTo(f)}
                            disabled={already}
                            aria-disabled={already}
                            className={`flex w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left text-[0.85rem] font-medium transition-colors ${
                              already
                                ? "cursor-not-allowed text-ink-3"
                                : "text-ink hover:bg-accent hover:text-on-accent"
                            }`}
                          >
                            <span>{f.label}</span>
                            {already && (
                              <span
                                className="inline-flex flex-none items-center gap-[0.4ch] text-[0.72rem] font-semibold"
                                style={{ color: "var(--good)" }}
                              >
                                <Check width={10} height={8} />
                                Added
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={doneSelecting}
                  className="btn--quiet ml-auto text-[0.82rem]"
                  style={{ minHeight: "40px" }}
                >
                  Done selecting
                </button>
              </div>

              {/* tablet/mobile: prominent full-width destination controls */}
              <div className="mt-2.5 grid grid-cols-1 gap-1.5 lg:hidden">
                {spec.fields.map((f) => {
                  const already = allCheckedAlreadyIn(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => commitCheckedTo(f)}
                      disabled={checkedCount === 0 || already}
                      className={`btn w-full justify-center ${already ? "opacity-60" : ""}`}
                      style={{ padding: "0.7em 1em", fontSize: "0.85rem" }}
                    >
                      {already
                        ? `Already added to ${f.label}`
                        : checkedCount > 0
                          ? `Add ${checkedCount} to ${f.label}`
                          : `Add to ${f.label}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* composer — collapses on tablet/mobile while selecting, so selection
              mode is the single clear task; always present on the two-pane desktop */}
          <div
            className={`flex-none border-t border-hairline bg-ground px-[clamp(1rem,2.5vw,1.5rem)] py-3 ${
              selecting ? "hidden lg:block" : ""
            }`}
          >
            <div className="flex items-end gap-2 rounded-sm border border-hairline bg-raised p-2 focus-within:border-accent">
              <textarea
                id="composer"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                disabled={atCeiling}
                aria-label="Tell the AI what you need"
                placeholder={atCeiling ? "Message limit reached." : "Tell the AI what you need…"}
                className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1 text-[0.92rem] leading-relaxed text-ink outline-none placeholder:text-ink-3 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || thinking || atCeiling}
                aria-label="Send instruction"
                className="btn flex-none"
                style={{ padding: "0.6em 0.9em" }}
              >
                <Arrow className="arr" width={16} />
              </button>
            </div>
            <p
              className="mt-2 text-[0.78rem] leading-snug"
              style={{ color: atCeiling ? "var(--warn)" : "var(--ink-3)" }}
            >
              {hint}
            </p>
          </div>
        </section>

        {/* DELIVERABLE column */}
        <section
          id="deliverable-panel"
          className={`min-h-0 flex-col overflow-y-auto bg-ground px-[clamp(1rem,3vw,2.25rem)] py-6 lg:flex ${
            mode === "deliverable" ? "flex" : "hidden lg:flex"
          }`}
          aria-label="Your deliverable"
        >
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="section-label mb-1">You&rsquo;re building</p>
              <h2 className="heading text-[1.4rem] text-ink">{spec.title}</h2>
            </div>
            {(saveState === "saving" || saveState === "saved") && (
              <span
                className="flex-none text-[0.78rem] font-medium text-ink-2"
                title={saveState === "saving" ? "Saving…" : "Saved on this device only"}
                aria-label={saveState === "saving" ? "Saving…" : "Saved on this device."}
                aria-live="polite"
              >
                {saveState === "saving" ? "Saving…" : "Saved on this device"}
              </span>
            )}
          </div>

          {!canFinish && (
            <p className="mb-6 max-w-[46ch] text-[0.9rem] leading-relaxed text-ink-3">
              This is yours to write. Work with the AI and add useful output to a
              section, or type into any section directly — you decide what&rsquo;s
              worth keeping, and everything here stays editable.
            </p>
          )}

          <div className="space-y-8">
            {spec.fields.map((f) => (
              <div
                key={f.id}
                ref={(el) => {
                  fieldRefs.current[f.id] = el;
                }}
                className={`rounded-sm px-1 ${flashField === f.id ? "animate-wash" : ""}`}
              >
                <h3 className="section-label mb-3" style={{ color: "var(--ink-2)" }}>
                  {f.label}
                </h3>

                {f.kind === "list" ? (
                  <ListEditor
                    label={f.label}
                    addLabel={createLabel(f)}
                    items={deliverable.lists[f.id] ?? []}
                    placeholder={f.placeholder}
                    flash={flashItems}
                    onChange={(id, v) => updateListItem(f.id, id, v)}
                    onAdd={() => addListItem(f.id)}
                    onRemove={(id) => removeListItem(f.id, id)}
                  />
                ) : (
                  <TableEditor
                    columns={f.columns}
                    addLabel={createLabel(f)}
                    rows={deliverable.tables[f.id] ?? []}
                    flash={flashItems}
                    onChange={(id, c, v) => updateCell(f.id, id, c, v)}
                    onAdd={() => addRow(f.id, f.columns.map((c) => c.id))}
                    onRemove={(id) => removeRow(f.id, id)}
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* raw-selection precision toolbar — optional shortcut */}
      {capture && (
        <div
          ref={captureRef}
          role="group"
          aria-label="Use selection in your deliverable"
          className="fixed z-50 flex items-center gap-0.5 rounded-sm border border-hairline bg-raised p-1 shadow-layer animate-fadeUp"
          style={{ left: capture.x, top: capture.y - 10, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="meta whitespace-nowrap px-1.5 text-ink-3">Use selection in</span>
          {spec.fields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => useRawSelectionInto(f)}
              className="whitespace-nowrap rounded-sm px-2 py-1 text-[0.8rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-on-accent"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* single polite live region */}
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </main>
  );
}

/* ---------- selection view ---------- */

// Renders a completed AI reply as its mechanical blocks, each with a persistent
// checkbox. Consecutive blocks under the same heading are grouped under a shown
// (non-selectable) context label. Blocks already transferred carry an "Added to
// …" marker so a re-add into the same section (a silent duplicate) is visible up
// front. Large tap targets; native checkboxes keep it keyboard- and
// screen-reader-friendly.
function SelectionView({
  blocks,
  checked,
  onToggle,
  added,
  fields,
}: {
  blocks: Block[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  added: Record<string, string[]>;
  fields: DeliverableField[];
}) {
  const labelOf = (id: string) => fields.find((f) => f.id === id)?.label ?? id;
  return (
    // Named group so a screen-reader user knows they've entered block selection.
    <div
      role="group"
      aria-label="Select useful blocks from this AI response."
      className="mt-1.5 space-y-1.5"
    >
      {blocks.map((b, i) => {
        const prev = blocks[i - 1];
        const showLabel = b.contextLabel && b.contextLabel !== prev?.contextLabel;
        // Short positional name on the checkbox; the full block text is the
        // description (via aria-describedby) so it is read once, not twice, and a
        // long paragraph never becomes the control's name.
        const textId = `blk-${b.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const addedTo = added[b.id] ?? [];
        return (
          <div key={b.id}>
            {showLabel && (
              <p className="meta mb-1 mt-2 text-ink-3">{b.contextLabel}</p>
            )}
            <label
              className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-hairline p-2.5 transition-colors hover:border-accent has-[:checked]:border-accent has-[:checked]:bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]"
            >
              <input
                type="checkbox"
                checked={checked.has(b.id)}
                onChange={() => onToggle(b.id)}
                aria-label={`Select block ${i + 1} of ${blocks.length}`}
                aria-describedby={textId}
                className="mt-0.5 h-[18px] w-[18px] flex-none accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1">
                <span
                  id={textId}
                  className="block whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink"
                >
                  {b.text}
                </span>
                {addedTo.length > 0 && (
                  <span
                    className="mt-1 inline-flex items-center gap-[0.5ch] text-[0.72rem] font-semibold"
                    style={{ color: "var(--good)" }}
                  >
                    <Check width={11} height={9} />
                    Added to {addedTo.map(labelOf).join(", ")}
                  </span>
                )}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- editors ---------- */

function GrowText({
  value,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={`resize-none overflow-hidden ${className}`}
      {...props}
    />
  );
}

function ListEditor({
  label,
  addLabel,
  items,
  placeholder,
  flash,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string;
  addLabel: string;
  items: EditableListItem[];
  placeholder: string;
  flash: Set<string>;
  onChange: (id: string, v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const areas = listRef.current?.querySelectorAll("textarea");
    areas?.[areas.length - 1]?.focus();
  }, [items.length]);

  return (
    <div className="space-y-2" ref={listRef}>
      {items.map((item, i) => {
        const isNew = flash.has(item.id);
        return (
          <div
            key={item.id}
            className={`flex items-start gap-1 rounded-sm transition-colors has-[:focus]:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] ${
              isNew
                ? "border-l-2 border-accent pl-2 bg-[color-mix(in_oklab,var(--accent)_7%,transparent)]"
                : "border-l-2 border-transparent pl-2"
            }`}
          >
            <span aria-hidden className="mt-[0.9em] h-[5px] w-[5px] flex-none rounded-full bg-ink-3" />
            <GrowText
              value={item.text}
              onChange={(e) => onChange(item.id, e.target.value)}
              placeholder={placeholder}
              aria-label={`${label} — item ${i + 1}`}
              data-gramm="false"
              className="min-h-0 flex-1 border-b border-hairline bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-ink transition-colors placeholder:text-ink-3 hover:border-ink-3 focus:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="Remove"
              className="-mr-2 flex h-11 w-11 flex-none items-center justify-center text-ink-3 transition-colors hover:text-ink"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => {
          pendingFocus.current = true;
          onAdd();
        }}
        className="inline-flex min-h-[44px] items-center py-1 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function TableEditor({
  columns,
  addLabel,
  rows,
  flash,
  onChange,
  onAdd,
  onRemove,
}: {
  columns: { id: string; label: string; placeholder: string }[];
  addLabel: string;
  rows: EditableTableRow[];
  flash: Set<string>;
  onChange: (id: string, col: string, v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const tableRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    tableRef.current
      ?.querySelector<HTMLTextAreaElement>("tbody tr:last-child textarea")
      ?.focus();
  }, [rows.length]);

  return (
    <div ref={tableRef}>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="meta border-b border-hairline pb-1.5 pr-3 font-semibold"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="w-11 border-b border-hairline">
                  <span className="sr-only">Remove row</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isNew = flash.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className="align-top"
                    style={
                      isNew
                        ? { background: "color-mix(in oklab, var(--accent) 7%, transparent)" }
                        : undefined
                    }
                  >
                    {columns.map((c, ci) => (
                      <td
                        key={c.id}
                        className="border-b border-hairline py-1 pr-3 transition-colors hover:border-ink-3 has-[:focus]:border-accent has-[:focus]:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
                        style={
                          isNew && ci === 0
                            ? { boxShadow: "inset 2px 0 0 var(--accent)" }
                            : undefined
                        }
                      >
                        <GrowText
                          value={row.cells[c.id] ?? ""}
                          onChange={(e) => onChange(row.id, c.id, e.target.value)}
                          placeholder={c.placeholder}
                          aria-label={`${c.label}, row ${i + 1}`}
                          data-gramm="false"
                          className={`min-h-0 w-full bg-transparent py-1 text-[0.92rem] leading-snug text-ink placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 ${
                            ci === 0 ? "font-semibold" : ""
                          }`}
                          style={{ minWidth: ci === 0 ? "5rem" : "7rem" }}
                        />
                      </td>
                    ))}
                    <td className="border-b border-hairline text-center">
                      <button
                        type="button"
                        onClick={() => onRemove(row.id)}
                        aria-label="Remove row"
                        className="mx-auto flex h-11 w-11 items-center justify-center text-ink-3 transition-colors hover:text-ink"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          pendingFocus.current = true;
          onAdd();
        }}
        className="mt-2 inline-flex min-h-[44px] items-center py-1 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
      >
        + {addLabel}
      </button>
    </div>
  );
}
