import type { Competency } from "../missions/types";
import type { Profile } from "../competencies";
import type { CompetencyMove } from "../progression/update";

// The debrief payload the UI renders. Deliberately the same shape the design MVP
// used, so the frontend surface is unchanged when the real backend replaces the
// mock. Built by lib/debrief/build.ts from the judge output + deterministic moves.

export type EvidenceMoment = {
  turnId: string;
  who: "you" | "the AI";
  text: string;
  note: string;
  tone: "good" | "gap" | "neutral";
};

export type Debrief = {
  headline: string;
  sessionLine: EvidenceMoment[];
  worked: string;
  missed: string;
  expert: string;
  moves: CompetencyMove[];
  practice: Competency;
  nextMissionId: string;
  newProfile: Profile;
};

export type { CompetencyMove };
