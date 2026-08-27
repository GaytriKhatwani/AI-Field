"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";
import { getMission, MISSIONS, FIRST_MISSION_ID } from "@/lib/missions";
import { recommendNext } from "@/lib/progression/recommend";
import type { Competency } from "@/lib/missions/types";
import {
  COMPETENCY_ORDER,
  COMPETENCY_META,
  gapCompetency,
  scoreToBand,
  bandToState,
  practicePitch,
} from "@/lib/competencies";
import { CapabilityRegister } from "@/components/CapabilityRegister";
import { ACCOUNT_LINKING_ENABLED } from "@/lib/flags";
import { Arrow, Chevron } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Field() {
  const router = useRouter();
  const { hydrated, profile, completed, recommendation, lastDebrief, isAnonymous } =
    useField();
  const [recordOpen, setRecordOpen] = useState(false);
  const [openMission, setOpenMission] = useState<string | null>(null);

  const completedIds = completed.map((c) => c.missionId);
  const hasReps = completed.length > 0;
  // The gap is the competency the judge chose to practise next (what actually
  // drove the recommendation) — the same authority behind nextMissionId. Prefer
  // the just-finished debrief, then the durable recommendation loaded from the
  // backend, and only fall back to the profile-derived weakest when neither is
  // available — so the "your gap" marker can never contradict the recommended
  // mission, even on a cold load in a fresh tab.
  const gap = hasReps
    ? (lastDebrief?.practice ?? recommendation?.practice ?? gapCompetency(profile))
    : null;

  // Prefer the judge-driven recommendation (just-finished debrief, then the
  // durable one loaded from the backend). With neither stored, derive it: a
  // brand-new operator gets the catalog's first mission; a returning one gets
  // the deterministic recommender aimed at their gap — never a hardcoded id.
  const recommendedId =
    lastDebrief?.nextMissionId ??
    recommendation?.nextMissionId ??
    (hasReps
      ? recommendNext(gap ?? gapCompetency(profile), completedIds)
      : FIRST_MISSION_ID);
  // Safe resolution — an unknown/stale id can never crash the Field: fall back
  // to the first mission, and to the catalog head as a last resort.
  const recommended =
    getMission(recommendedId) ?? getMission(FIRST_MISSION_ID) ?? MISSIONS[0];

  const rest = MISSIONS.filter(
    (m) => m.id !== recommended.id && !completedIds.includes(m.id),
  );

  const evidence = useMemo(() => {
    const out = {} as Record<Competency, string>;
    for (const comp of COMPETENCY_ORDER) {
      const band = scoreToBand(profile[comp]);
      const phrase = bandToState(band).phrase;
      if (comp === gap) {
        out[comp] =
          band === "not_shown"
            ? `Not observed yet — your best area to practise next. ${recommended.title} is built to draw it out.`
            : `${phrase} — and still your best area to practise next. ${recommended.title} focuses on it.`;
        continue;
      }
      if (profile[comp] > 0) {
        const rep = completed.find((c) => c.shown.includes(comp));
        out[comp] = rep ? `Shown in ${rep.title} — ${phrase}.` : `${phrase}.`;
      } else {
        out[comp] =
          "Not observed yet — a later scenario will draw it out when it's the useful next one.";
      }
    }
    return out;
  }, [profile, gap, completed, recommended.title]);

  const whyLine = hasReps ? (
    <>
      Recommended to strengthen{" "}
      <span className="font-semibold text-accent">
        {COMPETENCY_META[gap!].label}
      </span>
      .
    </>
  ) : (
    <>
      Your first scenario — a realistic task chosen to establish your starting
      Field Profile across all five capabilities.
    </>
  );

  if (!hydrated) {
    return (
      <main className="grid min-h-screen place-items-center">
        <div
          role="status"
          aria-label="Loading"
          className="meta animate-breathe"
          style={{ letterSpacing: "0.2em" }}
        >
          AI&nbsp;Field
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pb-16 pt-[clamp(1.5rem,4.5vw,3.75rem)]">
      {/* top */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-4">
        <span
          className="font-semibold uppercase text-ink"
          style={{ fontSize: "0.82rem", letterSpacing: "0.2em" }}
        >
          AI&nbsp;Field
        </span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-expanded={recordOpen}
            onClick={() => setRecordOpen((o) => !o)}
            className="inline-flex items-center gap-[0.5ch] border-b border-transparent pb-1 text-[0.82rem] font-medium text-ink-2 transition-colors hover:border-hairline hover:text-ink"
          >
            <span>
              Your Field Profile ·{" "}
              {hasReps ? (
                <span className="num">
                  {completed.length}&nbsp;scenario{completed.length > 1 ? "s" : ""} completed
                </span>
              ) : (
                "ready to begin"
              )}
            </span>
            <Chevron
              width={7}
              height={11}
              className="transition-transform"
              style={{ transform: recordOpen ? "rotate(90deg)" : "none" }}
            />
          </button>
          <ThemeToggle />
        </div>
      </header>

      {recordOpen && (
        <div className="mt-4 max-w-measure animate-fadeUp rounded-sm border border-hairline bg-raised px-4 py-4 text-[0.9rem] text-ink-2">
          {hasReps ? (
            <ul className="m-0 list-none space-y-1 p-0">
              {completed.map((c) => (
                <li key={c.attemptId}>
                  <button
                    type="button"
                    onClick={() => router.push(`/debrief?attemptId=${c.attemptId}`)}
                    className="group -mx-2 flex w-full items-baseline gap-1 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-ground"
                  >
                    <span className="font-semibold text-ink group-hover:text-accent">
                      {c.title}
                    </span>
                    <span className="text-ink-2">
                      {c.shown.length > 0 ? (
                        <>
                          {" "}
                          — showed{" "}
                          {c.shown.map((s) => COMPETENCY_META[s].label).join(", ")}.
                        </>
                      ) : (
                        " — logged."
                      )}
                    </span>
                    <span
                      aria-hidden
                      className="ml-auto self-center text-ink-3 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Review ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            "Your record begins with your first scenario, and grows one completed scenario at a time."
          )}
        </div>
      )}

      {ACCOUNT_LINKING_ENABLED && <LinkErrorNote />}
      {ACCOUNT_LINKING_ENABLED && isAnonymous && hasReps && <FieldSaveLine />}

      {/* the one next rep */}
      <section className="mt-[clamp(3rem,9vw,6rem)] max-w-[40ch] animate-riseIn" aria-label="Your next scenario">
        <h1 className="display text-ink" style={{ fontSize: "clamp(2.7rem,8.5vw,5rem)" }}>
          {recommended.title}
        </h1>
        <p className="mt-[1.35rem] max-w-[34ch] text-[clamp(1.05rem,2.4vw,1.2rem)] font-medium leading-[1.45] text-ink">
          {whyLine}
        </p>
        <p className="mt-2 max-w-[38ch] text-[clamp(1.02rem,2.2vw,1.12rem)] leading-normal text-ink-2">
          {hasReps ? practicePitch(gap!, profile) : recommended.premise}
        </p>
        <p className="meta mt-[1.4rem] flex flex-wrap items-center gap-[0.75ch]">
          <span className="num">~{recommended.effortMinutes}</span> min
          <span className="inline-block h-[3px] w-[3px] rounded-full bg-ink-3" />
          builds{" "}
          {topCompetencies(recommended.competencyWeights)
            .map((c) => COMPETENCY_META[c].label)
            .join(" · ")}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/briefing/${recommended.id}`)}
          className="btn mt-[1.9rem]"
        >
          Begin
          <Arrow className="arr" />
        </button>
      </section>

      {rest.length > 0 && (
        <>
          <hr className="rule my-[clamp(2.75rem,6vw,4.25rem)]" />
          <section aria-label="More scenarios to practise">
            <h2 className="section-label mb-5">More scenarios to practise</h2>
            <ul className="m-0 list-none p-0">
              {rest.map((m) => {
                const later = m.availability === "later";
                const isOpen = openMission === m.id;
                return (
                  <li
                    key={m.id}
                    className="border-t border-hairline last:border-b"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenMission(isOpen ? null : m.id)}
                      className="group flex w-full items-baseline justify-between gap-6 py-[1.15rem] text-left transition-transform duration-200 ease hover:translate-x-1.5"
                    >
                      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-[1.1rem] gap-y-1">
                        <span
                          className={`heading whitespace-nowrap text-[1.2rem] transition-colors group-hover:text-accent ${
                            later ? "text-ink-2" : "text-ink"
                          }`}
                        >
                          {m.title}
                        </span>
                        <span className="text-[0.95rem] text-ink-2">
                          {m.tagline}
                        </span>
                      </span>
                      {later && (
                        <span className="meta flex-none self-center">
                          recommended later
                        </span>
                      )}
                      <Chevron
                        className="flex-none self-center text-ink-3 transition-transform group-aria-[expanded=true]:rotate-90"
                        style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                      />
                    </button>
                    {isOpen && (
                      <div className="animate-fadeUp px-1 pb-[1.35rem]">
                        {later ? (
                          <p className="m-0 max-w-[52ch] text-[0.9rem] text-ink-2">
                            Best after a few more scenarios. Right now{" "}
                            <span className="font-semibold text-ink">
                              {recommended.title}
                            </span>{" "}
                            is the one to practise
                            {gap && (
                              <>
                                {" "}
                                — it strengthens your{" "}
                                {COMPETENCY_META[gap].label} first
                              </>
                            )}
                            .
                          </p>
                        ) : (
                          <>
                            <p className="meta mb-4">
                              <span className="num">~{m.effortMinutes}</span> min
                              &nbsp;·&nbsp; builds{" "}
                              {topCompetencies(m.competencyWeights)
                                .map((c) => COMPETENCY_META[c].label)
                                .join(" · ")}
                            </p>
                            <button
                              type="button"
                              onClick={() => router.push(`/briefing/${m.id}`)}
                              className="btn btn--ghost"
                            >
                              Begin this instead
                              <Arrow className="arr" width={15} />
                            </button>
                            <p className="mt-[0.95rem] text-[0.85rem] text-ink-2">
                              Your recommended scenario is still{" "}
                              <span className="font-semibold text-ink">
                                {recommended.title}
                              </span>
                              .
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <hr className="rule my-[clamp(2.75rem,6vw,4.25rem)]" />

      {hasReps ? (
        <CapabilityRegister profile={profile} gap={gap} evidence={evidence} />
      ) : (
        <section aria-label="Your five AI capabilities">
          <h2 className="section-label mb-4">Your five AI capabilities</h2>
          <p className="max-w-measure text-[1.02rem] leading-relaxed text-ink-2">
            Complete your first scenario to establish your starting Field
            Profile — how you handle context, direction, iteration,
            verification, and synthesis.
          </p>
        </section>
      )}
    </main>
  );
}

function topCompetencies(
  weights: Record<Competency, number>,
): Competency[] {
  return COMPETENCY_ORDER.filter((c) => weights[c] >= 0.9);
}

// Quiet note when the Google account-linking round-trip came back a failure
// (the OAuth callback redirects to /field?link=error — e.g. that Google email
// already belongs to another account; Supabase won't merge). Anonymous progress
// is untouched. Reads the param client-side and cleans the URL so a refresh
// doesn't re-show it.
function LinkErrorNote() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("link") === "error") {
        setShow(true);
        params.delete("link");
        const qs = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (qs ? `?${qs}` : ""),
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[0.82rem] text-warn"
    >
      <span>
        Couldn&rsquo;t connect that Google account — it may already be linked to
        another account. Your progress is safe; you can try again.
      </span>
      <button type="button" onClick={() => setShow(false)} className="btn--quiet ml-auto">
        Dismiss
      </button>
    </div>
  );
}

// Quiet, dismissible re-surface of the Save offer for an anonymous user with reps
// (typically one who chose "Not now" at the first debrief). Honest framing: the
// work is saved, just not reachable from another browser until an account links
// it. Dismissal is remembered per-device; connecting upgrades in place.
const SAVE_LINE_DISMISSED = "aifield.saveLineDismissed";

function FieldSaveLine() {
  const { linkGoogle } = useField();
  // Start hidden; reveal only after confirming (client-side) it wasn't dismissed,
  // so there's no flash before the localStorage check.
  const [dismissed, setDismissed] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(SAVE_LINE_DISMISSED) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  async function connect() {
    if (linking) return;
    setLinking(true);
    try {
      await linkGoogle(); // redirects on success
    } catch {
      setLinking(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(SAVE_LINE_DISMISSED, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-3 text-[0.82rem] text-ink-3">
      <span>Your Field Profile is only saved in this browser.</span>
      <button
        type="button"
        onClick={connect}
        disabled={linking}
        className="btn--quiet inline-flex items-center gap-[0.5ch] text-accent"
      >
        {linking ? "Saving…" : "Save it with Google"}
        <Arrow width={13} />
      </button>
      <button type="button" onClick={dismiss} className="btn--quiet ml-auto">
        Dismiss
      </button>
    </div>
  );
}
