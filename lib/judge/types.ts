import type { Competency } from "../missions/types";
import type { Band } from "../competencies";

// The judge's output contract. The Gemini call is constrained to this shape via
// structured output (see lib/judge/schema.ts). The judge produces bands, prose,
// and the named practice gap — it NEVER updates the profile or picks a mission;
// those are deterministic app code (lib/progression/*).

/** One competency's read: a band, why, and evidence referenced BY turn id — never quoted. */
export type CompetencyEvidence = {
  competency: Competency;
  band: Band;
  why: string;
  /** ids of timeline turns (msg_04, evt_02, …) that justify the band. Never verbatim quotes. */
  evidence_turn_ids: string[];
};

/** The four attempt-level lenses the judge narrates (Approach/Iteration/Judgment/Outcome). */
export type AttemptEvaluation = {
  approach: string;
  iteration: string;
  judgment: string;
  outcome: string;
};

/** User-facing coaching. Plain language, specific, no numeric grade. */
export type Coaching = {
  worked: string;
  missed: string;
  expert: string;
  skill_shown: Competency;
  skill_to_practice: Competency;
};

/** The complete judge response for one attempt. */
export type JudgeOutput = {
  attempt_evaluation: AttemptEvaluation;
  competency_evidence: CompetencyEvidence[];
  coaching: Coaching;
  /** the single competency the next rep should target */
  practice_competency: Competency;
  /** a short, honest headline for the debrief — no praise clichés, no score */
  headline: string;
};

/** Versions stamped onto every evaluation so two evaluations are comparable. */
export const JUDGE_PROMPT_VERSION = "practice-language-2026-08-27";
export const JUDGE_SCHEMA_VERSION = "1";
