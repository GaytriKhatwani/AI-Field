import type { Mission } from "../missions/types";

// A MOCKED literal-tool AI for the design MVP. It stands in for the real
// server-side Gemini call (lib/ai/provider.ts in the backend build). It executes
// instructions and never coaches, never volunteers missing requirements, never
// repairs vague instructions. Deterministic, keyword-driven — not a real model.

export type DeliverablePatch = {
  lists?: Record<string, string[]>;
  tables?: Record<string, Record<string, string>[]>;
};

export type AiReply = {
  text: string;
  /** structured content the operator can pull into the deliverable */
  extract?: DeliverablePatch;
};

function intent(msg: string): "summarise" | "owners" | "verify" | "vague" | "other" {
  const m = msg.toLowerCase();
  if (m.trim().split(/\s+/).length <= 4 && !/decision|owner|due|check|verify/.test(m))
    return "vague";
  if (/owner|who|due|deadline|date|assign/.test(m)) return "owners";
  if (/check|verify|correct|true|source|wrong|accurate|confirm/.test(m)) return "verify";
  if (/summar|decision|action|clean|structure|organis|organize/.test(m)) return "summarise";
  return "other";
}

export function respond(
  mission: Mission,
  userMessage: string,
  givenResourceIds: string[],
): AiReply {
  const hasNotes = givenResourceIds.length > 0;
  const kind = intent(userMessage);

  // No context given: the literal tool cannot invent the material.
  if (!hasNotes) {
    return {
      text:
        "I don't have anything to work from yet — you haven't given me any of the mission's material. Tell me what to use, or give me a resource, and I'll do exactly what you ask with it.",
    };
  }

  if (mission.id === "meeting-chaos") {
    if (kind === "vague") {
      return {
        text:
          "Here's a first pass at a summary of the notes:\n\n• The team is targeting a Sept 15 launch, to be revisited Friday.\n• Onboarding copy is outstanding.\n• The referral feature may be cut.\n\nThat's what I pulled out. Tell me the exact shape you want and I'll rebuild it.",
        extract: {
          lists: {
            decisions: ["Targeting Sept 15 launch (revisit Friday)"],
          },
        },
      };
    }
    if (kind === "owners" || kind === "summarise") {
      return {
        text:
          "Structured summary, with owners and due dates filled in:\n\nDECISIONS\n• Target the Sept 15 launch, revisit on Friday.\n• Cut the referral feature if it threatens the date.\n\nACTION ITEMS\n• Sam — draft launch copy — due Sept 8.\n• Dana — send final logo assets to Marcus — due Sept 6.\n• Priya — ask finance about pricing tiers — due Sept 5.\n• Support team — review the new flows — due Sept 10.\n\nOPEN QUESTIONS\n• Who owns the blog post and email sequence?\n• Is the referral feature in or out of v1?",
        extract: {
          lists: {
            decisions: [
              "Target the Sept 15 launch, revisit Friday",
              "Cut the referral feature if it threatens the date",
            ],
            questions: [
              "Who owns the blog post and email sequence?",
              "Is the referral feature in or out of v1?",
            ],
          },
          tables: {
            actions: [
              { owner: "Sam", task: "Draft launch copy", due: "Sept 8" },
              { owner: "Dana", task: "Send final logo assets to Marcus", due: "Sept 6" },
              { owner: "Priya", task: "Ask finance about pricing tiers", due: "Sept 5" },
              { owner: "Support team", task: "Review the new flows", due: "Sept 10" },
            ],
          },
        },
      };
    }
    if (kind === "verify") {
      return {
        text:
          "Checking against the notes you gave me: the notes never state a due date for Sam's copy — he said \"soon\" without committing. The support-team task had no named owner in the notes; nobody actually volunteered. The Sept dates I used were not in the notes. Those are the parts you'd want to correct.",
      };
    }
  }

  // Generic literal-tool reply for the other missions — executes, does not coach.
  return {
    text:
      "Done. I worked only from what you gave me and did exactly what you asked. If you want it in a specific shape — fields, order, length — tell me and I'll redo it that way.",
    extract: undefined,
  };
}
