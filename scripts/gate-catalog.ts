// M2 aggregate discrimination gate — runs all three catalog missions' gates
// sequentially and reports one go/no-go. Each mission is also runnable on its own
// (npx tsx scripts/gate-the-bad-prompt.ts, etc.); this bundles them so M2 has a
// single verdict, mirroring the M1 gate-meeting-chaos.ts bar.
// Run: npx tsx scripts/gate-catalog.ts
import { runGate } from "./gate-harness";
import { spec as badPrompt } from "./gate-the-bad-prompt";
import { spec as brief } from "./gate-the-brief";
import { spec as dontTrust } from "./gate-dont-trust-the-ai";

async function main() {
  const specs = [badPrompt, brief, dontTrust];
  const results: { id: string; failures: number }[] = [];
  for (const spec of specs) {
    const failures = await runGate(spec);
    results.push({ id: spec.mission.id, failures });
  }

  console.log("\n============ M2 SUMMARY ============");
  for (const r of results) {
    console.log(`${r.failures === 0 ? "PASS" : "FAIL"}  ${r.id}${r.failures ? ` (${r.failures} failed)` : ""}`);
  }
  const total = results.reduce((n, r) => n + r.failures, 0);
  console.log(
    `\n${total === 0 ? "M2 GATE PASSED — all three missions discriminate." : `M2 GATE FAILED — ${total} check(s) across ${results.filter((r) => r.failures).length} mission(s).`}`,
  );
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Gate run errored:", e?.message || e);
  process.exit(1);
});
