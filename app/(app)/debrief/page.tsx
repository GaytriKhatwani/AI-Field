"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useField } from "@/lib/store";
import { getMission } from "@/lib/missions";
import {
  COMPETENCY_META,
  COMPETENCY_ORDER,
  bandLabel,
  bandToState,
  scoreToBand,
  practicePitch,
  type Profile,
} from "@/lib/competencies";
import { Marker } from "@/components/CapabilityRegister";
import type { Competency } from "@/lib/missions/types";
import { track, EVENTS } from "@/lib/analytics/client";
import { ACCOUNT_LINKING_ENABLED } from "@/lib/flags";
import { Arrow, Back, GoogleG } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Debrief } from "@/lib/debrief/types";

type Deliverable = {
  lists: Record<string, string[]>;
  tables: Record<string, Record<string, string>[]>;
};

function Loading({ label }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center">
      <div
        role="status"
        aria-label={label ?? "Loading"}
        className="flex flex-col items-center gap-3 text-center"
      >
        <span className="meta animate-breathe" style={{ letterSpacing: "0.2em" }}>
          AI&nbsp;Field
        </span>
        {label && <span className="text-[0.85rem] text-ink-3">{label}</span>}
      </div>
    </main>
  );
}

// Smoothly scale the judge-authored headline by length: short verdicts get the
// full display peak, long sentence-length ones shrink continuously (no hard tier
// cliffs) so the opening beat never becomes a wall or an oversized run-on.
function headlineStyle(text: string): CSSProperties {
  const len = text.length;
  const maxRem = Math.max(1.7, Math.min(3.4, 3.4 - Math.max(0, len - 30) * 0.028));
  return {
    fontSize: `clamp(1.5rem, 4.5vw, ${maxRem.toFixed(2)}rem)`,
    lineHeight: maxRem > 2.6 ? 1.04 : 1.12,
    maxWidth: `${Math.min(30, Math.round(16 + len * 0.14))}ch`,
    textWrap: len > 70 ? "pretty" : "balance",
  };
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

  const { hydrated, lastDebrief, completed, isAnonymous } = useField();

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
        <p className="section-label mb-5">Couldn&rsquo;t open this scenario</p>
        <h1 className="display max-w-[16ch] text-ink" style={{ fontSize: "clamp(1.9rem,5vw,2.8rem)" }}>
          That review didn&rsquo;t load.
        </h1>
        <button type="button" onClick={() => router.push("/field")} className="btn mt-8 self-start">
          Back to the Field
        </button>
      </main>
    );
  }

  const d = isReview ? review?.debrief : lastDebrief;

  if (!hydrated || !d)
    return <Loading label={isReview ? "Opening this scenario…" : undefined} />;

  const moved = d.moves.filter((m) => m.moved);
  // A profile still entirely at not-yet-shown is a baseline read — the first rep,
  // or an early one where nothing has crossed a band yet. It earns a warmer
  // starting-line framing instead of the veteran-plateau "held your ground" copy,
  // so a beginner's first debrief doesn't read as a failure to advance.
  const atBaseline = d.moves.every((m) => m.before === "not_shown");
  const headerTitle = isReview
    ? (getMission(review!.missionId)?.title ?? "Scenario")
    : (completed[0]?.title ?? "Scenario");
  const next = isReview ? null : getMission(d.nextMissionId);
  const mission = isReview ? getMission(review!.missionId) : null;

  // The first-mission Save moment replaces the forward CTA on the live debrief of
  // the user's FIRST rep, and only for a still-anonymous user (and only when the
  // account-linking flag is on). Every later debrief keeps the normal next-rep
  // CTA; the Field carries the quiet re-surface for anyone who chose "Not now".
  // completed is refreshed before this page renders, so length === 1 is reliable.
  const showSave =
    !isReview && ACCOUNT_LINKING_ENABLED && isAnonymous && completed.length === 1;

  return (
    <main className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pb-24 pt-[clamp(1.5rem,4.5vw,3.25rem)]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/field")}
          className="-ml-1 inline-flex min-h-[32px] items-center gap-[0.6ch] px-1 text-[0.82rem] font-medium text-ink-3 transition-colors hover:text-accent"
        >
          <Back /> The Field
        </button>
        <ThemeToggle />
      </div>

      {/* hero — the emotional peak. It breaks the rail to the page's left edge so
          the verdict lands with full force; the mission/mode is an informative
          folio above it, and one framing line says what this read is. */}
      <header className="mt-[clamp(2rem,6vw,3.5rem)] animate-riseIn">
        <p className="meta mb-3">{headerTitle} · Practice Review</p>
        <h1 className="display text-ink" style={headlineStyle(d.headline)}>
          {d.headline}
        </h1>
        <p className="mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-ink-2">
          {isReview
            ? "A look back at how you approached this scenario."
            : "An honest review of how you worked — what landed, what to improve, and the practice that follows."}
        </p>
      </header>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* what worked leads — the first beat after the verdict is affirming,
          before the evidence and the gaps */}
      <Row as="section" aria-label="What worked" rail={<h2 className="section-label">What worked</h2>}>
        <p className="max-w-measure text-[1.02rem] leading-relaxed text-ink">{d.worked}</p>
      </Row>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* what to improve — the miss named, then a stronger approach */}
      <div className="space-y-[clamp(1.75rem,4vw,2.75rem)]">
        <Row
          as="section"
          aria-label="What to improve next"
          rail={
            <h2 className="section-label" style={{ color: "var(--warn)" }}>
              What to improve next
            </h2>
          }
        >
          <p className="max-w-measure text-[1.02rem] leading-relaxed text-ink">{d.missed}</p>
        </Row>
        <Row
          as="section"
          aria-label="A stronger approach"
          rail={<h2 className="section-label">A stronger approach</h2>}
        >
          <p className="max-w-measure text-[1.05rem] leading-relaxed text-ink-2">{d.expert}</p>
        </Row>
      </div>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* the evidence / session line — each moment is tagged in words (strength /
          to sharpen) so the good-vs-gap signal never rides on colour alone */}
      <Row
        as="section"
        aria-label="Evidence from your session"
        rail={<h2 className="section-label">From your session</h2>}
      >
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
                <p className="meta mb-1 flex flex-wrap items-baseline gap-x-2">
                  <span style={{ color: "var(--ink-3)" }}>{m.who}</span>
                  {m.tone !== "neutral" && (
                    <span style={{ color: m.tone === "good" ? "var(--accent)" : "var(--warn)" }}>
                      {m.tone === "good" ? "strength" : "to sharpen"}
                    </span>
                  )}
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
      </Row>

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {/* capability movement — in words, no bars, no numbers. A baseline read
          (all still not-yet-shown) is framed as a starting line, not a plateau. */}
      <Row
        as="section"
        aria-label="Your Field Profile"
        rail={<h2 className="section-label">Your Field Profile</h2>}
      >
        {atBaseline && (
          <p className="mb-5 max-w-measure text-[1.02rem] leading-relaxed text-ink">
            Every capability still reads not observed yet. This scenario sets your
            starting Field Profile — a starting read, not a score to beat.
          </p>
        )}
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
        ) : atBaseline ? (
          <p className="max-w-measure text-[0.98rem] text-ink-2">
            Nothing crossed into a new state yet — early scenarios often read
            quiet. Your capabilities begin to move as you practise more; this one
            sets the starting point they climb from.
          </p>
        ) : (
          <p className="max-w-measure text-[0.98rem] text-ink-2">
            Nothing moved enough to change a state this time — the honest read is
            that this scenario held your ground rather than advancing it.
          </p>
        )}
        <p className="mt-5 max-w-measure text-[0.88rem] leading-snug text-ink-3">
          Capabilities this scenario didn&rsquo;t call for stayed exactly where
          they were. Finishing a scenario never inflates a capability you
          didn&rsquo;t use.
        </p>
      </Row>

      {/* review mode: what you actually submitted */}
      {isReview && mission && (
        <>
          <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />
          <Row
            as="section"
            aria-label="What you produced"
            rail={<h2 className="section-label">What you produced</h2>}
          >
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
          </Row>
        </>
      )}

      <hr className="rule my-[clamp(2.5rem,6vw,3.5rem)]" />

      {isReview ? (
        /* review: no forward CTA — the recommendation lives on the Field, current */
        <Row as="section" aria-label="Next" rail={<p className="meta">Next</p>}>
          <p className="max-w-measure text-[0.95rem] leading-relaxed text-ink-2">
            Your latest recommendation is waiting on the Field.
          </p>
          <button type="button" onClick={() => router.push("/field")} className="btn mt-6">
            Back to the Field
            <Arrow className="arr" />
          </button>
        </Row>
      ) : showSave ? (
        <SaveMoment profile={d.newProfile} practice={d.practice} />
      ) : next ? (
        /* live: the gap resolves into the next assignment */
        <Row
          as="section"
          aria-label="Recommended next practice"
          className="animate-riseIn"
          rail={<p className="meta">Recommended next practice</p>}
        >
          <p className="max-w-[38ch] text-[clamp(1.05rem,2.4vw,1.2rem)] font-medium leading-[1.45] text-ink">
            Recommended to strengthen{" "}
            <span className="font-semibold text-accent">
              {COMPETENCY_META[d.practice].label}
            </span>
            .
          </p>
          <p className="mt-3 max-w-measure text-[1.02rem] leading-relaxed text-ink-2">
            {practicePitch(d.practice, d.newProfile)}
          </p>
          <h2
            className="display mt-6 text-ink"
            style={{ fontSize: "clamp(2.2rem,6.5vw,3.6rem)" }}
          >
            {next.title}
          </h2>
          <p className="mt-3 max-w-[36ch] text-[1.05rem] leading-normal text-ink-2">
            {next.premise}
          </p>
          <button
            type="button"
            onClick={() => {
              // Next Mission Clicked — intent to continue from the debrief. from
              // is the just-completed rep (most recent evaluated attempt).
              const fromId = completed[0]?.missionId;
              if (fromId) {
                track(EVENTS.NEXT_MISSION_CLICKED, {
                  from_mission_id: fromId,
                  to_mission_id: next.id,
                  practice_competency: d.practice,
                });
              }
              router.push(`/briefing/${next.id}`);
            }}
            className="btn mt-7"
          >
            Begin {next.title}
            <Arrow className="arr" />
          </button>
        </Row>
      ) : (
        /* live but the next mission id didn't resolve — degrade, don't crash */
        <Row as="section" aria-label="Next" rail={<p className="meta">Next</p>}>
          <p className="max-w-measure text-[0.95rem] leading-relaxed text-ink-2">
            Your review is saved. Head back to the Field to pick up your next
            practice.
          </p>
          <button type="button" onClick={() => router.push("/field")} className="btn mt-6">
            Back to the Field
            <Arrow className="arr" />
          </button>
        </Row>
      )}
    </main>
  );
}

// The first-scenario Save moment — inline at the tail of the first live Practice
// Review, framed around preserving the Field Profile the person just earned (not
// "create an account"). It reflects the actual capability result and shows all
// five states. Continue with Google upgrades the anonymous user in place;
// "Continue without saving" keeps the anonymous progress and returns to the
// Field, where the offer re-surfaces quietly.
function SaveMoment({
  profile,
  practice,
}: {
  profile: Profile;
  practice: Competency;
}) {
  const router = useRouter();
  const { linkGoogle } = useField();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return; // once, even under StrictMode double-invoke
    viewed.current = true;
    track(EVENTS.SAVE_PROFILE_VIEWED, {});
  }, []);

  // A short spoken-language summary of the strongest capability, so the moment
  // reflects what actually happened rather than a generic "results are in".
  const bestCap = [...COMPETENCY_ORDER].sort((a, b) => profile[b] - profile[a])[0];
  const bestBand = scoreToBand(profile[bestCap]);
  const bestLabel = COMPETENCY_META[bestCap].label;
  const praise =
    bestBand === "strong"
      ? `You showed a clear strength in ${bestLabel}.`
      : bestBand === "proficient"
        ? `You were consistent on ${bestLabel}.`
        : bestBand === "developing"
          ? `You're developing ${bestLabel}.`
          : bestBand === "emerging"
            ? `${bestLabel} is starting to show.`
            : "You've made your first pass across the five capabilities.";

  async function connect() {
    if (linking) return;
    setError(false);
    setLinking(true);
    track(EVENTS.SAVE_PROFILE_CLICKED, { auth_provider: "google" });
    try {
      await linkGoogle(); // redirects to Google on success (returns via /auth/callback)
    } catch {
      setError(true);
      setLinking(false);
    }
  }

  function skip() {
    track(EVENTS.SAVE_PROFILE_SKIPPED, {});
    router.push("/field");
  }

  return (
    <Row
      as="section"
      aria-label="Save your Field Profile"
      className="animate-riseIn"
      rail={<p className="meta">Save your profile</p>}
    >
      <p className="max-w-[40ch] text-[clamp(1.05rem,2.4vw,1.2rem)] font-medium leading-[1.45] text-ink">
        Your first Field Profile is ready.
      </p>
      <p className="mt-3 max-w-measure text-[1.02rem] leading-relaxed text-ink-2">
        {praise}{" "}
        <span className="text-ink">
          {COMPETENCY_META[practice].label} is the best area to practise next.
        </span>
      </p>

      {/* all five capabilities, including "not observed yet" where it applies */}
      <ul className="mt-6 m-0 grid max-w-[34rem] list-none grid-cols-1 gap-x-8 gap-y-2.5 p-0 sm:grid-cols-2">
        {COMPETENCY_ORDER.map((c) => {
          const { marker, phrase } = bandToState(scoreToBand(profile[c]));
          const isNext = c === practice;
          return (
            <li key={c} className="flex items-baseline gap-[0.6ch]">
              <span className="mt-[0.2em]">
                <Marker kind={marker} gap={isNext} />
              </span>
              <span className="text-[0.92rem] text-ink">
                {COMPETENCY_META[c].label}
              </span>
              <span className="ml-auto pl-3 text-[0.82rem] text-ink-3">
                {phrase}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
        <button type="button" onClick={connect} disabled={linking} className="btn">
          <span className="inline-grid place-items-center rounded-[3px] bg-white p-[3px]">
            <GoogleG />
          </span>
          {linking ? "Saving…" : "Save my Field Profile with Google"}
        </button>
        <button type="button" onClick={skip} className="btn--quiet">
          Continue without saving
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 max-w-measure text-[0.9rem] leading-relaxed text-warn">
          Couldn&rsquo;t save your profile just now — keep practising, you can try
          again from the Field.
        </p>
      ) : (
        <p className="mt-4 max-w-measure text-[0.85rem] leading-relaxed text-ink-3">
          Save your progress and keep building your profile across future
          scenarios.
        </p>
      )}
    </Row>
  );
}

// Editorial side-heading row: the section label sits in a left rail and the
// content in the main column, so the debrief reads as a structured document and
// uses the width on wide screens. On mobile the grid collapses to one column —
// the label stacks above its content, in DOM order.
function Row({
  rail,
  children,
  className = "",
  as: As = "div",
  ...rest
}: {
  rail: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
  "aria-label"?: string;
}) {
  return (
    <As
      className={`grid gap-x-[clamp(1.5rem,4vw,3rem)] gap-y-3 min-[860px]:grid-cols-[minmax(140px,180px)_minmax(0,1fr)] ${className}`}
      {...rest}
    >
      <div className="min-[860px]:pt-[0.35rem]">{rail}</div>
      <div className="min-w-0">{children}</div>
    </As>
  );
}
