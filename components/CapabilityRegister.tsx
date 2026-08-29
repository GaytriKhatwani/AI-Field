"use client";

import { useState } from "react";
import type { Competency } from "@/lib/missions/types";
import {
  COMPETENCY_ORDER,
  COMPETENCY_META,
  Profile,
  scoreToBand,
  bandToState,
  MarkerKind,
} from "@/lib/competencies";

export function Marker({
  kind,
  gap,
}: {
  kind: MarkerKind;
  gap?: boolean;
}) {
  const color = gap ? "var(--accent)" : "var(--ink)";
  const openColor = gap ? "var(--accent)" : "var(--marker-open)";
  if (kind === "open") {
    return (
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          boxShadow: `inset 0 0 0 1.5px ${openColor}`,
          flex: "none",
        }}
      />
    );
  }
  if (kind === "ringed") {
    return (
      <span
        aria-hidden
        style={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          boxShadow: `0 0 0 1.5px ${gap ? "var(--accent)" : "var(--hairline)"}`,
          position: "relative",
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
          }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: 9, height: 9, borderRadius: "50%", background: color, flex: "none" }}
    />
  );
}

export function CapabilityRegister({
  profile,
  gap,
  evidence,
  label = "Your five AI capabilities",
}: {
  profile: Profile;
  gap: Competency | null;
  evidence: Record<Competency, string>;
  label?: string;
}) {
  const [open, setOpen] = useState<Competency | null>(null);

  return (
    <section aria-label="Your five AI capabilities">
      <h2 className="section-label mb-5">{label}</h2>
      <ul className="caps-grid m-0 list-none p-0 overflow-hidden rounded-sm border border-hairline bg-hairline">
        {COMPETENCY_ORDER.map((comp) => {
          const band = scoreToBand(profile[comp]);
          const { marker, phrase } = bandToState(band);
          const isGap = comp === gap;
          const isOpen = open === comp;
          return (
            <li key={comp} className="flex cap-cell">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={isOpen ? "cap-evidence" : undefined}
                onClick={() => setOpen(isOpen ? null : comp)}
                className="w-full text-left bg-ground px-[1.05rem] pb-[1.15rem] pt-[1.1rem] transition-colors duration-150 hover:bg-raised aria-[expanded=true]:bg-raised flex flex-col gap-[0.55rem] cap-btn"
              >
                <span className="flex items-center gap-[0.6ch]">
                  <Marker kind={marker} gap={isGap} />
                  <span
                    className="meta"
                    style={{ color: "var(--ink)", letterSpacing: "0.09em" }}
                  >
                    {COMPETENCY_META[comp].label}
                  </span>
                </span>
                <span className="text-[0.82rem] leading-[1.35] text-ink-3">
                  {phrase}
                  {isGap && (
                    <span className="font-semibold text-accent">
                      {" "}
                      · best to practise next
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <p
          id="cap-evidence"
          aria-live="polite"
          className="mt-[1.05rem] max-w-measure rounded-sm border border-hairline bg-raised px-[1.05rem] py-[0.9rem] text-[0.9rem] text-ink-2 animate-fadeUp"
        >
          <span className="font-semibold text-ink">
            {COMPETENCY_META[open].label}.{" "}
          </span>
          {evidence[open]}
        </p>
      )}
    </section>
  );
}
