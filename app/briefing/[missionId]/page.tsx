"use client";

import { useParams, useRouter } from "next/navigation";
import { getMission } from "@/lib/missions";
import type { Competency } from "@/lib/missions/types";
import { COMPETENCY_ORDER, COMPETENCY_META } from "@/lib/competencies";
import { Arrow, Back } from "@/components/icons";

export default function Briefing() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const mission = getMission(params.missionId);

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

  const builds = COMPETENCY_ORDER.filter(
    (c) => mission.competencyWeights[c] >= 0.9,
  );

  return (
    <main className="mx-auto max-w-reading px-[clamp(1.25rem,5vw,3.25rem)] pb-24 pt-[clamp(1.5rem,4.5vw,3.25rem)]">
      <button
        type="button"
        onClick={() => router.push("/field")}
        className="inline-flex items-center gap-[0.6ch] text-[0.82rem] font-medium text-ink-3 transition-colors hover:text-accent"
      >
        <Back /> The Field
      </button>

      <header className="mt-[clamp(2.5rem,7vw,4.5rem)] max-w-[24ch] animate-riseIn">
        <p className="meta mb-4">Briefing</p>
        <h1 className="display text-ink" style={{ fontSize: "clamp(2.4rem,7vw,4rem)" }}>
          {mission.title}
        </h1>
      </header>

      {/* scenario leads — the largest reading block */}
      <p className="mt-10 max-w-measure text-[clamp(1.15rem,2.6vw,1.4rem)] font-medium leading-[1.5] text-ink">
        {mission.briefing.scenario}
      </p>

      <div className="mt-[clamp(2.5rem,6vw,3.75rem)] grid gap-[clamp(2rem,4vw,3rem)] md:grid-cols-[1fr_1fr]">
        <section>
          <h2 className="section-label mb-3">Your objective</h2>
          <p className="max-w-[40ch] text-[1.05rem] leading-relaxed text-ink-2">
            {mission.briefing.objective}
          </p>
        </section>

        <section>
          <h2 className="section-label mb-3">Constraints</h2>
          <ul className="m-0 list-none space-y-3 p-0">
            {mission.briefing.constraints.map((c, i) => (
              <li
                key={i}
                className="flex gap-3 text-[1.02rem] leading-snug text-ink-2"
              >
                <span
                  aria-hidden
                  className="num mt-[0.15em] flex-none font-semibold text-ink-3"
                  style={{ fontSize: "0.82rem" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <hr className="rule my-[clamp(2.5rem,6vw,3.75rem)]" />

      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <h2 className="section-label mb-2">You&rsquo;ll submit</h2>
          <p className="text-[1.05rem] text-ink">
            {capitalize(mission.briefing.deliverableDescription)}.
          </p>
          <p className="meta mt-4 flex flex-wrap items-center gap-[0.75ch]">
            <span className="num">~{mission.effortMinutes}</span> min
            <span className="inline-block h-[3px] w-[3px] rounded-full bg-ink-3" />
            {builds.map((c) => COMPETENCY_META[c].label).join(" · ")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/workbench/${mission.id}`)}
          className="btn"
          style={{ padding: "1em 1.9em", fontSize: "1.02rem" }}
        >
          Enter the Workbench
          <Arrow className="arr" />
        </button>
      </div>

      <p className="mt-10 flex max-w-measure items-start gap-2 text-[0.85rem] leading-snug text-ink-3">
        <span
          aria-hidden
          className="mt-[0.35em] h-[6px] w-[6px] flex-none rounded-full"
          style={{ background: "var(--warn)" }}
        />
        This is a practice environment on a free AI tier. The material here is
        synthetic — don&rsquo;t paste real confidential or personal data.
      </p>
    </main>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
