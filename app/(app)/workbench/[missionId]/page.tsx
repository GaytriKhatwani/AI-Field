"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMission, missionVersion } from "@/lib/missions";
import type { DeliverableField } from "@/lib/missions/types";
import { track, EVENTS } from "@/lib/analytics/client";
import { Arrow, Back, Check } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const HARD_CEILING = 12;

type Msg = { id: string; role: "user" | "ai"; text: string; error?: boolean };
type Row = Record<string, string>;
type Deliverable = {
  lists: Record<string, string[]>;
  tables: Record<string, Row[]>;
};

function emptyDeliverable(fields: DeliverableField[]): Deliverable {
  const lists: Record<string, string[]> = {};
  const tables: Record<string, Row[]> = {};
  for (const f of fields) {
    if (f.kind === "list") lists[f.id] = [];
    else tables[f.id] = [];
  }
  return { lists, tables };
}

// Strip a leading list marker ("1.", "2)", "-", "•", "*") the AI often prefixes
// its lines with, so a captured phrase lands clean in the deliverable.
function stripListMarker(text: string): string {
  return text.replace(/^\s*(?:\d+[.)]|[-–—•*])\s+/, "").trim();
}

// A captured phrase is a single blob, but a table row has several columns. Land
// it in the column that reads as the row's content (task / description / …)
// rather than blindly in the first column (often an Owner/Who key), leaving the
// structured cells for the operator to fill.
function tableTargetColumn(columns: { id: string; label: string }[]): string {
  const CONTENT = /task|desc|detail|item|note|summary|answer|content|what|text|question/i;
  const match = columns.find((c) => CONTENT.test(c.id) || CONTENT.test(c.label));
  return (match ?? columns[0]).id;
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
  // to curate, and the deliverable starts empty. A capture switches to it.
  const [mode, setMode] = useState<"instrument" | "deliverable">("instrument");
  const [deliverable, setDeliverable] = useState<Deliverable>(() =>
    mission ? emptyDeliverable(mission.deliverable.fields) : { lists: {}, tables: {} },
  );
  const idRef = useRef(0);
  const [capture, setCapture] = useState<{ text: string; x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // one polite live region drives every screen-reader status announcement
  // (capture landed, submit failed) so dynamic changes aren't silent.
  const [announce, setAnnounce] = useState("");
  const transcriptRef = useRef<HTMLOListElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // keyboard-reachable capture: which AI message has its "add to a section"
  // picker open (the select-to-capture toolbar is pointer-only, so every reply
  // also carries a focusable path into the deliverable).
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [emptyHint, setEmptyHint] = useState(false);
  // First-visit-only orientation cue (not a multi-step tour). Dismissed for good
  // once seen, per-device.
  const [showGuide, setShowGuide] = useState(false);
  // draft persistence: the workbench is the longest-dwell surface, so the
  // transcript + given resources + half-built deliverable survive a refresh or
  // an accidental navigation instead of being lost with the React state.
  const [restored, setRestored] = useState(false);
  const draftKey = `aifield:wb:${params.missionId}`;

  // first Workbench visit: show the orientation cue once
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

  // clear the landing flash after it plays
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1100);
    return () => clearTimeout(t);
  }, [flash]);

  // the capture toolbar is anchored to viewport coords — dismiss it if the
  // layout shifts under it, or on Escape (returning focus to the transcript so
  // a keyboard user isn't stranded). When it opens, move focus into it so the
  // capture action is reachable without a mouse.
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

  // rehydrate a saved draft once on mount, before the persist effect can run —
  // so a refresh mid-attempt restores work rather than clobbering it with empty
  // state. idRef is advanced past the restored ids so new turns don't collide.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 1) {
          if (typeof d.attemptId === "string") setAttemptId(d.attemptId);
          if (Array.isArray(d.messages)) {
            setMessages(d.messages);
            idRef.current = d.messages.length;
          }
          if (Array.isArray(d.given)) setGiven(d.given);
          if (d.deliverable?.lists && d.deliverable?.tables) setDeliverable(d.deliverable);
        }
      }
    } catch {
      /* private mode / quota / malformed draft — start clean */
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // persist the draft once restore has run and the AI isn't mid-stream (so a
  // partial reply and per-token thrash never hit storage). Cleared on submit.
  useEffect(() => {
    if (!restored || thinking || submitting) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ v: 1, attemptId, messages, given, deliverable }),
      );
    } catch {
      /* storage unavailable — the attempt still works, just isn't recoverable */
    }
  }, [restored, thinking, submitting, attemptId, messages, given, deliverable, draftKey]);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const atCeiling = userTurns >= HARD_CEILING;

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
  const deliverableEmpty =
    Object.values(deliverable.lists).every((v) => v.length === 0) &&
    Object.values(deliverable.tables).every((v) => v.length === 0);

  function giveResource(id: string) {
    if (given.includes(id)) return; // already given — don't re-track or re-add
    // Resource Attached: attempt_id omitted entirely when no attempt exists yet
    // (materials can be given before the first message creates the attempt).
    track(EVENTS.RESOURCE_ATTACHED, {
      mission_id: mission!.id,
      mission_version: missionVersion(mission!),
      resource_id: id,
      ...(attemptId ? { attempt_id: attemptId } : {}),
    });
    setGiven((g) => (g.includes(id) ? g : [...g, id]));
  }

  // Deciding what to give the AI is the scored Context skill, so the give is not
  // a one-way door — an operator can take a resource back while they figure out
  // what the AI actually needs.
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

      // Workbench Message Sent — only after the route accepted the turn. The
      // attempt exists now (created lazily server-side; id comes back on the
      // header for the first message). turn_index is this user turn's number.
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
        body: JSON.stringify({ attemptId, missionId: mission!.id, deliverable }),
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
      // Deliverable Submitted — only after /api/submit succeeded (the commitment
      // point), carrying the now-canonical attempt id.
      track(EVENTS.DELIVERABLE_SUBMITTED, {
        mission_id: mission!.id,
        mission_version: missionVersion(mission!),
        attempt_id: id,
      });
      // handed in — the draft is now the server's; drop the local copy so a
      // later visit doesn't rehydrate a submitted, uneditable attempt.
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

  // ---- select-to-capture: pull the AI's words into the deliverable ----
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

  // Shared capture: land a phrase in the chosen field, flash it, announce it,
  // and (on mobile, where the deliverable is a separate tab) switch to it so
  // the result is visible. Both the pointer toolbar and the keyboard picker
  // funnel through here so they can never drift apart.
  function commitCapture(raw: string, f: DeliverableField) {
    const text = stripListMarker(raw);
    if (!text) return;
    if (f.kind === "list") {
      setDeliverable((d) => ({
        ...d,
        lists: { ...d.lists, [f.id]: [...d.lists[f.id], text] },
      }));
    } else {
      const target = tableTargetColumn(f.columns);
      const row = Object.fromEntries(
        f.columns.map((c) => [c.id, c.id === target ? text : ""]),
      );
      setDeliverable((d) => ({
        ...d,
        tables: { ...d.tables, [f.id]: [...d.tables[f.id], row] },
      }));
    }
    setFlash(f.id);
    setAnnounce(`Used in ${f.label}.`);
    setMode("deliverable");
    requestAnimationFrame(() =>
      fieldRefs.current[f.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }

  // pointer path: capture the current text selection from the floating toolbar.
  function captureInto(f: DeliverableField) {
    if (!capture) return;
    commitCapture(capture.text, f);
    setCapture(null);
    window.getSelection()?.removeAllRanges();
    transcriptRef.current?.focus();
  }

  // keyboard path: capture a whole AI reply from its per-message picker.
  function captureMessage(m: Msg, f: DeliverableField) {
    commitCapture(m.text, f);
    setPickerFor(null);
  }

  // ---- deliverable editors ----
  function updateListItem(fieldId: string, i: number, value: string) {
    setDeliverable((d) => {
      const arr = [...d.lists[fieldId]];
      arr[i] = value;
      return { ...d, lists: { ...d.lists, [fieldId]: arr } };
    });
  }
  function addListItem(fieldId: string) {
    setDeliverable((d) => ({
      ...d,
      lists: { ...d.lists, [fieldId]: [...d.lists[fieldId], ""] },
    }));
  }
  function removeListItem(fieldId: string, i: number) {
    setDeliverable((d) => ({
      ...d,
      lists: { ...d.lists, [fieldId]: d.lists[fieldId].filter((_, n) => n !== i) },
    }));
  }
  function updateCell(fieldId: string, i: number, col: string, value: string) {
    setDeliverable((d) => {
      const rows = d.tables[fieldId].map((r, n) => (n === i ? { ...r, [col]: value } : r));
      return { ...d, tables: { ...d.tables, [fieldId]: rows } };
    });
  }
  function addRow(fieldId: string, cols: string[]) {
    setDeliverable((d) => ({
      ...d,
      tables: {
        ...d.tables,
        [fieldId]: [...d.tables[fieldId], Object.fromEntries(cols.map((c) => [c, ""]))],
      },
    }));
  }
  function removeRow(fieldId: string, i: number) {
    setDeliverable((d) => ({
      ...d,
      tables: { ...d.tables, [fieldId]: d.tables[fieldId].filter((_, n) => n !== i) },
    }));
  }

  const hint = useMemo(() => {
    // A soft nudge, never a counter: no running tally per turn (that's the
    // gamified-countdown the brand forbids). Only speak up once past the typical
    // range, as reassurance rather than a score.
    if (atCeiling)
      return "You've reached this session's message limit. Finish practice when your deliverable is ready.";
    if (userTurns > 8)
      return "Past the usual 4–8 messages — that's fine. Finish when your deliverable holds up.";
    return "Most people finish in 4–8 messages.";
  }, [atCeiling, userTurns]);

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
          <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="heading m-0 whitespace-nowrap text-[1.05rem] text-ink">
              {mission.title}
            </h1>
            <span
              title={mission.briefing.objective}
              className="truncate text-[0.8rem] text-ink-2 sm:text-[0.85rem]"
            >
              {mission.briefing.objective}
            </span>
          </div>
        </div>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => {
            // Empty deliverable stays clickable so the reason is discoverable
            // (a disabled button explained only by `title` is invisible to
            // touch, keyboard focus, and screen readers).
            if (deliverableEmpty) {
              setEmptyHint(true);
              setAnnounce("Add at least one item to your deliverable before you can finish practice.");
              return;
            }
            setEmptyHint(false);
            setSubmitError(null);
            setConfirming(true);
          }}
          disabled={submitting || confirming}
          className="btn flex-none"
          style={{ padding: "0.6em 1.2em", fontSize: "0.9rem" }}
        >
          {submitting ? "Finishing…" : "Finish practice"}
          <Arrow className="arr" width={15} />
        </button>
      </header>

      {/* first-visit orientation cue — a single dismissible row, never a tour */}
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

      {/* finish confirmation — finishing is a point of no return, so it asks first
          and surfaces any failure instead of silently re-enabling the button */}
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

      {/* empty-deliverable hint — shown when Submit is pressed with nothing to
          hand in; clears itself the moment the deliverable holds anything */}
      {emptyHint && deliverableEmpty && (
        <div
          role="status"
          className="flex flex-none items-center gap-3 border-b border-hairline bg-raised px-[clamp(1rem,3vw,1.75rem)] py-2.5 animate-fadeUp"
        >
          <p className="min-w-0 flex-1 text-[0.85rem] leading-snug text-ink">
            Add at least one item before you finish. Work with the AI and add
            useful output to a section — or type into a section directly.
          </p>
          <button
            type="button"
            onClick={() => setEmptyHint(false)}
            aria-label="Dismiss"
            className="flex h-6 w-6 flex-none items-center justify-center text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      )}

      {/* mobile mode switch */}
      <div className="flex flex-none border-b border-hairline md:hidden">
        {(["deliverable", "instrument"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            aria-controls={m === "deliverable" ? "deliverable-panel" : "instrument-panel"}
            className="flex-1 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors aria-[pressed=true]:text-ink text-ink-3"
            style={{
              boxShadow:
                mode === m ? "inset 0 -2px 0 var(--accent)" : "inset 0 -2px 0 transparent",
            }}
          >
            {m === "deliverable" ? "Deliverable" : "Work with AI"}
          </button>
        ))}
      </div>

      {/* working regions — grid-rows-1 bounds each column to the row height so
          they scroll internally instead of growing past the viewport */}
      <div className="grid min-h-0 flex-1 grid-rows-1 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        {/* INSTRUMENT column */}
        <section
          id="instrument-panel"
          className={`min-h-0 flex-col border-hairline md:flex md:border-r ${
            mode === "instrument" ? "flex" : "hidden md:flex"
          }`}
          aria-label="Materials and the AI"
        >
          {/* scroll region: resources + transcript scroll here, above the fixed
              composer footer — so a reply never renders on both sides of it */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-[clamp(1rem,2.5vw,1.5rem)] py-5"
            onScroll={() => capture && setCapture(null)}
          >
          {/* working rules — the mission's constraints, carried from the
              Briefing so the operator isn't scored on a rule that's off-screen */}
          {mission.briefing.constraints.length > 0 && (
            <div className="mb-7">
              <h2 className="section-label mb-2.5">What matters</h2>
              <ul className="m-0 list-none space-y-1.5 p-0">
                {mission.briefing.constraints.map((c, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 text-[0.82rem] leading-snug text-ink-2"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.5em] h-[4px] w-[4px] flex-none rounded-full bg-ink-3"
                    />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* materials */}
          <h2 className="section-label mb-2">Materials</h2>
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
                {messages.map((m) => (
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
                      ) : (
                        <>
                          <p className="mt-1 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-ink">
                            {m.text}
                          </p>
                          {m.role === "ai" &&
                            (pickerFor === m.id ? (
                              <span
                                role="group"
                                aria-label="Use this reply in your deliverable"
                                className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-sm border border-hairline bg-raised p-1"
                              >
                                <span className="meta whitespace-nowrap px-1 text-ink-3">
                                  Use in
                                </span>
                                {spec.fields.map((f) => (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => captureMessage(m, f)}
                                    className="whitespace-nowrap rounded-sm px-2 py-1 text-[0.8rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-on-accent"
                                  >
                                    {f.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setPickerFor(null)}
                                  aria-label="Cancel using in deliverable"
                                  className="flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 transition-colors hover:text-ink"
                                >
                                  ×
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPickerFor(m.id)}
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
                        {/* reduced motion freezes the pulse, so a visible text
                            cue replaces the dots — sighted users still get a
                            "working" signal, not three static dots */}
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
                ))}
              </ol>
            )}
          </div>
          </div>

          {/* composer — a fixed footer; the transcript scrolls above it */}
          <div className="flex-none border-t border-hairline bg-ground px-[clamp(1rem,2.5vw,1.5rem)] py-3">
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

        {/* DELIVERABLE column — the primary region */}
        <section
          id="deliverable-panel"
          className={`min-h-0 flex-col overflow-y-auto bg-ground px-[clamp(1rem,3vw,2.25rem)] py-6 md:flex ${
            mode === "deliverable" ? "flex" : "hidden md:flex"
          }`}
          aria-label="Your deliverable"
        >
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="section-label mb-1">You&rsquo;re building</p>
              <h2 className="heading text-[1.4rem] text-ink">{spec.title}</h2>
            </div>
          </div>

          <div className="space-y-8">
            {spec.fields.map((f) => (
              <div
                key={f.id}
                ref={(el) => {
                  fieldRefs.current[f.id] = el;
                }}
                className={`rounded-sm px-1 ${flash === f.id ? "animate-wash" : ""}`}
              >
                <h3 className="section-label mb-3" style={{ color: "var(--ink-2)" }}>
                  {f.label}
                </h3>

                {f.kind === "list" ? (
                  <ListEditor
                    label={f.label}
                    items={deliverable.lists[f.id] ?? []}
                    placeholder={f.placeholder}
                    onChange={(i, v) => updateListItem(f.id, i, v)}
                    onAdd={() => addListItem(f.id)}
                    onRemove={(i) => removeListItem(f.id, i)}
                  />
                ) : (
                  <TableEditor
                    columns={f.columns}
                    rows={deliverable.tables[f.id] ?? []}
                    onChange={(i, c, v) => updateCell(f.id, i, c, v)}
                    onAdd={() => addRow(f.id, f.columns.map((c) => c.id))}
                    onRemove={(i) => removeRow(f.id, i)}
                  />
                )}
              </div>
            ))}
          </div>

          {deliverableEmpty && (
            <p className="mt-8 max-w-[44ch] text-[0.9rem] leading-relaxed text-ink-3">
              This is what you&rsquo;ll produce. Work with the AI, add useful
              output to the appropriate section, or write here directly. You
              decide what&rsquo;s worth keeping.
            </p>
          )}
        </section>
      </div>

      {/* select-to-capture toolbar — anchored above the AI-text selection.
          Focus moves here on open and Escape returns it to the transcript (see
          the capture effect), so it works without a mouse. */}
      {capture && (
        <div
          ref={captureRef}
          role="group"
          aria-label="Use selection in your deliverable"
          className="fixed z-50 flex items-center gap-0.5 rounded-sm border border-hairline bg-raised p-1 shadow-layer animate-fadeUp"
          style={{ left: capture.x, top: capture.y - 10, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="meta whitespace-nowrap px-1.5 text-ink-3">Use in</span>
          {spec.fields.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => captureInto(f)}
              className="whitespace-nowrap rounded-sm px-2 py-1 text-[0.8rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-on-accent"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* single polite live region: announces captures and submit failures so
          screen-reader users aren't left guessing what changed */}
      <div className="sr-only" role="status" aria-live="polite">
        {announce}
      </div>
    </main>
  );
}

/* ---------- editors ---------- */

// A textarea that grows to fit its content, so a multi-sentence capture is
// fully visible instead of clipped behind a one-line scroll. Height is set
// after render (useEffect, not layout effect, to avoid the SSR warning); the
// brief first-paint reflow is invisible for content that arrives post-mount
// (captures, restored drafts, typing).
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
  items,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onChange: (i: number, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  // Focus the field created by an explicit "+ add" (not one landed by a capture,
  // which manages its own focus) so a keyboard user can type straight away.
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
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <span
            aria-hidden
            className="mt-[0.9em] h-[5px] w-[5px] flex-none rounded-full bg-ink-3"
          />
          <GrowText
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={placeholder}
            aria-label={`${label} — item ${i + 1}`}
            data-gramm="false"
            className="min-h-0 flex-1 border-b border-hairline bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="-mr-2 flex h-11 w-11 flex-none items-center justify-center text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          pendingFocus.current = true;
          onAdd();
        }}
        className="inline-flex min-h-[44px] items-center py-1 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
      >
        + add
      </button>
    </div>
  );
}

function TableEditor({
  columns,
  rows,
  onChange,
  onAdd,
  onRemove,
}: {
  columns: { id: string; label: string; placeholder: string }[];
  rows: Record<string, string>[];
  onChange: (i: number, col: string, v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  // Focus the first cell of a row created by "+ add row" (not one landed by a
  // capture, which manages its own focus).
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
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  {columns.map((c, ci) => (
                    <td key={c.id} className="border-b border-hairline py-1 pr-3">
                      <GrowText
                        value={row[c.id] ?? ""}
                        onChange={(e) => onChange(i, c.id, e.target.value)}
                        placeholder={c.placeholder}
                        aria-label={`${c.label}, row ${i + 1}`}
                        data-gramm="false"
                        className={`min-h-0 w-full bg-transparent py-1 text-[0.92rem] leading-snug text-ink outline-none placeholder:text-ink-3 ${
                          ci === 0 ? "font-semibold" : ""
                        }`}
                        style={{ minWidth: ci === 0 ? "5rem" : "7rem" }}
                      />
                    </td>
                  ))}
                  <td className="border-b border-hairline text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label="Remove row"
                      className="mx-auto flex h-11 w-11 items-center justify-center text-ink-3 transition-colors hover:text-ink"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
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
        + add row
      </button>
    </div>
  );
}
