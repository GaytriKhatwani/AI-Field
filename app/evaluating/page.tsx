"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";
import { getMission, missionVersion } from "@/lib/missions";
import { COMPETENCY_ORDER, type Band } from "@/lib/competencies";
import type { Competency } from "@/lib/missions/types";
import type { CompetencyMove } from "@/lib/progression/update";
import { track, EVENTS } from "@/lib/analytics/client";

const READING = [
  "How you directed the AI",
  "What you gave it to work from",
  "How far you pushed the first answer",
  "What you chose to submit",
];

export default function Evaluating() {
  const router = useRouter();
  const { hydrated, setLastDebrief, refresh } = useField();
  const [active, setActive] = useState(0);
  const [errored, setErrored] = useState(false);

  // Cycle the reading lines while the examiner works (purely visual).
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = window.setInterval(
      () => setActive((a) => (a + 1) % (READING.length + 1)),
      reduce ? 400 : 900,
    );
    return () => window.clearInterval(step);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const attemptId = new URLSearchParams(window.location.search).get("attemptId");
    if (!attemptId) {
      router.replace("/field");
      return;
    }

    // If this effect ever re-runs (a dep changes, a dev hot-reload), the cleanup
    // cancels the old run so it can't navigate, and a fresh run starts. Re-POSTing
    // is safe because /api/evaluate is idempotent — a held lease returns 202 and a
    // finished one returns the existing debrief — so the poll always resolves
    // forward to the debrief instead of stranding a completed evaluation.
    let cancelled = false;
    const MAX_POLLS = 40; // ~2 minutes at 3s

    async function run() {
      for (let i = 0; i < MAX_POLLS && !cancelled; i++) {
        let res: Response;
        try {
          res = await fetch("/api/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          });
        } catch {
          await sleep(3000);
          continue;
        }

        if (res.status === 202) {
          // Evaluation is in progress elsewhere — wait and poll again.
          await sleep(3000);
          continue;
        }

        if (!res.ok) {
          if (!cancelled) setErrored(true);
          return;
        }

        const data = await res.json().catch(() => null);
        if (data?.debrief) {
          // Evaluation Completed — the loop closed. The wrapper dedupes this per
          // attempt (localStorage + $insert_id), so an extra poll observation of
          // the same evaluated result never double-fires.
          const mission =
            typeof data.missionId === "string" ? getMission(data.missionId) : undefined;
          if (attemptId && mission) {
            const bands = Object.fromEntries(
              COMPETENCY_ORDER.map((c) => [c, "not_shown"]),
            ) as Record<Competency, Band>;
            for (const mv of (data.debrief.moves ?? []) as CompetencyMove[]) {
              bands[mv.competency] = mv.after;
            }
            track(EVENTS.EVALUATION_COMPLETED, {
              mission_id: mission.id,
              mission_version: missionVersion(mission),
              attempt_id: attemptId,
              practice_competency: data.debrief.practice as Competency,
              bands,
            });
          }
          setLastDebrief(data.debrief);
          await refresh();
          if (!cancelled) router.replace("/debrief");
          return;
        }
        // Unexpected shape — brief wait then retry.
        await sleep(3000);
      }
      if (!cancelled) setErrored(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, router, setLastDebrief, refresh]);

  if (errored) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-[clamp(1.25rem,5vw,3.25rem)] py-16">
        <p role="alert" className="section-label mb-5">The examiner hit a snag</p>
        <h1 className="display max-w-[16ch] text-ink" style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)" }}>
          Grading didn&rsquo;t finish.
        </h1>
        <p className="mt-6 max-w-[40ch] text-[0.95rem] leading-relaxed text-ink-2">
          Your session is saved. This is usually a temporary hiccup with the
          examiner — try again in a moment.
        </p>
        <div className="mt-8 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setErrored(false);
              // re-trigger by reloading the same URL
              router.refresh();
              location.reload();
            }}
            className="btn"
          >
            Try grading again
          </button>
          <button type="button" onClick={() => router.push("/field")} className="btn--quiet">
            Back to the Field
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-[clamp(1.25rem,5vw,3.25rem)] py-16">
      <p role="status" className="section-label mb-5">
        The examiner is reading your session
      </p>
      <h1
        className="display max-w-[18ch] text-ink"
        style={{ fontSize: "clamp(2rem,5.5vw,3.2rem)" }}
      >
        Reading how you worked.
      </h1>

      <ul className="mt-12 m-0 max-w-[34rem] list-none space-y-0 p-0">
        {READING.map((line, i) => {
          const on = i < active;
          const current = i === active;
          return (
            <li
              key={line}
              className="flex items-center gap-4 border-t border-hairline py-4 last:border-b"
            >
              <span
                aria-hidden
                className={`h-[7px] w-[7px] flex-none rounded-full ${current ? "animate-breathe" : ""}`}
                style={{
                  background: on || current ? "var(--accent)" : "transparent",
                  boxShadow:
                    on || current ? "none" : "inset 0 0 0 1.5px var(--marker-open)",
                }}
              />
              <span
                className="text-[1.05rem] transition-colors duration-500"
                style={{ color: on || current ? "var(--ink)" : "var(--ink-3)" }}
              >
                {line}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-10 max-w-[40ch] text-[0.9rem] leading-relaxed text-ink-3">
        The same standard for every operator — your session judged on how you
        directed the work, not on how the AI happened to answer.
      </p>
    </main>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
