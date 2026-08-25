import { z } from "zod";
import { COMPETENCY_ORDER } from "../competencies";

// Zod schema the judge output is constrained to (Anthropic structured outputs via
// zodOutputFormat). Provider-neutral: the shape lives here, the provider that
// enforces it lives in lib/ai/provider.ts. Band and competency are closed enums.

const COMPETENCY = z.enum(
  COMPETENCY_ORDER as [string, ...string[]],
);
const BAND = z.enum([
  "not_shown",
  "emerging",
  "developing",
  "proficient",
  "strong",
]);

export const JudgeOutputSchema = z.object({
  headline: z
    .string()
    .describe("A short, honest debrief headline. No numeric score, no praise clichés."),
  attempt_evaluation: z.object({
    approach: z.string(),
    iteration: z.string(),
    judgment: z.string(),
    outcome: z.string(),
  }),
  competency_evidence: z
    .array(
      z.object({
        competency: COMPETENCY,
        band: BAND,
        why: z.string(),
        evidence_turn_ids: z
          .array(z.string())
          .describe(
            "Ids of timeline turns that justify the band (e.g. msg_04, evt_02). Reference by id — never quote text.",
          ),
      }),
    )
    .describe("One entry per competency the mission weighted (weight-0 omitted)."),
  coaching: z.object({
    worked: z.string(),
    missed: z.string(),
    expert: z.string(),
    skill_shown: COMPETENCY,
    skill_to_practice: COMPETENCY,
  }),
  practice_competency: COMPETENCY.describe(
    "The single competency the next rep should target.",
  ),
});

export type JudgeOutputParsed = z.infer<typeof JudgeOutputSchema>;
