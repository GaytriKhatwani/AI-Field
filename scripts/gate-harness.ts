// Shared discrimination-gate harness for the catalog missions (M2).
//
// gate-meeting-chaos.ts is the ORIGINAL, standalone gate (M1) and is left as-is.
// The three M2 gates (the-bad-prompt, the-brief, dont-trust-the-ai) share this
// harness so the judge call, the profile math, the reporting, and the COMMON
// go/no-go checks are defined once and cannot drift between missions.
//
// The bar is identical to M1: run the REAL judge on a scripted strong vs weak
// transcript and require the bands / profile / coaching to diverge in the
// expected direction. A pipeline that cannot discriminate does not pass.
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildJudgePrompt, weightedCompetencies } from "../lib/judge/prompt";
import type { JudgeInput } from "../lib/judge/prompt";
import { JudgeOutputSchema } from "../lib/judge/schema";
import { updateProfile } from "../lib/progression/update";
import { FRESH_PROFILE, COMPETENCY_ORDER } from "../lib/competencies";
import type { Mission } from "../lib/missions/types";
import type { JudgeOutput } from "../lib/judge/types";

// Load .env.local the same way the M1 gate does (tsx doesn't read it for us).
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const BAND_RANK: Record<string, number> = {
  not_shown: 0, emerging: 1, developing: 2, proficient: 3, strong: 4,
};

// Mirrors lib/ai/provider.ts runJudge (the gate can't import the server-only
// provider module, so it calls the SDK the same way: high effort + Zod schema).
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

function bands(o: JudgeOutput): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of o.competency_evidence) map[e.competency] = e.band;
  return map;
}

export type GateContext = {
  sOut: JudgeOutput;
  wOut: JudgeOutput;
  /** strong bands by competency id */
  sB: Record<string, string>;
  /** weak bands by competency id */
  wB: Record<string, string>;
  /** convenience: rank(strong) - rank(weak) for a competency */
  gap: (c: string) => number;
  check: (name: string, cond: boolean) => void;
};

export type GateSpec = {
  mission: Mission;
  strong: JudgeInput;
  weak: JudgeInput;
  /** mission-specific assertions layered on top of the common ones */
  checks: (ctx: GateContext) => void;
};

/**
 * Run one mission's discrimination gate. Prints the read, applies the common
 * checks + the mission-specific checks, and returns the failure count (0 = pass).
 * Does NOT exit — the caller decides (a single gate exits; gate-all aggregates).
 */
export async function runGate(spec: GateSpec): Promise<number> {
  const { mission, strong, weak } = spec;
  console.log(`\n=== GATE: ${mission.title} (${mission.id}) ===`);
  console.log("Running the real judge on both transcripts (sequentially)…\n");

  const sOut = await judge("strong", strong);
  const wOut = await judge("weak", weak);
  const sB = bands(sOut);
  const wB = bands(wOut);
  const weights = mission.competencyWeights;
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

  let failures = 0;
  const check = (name: string, cond: boolean) => {
    console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
    if (!cond) failures++;
  };
  const gap = (c: string) => (BAND_RANK[sB[c]] ?? 0) - (BAND_RANK[wB[c]] ?? 0);

  const scored = weightedCompetencies(mission);
  let sSum = 0, wSum = 0;
  for (const c of COMPETENCY_ORDER) { sSum += sProf[c]; wSum += wProf[c]; }

  // --- COMMON gate assertions (identical bar for every mission) ---
  check("strong total profile clearly exceeds weak (>= 60 pts)", sSum - wSum >= 60);
  check("strong never scores BELOW weak on any scored competency",
    scored.every((c) => (BAND_RANK[sB[c]] ?? 0) >= (BAND_RANK[wB[c]] ?? 0)));
  check("weak's next rep targets a real competency",
    typeof wOut.practice_competency === "string" && wOut.practice_competency.length > 0);

  // --- mission-specific assertions ---
  spec.checks({ sOut, wOut, sB, wB, gap, check });

  console.log(
    `\n${mission.id}: ${failures === 0 ? "GATE PASSED — the judge discriminates." : failures + " GATE CHECK(S) FAILED — tune the judge."}`,
  );
  return failures;
}
