// END-TO-END DISCRIMINATION GATE — real workbench AI + real judge.
//
// The scripted gates (gate-*.ts) hand-write the AI's replies, including its
// mistakes, so they prove the judge discriminates WHEN the AI misbehaves. The
// production AI is told not to fabricate, so this gate asks the other question:
// with the AI the person will actually meet, do a strong and a weak person
// still separate? Only the PERSON's turns are scripted here; every AI turn is
// generated live with the exact system prompt and materials framing the
// workbench route uses (lib/ai/workbenchSystem.ts).
//
// The weak person's deliverable is built the way a weak person builds it: the
// AI's last reply split into blocks by the real segmenter and dumped whole into
// the first section. The strong person's deliverable is hand-curated from the
// notes, which is what a strong person produces whatever the AI said.
//
// Costs real API calls (4 workbench turns at low effort + 2 judge runs).
// Run: npx tsx scripts/gate-e2e-meeting-chaos.ts
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { runGate, BAND_RANK } from "./gate-harness";
import { workbenchSystemPrompt, materialsTurn } from "../lib/ai/workbenchSystem";
import { segment } from "../lib/workbench/segment";
import { meetingChaos } from "../lib/missions/meeting-chaos";
import type { JudgeInput, TimelineMessage } from "../lib/judge/prompt";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const RAW_NOTES = meetingChaos.resources.find((r) => r.id === "raw-notes")!;

type Turn = { role: "user" | "assistant"; text: string };

// Mirrors lib/ai/provider.ts streamWorkbench (non-streaming is fine here).
async function workbenchReply(history: Turn[]): Promise<string> {
  const r = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: workbenchSystemPrompt(meetingChaos.workbenchSystemContext),
    output_config: { effort: "low" },
    messages: history.map((t) => ({ role: t.role, content: t.text })),
  });
  return r.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Play a session: the person's turns are scripted, the AI answers live. Returns
 * the judge-shaped timeline plus the AI's final reply. `shareNotes` mirrors the
 * workbench route: shared materials are injected as the first user turn of the
 * model history and recorded as an attach event for the judge.
 */
async function play(
  label: string,
  userTurns: string[],
  shareNotes: boolean,
): Promise<{ messages: TimelineMessage[]; events: JudgeInput["events"]; lastAi: string }> {
  const history: Turn[] = [];
  const messages: TimelineMessage[] = [];
  const events: JudgeInput["events"] = [];
  if (shareNotes) {
    history.push({ role: "user", text: materialsTurn([RAW_NOTES]) });
    events.push({
      turnId: "evt_01",
      kind: "attach_resource",
      detail: `Shared "${RAW_NOTES.label}" with the AI`,
    });
  }
  let seq = 0;
  let lastAi = "";
  for (const text of userTurns) {
    history.push({ role: "user", text });
    messages.push({ turnId: `msg_${String(++seq).padStart(2, "0")}`, role: "user", text });
    const reply = await workbenchReply(history);
    history.push({ role: "assistant", text: reply });
    messages.push({ turnId: `msg_${String(++seq).padStart(2, "0")}`, role: "ai", text: reply });
    lastAi = reply;
    console.log(`\n[${label}] PERSON: ${text.slice(0, 90)}${text.length > 90 ? "…" : ""}`);
    console.log(`[${label}] AI (${reply.length} chars):\n${reply}\n`);
  }
  return { messages, events, lastAi };
}

async function main() {
  console.log("Playing STRONG session against the real workbench AI…");
  const strong = await play(
    "strong",
    [
      "Using only the notes I just gave you, produce three sections: (1) Decisions actually made, (2) Action items, each with a named owner AND a due date, (3) Open questions. Do not invent any owner or date the notes don't state. Where the notes are ambiguous, put it under Open questions.",
      "Check every owner and date in your answer against the notes line by line. Anything the notes don't state explicitly — including anything treated as decided when the notes show it wasn't — move to Open questions and tell me what you moved.",
    ],
    true,
  );

  console.log("\nPlaying WEAK session against the real workbench AI…");
  const weak = await play(
    "weak",
    [`here are the notes from our meeting, just clean this up and make it look organized:\n\n${RAW_NOTES.content}`],
    false,
  );

  // Weak deliverable: everything the AI said, dumped into the first section.
  const weakBlocks = segment("weak", weak.lastAi).map((b) => b.text);

  const strongInput: JudgeInput = {
    mission: meetingChaos,
    operatorExperience: "Most days",
    events: strong.events,
    messages: strong.messages,
    deliverable: {
      lists: {
        decisions: [
          "Target the Sept 15 launch, revisit Friday",
          "Cut the referral feature if it threatens the date",
        ],
        questions: [
          "When is Sam's launch copy actually due? (he only said 'soon')",
          "Who owns the support-flows review? (nobody volunteered)",
          "Who writes the blog post and email sequence?",
          "Is the referral feature in or out of v1?",
        ],
      },
      tables: {
        actions: [
          { owner: "Dana", task: "Send final logo assets to Marcus", due: "This week (no exact date stated)" },
          { owner: "Priya", task: "Send finance the pricing question", due: "Not stated" },
        ],
      },
    },
  };

  const weakInput: JudgeInput = {
    mission: meetingChaos,
    operatorExperience: "Rarely",
    events: weak.events,
    messages: weak.messages,
    deliverable: { lists: { decisions: weakBlocks, questions: [] }, tables: { actions: [] } },
  };

  const failures = await runGate({
    mission: meetingChaos,
    strong: strongInput,
    weak: weakInput,
    checks: ({ sB, wB, check, gap }) => {
      // With a non-fabricating AI the weak person may not face an invention
      // trap, so Verification is not required to be not_shown — but the
      // strong person's explicit line-by-line check must still read higher.
      check("strong Direction is at least proficient", (BAND_RANK[sB.direction] ?? 0) >= 3);
      check("weak Direction is at most developing", (BAND_RANK[wB.direction] ?? 0) <= 2);
      check("strong Verification higher than weak", gap("verification") >= 1);
      check("strong Synthesis higher than weak", gap("synthesis") >= 1);
      check("weak Synthesis is low (dumped the reply whole)", (BAND_RANK[wB.synthesis] ?? 0) <= 1);
    },
  });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E gate errored:", e?.message || e);
  process.exit(1);
});
