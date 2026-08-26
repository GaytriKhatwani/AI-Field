import type { Mission } from "./types";
import { meetingChaos } from "./meeting-chaos";
import { theBadPrompt, theBrief, dontTrustTheAI } from "./catalog";

export const MISSIONS: Mission[] = [
  meetingChaos,
  theBadPrompt,
  dontTrustTheAI,
  theBrief,
];

export const MISSIONS_BY_ID: Record<string, Mission> = Object.fromEntries(
  MISSIONS.map((m) => [m.id, m]),
);

/**
 * The mission a brand-new operator starts on — DERIVED from the catalog (the
 * one flagged `availability: "recommended"`, else the first catalog entry) so no
 * screen hardcodes a mission id. Single source of truth for the cold-start rep.
 */
export const FIRST_MISSION_ID: string =
  (MISSIONS.find((m) => m.availability === "recommended") ?? MISSIONS[0]).id;

export function getMission(id: string): Mission | undefined {
  return MISSIONS_BY_ID[id];
}

/** Content version stamped onto attempts. Defaults to "1" when unset. */
export function missionVersion(mission: Mission): string {
  return mission.version ?? "1";
}

export type { Mission };
export * from "./types";
