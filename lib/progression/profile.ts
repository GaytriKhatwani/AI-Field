import { FRESH_PROFILE, Profile } from "../competencies";
import type { Competency } from "../missions/types";

// Pure helpers between the stored user_competencies rows and the in-memory Profile.

export type CompetencyRow = { competency: string; score: number };

/** Build a full Profile from however many competency rows exist (missing = 0). */
export function rowsToProfile(rows: CompetencyRow[]): Profile {
  const p: Profile = { ...FRESH_PROFILE };
  for (const r of rows) {
    if (r.competency in p) p[r.competency as Competency] = r.score;
  }
  return p;
}

/** Profile → the { competency: score } map finalize_evaluation expects. */
export function profileToScores(p: Profile): Record<string, number> {
  return { ...p };
}
