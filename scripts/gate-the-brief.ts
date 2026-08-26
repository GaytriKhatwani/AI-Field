// M2 discrimination gate — "The Brief".
// Signature competencies: Context (know what a board-ready one-pager needs and
// give the AI only the facts you have), Synthesis (assemble something that would
// survive a board's questions), and Verification (separate fact from assumption).
// The trap a weak operator falls into: let the AI pick arbitrary axes, invent
// competitor facts, and present unverified assertions as fact.
// Run: npx tsx scripts/gate-the-brief.ts
import { fileURLToPath } from "node:url";
import { runGate, BAND_RANK, type GateSpec } from "./gate-harness";
import { theBrief } from "../lib/missions/catalog";
import type { JudgeInput } from "../lib/judge/prompt";

const rank = (b: string) => BAND_RANK[b] ?? 0;

// ---- STRONG: names the axes, gives only known facts, separates fact from assumption ----
const strong: JudgeInput = {
  mission: theBrief,
  operatorExperience: "I use AI daily for real work",
  events: [
    { turnId: "evt_01", kind: "attach_resource", detail: "Gave the AI: What we know (entrant facts)" },
  ],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: "Board-ready competitive one-pager on the new entrant. Use ONLY the facts I gave you. Compare us and them on four named axes: pricing/tier inclusions, onboarding, integrations, and proof of adoption. Do not add any market data, funding, customer counts, or competitor facts that aren't in my notes. Anything you can't source from my notes goes in a separate 'assumptions to verify' list, not the comparison. Structure: a one-line positioning summary, a head-to-head table on those four axes, then the assumptions list.",
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "Positioning: The entrant is a cheaper, self-serve alternative that is thinner on integrations. Head-to-head:\n- Pricing: Us — standard tiers; Them — starts lower, 40% cheaper on entry.\n- Onboarding: Us — assisted; Them — strong self-serve.\n- Integrations: Us — broad; Them — thin.\n- Proof: Us — established base; Them — a paying enterprise customer (logo on site).\nThey've raised roughly $20M.",
    },
    {
      turnId: "msg_03",
      role: "user",
      text: "You invented two things my notes don't contain: the '40% cheaper' figure (notes only say 'starts lower', and what's included at that tier is unclear) and the '$20M raised'. Remove both. The site logo is unverified — the notes say it's unclear whether they're a paying customer, so it can't be stated as 'a paying enterprise customer'; move it to assumptions. Rebuild the table using only my facts and put every unsourced item in the assumptions list.",
    },
    {
      turnId: "msg_04",
      role: "ai",
      text: "Corrected. Removed the invented '40% cheaper' and '$20M raised'. Pricing row now reads 'starts lower than ours; tier inclusions unclear'. Proof-of-adoption row now reads 'one logo on their site, adoption unverified'. Assumptions to verify: what's included at their entry tier; whether the site logo is a paying customer; funding/market position (unknown).",
    },
  ],
  deliverable: {
    lists: {
      summary: [
        "A cheaper, self-serve entrant that's strong on onboarding but thin on integrations — with real unknowns at the entry tier.",
      ],
      assumptions: [
        "What's actually included at their lower entry tier (notes say unclear)",
        "Whether the logo on their site is a paying customer (unverified)",
        "Their funding / market position (not known)",
      ],
    },
    tables: {
      compare: [
        { axis: "Pricing / tier inclusions", us: "Standard tiers", them: "Starts lower than ours; tier inclusions unclear" },
        { axis: "Onboarding", us: "Assisted", them: "Strong self-serve, no sales team" },
        { axis: "Integrations", us: "Broad", them: "Thin" },
        { axis: "Proof of adoption", us: "Established customer base", them: "One logo on site; adoption unverified" },
      ],
    },
  },
};

// ---- WEAK: one vague ask, lets the AI invent facts and arbitrary axes, ships them ----
const weak: JudgeInput = {
  mission: theBrief,
  operatorExperience: "I'm new to using AI for work",
  events: [],
  messages: [
    {
      turnId: "msg_01",
      role: "user",
      text: "make a competitive one-pager on the new entrant for the board",
    },
    {
      turnId: "msg_02",
      role: "ai",
      text: "Competitive one-pager:\n- They're 40% cheaper than us and growing fast.\n- 500+ customers in 4 months, backed by $20M in funding.\n- Integrates with all major tools; best-in-class onboarding.\n- Market leader in the self-serve segment.\nRecommendation: match their pricing to defend share.",
    },
  ],
  deliverable: {
    lists: {
      summary: ["A fast-growing, well-funded competitor beating us on price and integrations."],
      assumptions: [],
    },
    tables: {
      compare: [
        { axis: "Price", us: "Higher", them: "40% cheaper" },
        { axis: "Customers", us: "Steady", them: "500+ in 4 months" },
        { axis: "Funding", us: "N/A", them: "$20M raised" },
        { axis: "Integrations", us: "Some", them: "Integrates with everything" },
      ],
    },
  },
};

export const spec: GateSpec = {
  mission: theBrief,
  strong,
  weak,
  checks: ({ sB, wB, gap, wOut, check }) => {
    check("strong Context is at least proficient", rank(sB.context) >= 3);
    check("weak Context is at most developing", rank(wB.context) <= 2);
    check("weak Verification is low (invented facts survived)",
      ["not_shown", "emerging"].includes(wB.verification));
    check("strong Verification clearly higher than weak", gap("verification") >= 2);
    check("strong Synthesis clearly higher than weak", gap("synthesis") >= 2);
    check("strong Synthesis is at least proficient", rank(sB.synthesis) >= 3);
    check("weak coaching names the invention / unsourced-fact / assumption miss",
      /invent|made up|fabricat|unsourc|unsupported|not in (the |your )?notes|assumption|source|axes|arbitrary|fact/i.test(
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
