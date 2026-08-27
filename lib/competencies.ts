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

// The one shared capability-state scale — every surface (the Field register, the
// Practice Review, the Field Profile) reads its words from here so a capability
// never reads two ways across the product.
//   Not observed yet · Starting to show · Developing · Consistent · A clear strength

/** The glanceable practice state for the register: marker glyph + words. */
export function bandToState(band: Band): { marker: MarkerKind; phrase: string } {
  switch (band) {
    case "not_shown":
      return { marker: "open", phrase: "Not observed yet" };
    case "emerging":
      return { marker: "filled", phrase: "Starting to show" };
    case "developing":
      return { marker: "filled", phrase: "Developing" };
    case "proficient":
      return { marker: "ringed", phrase: "Consistent" };
    case "strong":
      return { marker: "ringed", phrase: "A clear strength" };
  }
}

/** The same scale in lowercase, for flowing inline sentences ("your Synthesis is …"). */
export function bandLabel(band: Band): string {
  switch (band) {
    case "not_shown":
      return "not observed yet";
    case "emerging":
      return "starting to show";
    case "developing":
      return "developing";
    case "proficient":
      return "consistent";
    case "strong":
      return "a clear strength";
  }
}

/**
 * THE canonical band scale — the single source of truth for both the display
 * range a stored 0–100 score falls into AND the blend target the progression
 * code pulls a bar toward. Keeping range + target in one table is what stops
 * the two from drifting apart (which previously let a judged "strong" rep show
 * as "proficient" on the profile).
 *
 * Ranges are contiguous and cover 0–100. Targets sit inside their own range so
 * a highly-weighted attempt lands in the matching band (see updateProfile's
 * blend). Invariant asserted in scripts/verify-progression.ts:
 *   target ∈ [min,max]  AND  scoreToBand(target) === band.
 */
export type BandSpec = { band: Band; min: number; max: number; target: number };

export const BAND_SCALE: readonly BandSpec[] = [
  { band: "not_shown", min: 0, max: 0, target: 0 },
  { band: "emerging", min: 1, max: 29, target: 20 },
  { band: "developing", min: 30, max: 54, target: 42 },
  { band: "proficient", min: 55, max: 79, target: 68 },
  { band: "strong", min: 80, max: 100, target: 90 },
];

/** Internal 0–100 anchor per band — DERIVED from BAND_SCALE, never hand-kept. */
export const BAND_TARGET: Record<Band, number> = Object.fromEntries(
  BAND_SCALE.map((s) => [s.band, s.target]),
) as Record<Band, number>;

/** Deterministic score → band, derived from the one canonical BAND_SCALE. */
export function scoreToBand(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  for (const spec of BAND_SCALE) {
    if (s >= spec.min && s <= spec.max) return spec.band;
  }
  return "not_shown";
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
