import { Type } from "@google/genai";
import { COMPETENCY_ORDER } from "../competencies";

// Structured-output schema the judge is constrained to. Enforcing this means the
// route never has to parse free-form prose — the three blocks always arrive in
// a fixed shape. Band and competency values are closed enums.

const BANDS = ["not_shown", "emerging", "developing", "proficient", "strong"];
const COMPETENCIES = [...COMPETENCY_ORDER];

export const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description:
        "A short, honest debrief headline. No numeric score, no praise clichés.",
    },
    attempt_evaluation: {
      type: Type.OBJECT,
      properties: {
        approach: { type: Type.STRING },
        iteration: { type: Type.STRING },
        judgment: { type: Type.STRING },
        outcome: { type: Type.STRING },
      },
      required: ["approach", "iteration", "judgment", "outcome"],
      propertyOrdering: ["approach", "iteration", "judgment", "outcome"],
    },
    competency_evidence: {
      type: Type.ARRAY,
      description:
        "One entry per competency the mission weighted (weight 0 competencies omitted).",
      items: {
        type: Type.OBJECT,
        properties: {
          competency: { type: Type.STRING, enum: COMPETENCIES },
          band: { type: Type.STRING, enum: BANDS },
          why: { type: Type.STRING },
          evidence_turn_ids: {
            type: Type.ARRAY,
            description:
              "Ids of timeline turns that justify the band (e.g. msg_04, evt_02). Reference by id — never quote text.",
            items: { type: Type.STRING },
          },
        },
        required: ["competency", "band", "why", "evidence_turn_ids"],
        propertyOrdering: ["competency", "band", "why", "evidence_turn_ids"],
      },
    },
    coaching: {
      type: Type.OBJECT,
      properties: {
        worked: { type: Type.STRING },
        missed: { type: Type.STRING },
        expert: { type: Type.STRING },
        skill_shown: { type: Type.STRING, enum: COMPETENCIES },
        skill_to_practice: { type: Type.STRING, enum: COMPETENCIES },
      },
      required: ["worked", "missed", "expert", "skill_shown", "skill_to_practice"],
      propertyOrdering: [
        "worked",
        "missed",
        "expert",
        "skill_shown",
        "skill_to_practice",
      ],
    },
    practice_competency: {
      type: Type.STRING,
      enum: COMPETENCIES,
      description: "The single competency the next rep should target.",
    },
  },
  required: [
    "headline",
    "attempt_evaluation",
    "competency_evidence",
    "coaching",
    "practice_competency",
  ],
  propertyOrdering: [
    "headline",
    "attempt_evaluation",
    "competency_evidence",
    "coaching",
    "practice_competency",
  ],
};
