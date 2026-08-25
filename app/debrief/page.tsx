"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useField } from "@/lib/store";
import { getMission } from "@/lib/missions";
import { COMPETENCY_META, bandLabel } from "@/lib/competencies";
import { Marker } from "@/components/CapabilityRegister";
import { bandToState } from "@/lib/competencies";
import { Arrow, Back } from "@/components/icons";
import type { Debrief } from "@/lib/debrief/types";

type Deliverable = {
  lists: Record<string, string[]>;
  tables: Record<string, Record<string, string>[]>;
};

function Loading() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="meta animate-breathe" style={{ letterSpacing: "0.2em" }}>
        AI&nbsp;Field
      </div>
    </main>
  );
}

export default function DebriefPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DebriefInner />
    </Suspense>
  );
}

function DebriefInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reviewAttemptId = params.get("attemptId");
  const isReview = !!reviewAttemptId;

  const { hydrated, lastDebrief, completed } = useField();

  // Review mode fetches a past attempt's debrief + submitted deliverable through
  // the idempotent return_existing path (no re-judge, no double-count).
  const [review, setReview] = useState<{
    debrief: Debrief;
    deliverable: Deliverable;
    missionId: string;
  } | null>(null);
  const [reviewError, setReviewError] = useState(false);

  // Live flow: with no debrief in hand and not reviewing, there's nothing here.
  useEffect(() => {
    if (!isReview && hydrated && !lastDebrief) router.replace("/field");
  }, [isReview, hydrated, lastDebrief, router]);

  useEffect(() => {
    if (!isReview || !hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: reviewAttemptId }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (data?.debrief && data?.deliverable && data?.missionId) {
          setReview({
            debrief: data.debrief,
            deliverable: data.deliverable,
            missionId: data.missionId,
          });
        } else {
          setReviewError(true);
        }
      } catch {
        if (!cancelled) setReviewError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isReview, hydrated, reviewAttemptId]);

  if (isReview && reviewError) {
    return (
      <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-[clamp(1.25rem,5vw,3.25rem)] py-16">
        <p className="section-label mb-5">Couldn&rsquo;t open this rep</p>
        <h1 className="display max-w-[16ch] text-ink" style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)" }}>
          That debrief didn&rsquo;t load.
        </h1>
        <button type="button" onClick={() => router.push("/field")} className="btn mt-8 self-start">
          Back to the Field
        </button>
      </main>
    );
  }

  const d = isReview ? review?.debrief : lastDebrief;

  if (!hydrated || !d) return <Loading />;

  const moved = d.moves.filter((m) => m.moved);
  const headerTitle = isReview
    ? (getMission(review!.missionId)?.title ?? "Mission")
    : (completed[0]?.title ?? "Mission");
  const practiceAfter = bandLabel(
    d.moves.find((m) => m.competency === d.practice)?.after ?? "not_shown",
  );
  const next = isReview ? null : getMission(d.nextMissionId)!;
  const mission = isReview ? getMission(review!.missionId) : null;

  return (
    <main className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pb-24 pt-[clamp(1.5rem,4.5vw,3.25rem)]">
      <button
        type="button"
        onClick={() => router.push("/field")}
        className="inline-flex items-center gap-[0.6ch] text-[0.82rem] font-medium text-ink-3 transition-colors hover:text-accent"
      >
        <Back /> The Field
      </button>

      {/* what happened */}
      <header className="mt-[clamp(2rem,6vw,3.5rem)] max-w-[16ch] animate-riseIn">
        <p className="meta mb-4">
          {headerTitle} · {isReview ? "Reviewing a past rep" : "Debrief"}
        </p>
        <h1
          className="display text-ink"
          style={{ fontSize: "clamp(2.3rem,5.5vw,3.4rem)", lineHeight: 1.02 }}
        >
          {d.headline}
        </h1>
      </header>

      {/* the evidence / session line */}
      <section className="mt-[clamp(2.5rem,6vw,3.5rem)]" aria-label="Evidence from your session">
        <h2 className="section-label mb-5">From your session</h2>
        <ol className="relative m-0 list-none p-0">
          <span
            aria-hidden
            className="absolute bottom-2 left-[5px] top-2 w-px"
            style={{ background: "var(--hairline)" }}
          />
          {d.sessionLine.map((m) => (
            <li key={m.turnId} className="relative flex gap-5 pb-7 last:pb-0">
              <span
                aria-hidden
                className="relative z-10 mt-1.5 h-[11px] w-[11px] flex-none rounded-full"
                style={{
                  background:
                    m.tone === "good"
                      ? "var(--accent)"
                      : m.tone === "gap"
                        ? "var(--warn)"
                        : "var(--ground)",
                  boxShadow:
                    m.tone === "neutral" ? "inset 0 0 0 1.5px var(--marker-open)" : "none",
                  outline: "3px solid var(--ground)",
                }}
              />
              <div className="min-w-0">
                <p className="meta mb-1" style={{ color: "var(--ink-3)" }}>
                  {m.who}
                </p>
                <p className="max-w-measure text-[0.98rem] leading-relaxed text-ink">
                  {m.text}
                </p>
                <p
                  className="mt-1 max-w-measure text-[0.88rem] leading-snug"
                  style={{
                    color: m.tone === "gap" ? "var(--warn)" : "var(--ink-2)",
                  }}
                >
                  {m.note}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* worked / missed / expert — editorial prose, not cards */}
      <div className="grid gap-[clamp(2rem,4vw,3rem)] md:grid-cols-2">
        <section>
          <h2 className="section-label mb-3">What worked</h2>
          <p className="max-w-[42ch] text-[1.02rem] leading-relaxed text-ink">{d.worked}</p>
        </section>
        <section>
          <h2
            className="section-label mb-3"
            style={{ color: "var(--warn)" }}
          >
            What you missed
          </h2>
          <p className="max-w-[42ch] text-[1.02rem] leading-relaxed text-ink">{d.missed}</p>
        </section>
      </div>

      <section className="mt-[clamp(2rem,4vw,3rem)]">
        <h2 className="section-label mb-3">How a strong operator does it</h2>
        <p className="max-w-measure text-[1.05rem] leading-relaxed text-ink-2">{d.expert}</p>
      </section>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* capability movement — in words, no bars, no numbers */}
      <section aria-label="What moved">
        <h2 className="section-label mb-5">What moved</h2>
        {moved.length > 0 ? (
          <ul className="m-0 list-none space-y-4 p-0">
            {moved.map((m) => (
              <li key={m.competency} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="flex items-center gap-[0.6ch]">
                  <Marker kind={bandToState(m.after).marker} />
                  <span className="heading text-[1.1rem] text-ink">
                    {COMPETENCY_META[m.competency].label}
                  </span>
                </span>
                <span className="text-[0.95rem] text-ink-2">
                  {bandLabel(m.before)}{" "}
                  <span className="text-ink-3">→</span>{" "}
                  <span className="font-semibold text-ink">{bandLabel(m.after)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-measure text-[0.98rem] text-ink-2">
            Nothing moved enough to change a band this time — the honest read is
            that this rep held your ground rather than advancing it.
          </p>
        )}
        <p className="mt-5 max-w-measure text-[0.88rem] leading-snug text-ink-3">
          Capabilities this mission didn&rsquo;t call for stayed exactly where they
          were. Finishing a mission never inflates a bar you didn&rsquo;t use.
        </p>
      </section>

      {/* review mode: what you actually submitted */}
      {isReview && mission && (
        <>
          <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />
          <section aria-label="What you submitted">
            <h2 className="section-label mb-5">What you submitted</h2>
            <div className="space-y-7">
              {mission.deliverable.fields.map((f) => {
                const empty = <p className="text-[0.9rem] text-ink-3">— left empty —</p>;
                return (
                  <div key={f.id}>
                    <h3 className="section-label mb-2" style={{ color: "var(--ink-2)" }}>
                      {f.label}
                    </h3>
                    {f.kind === "list" ? (
                      (review!.deliverable.lists[f.id]?.length ?? 0) > 0 ? (
                        <ul className="m-0 max-w-measure list-disc space-y-1 pl-5">
                          {review!.deliverable.lists[f.id].map((item, i) => (
                            <li key={i} className="text-[0.96rem] leading-relaxed text-ink">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        empty
                      )
                    ) : (review!.deliverable.tables[f.id]?.length ?? 0) > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[0.92rem]">
                          <thead>
                            <tr>
                              {f.columns.map((c) => (
                                <th
                                  key={c.id}
                                  className="section-label border-b border-hairline pb-1.5 pr-4 text-left"
                                >
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {review!.deliverable.tables[f.id].map((row, ri) => (
                              <tr key={ri}>
                                {f.columns.map((c) => (
                                  <td
                                    key={c.id}
                                    className="border-b border-hairline py-2 pr-4 align-top text-ink"
                                  >
                                    {row[c.id] ? row[c.id] : <span className="text-ink-3">—</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      empty
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {isReview ? (
        /* review: no forward CTA — the recommendation lives on the Field, current */
        <section aria-label="Back to your practice">
          <p className="max-w-measure text-[0.95rem] leading-relaxed text-ink-2">
            This is the read from that rep. Your live recommendation — built from
            everything you&rsquo;ve done since — is waiting on the Field.
          </p>
          <button type="button" onClick={() => router.push("/field")} className="btn mt-6">
            Back to the Field
            <Arrow className="arr" />
          </button>
        </section>
      ) : (
        /* live: the gap resolves into the next assignment */
        <section className="animate-riseIn" aria-label="Your next assignment">
          <p className="meta mb-4">Your next assignment</p>
          <p className="max-w-[38ch] text-[clamp(1.05rem,2.4vw,1.2rem)] font-medium leading-[1.45] text-ink">
            Because your{" "}
            <span className="font-semibold text-accent">
              {COMPETENCY_META[d.practice].label}
            </span>{" "}
            is {practiceAfter}, your next rep is built to draw it out.
          </p>
          <h2
            className="display mt-6 text-ink"
            style={{ fontSize: "clamp(2.2rem,6.5vw,3.6rem)" }}
          >
            {next!.title}
          </h2>
          <p className="mt-3 max-w-[36ch] text-[1.05rem] leading-normal text-ink-2">
            {next!.premise}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/briefing/${next!.id}`)}
            className="btn mt-7"
          >
            Begin {next!.title}
            <Arrow className="arr" />
          </button>
        </section>
      )}
    </main>
  );
}
