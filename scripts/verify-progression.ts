// Credential-free proof that the DETERMINISTIC half of the thesis works: given a
// strong set of judged bands vs a weak set, the profile and recommendation must
// diverge in the expected direction. Run: `npx tsx scripts/verify-progression.ts`.
// (The real-LLM discrimination gate — that the judge PRODUCES these bands — is a
// separate step and needs a Gemini key.)

import { FRESH_PROFILE, scoreToBand } from "../lib/competencies";
import { updateProfile } from "../lib/progression/update";
import { recommendNext } from "../lib/progression/recommend";
import { meetingChaos } from "../lib/missions/meeting-chaos";
import type { CompetencyEvidence } from "../lib/judge/types";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
  if (!cond) failures++;
}

const weights = meetingChaos.competencyWeights;

// A STRONG attempt: gave context, directed precisely, iterated, verified, synthesised.
const strong: CompetencyEvidence[] = [
  { competency: "context", band: "proficient", why: "gave the raw notes", evidence_turn_ids: ["evt_01"] },
  { competency: "direction", band: "strong", why: "named the exact output", evidence_turn_ids: ["msg_01"] },
  { competency: "iteration", band: "developing", why: "pushed past first answer", evidence_turn_ids: ["msg_03"] },
  { competency: "verification", band: "proficient", why: "caught invented dates", evidence_turn_ids: ["msg_04"] },
  { competency: "synthesis", band: "proficient", why: "curated a usable summary", evidence_turn_ids: ["msg_05"] },
];

// A WEAK attempt: no context, vague, accepted first answer, missed the trap.
const weak: CompetencyEvidence[] = [
  { competency: "context", band: "not_shown", why: "gave nothing to work from", evidence_turn_ids: ["msg_01"] },
  { competency: "direction", band: "emerging", why: "one vague request", evidence_turn_ids: ["msg_01"] },
  { competency: "iteration", band: "not_shown", why: "accepted first answer", evidence_turn_ids: ["msg_01"] },
  { competency: "verification", band: "not_shown", why: "let invented dates through", evidence_turn_ids: ["msg_01"] },
  { competency: "synthesis", band: "emerging", why: "dumped the chat", evidence_turn_ids: ["msg_01"] },
];

const s = updateProfile(FRESH_PROFILE, strong, weights);
const w = updateProfile(FRESH_PROFILE, weak, weights);

console.log("\nStrong profile:", s.profile);
console.log("Weak profile:  ", w.profile, "\n");

// The whole point: a strong attempt must land higher on every scored competency.
for (const c of ["context", "direction", "iteration", "verification", "synthesis"] as const) {
  check(`strong > weak on ${c}`, s.profile[c] > w.profile[c]);
}

// Bands must visibly differ where it matters most.
check("strong direction reaches at least developing", scoreToBand(s.profile.direction) !== "not_shown" && s.profile.direction >= 45);
check("weak context stays not_shown", scoreToBand(w.profile.context) === "not_shown");

// Recommendation targets the named gap deterministically.
const recWeak = recommendNext("verification", ["meeting-chaos"]);
const recStrong = recommendNext("iteration", ["meeting-chaos"]);
check("recommendation returns a real mission id (weak→verification)", typeof recWeak === "string" && recWeak.length > 0);
check("recommendation returns a real mission id (strong→iteration)", typeof recStrong === "string" && recStrong.length > 0);

// Not-exercised competencies never inflate: with a mission that only weights
// context, the other bars must stay put.
const onlyContext = { context: 1, direction: 0, iteration: 0, verification: 0, synthesis: 0 };
const partial = updateProfile(FRESH_PROFILE, strong, onlyContext);
check("weight-0 competencies stay frozen", partial.profile.direction === 0 && partial.profile.synthesis === 0);
check("weighted competency still moves", partial.profile.context > 0);

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
