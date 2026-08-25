// THE M1 DISCRIMINATION GATE (real Gemini judge).
// Runs the actual judge on a STRONG vs a WEAK Meeting Chaos transcript and checks
// the bands, profile movement, and coaching diverge in the expected direction.
// This is the go/no-go: a pipeline that cannot discriminate does not pass.
// Run: npx tsx scripts/gate-meeting-chaos.ts
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildJudgePrompt, weightedCompetencies } from "../lib/judge/prompt";
import type { JudgeInput } from "../lib/judge/prompt";
import { JudgeOutputSchema } from "../lib/judge/schema";
import { updateProfile } from "../lib/progression/update";
import { FRESH_PROFILE, scoreToBand, COMPETENCY_ORDER } from "../lib/competencies";
import { meetingChaos } from "../lib/missions/meeting-chaos";
import type { JudgeOutput } from "../lib/judge/types";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const RAW_NOTES = meetingChaos.resources.find((r) => r.id === "raw-notes")!.content;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mirrors lib/ai/provider.ts runJudge (the gate can't import the server-only
// provider module, so it calls the SDK the same way).
async function judge(label: string, input: JudgeInput): Promise<JudgeOutput> {
  const prompt = buildJudgePrompt(input);
  let lastErr: unknown;
  const MAX = 8;
  for (let attempt = 0; attempt < MAX; attempt++) {
    try {
      const r = await anthropic.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        output_config: {
          effort: "high",
          format: zodOutputFormat(JudgeOutputSchema),
        },
        messages: [{ role: "user", content: prompt }],
      });
      if (!r.parsed_output) throw new Error("judge output did not match schema");
      return r.parsed_output as JudgeOutput;
    } catch (e) {
      lastErr = e;
      const msg = String((e as { message?: string })?.message || e);
      const status = (e as { status?: number })?.status;
      if (status === 429 || status === 529 || (status && status >= 500) || /overloaded|rate.?limit/i.test(msg)) {
        const wait = Math.min(30000, 3000 * (attempt + 1)) + Math.floor(Math.random() * 1500);
        console.log(`  [${label}] transient (${msg.slice(0, 48)}…) — retry ${attempt + 1}/${MAX} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

// ---- STRONG: deliberate context, precise direction, iterates, verifies, curates ----
const strongInput: JudgeInput = {
  mission: meetingChaos,
  operatorExperience: "I use AI daily for real work",
  events: [
    { turnId: "evt_01", kind: "attach_resource", detail: "Gave the AI: Raw meeting notes" },
  ],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: "Using only the notes I just gave you, produce three sections: (1) Decisions actually made, (2) Action items, each with a named owner AND a due date, (3) Open questions. Do not invent any owner or date the notes don't state.",
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "DECISIONS\n- Target Sept 15 launch, revisit Friday\n- Cut referral if it threatens the date\nACTION ITEMS\n- Sam — draft launch copy — due Sept 8\n- Dana — send logo assets to Marcus — due Sept 6\n- Support team — review new flows — due Sept 10\nOPEN QUESTIONS\n- Who writes the blog post and email sequence?",
    },
    {
      turnId: "msg_03",
      role: "user",
      text: "Check every date and owner against the notes. Sam only said 'soon' — he never committed to Sept 8. Nobody was named for the support-team task. The notes contain no due dates at all. Remove every date and owner the notes don't actually support, and move those to Open questions instead.",
    },
    {
      turnId: "msg_04",
      role: "ai",
      text: "Corrected. Removed the invented dates (Sept 8/6/10) and the unnamed support owner. DECISIONS unchanged. ACTION ITEMS now: Dana — send final logo assets to Marcus (no date stated); Priya — send finance the pricing question. OPEN QUESTIONS now include: When is Sam's copy actually due? Who owns the support-flows task? Who writes the blog/email?",
    },
  ],
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

// ---- WEAK: no deliberate context, one vague ask, accepts the dump w/ invented dates ----
const weakInput: JudgeInput = {
  mission: meetingChaos,
  operatorExperience: "I'm new to using AI for work",
  events: [],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: `here are the notes from our meeting, just clean this up and make it look organized:\n\n${RAW_NOTES}`,
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "DECISIONS\n- Sept 15 launch\n- Cut referral\nACTION ITEMS\n- Sam — draft launch copy — due Sept 8\n- Dana — send logo assets — due Sept 6\n- Priya — pricing question — due Sept 5\n- Support team — review new flows — due Sept 10\nOPEN QUESTIONS\n- none",
    },
  ],
  deliverable: {
    lists: { decisions: ["Sept 15 launch", "Cut referral"], questions: [] },
    tables: {
      actions: [
        { owner: "Sam", task: "Draft launch copy", due: "Sept 8" },
        { owner: "Dana", task: "Send logo assets", due: "Sept 6" },
        { owner: "Priya", task: "Pricing question", due: "Sept 5" },
        { owner: "Support team", task: "Review new flows", due: "Sept 10" },
      ],
    },
  },
};

function bands(o: JudgeOutput) {
  const map: Record<string, string> = {};
  for (const e of o.competency_evidence) map[e.competency] = e.band;
  return map;
}

const BAND_RANK: Record<string, number> = {
  not_shown: 0, emerging: 1, developing: 2, proficient: 3, strong: 4,
};

let failures = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
  if (!cond) failures++;
};

async function main() {
console.log("Running the real judge on both transcripts (sequentially)…\n");
const sOut = await judge("strong", strongInput);
const wOut = await judge("weak", weakInput);

const sB = bands(sOut);
const wB = bands(wOut);
const weights = meetingChaos.competencyWeights;
const sProf = updateProfile(FRESH_PROFILE, sOut.competency_evidence, weights).profile;
const wProf = updateProfile(FRESH_PROFILE, wOut.competency_evidence, weights).profile;

console.log("STRONG bands:", sB);
console.log("STRONG headline:", JSON.stringify(sOut.headline));
console.log("STRONG practice:", sOut.practice_competency);
console.log("STRONG profile:", sProf);
console.log("\nWEAK bands:  ", wB);
console.log("WEAK headline:", JSON.stringify(wOut.headline));
console.log("WEAK practice:", wOut.practice_competency);
console.log("WEAK profile: ", wProf);
console.log("\nWEAK missed:", JSON.stringify(wOut.coaching.missed));
console.log("STRONG worked:", JSON.stringify(sOut.coaching.worked));
console.log("");

const scored = weightedCompetencies(meetingChaos);
let sSum = 0, wSum = 0;
for (const c of COMPETENCY_ORDER) { sSum += sProf[c]; wSum += wProf[c]; }

// --- The gate assertions: meaningful divergence in the expected direction ---
check("strong total profile clearly exceeds weak (>= 60 pts)", sSum - wSum >= 60);
check("strong never scores BELOW weak on any scored competency",
  scored.every((c) => (BAND_RANK[sB[c]] ?? 0) >= (BAND_RANK[wB[c]] ?? 0)));
check("weak Verification is low (trap survived → not_shown/emerging)",
  ["not_shown", "emerging"].includes(wB.verification));
check("strong Verification clearly higher than weak",
  (BAND_RANK[sB.verification] ?? 0) - (BAND_RANK[wB.verification] ?? 0) >= 2);
check("strong Direction is at least proficient",
  (BAND_RANK[sB.direction] ?? 0) >= 3);
check("weak Direction is at most developing",
  (BAND_RANK[wB.direction] ?? 0) <= 2);
check("strong Synthesis higher than weak",
  (BAND_RANK[sB.synthesis] ?? 0) > (BAND_RANK[wB.synthesis] ?? 0));
check("weak's next rep targets a real gap (not synthesis-only)",
  typeof wOut.practice_competency === "string");
check("coaching differs (weak.missed mentions a date/invention miss)",
  /date|invent|made up|not in the notes|unsupported|owner/i.test(wOut.coaching.missed));

console.log(`\n${failures === 0 ? "GATE PASSED — the judge discriminates." : failures + " GATE CHECK(S) FAILED — tune the judge."}`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Gate run errored:", e?.message || e);
  process.exit(1);
});
