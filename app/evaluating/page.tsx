"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useField } from "@/lib/store";

const READING = [
  "How you directed the AI",
  "What you gave it to work from",
  "How far you pushed the first answer",
  "What you chose to submit",
];

export default function Evaluating() {
  const router = useRouter();
  const { hydrated, lastDebrief } = useField();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!hydrated) return;
    if (!lastDebrief) {
      router.replace("/field");
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const step = window.setInterval(
      () => setActive((a) => Math.min(a + 1, READING.length)),
      reduce ? 120 : 620,
    );
    const done = window.setTimeout(
      () => router.replace("/debrief"),
      reduce ? 400 : 2700,
    );
    return () => {
      window.clearInterval(step);
      window.clearTimeout(done);
    };
  }, [hydrated, lastDebrief, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-[clamp(1.25rem,5vw,3.25rem)] py-16">
      <p className="section-label mb-5">The examiner is reading your session</p>
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
