import type { Mission } from "./types";

const RAW_NOTES = `PLANNING CALL — Q3 launch (45 min, half of it went sideways)
present: Priya (PM), Marcus (eng), Dana (design), Sam (marketing), + Leo joined late

- kicked off talking about the launch date. Priya wants Sept 15. Marcus pushed back,
  said the API work isn't done, maybe 2 more weeks. left it as "target 15th, revisit Fri"
- Dana: onboarding screens still not final, waiting on copy from Sam. Sam said he can
  get first-draft copy "soon" (didn't commit to when)
- big debate about whether to ship the referral feature in v1. Marcus thinks it's risky.
  Priya said cut it if it threatens the date. Nobody actually decided?? felt decided but
  reading back my notes it wasn't
- pricing — Leo brought up we still don't know the pricing tiers. Priya said that's a
  separate convo with finance, not this call
- Marcus: needs the final logo assets from Dana before he can do the splash screen.
  Dana said she'd send "this week"
- Sam wants a blog post + email sequence ready for launch. asked who's writing it.
  awkward silence. Priya said "let's figure that out"
- action-ish: someone needs to talk to support about the new flows. can't remember who
  volunteered, might have been nobody
- Priya to send finance the pricing question (her words: "I'll ping them")
- we ran out of time on the analytics/tracking plan. bumped to next week
- oh — Marcus said if we DO slip to the 29th, that's fine for eng but marketing needs
  2 weeks lead so they'd need to know by the 15th latest`;

const SUPPORT_DOC = `Team calendar — September

Sept 5   design review (recurring)
Sept 12  finance sync
Sept 15  proposed launch — go/no-go
Sept 26  company all-hands
Sept 29  fallback launch window`;

export const meetingChaos: Mission = {
  id: "meeting-chaos",
  version: "1",
  title: "Meeting Chaos",
  tagline: "Turn messy notes into decisions and actions.",
  premise: "A planning call ran sideways. Make it something your manager can act on.",
  domain: "operations",
  effortMinutes: 10,
  availability: "recommended",
  briefing: {
    scenario:
      "Your team just wrapped a 45-minute Q3 planning call. Half of it ran sideways, and the notes are a mess of half-sentences, near-decisions, and things nobody quite committed to. Your manager needs the decisions and who-owns-what by end of day — and needs to trust that it reflects what was actually said.",
    objective:
      "Produce a clean summary: the decisions that were actually made, action items with an owner and a due date, and the questions left open.",
    constraints: [
      "Include only what the notes support — do not invent tasks, owners, or dates.",
      "Every action item needs a named owner and a due date.",
      "Where the notes are ambiguous, surface it as an open question rather than guessing.",
    ],
    deliverableDescription: "a structured meeting summary",
  },
  resources: [
    {
      id: "raw-notes",
      label: "Raw meeting notes",
      kind: "notes",
      summary: "Your own scrappy notes from the call — unedited.",
      content: RAW_NOTES,
    },
    {
      id: "team-calendar",
      label: "Team calendar",
      kind: "data",
      summary: "Upcoming dates that may or may not be relevant.",
      content: SUPPORT_DOC,
    },
  ],
  workbenchSystemContext:
    "You are assisting an operator who is summarising a messy planning call. Work only from the material the operator gives you. Execute their instructions precisely. Do not coach them, do not volunteer requirements they did not ask for, do not repair vague instructions, and do not invent facts that are not in the material you were given.",
  deliverable: {
    title: "Meeting summary",
    fields: [
      {
        id: "decisions",
        kind: "list",
        label: "Decisions",
        placeholder: "A decision the team actually made…",
      },
      {
        id: "actions",
        kind: "table",
        label: "Action items",
        columns: [
          { id: "owner", label: "Owner", placeholder: "Who" },
          { id: "task", label: "Task", placeholder: "What they own" },
          { id: "due", label: "Due", placeholder: "By when" },
        ],
      },
      {
        id: "questions",
        kind: "list",
        label: "Open questions",
        placeholder: "Something left unresolved…",
      },
    ],
  },
  competencyWeights: {
    context: 1,
    direction: 1,
    iteration: 0.6,
    verification: 0.5,
    synthesis: 1,
  },
  judgeGuidance:
    "Strong operators give the AI the raw notes, set the output shape explicitly (decisions / owners / due dates / open questions), and refuse to let the AI invent deadlines the notes never stated (e.g. the unassigned support task, the uncommitted copy date). Weak operators paste one vague request, accept the first draft, and let invented owners and dates through.",
};
