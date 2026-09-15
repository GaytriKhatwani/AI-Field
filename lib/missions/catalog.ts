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
  premise: "A colleague's prompt keeps producing junk. Turn it into something usable.",
  domain: "marketing",
  effortMinutes: 10,
  availability: "available",
  briefing: {
    scenario:
      "A message from Sam in marketing lands mid-afternoon: \"can you take a crack at this? I've been going in circles.\" Sam has been asking the AI to \"write a product announcement\" and every draft comes back as the same press-release filler. The announcement is for shared team scheduling and goes to existing customers. It needs to sound like the company, not a launch-hype generator. Sam's message with the feature details and the house style is in your materials.",
    objective:
      "Get the AI to a product announcement you'd be willing to send: specific to the feature, pitched to existing customers, in a plain confident voice.",
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
      label: "Sam's message",
      kind: "email",
      summary: "The feature details and how the company writes, as Sam sent them.",
      content: `Sam (marketing), 2:40pm

ok so the feature is shared team scheduling. teammates can see each other's
availability and book shared time without the usual back-and-forth. it's on
all paid plans, nothing to switch on.

for voice, this is the bit from the style doc that everyone ignores:
"plain and specific, a little dry. we say what a thing does, not how we
feel about it. we never say 'thrilled', 'excited to announce',
'game-changer', 'revolutionary'. short sentences."

the drafts I've got all open with "we're thrilled to announce". I can't send
that. if you can get it to something I'd actually put in front of customers
that'd be great`,
    },
  ],
  workbenchSystemContext:
    "You are helping a person write a product announcement. Follow their instructions exactly. Do not add requirements they did not state, do not coach them on prompt-writing, and do not invent product details beyond what they give you.",
  deliverable: {
    title: "Announcement",
    fields: [
      { id: "subject", kind: "list", label: "Subject line options", placeholder: "A subject line…" },
      { id: "body", kind: "list", label: "Announcement body", placeholder: "A paragraph of the announcement…" },
    ],
  },
  competencyWeights: { context: 0.6, direction: 1, iteration: 1, verification: 0.3, synthesis: 0.7 },
  judgeGuidance:
    "Strong people specify feature, audience, and voice, then iterate to strip hype. Weak people pass the vague prompt through and accept generic filler.",
};

export const theBrief: Mission = {
  id: "the-brief",
  title: "From Ask to Brief",
  tagline: "Turn a vague ask into a brief the AI can execute.",
  premise: "Turn a one-line request into a brief the AI can execute.",
  domain: "product",
  effortMinutes: 12,
  availability: "later",
  briefing: {
    scenario:
      "Your director drops a message: \"Can you get AI to put together a competitive one-pager on the new entrant? Need it for the board.\" That's the whole brief. Before you point the AI at anything, you have to decide what a board-ready one-pager actually needs — and what you'd have to know to make one that isn't hand-wavy. You have the few facts anyone has on the entrant, and a short note on where we stand.",
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
      content: `NEW ENTRANT — what we actually know
- launched 4 months ago, self-serve only, no sales team
- pricing starts lower than ours; unclear what's included at that tier
- strong onboarding, thin on integrations
- one large logo on their site
- (that's it — everything else I've heard is second-hand)`,
    },
    {
      id: "our-position",
      label: "Where we stand",
      kind: "notes",
      summary: "The short version of our own product and go-to-market.",
      content: `US — the short version:
- three paid tiers plus a free trial; mid-market is the core segment
- sales-assisted onboarding for larger accounts; self-serve for the rest
- 40+ integrations, incl. the big CRMs; this is what most customers cite when they renew
- onboarding is our weakest review theme; a redesign is in progress, no date yet
- customers: several hundred paying accounts, five years in market`,
    },
  ],
  workbenchSystemContext:
    "You are helping a person build a competitive one-pager. Use only the facts they give you. If asked to compare, compare on the axes they name. Do not invent competitor facts, market data, or customers.",
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
    "Strong people define the comparison axes and separate fact from assumption. Weak people let the AI invent competitor detail and present it as fact.",
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
      "You asked the AI to turn Finance's Q2 update into a short summary for a stakeholder email, and it came back reading clean and finished. It's going out under your name, though — and a summary that tidy is exactly where a number the source never gave can slip through. Both the AI's draft and the original update are in your materials. Check one against the other before it goes anywhere.",
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
      label: "Q2 update from Finance",
      kind: "document",
      summary: "Finance's quarterly recap — the figures you're checking against.",
      content: `Subject: Q2 numbers before board prep
From: Ines (Finance)

Sharing where Q2 landed so we're all working off the same numbers.

Revenue came in at $1.24M, up 9% on Q1. Net new customers: 312 — that's
after the 41 who churned. Gross margin held at 71%. Support had a strong
quarter too, ticket volume down 6% even with more accounts on the books.

Enterprise is the one to watch — a couple of conversations picked up after
the conference and one could be sizeable, but nothing's signed yet.

Full deck to follow before the board meeting.`,
    },
    {
      id: "ai-draft",
      label: "The AI's draft summary",
      kind: "document",
      summary: "The tidy summary the AI produced — unchecked.",
      content: `Draft summary for the stakeholder email:

Q2 was a strong quarter. Revenue reached $1.24M, up 9% on Q1, and we added
312 net new customers after 41 churned. Gross margin held at 71%, and
support ticket volume fell 6% even as the account base grew. The enterprise
pipeline now stands at $3.2M, a strong signal heading into next quarter.`,
    },
  ],
  workbenchSystemContext:
    "You are assisting a person who is checking a summary. Answer their questions using only the source they provide. Do not add figures or claims that are not in the source, and do not reassure them that something is correct unless the source supports it.",
  deliverable: {
    title: "Verified summary",
    fields: [
      { id: "summary", kind: "list", label: "Summary (verified)", placeholder: "A checked, source-backed line…" },
      { id: "caught", kind: "list", label: "Caught & removed", placeholder: "An unsupported claim you found…" },
    ],
  },
  competencyWeights: { context: 0.5, direction: 0.6, iteration: 0.7, verification: 1, synthesis: 0.7 },
  judgeGuidance:
    "Strong people trace each figure to the source and catch the invented enterprise number. Weak people accept the confident summary whole.",
};
