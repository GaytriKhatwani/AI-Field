import type { Mission } from "./types";

// Missions 2–4. Authored as real, playable content so the practice loop is
// walkable through the one generic workbench. They run on the SAME real examiner
// as Meeting Chaos (lib/ai/provider.ts) — nothing here is mocked. M2 DONE: each
// has passed its discrimination gate (strong vs weak transcripts diverge in the
// expected direction on the real judge) — see scripts/gate-the-bad-prompt.ts,
// gate-the-brief.ts, gate-dont-trust-the-ai.ts, run together via gate-catalog.ts.

export const theBadPrompt: Mission = {
  id: "the-bad-prompt",
  title: "The Bad Prompt",
  tagline: "Rewrite a weak prompt into one that actually works.",
  premise: "A colleague's prompt keeps producing junk. Direct the AI to something usable.",
  domain: "marketing",
  effortMinutes: 10,
  availability: "available",
  briefing: {
    scenario:
      "A teammate forwarded you a prompt they've been fighting with: \"write a product announcement.\" The AI keeps giving them generic, off-brand filler. They want the actual announcement — for a new scheduling feature, aimed at existing customers — and they want it to sound like your company, not a press-release generator.",
    objective:
      "Direct the AI to a product announcement you'd be willing to send: specific to the feature, pitched to existing customers, in a plain confident voice.",
    constraints: [
      "The announcement is about one feature: shared team scheduling.",
      "Audience is existing customers, not press or new prospects.",
      "No hype words, no exclamation-mark padding — plain and specific.",
    ],
    deliverableDescription: "a ready-to-send announcement",
  },
  resources: [
    {
      id: "brand-note",
      label: "Voice & feature note",
      kind: "document",
      summary: "What the feature does and how the company sounds.",
      content: `FEATURE: Shared team scheduling — teammates can see each other's availability
and book shared time without the back-and-forth. Ships to all paid plans.

VOICE: plain, specific, a little dry. We say what a thing does, not how excited
we are about it. We never say "thrilled", "excited to announce", "game-changer",
or "revolutionary". Short sentences.`,
    },
  ],
  workbenchSystemContext:
    "You are helping an operator write a product announcement. Follow their instructions exactly. Do not add requirements they did not state, do not coach them on prompt-writing, and do not invent product details beyond what they give you.",
  deliverable: {
    title: "Announcement",
    fields: [
      { id: "subject", kind: "list", label: "Subject line options", placeholder: "A subject line…" },
      { id: "body", kind: "list", label: "Announcement body", placeholder: "A paragraph of the announcement…" },
    ],
  },
  competencyWeights: { context: 0.6, direction: 1, iteration: 1, verification: 0.3, synthesis: 0.7 },
  judgeGuidance:
    "Strong operators specify feature, audience, and voice, then iterate to strip hype. Weak operators pass the vague prompt through and accept generic filler.",
};

export const theBrief: Mission = {
  id: "the-brief",
  title: "The Brief",
  tagline: "Turn a vague ask into a brief the AI can execute.",
  premise: "One line of instruction, a whole deliverable expected. Close the gap first.",
  domain: "product",
  effortMinutes: 12,
  availability: "later",
  briefing: {
    scenario:
      "Your director drops a message: \"Can you get AI to put together a competitive one-pager on the new entrant? Need it for the board.\" That's the whole brief. Before you point the AI at anything, you have to decide what a board-ready one-pager actually needs — and what you'd have to know to make one that isn't hand-wavy.",
    objective:
      "Assemble a brief the AI can execute against, then produce a competitive one-pager that would survive a board's questions.",
    constraints: [
      "Name what you're comparing on — don't let the AI pick arbitrary axes.",
      "Flag anything you're asserting without a source as an assumption.",
    ],
    deliverableDescription: "a competitive one-pager",
  },
  resources: [
    {
      id: "entrant-facts",
      label: "What we know",
      kind: "notes",
      summary: "The few facts you actually have about the new entrant.",
      content: `NEW ENTRANT — what's actually known (rest is rumour):
- launched 4 months ago, self-serve only, no sales team
- pricing starts lower than ours; unclear what's included at that tier
- strong onboarding, thin on integrations
- one large logo on their site (unverified whether it's a paying customer)`,
    },
  ],
  workbenchSystemContext:
    "You are helping an operator build a competitive one-pager. Use only the facts they give you. If asked to compare, compare on the axes they name. Do not invent competitor facts, market data, or customers.",
  deliverable: {
    title: "Competitive one-pager",
    fields: [
      { id: "summary", kind: "list", label: "Positioning summary", placeholder: "A line of positioning…" },
      {
        id: "compare",
        kind: "table",
        label: "Head to head",
        columns: [
          { id: "axis", label: "Axis", placeholder: "What you're comparing on" },
          { id: "us", label: "Us", placeholder: "Our position" },
          { id: "them", label: "Them", placeholder: "Their position" },
        ],
      },
      { id: "assumptions", kind: "list", label: "Assumptions to verify", placeholder: "Something you asserted without a source…" },
    ],
  },
  competencyWeights: { context: 1, direction: 1, iteration: 0.5, verification: 0.8, synthesis: 1 },
  judgeGuidance:
    "Strong operators define the comparison axes and separate fact from assumption. Weak operators let the AI invent competitor detail and present it as fact.",
};

export const dontTrustTheAI: Mission = {
  id: "dont-trust-the-ai",
  title: "Don't Trust the AI",
  tagline: "Catch what the AI gets wrong before you rely on it.",
  premise: "The AI's answer looks clean. Some of it is wrong. Find it before you ship it.",
  domain: "operations",
  effortMinutes: 10,
  availability: "available",
  briefing: {
    scenario:
      "You asked the AI to pull the key figures out of a quarterly update and summarise them for a stakeholder email. The summary reads confidently and looks finished. But you know from experience that a confident summary is exactly where a made-up number hides. Before this goes anywhere, you need to check it against the source.",
    objective:
      "Produce a summary you'd actually put your name on — every figure traced back to the source, every unsupported claim caught and removed.",
    constraints: [
      "Every number in the summary must be verifiable against the source document.",
      "If the AI states something the source doesn't support, flag it — don't quietly keep it.",
    ],
    deliverableDescription: "a verified summary",
  },
  resources: [
    {
      id: "quarterly",
      label: "Quarterly update (source)",
      kind: "document",
      summary: "The real figures. Check the AI against this.",
      content: `Q2 UPDATE (source of truth)
- Revenue: $1.24M, up 9% quarter over quarter
- New customers: 312 (net, after churn of 41)
- Gross margin: 71%
- Support tickets: down 6%
- NOTE: enterprise pipeline discussed qualitatively; no dollar figure was given`,
    },
  ],
  workbenchSystemContext:
    "You are assisting an operator who is checking a summary. Answer their questions using only the source they provide. Do not add figures or claims that are not in the source, and do not reassure them that something is correct unless the source supports it.",
  deliverable: {
    title: "Verified summary",
    fields: [
      { id: "summary", kind: "list", label: "Summary (verified)", placeholder: "A checked, source-backed line…" },
      { id: "caught", kind: "list", label: "Caught & removed", placeholder: "An unsupported claim you found…" },
    ],
  },
  competencyWeights: { context: 0.5, direction: 0.6, iteration: 0.7, verification: 1, synthesis: 0.7 },
  judgeGuidance:
    "Strong operators trace each figure to the source and catch the invented enterprise number. Weak operators accept the confident summary whole.",
};
