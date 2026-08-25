import type { Competency } from "./missions/types";

export const COMPETENCY_ORDER: Competency[] = [
  "context",
  "direction",
  "iteration",
  "verification",
  "synthesis",
];

export const COMPETENCY_META: Record<
  Competency,
  { label: string; question: string }
> = {
  context: {
    label: "Context",
    question: "Did you recognise what the AI needed to know, and give it?",
  },
  direction: {
    label: "Direction",
    question: "Did you set a clear objective, constraints, and output?",
  },
  iteration: {
    label: "Iteration",
    question: "Did you push past the first answer instead of accepting it?",
  },
  verification: {
    label: "Verification",
    question: "Did you catch the AI's mistakes, gaps, and invented claims?",
  },
  synthesis: {
    label: "Synthesis",
    question: "Did you turn the AI's output into something genuinely useful?",
  },
};

// Internal band scale (stored 0–100, exposed only as bands/states).
export type Band =
  | "not_shown"
  | "emerging"
  | "developing"
  | "proficient"
  | "strong";

export type MarkerKind = "open" | "filled" | "ringed";

/** The glanceable practice state for the register: marker glyph + words. */
export function bandToState(band: Band): { marker: MarkerKind; phrase: string } {
  switch (band) {
    case "not_shown":
      return { marker: "open", phrase: "not yet worked" };
    case "emerging":
      return { marker: "filled", phrase: "shown once" };
    case "developing":
      return { marker: "filled", phrase: "shown in a few reps" };
    case "proficient":
      return { marker: "ringed", phrase: "shown consistently" };
    case "strong":
      return { marker: "ringed", phrase: "a reliable strength" };
  }
}

export function bandLabel(band: Band): string {
  return band === "not_shown" ? "not yet shown" : band;
}

// Deterministic mapping between the internal score and a band (illustrative
// curve for the MVP; the real curve is tuned at the M1 gate per SPEC).
export function scoreToBand(score: number): Band {
  if (score <= 0) return "not_shown";
  if (score < 30) return "emerging";
  if (score < 55) return "developing";
  if (score < 80) return "proficient";
  return "strong";
}

export type Profile = Record<Competency, number>;

export const FRESH_PROFILE: Profile = {
  context: 0,
  direction: 0,
  iteration: 0,
  verification: 0,
  synthesis: 0,
};

/** The gap = lowest-scoring competency, ties broken by COMPETENCY_ORDER. */
export function gapCompetency(profile: Profile): Competency {
  let gap: Competency = COMPETENCY_ORDER[0];
  let lowest = Infinity;
  for (const c of COMPETENCY_ORDER) {
    if (profile[c] < lowest) {
      lowest = profile[c];
      gap = c;
    }
  }
  return gap;
}
