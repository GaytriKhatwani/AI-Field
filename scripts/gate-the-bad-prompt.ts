// M2 discrimination gate — "The Bad Prompt".
// Signature competencies: Direction (set a real objective/constraints/voice) and
// Iteration (push past the first hype-filled draft). The trap a weak operator
// falls into: pass the vague "write a product announcement" straight through and
// accept generic, off-brand filler.
// Run: npx tsx scripts/gate-the-bad-prompt.ts
import { fileURLToPath } from "node:url";
import { runGate, BAND_RANK, type GateSpec } from "./gate-harness";
import { theBadPrompt } from "../lib/missions/catalog";
import type { JudgeInput } from "../lib/judge/prompt";

const rank = (b: string) => BAND_RANK[b] ?? 0;

// ---- STRONG: gives voice+feature context, precise direction, iterates off hype ----
const strong: JudgeInput = {
  mission: theBadPrompt,
  operatorExperience: "I use AI daily for real work",
  events: [
    { turnId: "evt_01", kind: "attach_resource", detail: "Gave the AI: Voice & feature note" },
  ],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: `Using only the voice & feature note I gave you, write a product announcement for existing customers about ONE feature: shared team scheduling. Constraints: plain, specific, a little dry — no "thrilled", "excited to announce", "game-changer", "revolutionary", no exclamation marks. Give me 3 subject-line options and a short 2-paragraph body that says what the feature does and who it's for. Don't invent capabilities beyond the note.`,
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "Subjects: 1) We're excited to announce shared team scheduling! 2) A game-changer for your calendar 3) Introducing shared scheduling.\nBody: We're thrilled to introduce shared team scheduling — a revolutionary way to book time together. It's going to change how your team works!",
    },
    {
      turnId: "msg_03",
      role: "user",
      text: "That's exactly the hype the note bans. Rewrite: drop every one of 'excited', 'thrilled', 'game-changer', 'revolutionary' and the exclamation marks. Subject lines must name the feature, not tease it. The body should state plainly what shared team scheduling does (see availability, book shared time without back-and-forth), that it ships to all paid plans, and that it's for existing customers. Keep it two short paragraphs.",
    },
    {
      turnId: "msg_04",
      role: "ai",
      text: "Subjects: 1) Shared team scheduling is now available 2) See your team's availability and book shared time 3) Scheduling, without the back-and-forth.\nBody: Shared team scheduling lets your teammates see each other's availability and book shared time without the usual back-and-forth. It's available now on all paid plans. If your team already uses us to plan work, this removes a step you're doing by hand today.",
    },
  ],
  deliverable: {
    lists: {
      subject: [
        "Shared team scheduling is now available",
        "See your team's availability and book shared time",
        "Scheduling, without the back-and-forth",
      ],
      body: [
        "Shared team scheduling lets your teammates see each other's availability and book shared time without the usual back-and-forth.",
        "It's available now on all paid plans — if your team already plans work with us, this removes a manual step.",
      ],
    },
    tables: {},
  },
};

// ---- WEAK: passes the vague prompt through, accepts generic off-brand hype ----
const weak: JudgeInput = {
  mission: theBadPrompt,
  operatorExperience: "I'm new to using AI for work",
  events: [],
  messages: [
    { turnId: "msg_01", role: "user", text: "write a product announcement" },
    {
      turnId: "msg_02",
      role: "ai",
      text: "🎉 We're THRILLED to announce our game-changing new feature! This revolutionary update will transform the way you work. We can't wait for you to try it — it's going to be amazing!",
    },
  ],
  deliverable: {
    lists: {
      subject: ["We're thrilled to announce something amazing!"],
      body: [
        "We're THRILLED to announce our game-changing new feature! This revolutionary update will transform the way you work.",
      ],
    },
    tables: {},
  },
};

export const spec: GateSpec = {
  mission: theBadPrompt,
  strong,
  weak,
  checks: ({ sB, wB, gap, wOut, check }) => {
    check("strong Direction is at least proficient", rank(sB.direction) >= 3);
    check("weak Direction is at most developing", rank(wB.direction) <= 2);
    check("strong Iteration is at least proficient", rank(sB.iteration) >= 3);
    check("weak Iteration is low (never pushed past the draft)",
      ["not_shown", "emerging"].includes(wB.iteration));
    check("strong Iteration clearly higher than weak", gap("iteration") >= 2);
    check("strong Direction clearly higher than weak", gap("direction") >= 2);
    check("weak coaching names the vague/hype/off-voice miss",
      /hype|generic|vague|voice|thrilled|excited|game.?changer|filler|specific|off.?brand|constraint/i.test(
        wOut.coaching.missed,
      ));
  },
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runGate(spec)
    .then((f) => process.exit(f === 0 ? 0 : 1))
    .catch((e) => {
      console.error("Gate run errored:", e?.message || e);
      process.exit(1);
    });
}
