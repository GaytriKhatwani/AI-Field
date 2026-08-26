import type { Competency } from "../missions/types";
import type { Band } from "../competencies";

// THE analytics taxonomy — a CLOSED, typed catalog. This is the only intended
// source of product analytics: components call track(EVENTS.X, {…}) and the
// property shape is enforced at compile time. No arbitrary track("whatever", {…})
// anywhere. Every event exists to answer a specific product question (see
// ANALYTICS.md). Egress is metadata only — ids / enums / counts / bands /
// booleans — never transcript, prompts, AI output, deliverable, judge prose, or
// free-text onboarding answers.

export const EVENTS = {
  ONBOARDING_STARTED: "Onboarding Started",
  ONBOARDING_COMPLETED: "Onboarding Completed",
  MISSION_VIEWED: "Mission Viewed",
  MISSION_STARTED: "Mission Started",
  RESOURCE_ATTACHED: "Resource Attached",
  WORKBENCH_MESSAGE_SENT: "Workbench Message Sent",
  DELIVERABLE_SUBMITTED: "Deliverable Submitted",
  EVALUATION_COMPLETED: "Evaluation Completed",
  NEXT_MISSION_CLICKED: "Next Mission Clicked",
} as const;

/** Every mission-scoped event carries these two. mission_version is per-event. */
type MissionScoped = { mission_id: string; mission_version: string };

/** The property contract per event. Optional keys are OMITTED, never sent null. */
export type EventProps = {
  "Onboarding Started": Record<string, never>;
  "Onboarding Completed": {
    completed: boolean; // false = skipped
    role_enum?: string; // fixed chip only — omitted for "Other"/free-text
    ai_usage_enum?: string; // fixed chip only
  };
  "Mission Viewed": MissionScoped;
  "Mission Started": MissionScoped; // no attempt_id — created lazily on first message
  "Resource Attached": MissionScoped & {
    resource_id: string;
    attempt_id?: string; // omit the key entirely if no attempt exists yet
  };
  "Workbench Message Sent": MissionScoped & { attempt_id: string; turn_index: number };
  "Deliverable Submitted": MissionScoped & { attempt_id: string };
  "Evaluation Completed": MissionScoped & {
    attempt_id: string;
    practice_competency: Competency;
    bands: Record<Competency, Band>; // enums only
  };
  "Next Mission Clicked": {
    from_mission_id: string;
    to_mission_id: string;
    practice_competency: Competency;
  };
};

export type EventName = keyof EventProps;

/** Closed allowlist of property KEYS that may ever leave the app (dev guard). */
export const ALLOWED_PROPERTY_KEYS: ReadonlySet<string> = new Set([
  "mission_id",
  "mission_version",
  "attempt_id",
  "resource_id",
  "turn_index",
  "completed",
  "role_enum",
  "ai_usage_enum",
  "practice_competency",
  "bands",
  "from_mission_id",
  "to_mission_id",
]);

/** Secondary signal: property keys that look like prohibited free-text/content. */
export const PROHIBITED_KEY_PATTERNS: readonly RegExp[] = [
  /transcript/i,
  /message/i,
  /\bcontent\b/i,
  /prompt/i,
  /response/i,
  /deliverable/i,
  /prose/i,
  /observation/i,
  /evidence/i,
  /\bgoal\b/i,
  /\btext\b/i,
  /email/i,
  /answer/i,
];
