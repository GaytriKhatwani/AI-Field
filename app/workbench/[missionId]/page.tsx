"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMission } from "@/lib/missions";
import type { DeliverableField } from "@/lib/missions/types";
import { Arrow, Back, Check } from "@/components/icons";

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
      return "[You've reached this attempt's exchange ceiling. Submit your deliverable when it's ready.]";
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
  const [mode, setMode] = useState<"instrument" | "deliverable">("deliverable");
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

  const userTurns = messages.filter((m) => m.role === "user").length;
  const atCeiling = userTurns >= HARD_CEILING;

  if (!mission) {
    return (
      <main className="mx-auto max-w-reading px-6 py-24">
        <p className="text-ink-2">That mission isn&rsquo;t available.</p>
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
          "Couldn't hand in your deliverable. Your work is safe — try again in a moment.",
        );
        setAnnounce("Submission failed. Try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/evaluating?attemptId=${id}`);
    } catch {
      setSubmitError(
        "Couldn't reach the examiner. Your work is safe — check your connection and try again.",
      );
      setAnnounce("Submission failed. Try again.");
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

  function captureInto(f: DeliverableField) {
    if (!capture) return;
    const text = stripListMarker(capture.text);
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
    setCapture(null);
    window.getSelection()?.removeAllRanges();
    setFlash(f.id);
    setAnnounce(`Added to ${f.label}.`);
    // On mobile the deliverable lives on a separate tab, so the capture would
    // land off-screen — switch to it so the operator sees the result. Harmless
    // on desktop, where both columns are always visible.
    setMode("deliverable");
    transcriptRef.current?.focus();
    requestAnimationFrame(() =>
      fieldRefs.current[f.id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
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
      return "You've reached this attempt's exchange ceiling. Submit when your deliverable is ready.";
    if (userTurns > 8)
      return "Past the usual 4–8 exchanges — that's fine. Submit when your deliverable holds up.";
    return "Most operators finish in 4–8 exchanges.";
  }, [atCeiling, userTurns]);

  return (
    <main className="flex h-screen [height:100dvh] flex-col overflow-hidden">
      {/* orientation bar — persistent */}
      <header className="flex flex-none items-center gap-4 border-b border-hairline px-[clamp(1rem,3vw,1.75rem)] py-3">
        <button
          type="button"
          onClick={() => router.push("/field")}
          aria-label="Leave the workbench"
          className="-ml-1.5 flex h-9 w-9 flex-none items-center justify-center text-ink-3 transition-colors hover:text-accent"
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
        <button
          type="button"
          onClick={() => {
            setSubmitError(null);
            setConfirming(true);
          }}
          disabled={deliverableEmpty || submitting || confirming}
          className="btn flex-none"
          style={{ padding: "0.6em 1.2em", fontSize: "0.9rem" }}
          title={deliverableEmpty ? "Build your deliverable before submitting" : undefined}
        >
          {submitting ? "Submitting…" : "Submit mission"}
          <Arrow className="arr" width={15} />
        </button>
      </header>

      {/* hand-in confirmation — submit is a point of no return, so it asks first
          and surfaces any failure instead of silently re-enabling the button */}
      {confirming && (
        <div className="flex flex-none flex-wrap items-center gap-x-5 gap-y-3 border-b border-hairline bg-raised px-[clamp(1rem,3vw,1.75rem)] py-3 animate-fadeUp">
          <p className="min-w-0 flex-1 text-[0.9rem] leading-snug text-ink">
            This hands your deliverable to the examiner.{" "}
            <span className="text-ink-2">You can&rsquo;t edit it after this.</span>
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
              {submitting ? "Handing in…" : submitError ? "Try again" : "Hand in"}
              <Arrow className="arr" width={14} />
            </button>
          </div>
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
            {m === "deliverable" ? "Deliverable" : "Instrument"}
          </button>
        ))}
      </div>

      {/* working regions */}
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        {/* INSTRUMENT column */}
        <section
          id="instrument-panel"
          className={`min-h-0 flex-col overflow-y-auto border-hairline px-[clamp(1rem,2.5vw,1.5rem)] py-5 md:flex md:border-r ${
            mode === "instrument" ? "flex" : "hidden md:flex"
          }`}
          aria-label="Resources and the AI instrument"
          onScroll={() => capture && setCapture(null)}
        >
          {/* resources */}
          <h2 className="section-label mb-4">Resources</h2>
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
                        aria-label={`Take back ${r.label} from the AI`}
                        title="Take it back"
                        className="group/give flex min-h-[24px] flex-none items-center gap-[0.5ch] whitespace-nowrap rounded-sm px-1.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.09em] transition-colors hover:text-ink"
                        style={{ color: "var(--good)" }}
                      >
                        <Check width={12} height={10} />
                        <span className="group-hover/give:hidden">Given to the AI</span>
                        <span className="hidden group-hover/give:inline">Take it back</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => giveResource(r.id)}
                        className="btn btn--ghost flex-none"
                        style={{ padding: "0.5em 0.85em", fontSize: "0.8rem", minHeight: "24px" }}
                      >
                        Give to the AI
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
          <p className="mt-3 text-[0.8rem] leading-snug text-ink-3">
            The AI only knows what you give it. Deciding what it needs is part of
            the rep.
          </p>

          {/* the instrument / transcript */}
          <h2 className="section-label mb-3 mt-8">Direct the AI</h2>
          <div className="min-h-0">
            {messages.length === 0 && !thinking ? (
              <p className="max-w-[38ch] text-[0.9rem] leading-relaxed text-ink-3">
                Give it an instruction below. It executes what you ask — it
                won&rsquo;t coach you, fill in what you left out, or fix a vague
                request.
              </p>
            ) : (
              <ol
                ref={transcriptRef}
                onMouseUp={readSelection}
                onKeyUp={readSelection}
                tabIndex={-1}
                role="log"
                aria-live="polite"
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
                        <p className="mt-1 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-ink">
                          {m.text}
                        </p>
                      )
                    ) : (
                      <p className="mt-1 flex gap-1.5">
                        <span className="sr-only" role="status">
                          The AI is responding…
                        </span>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            aria-hidden
                            className="h-[6px] w-[6px] rounded-full bg-ink-3 animate-breathe"
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

          {/* composer */}
          <div className="sticky bottom-0 mt-4 bg-ground pt-1">
            <div className="flex items-end gap-2 rounded-sm border border-hairline bg-raised p-2 focus-within:border-accent">
              <textarea
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
                aria-label="Type an instruction to the AI"
                placeholder={atCeiling ? "Exchange ceiling reached." : "Type an instruction…"}
                className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1 text-[0.92rem] leading-relaxed text-ink outline-none placeholder:text-ink-3 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || thinking || atCeiling}
                aria-label="Direct the AI"
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
              This is what you&rsquo;ll hand in. Select any part of the
              AI&rsquo;s reply to add it to a section — or type directly. You
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
          role="menu"
          aria-label="Add selection to your deliverable"
          className="fixed z-50 flex items-center gap-0.5 rounded-sm border border-hairline bg-raised p-1 shadow-layer animate-fadeUp"
          style={{ left: capture.x, top: capture.y - 10, transform: "translate(-50%, -100%)" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="meta whitespace-nowrap px-1.5 text-ink-3">Add to</span>
          {spec.fields.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
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
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-[0.9em] h-[5px] w-[5px] flex-none rounded-full bg-ink-3"
          />
          <textarea
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={placeholder}
            aria-label={`${label} — item ${i + 1}`}
            rows={1}
            data-gramm="false"
            className="min-h-0 flex-1 resize-none border-b border-hairline bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex min-h-[24px] items-center py-1 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
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
  return (
    <div>
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
                <th scope="col" className="w-6 border-b border-hairline">
                  <span className="sr-only">Remove row</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="align-top">
                  {columns.map((c, ci) => (
                    <td key={c.id} className="border-b border-hairline py-1 pr-3">
                      <textarea
                        value={row[c.id] ?? ""}
                        onChange={(e) => onChange(i, c.id, e.target.value)}
                        placeholder={c.placeholder}
                        aria-label={`${c.label}, row ${i + 1}`}
                        rows={1}
                        data-gramm="false"
                        className={`min-h-0 w-full resize-none bg-transparent py-1 text-[0.92rem] leading-snug text-ink outline-none placeholder:text-ink-3 ${
                          ci === 0 ? "font-semibold" : ""
                        }`}
                        style={{ minWidth: ci === 0 ? "5rem" : "7rem" }}
                      />
                    </td>
                  ))}
                  <td className="border-b border-hairline py-1 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove(i)}
                      aria-label="Remove row"
                      className="mx-auto flex h-6 w-6 items-center justify-center text-ink-3 transition-colors hover:text-ink"
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
        onClick={onAdd}
        className="mt-2 inline-flex min-h-[24px] items-center py-1 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
      >
        + add row
      </button>
    </div>
  );
}
