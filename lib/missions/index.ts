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

export function getMission(id: string): Mission | undefined {
  return MISSIONS_BY_ID[id];
}

/** Content version stamped onto attempts. Defaults to "1" when unset. */
export function missionVersion(mission: Mission): string {
  return mission.version ?? "1";
}

export type { Mission };
export * from "./types";
