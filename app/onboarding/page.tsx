"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";
import { Arrow } from "@/components/icons";

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
    aside: "This flavours the missions and the language. It never changes how you're judged.",
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

export default function Onboarding() {
  const router = useRouter();
  const { saveOnboarding } = useField();
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({});

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  function choose(value: string) {
    const next = { ...picks, [step.key]: value };
    setPicks(next);
    if (last) {
      saveOnboarding(next, true);
      router.push("/field");
    } else {
      // brief beat so the selection registers, then advance
      setTimeout(() => setI((n) => n + 1), 140);
    }
  }

  function skip() {
    saveOnboarding(picks, true);
    router.push("/field");
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
          <button
            type="button"
            onClick={skip}
            className="btn--quiet inline-flex items-center gap-[0.5ch] border-b border-transparent hover:border-hairline"
          >
            Skip to your first rep
            <Arrow width={14} />
          </button>
        </header>

        <div key={i} className="flex flex-1 flex-col justify-center py-12 animate-riseIn">
          <p className="section-label mb-4">Setting up your practice</p>
          <h1
            className="display max-w-[16ch] text-ink"
            style={{ fontSize: "clamp(2.1rem,6vw,3.4rem)" }}
          >
            {step.prompt}
          </h1>
          <p className="mt-5 max-w-[42ch] text-[0.95rem] leading-relaxed text-ink-2">
            {step.aside}
          </p>

          <ul className="mt-9 max-w-[34rem] list-none p-0">
            {step.options.map((opt) => {
              const active = picks[step.key] === opt;
              return (
                <li key={opt} className="border-t border-hairline last:border-b">
                  <button
                    type="button"
                    onClick={() => choose(opt)}
                    aria-pressed={active}
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
