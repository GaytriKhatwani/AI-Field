"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";
import { FIRST_MISSION_ID } from "@/lib/missions";
import { track, EVENTS } from "@/lib/analytics/client";
import { Arrow, Back } from "@/components/icons";

type Step = {
  key: "role" | "aiUsage" | "goal";
  prompt: string;
  aside: string;
  options: string[];
};

const STEPS: Step[] = [
  {
    key: "role",
    prompt: "What kind of work do you do?",
    aside: "This just tailors the missions and wording to you — it never changes how you're judged.",
    options: [
      "Marketing",
      "Operations",
      "Product / PM",
      "Founder / business",
      "Something else",
      "Rather not say",
    ],
  },
  {
    key: "aiUsage",
    prompt: "How often do you work with AI?",
    aside: "So the coaching meets you where you are.",
    options: ["Rarely", "A few times a week", "Most days", "Constantly"],
  },
  {
    key: "goal",
    prompt: "What do you want to get sharper at?",
    aside: "Your first rep is set either way — this just tunes the framing.",
    options: [
      "Briefing AI properly",
      "Checking what it gives back",
      "Pushing past the first answer",
      "Turning output into real work",
      "Not sure yet — show me",
    ],
  },
];

// Fixed-chip option sets — an onboarding value is only emitted as an enum when
// it is one of these (a future free-text answer would be omitted, never sent).
const ROLE_OPTIONS = new Set(STEPS[0].options);
const USAGE_OPTIONS = new Set(STEPS[1].options);

function onboardingCompletedProps(
  picks: Record<string, string>,
  completed: boolean,
): { completed: boolean; role_enum?: string; ai_usage_enum?: string } {
  const props: { completed: boolean; role_enum?: string; ai_usage_enum?: string } = {
    completed,
  };
  if (picks.role && ROLE_OPTIONS.has(picks.role)) props.role_enum = picks.role;
  if (picks.aiUsage && USAGE_OPTIONS.has(picks.aiUsage)) props.ai_usage_enum = picks.aiUsage;
  // goal is deliberately NOT sent.
  return props;
}

export default function Onboarding() {
  const router = useRouter();
  const { saveOnboarding, hydrated, userId } = useField();
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const startedTracked = useRef(false);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Onboarding Started — once, only after the anonymous identity has resolved.
  useEffect(() => {
    if (hydrated && userId && !startedTracked.current) {
      startedTracked.current = true;
      track(EVENTS.ONBOARDING_STARTED, {});
    }
  }, [hydrated, userId]);

  function choose(value: string) {
    const next = { ...picks, [step.key]: value };
    setPicks(next);
    if (last) {
      saveOnboarding(next, true);
      track(EVENTS.ONBOARDING_COMPLETED, onboardingCompletedProps(next, true));
      // First-run flow goes straight into the first mission (Landing → FTUE →
      // Meeting Chaos). The Field becomes the home base after the first debrief.
      router.push(`/briefing/${FIRST_MISSION_ID}`);
    } else {
      // brief beat so the selection registers, then advance
      setTimeout(() => setI((n) => n + 1), 140);
    }
  }

  function back() {
    setI((n) => Math.max(0, n - 1));
  }

  function skip() {
    saveOnboarding(picks, true);
    track(EVENTS.ONBOARDING_COMPLETED, onboardingCompletedProps(picks, false));
    router.push(`/briefing/${FIRST_MISSION_ID}`);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-reading flex-col px-[clamp(1.25rem,5vw,3.25rem)] py-[clamp(1.5rem,4vw,2.5rem)]">
        <header className="flex items-baseline justify-between">
          <span
            className="font-semibold uppercase text-ink"
            style={{ fontSize: "0.82rem", letterSpacing: "0.2em" }}
          >
            AI&nbsp;Field
          </span>
          <div className="flex items-center gap-5">
            {i > 0 && (
              <button
                type="button"
                onClick={back}
                className="btn--quiet inline-flex items-center gap-[0.5ch]"
              >
                <Back /> Back
              </button>
            )}
            <button
              type="button"
              onClick={skip}
              className="btn--quiet inline-flex items-center gap-[0.5ch] border-b border-transparent hover:border-hairline"
            >
              Skip to your first mission
              <Arrow width={14} />
            </button>
          </div>
        </header>

        <div key={i} className="flex flex-1 flex-col justify-center py-12 animate-riseIn">
          <p className="section-label mb-4">Three quick questions</p>
          <h1
            className="display max-w-[16ch] text-ink"
            style={{ fontSize: "clamp(2.1rem,6vw,3.4rem)" }}
          >
            {step.prompt}
          </h1>
          <p className="mt-5 max-w-[42ch] text-[0.95rem] leading-relaxed text-ink-2">
            {step.aside}
          </p>

          <ul
            role="radiogroup"
            aria-label={step.prompt}
            className="mt-9 max-w-[34rem] list-none p-0"
          >
            {step.options.map((opt) => {
              const active = picks[step.key] === opt;
              return (
                <li key={opt} className="border-t border-hairline last:border-b">
                  <button
                    type="button"
                    role="radio"
                    onClick={() => choose(opt)}
                    aria-checked={active}
                    className="group flex w-full items-center gap-4 py-[0.95rem] text-left transition-transform duration-200 ease hover:translate-x-1.5"
                  >
                    <span
                      aria-hidden
                      className="flex-none rounded-full transition-colors"
                      style={{
                        width: 9,
                        height: 9,
                        background: active ? "var(--accent)" : "transparent",
                        boxShadow: active
                          ? "none"
                          : "inset 0 0 0 1.5px var(--marker-open)",
                      }}
                    />
                    <span
                      className="heading text-ink transition-colors group-hover:text-accent"
                      style={{ fontSize: "1.35rem" }}
                    >
                      {opt}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="flex items-center gap-3 pb-4">
          {STEPS.map((_, n) => (
            <span
              key={n}
              aria-hidden
              className="rounded-full transition-all"
              style={{
                width: n === i ? 22 : 7,
                height: 7,
                background: n <= i ? "var(--accent)" : "var(--hairline)",
              }}
            />
          ))}
          <span className="sr-only">
            Question {i + 1} of {STEPS.length}
          </span>
        </footer>
      </div>
    </main>
  );
}
