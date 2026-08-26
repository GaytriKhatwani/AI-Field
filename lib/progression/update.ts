import type { Competency } from "../missions/types";
import {
  Band,
  Profile,
  scoreToBand,
  COMPETENCY_ORDER,
  BAND_TARGET,
} from "../competencies";
import type { CompetencyEvidence } from "../judge/types";

// DETERMINISTIC profile update. The LLM never runs this. It takes the judge's
// per-competency bands and blends the stored 0–100 profile toward them, weighted
// by how much the mission emphasised each competency. Raw evaluation is stored
// separately (see /api/evaluate) so this is fully recomputable.
//
// TUNABLES decided at the M1 discrimination gate (SPEC): the band anchors (now
// BAND_TARGET, owned by the canonical BAND_SCALE in ../competencies so display
// range and blend target can't drift), the blend curve, and ALLOW_REGRESSION.

/**
 * Whether a single weak attempt may LOWER a bar the operator previously earned.
 * Default false: one off day shouldn't erase a demonstrated skill (kinder for
 * retention, and the profile still fails to rise). Flip at the gate if the
 * profile needs to punish regressions. `not_shown` never moves a bar.
 */
export const ALLOW_REGRESSION = false;

/** Heavier-weighted competencies move their bar more per attempt. */
function blendFactor(weight: number): number {
  return 0.4 + 0.5 * Math.max(0, Math.min(1, weight));
}

function blend(prev: number, target: number, weight: number): number {
  const k = blendFactor(weight);
  const next = prev + (target - prev) * k;
  return Math.round(Math.max(0, Math.min(100, next)));
}

export type CompetencyMove = {
  competency: Competency;
  before: Band;
  after: Band;
  moved: boolean;
  /** carried from the judge so the debrief can show why a bar did or didn't move */
  why: string;
};

export type ProgressionResult = {
  profile: Profile;
  moves: CompetencyMove[];
};

/**
 * Apply one attempt's judged bands to the profile.
 *
 * @param prev            the operator's stored profile (0–100 per competency)
 * @param evidence        the judge's per-competency reads
 * @param competencyWeights the mission's emphasis (0 = not exercised → bar frozen)
 */
export function updateProfile(
  prev: Profile,
  evidence: CompetencyEvidence[],
  competencyWeights: Record<Competency, number>,
): ProgressionResult {
  const byComp = new Map<Competency, CompetencyEvidence>(
    evidence.map((e) => [e.competency, e]),
  );

  const profile: Profile = { ...prev };
  const moves: CompetencyMove[] = [];

  for (const comp of COMPETENCY_ORDER) {
    const weight = competencyWeights[comp] ?? 0;
    const before = scoreToBand(prev[comp]);

    // A competency the mission didn't weight is not scored — the bar stays put,
    // so merely finishing missions can't inflate every bar (SPEC user story 37).
    if (weight <= 0) {
      moves.push({
        competency: comp,
        before,
        after: before,
        moved: false,
        why: "This mission didn't call for it.",
      });
      continue;
    }

    const read = byComp.get(comp);
    // Weighted but the judge returned nothing for it: treat as not shown here —
    // leave the bar unmoved rather than inventing a band.
    if (!read) {
      moves.push({
        competency: comp,
        before,
        after: before,
        moved: false,
        why: "Not demonstrated in this attempt.",
      });
      continue;
    }

    const target = BAND_TARGET[read.band];
    let next = blend(prev[comp], target, weight);
    if (!ALLOW_REGRESSION && next < prev[comp]) next = prev[comp];

    profile[comp] = next;
    const after = scoreToBand(next);
    moves.push({
      competency: comp,
      before,
      after,
      moved: after !== before,
      why: read.why,
    });
  }

  return { profile, moves };
}
