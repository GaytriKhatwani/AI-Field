"use client";

import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMission } from "@/lib/missions";
import type { DeliverableField } from "@/lib/missions/types";
import { useField } from "@/lib/store";
import { respond, DeliverablePatch } from "@/lib/mock/ai";
import type { SessionMessage } from "@/lib/mock/examiner";
import { Arrow, Back, Check } from "@/components/icons";

const HARD_CEILING = 12;

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

export default function Workbench() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const { submitAttempt } = useField();
  const mission = getMission(params.missionId);

  const [given, setGiven] = useState<string[]>([]);
  const [openResource, setOpenResource] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lastExtract, setLastExtract] = useState<DeliverablePatch | null>(null);
  const [pulledInto, setPulledInto] = useState<string[]>([]);
  const [mode, setMode] = useState<"instrument" | "deliverable">("deliverable");
  const [deliverable, setDeliverable] = useState<Deliverable>(() =>
    mission ? emptyDeliverable(mission.deliverable.fields) : { lists: {}, tables: {} },
  );
  const idRef = useRef(0);

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

  function send() {
    const text = draft.trim();
    if (!text || thinking || atCeiling) return;
    const userMsg: SessionMessage = { id: `msg_${++idRef.current}`, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setThinking(true);
    window.setTimeout(() => {
      const reply = respond(mission!, text, given);
      setMessages((m) => [...m, { id: `msg_${++idRef.current}`, role: "ai", text: reply.text }]);
      setLastExtract(reply.extract ?? null);
      setThinking(false);
    }, 720);
  }

  function pullIn() {
    if (!lastExtract) return;
    const touched: string[] = [];
    setDeliverable((d) => {
      const next: Deliverable = {
        lists: { ...d.lists },
        tables: { ...d.tables },
      };
      if (lastExtract.lists) {
        for (const [k, v] of Object.entries(lastExtract.lists)) {
          if (next.lists[k] !== undefined) {
            next.lists[k] = [...next.lists[k], ...v];
            touched.push(k);
          }
        }
      }
      if (lastExtract.tables) {
        for (const [k, v] of Object.entries(lastExtract.tables)) {
          if (next.tables[k] !== undefined) {
            next.tables[k] = [...next.tables[k], ...v];
            touched.push(k);
          }
        }
      }
      return next;
    });
    setPulledInto(touched);
    window.setTimeout(() => setPulledInto([]), 1100);
    setLastExtract(null);
    setMode("deliverable");
  }

  function submit() {
    submitAttempt({
      mission: mission!,
      givenResourceIds: given,
      messages,
      deliverable,
    });
    router.push("/evaluating");
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
    if (atCeiling)
      return "You've reached this attempt's exchange ceiling. Submit when your deliverable is ready.";
    if (userTurns === 0) return "Most operators finish in 4–8 exchanges.";
    return `Most operators finish in 4–8 exchanges. You've used ${userTurns}.`;
  }, [atCeiling, userTurns]);

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      {/* orientation bar — persistent */}
      <header className="flex flex-none items-center gap-4 border-b border-hairline px-[clamp(1rem,3vw,1.75rem)] py-3">
        <button
          type="button"
          onClick={() => router.push("/field")}
          aria-label="Leave the workbench"
          className="flex-none text-ink-3 transition-colors hover:text-accent"
        >
          <Back />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-3">
            <span className="heading whitespace-nowrap text-[1.05rem] text-ink">
              {mission.title}
            </span>
            <span className="hidden truncate text-[0.85rem] text-ink-2 sm:inline">
              {mission.briefing.objective}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={deliverableEmpty}
          className="btn flex-none"
          style={{ padding: "0.6em 1.2em", fontSize: "0.9rem" }}
          title={deliverableEmpty ? "Build your deliverable before submitting" : undefined}
        >
          Submit mission
          <Arrow className="arr" width={15} />
        </button>
      </header>

      {/* mobile mode switch */}
      <div className="flex flex-none border-b border-hairline md:hidden">
        {(["deliverable", "instrument"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-current={mode === m}
            className="flex-1 py-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] transition-colors aria-[current=true]:text-ink text-ink-3"
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
          className={`min-h-0 flex-col overflow-y-auto border-hairline px-[clamp(1rem,2.5vw,1.5rem)] py-5 md:flex md:border-r ${
            mode === "instrument" ? "flex" : "hidden md:flex"
          }`}
          aria-label="Resources and the AI instrument"
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
                      <span
                        className="flex flex-none items-center gap-[0.5ch] whitespace-nowrap text-[0.72rem] font-semibold uppercase tracking-[0.09em]"
                        style={{ color: "var(--good)" }}
                      >
                        <Check width={12} height={10} /> Given to the AI
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => giveResource(r.id)}
                        className="btn btn--ghost flex-none"
                        style={{ padding: "0.4em 0.75em", fontSize: "0.8rem" }}
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
              <ol className="m-0 list-none space-y-4 p-0">
                {messages.map((m) => (
                  <li key={m.id} className="animate-fadeUp">
                    <span
                      className="meta"
                      style={{
                        color: m.role === "user" ? "var(--accent)" : "var(--ink-3)",
                      }}
                    >
                      {m.role === "user" ? "You" : "AI"}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-[0.92rem] leading-relaxed text-ink">
                      {m.text}
                    </p>
                  </li>
                ))}
                {thinking && (
                  <li>
                    <span className="meta text-ink-3">AI</span>
                    <p className="mt-1 flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-[6px] w-[6px] rounded-full bg-ink-3 animate-breathe"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </p>
                  </li>
                )}
              </ol>
            )}
          </div>

          {/* composer */}
          <div className="sticky bottom-0 mt-4 bg-ground pt-1">
            {lastExtract && (
              <button
                type="button"
                onClick={pullIn}
                className="mb-2 inline-flex items-center gap-[0.6ch] text-[0.82rem] font-semibold text-accent transition-colors hover:text-accent-strong"
              >
                <Arrow width={14} style={{ transform: "rotate(180deg)" }} />
                Pull the AI&rsquo;s last reply into your deliverable
              </button>
            )}
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
            {spec.fields.map((f) => {
              const washed = pulledInto.includes(f.id);
              return (
                <div
                  key={f.id}
                  className={`rounded-sm px-1 ${washed ? "animate-wash" : ""}`}
                >
                  <h3 className="section-label mb-3" style={{ color: "var(--ink-2)" }}>
                    {f.label}
                  </h3>

                  {f.kind === "list" ? (
                    <ListEditor
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
              );
            })}
          </div>

          {deliverableEmpty && (
            <p className="mt-8 max-w-[44ch] text-[0.9rem] leading-relaxed text-ink-3">
              This is what you&rsquo;ll hand in. Build it from the AI&rsquo;s
              output — or type it yourself. You decide what&rsquo;s good enough.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- editors ---------- */

function ListEditor({
  items,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
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
            rows={1}
            data-gramm="false"
            className="min-h-0 flex-1 resize-none border-b border-hairline bg-transparent py-1.5 text-[0.95rem] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="mt-1 flex-none px-1 text-ink-3 transition-colors hover:text-ink"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
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
                    className="meta border-b border-hairline pb-1.5 pr-3 font-semibold"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {c.label}
                  </th>
                ))}
                <th className="w-6 border-b border-hairline" />
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
                      className="px-1 text-ink-3 transition-colors hover:text-ink"
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
        className="mt-2 text-[0.82rem] font-semibold text-ink-3 transition-colors hover:text-accent"
      >
        + add row
      </button>
    </div>
  );
}
