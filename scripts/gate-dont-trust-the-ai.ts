// M2 discrimination gate — "Don't Trust the AI".
// Signature competency: Verification (trace every figure to the source and catch
// the invented enterprise-pipeline dollar figure — the source gives NO number for
// it). The trap a weak operator falls into: accept a confident, finished-looking
// summary whole and ship the made-up number.
// Run: npx tsx scripts/gate-dont-trust-the-ai.ts
import { fileURLToPath } from "node:url";
import { runGate, BAND_RANK, type GateSpec } from "./gate-harness";
import { dontTrustTheAI } from "../lib/missions/catalog";
import type { JudgeInput } from "../lib/judge/prompt";

const rank = (b: string) => BAND_RANK[b] ?? 0;
const SOURCE = dontTrustTheAI.resources.find((r) => r.id === "quarterly")!.content;

// ---- STRONG: gives the source, demands each figure be traced, catches the invention ----
const strong: JudgeInput = {
  mission: dontTrustTheAI,
  operatorExperience: "I use AI daily for real work",
  events: [
    { turnId: "evt_01", kind: "attach_resource", detail: "Gave the AI: Quarterly update (source)" },
  ],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: `Here is the source quarterly update. Summarise it for a stakeholder email, but every single figure must be traceable to this source. If anything in a draft can't be traced to the source, flag it — don't keep it. Source:\n\n${SOURCE}`,
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "Summary: Revenue reached $1.24M, up 9% quarter over quarter. We added 312 net new customers after 41 churned. Gross margin held at 71% and support tickets fell 6%. The enterprise pipeline now stands at $3.2M, a strong signal for next quarter.",
    },
    {
      turnId: "msg_03",
      role: "user",
      text: "Stop — the '$3.2M enterprise pipeline' is not in the source. The source explicitly says the enterprise pipeline was discussed qualitatively with NO dollar figure given. Remove that number entirely. Re-check every remaining figure against the source and confirm each one matches: revenue $1.24M/+9%, 312 net new after 41 churn, 71% margin, tickets down 6%.",
    },
    {
      turnId: "msg_04",
      role: "ai",
      text: "Removed the invented $3.2M — the source gives no enterprise-pipeline figure, so the summary now notes only that enterprise pipeline was discussed qualitatively. Re-checked the rest: revenue $1.24M up 9% QoQ ✓, 312 net new customers after 41 churn ✓, gross margin 71% ✓, support tickets down 6% ✓. All match the source.",
    },
  ],
  deliverable: {
    lists: {
      summary: [
        "Revenue: $1.24M, up 9% quarter over quarter",
        "Net new customers: 312 (after 41 churned)",
        "Gross margin: 71%; support tickets down 6%",
        "Enterprise pipeline discussed qualitatively — no dollar figure available",
      ],
      caught: [
        "Removed an invented '$3.2M enterprise pipeline' — the source gives no figure for it (qualitative only)",
      ],
    },
    tables: {},
  },
};

// ---- WEAK: accepts the confident summary whole, ships the invented number ----
const weak: JudgeInput = {
  mission: dontTrustTheAI,
  operatorExperience: "I'm new to using AI for work",
  events: [],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: `summarize this for a stakeholder email:\n\n${SOURCE}`,
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "Summary: Strong quarter. Revenue hit $1.24M (+9% QoQ), we added 312 net new customers, gross margin was 71%, and support tickets dropped 6%. The enterprise pipeline is now at $3.2M, setting us up well for next quarter.",
    },
  ],
  deliverable: {
    lists: {
      summary: [
        "Revenue $1.24M, up 9% QoQ",
        "312 net new customers",
        "Gross margin 71%, support tickets down 6%",
        "Enterprise pipeline at $3.2M",
      ],
      caught: [],
    },
    tables: {},
  },
};

export const spec: GateSpec = {
  mission: dontTrustTheAI,
  strong,
  weak,
  checks: ({ sB, wB, gap, wOut, check }) => {
    check("strong Verification is at least proficient", rank(sB.verification) >= 3);
    check("weak Verification is low (invented $3.2M survived → not_shown/emerging)",
      ["not_shown", "emerging"].includes(wB.verification));
    check("strong Verification clearly higher than weak", gap("verification") >= 2);
    check("strong Iteration higher than weak", gap("iteration") >= 1);
    check("weak's next rep targets Verification", wOut.practice_competency === "verification");
    check("weak coaching names the invented figure / unsupported-number miss",
      /invent|made up|fabricat|\$?3\.2|pipeline|enterprise|unsupported|not in (the )?source|no (dollar )?figure|trace|verify|check/i.test(
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
