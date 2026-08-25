// Proves the evaluation pipeline's exactly-once + recovery guarantees at the DB
// boundary (SPEC "Testing Decisions"), exercising the real RPCs as a real anon
// user so auth.uid() resolves. No judge is called — the judge output is canned.
//   run: node scripts/verify-idempotency.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
  if (!cond) failures++;
};
const action = (rows) => (Array.isArray(rows) ? rows[0]?.action : undefined);
const CANNED_JUDGE = { headline: "test", practice_competency: "verification" };
const CANNED_MOVES = [{ competency: "context", before: "not_shown", after: "emerging", moved: true }];
const CANNED_SCORES = { context: 40, direction: 25 };

const A = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authErr } = await A.auth.signInAnonymously();
if (authErr || !auth?.user) {
  console.log("FAIL  anonymous sign-in:", authErr?.message);
  process.exit(1);
}
const uid = auth.user.id;
await A.from("profiles").upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });

async function seedSubmitted() {
  const { data } = await A.from("challenge_attempts")
    .insert({
      user_id: uid,
      mission_id: "meeting-chaos",
      mission_version: "1",
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_deliverable: { lists: { decisions: ["x"] }, tables: {} },
    })
    .select("id")
    .single();
  return data?.id;
}
async function statusOf(id) {
  const { data } = await A.from("challenge_attempts").select("status").eq("id", id).single();
  return data?.status;
}
const claim = (id, stale = 90) =>
  A.rpc("claim_attempt_for_evaluation", { p_attempt_id: id, p_stale_seconds: stale });
const finalize = (id) =>
  A.rpc("finalize_evaluation", {
    p_attempt_id: id,
    p_raw_evaluation: CANNED_JUDGE,
    p_competency_results: CANNED_MOVES,
    p_new_scores: CANNED_SCORES,
    p_model_id: "test-model",
    p_judge_prompt_version: "test",
    p_judge_schema_version: "test",
  });

// ---- exactly-once ----------------------------------------------------------
const a1 = await seedSubmitted();
check("seeded a submitted attempt", !!a1);

const { data: c1 } = await claim(a1);
check("first claim on submitted -> run", action(c1) === "run");
check("claim moved status -> evaluating", (await statusOf(a1)) === "evaluating");

const { data: c2 } = await claim(a1);
check("second claim (fresh lease) -> in_progress", action(c2) === "in_progress");

const { error: f1 } = await finalize(a1);
check("finalize succeeds", !f1);
check("finalize moved status -> evaluated", (await statusOf(a1)) === "evaluated");

const { data: evals1 } = await A.from("evaluations").select("id").eq("attempt_id", a1);
check("exactly one evaluation row written", (evals1?.length ?? 0) === 1);

const { data: comp } = await A.from("user_competencies").select("competency, score").eq("user_id", uid);
const ctx = comp?.find((r) => r.competency === "context")?.score;
check("competency score applied from finalize (context=40)", ctx === 40);

const { data: c3 } = await claim(a1);
check("claim after finalize -> return_existing", action(c3) === "return_existing");

const { error: f2 } = await finalize(a1);
check("duplicate finalize is rejected (UNIQUE attempt_id)", !!f2);
const { data: evals2 } = await A.from("evaluations").select("id").eq("attempt_id", a1);
check("still exactly one evaluation row after duplicate", (evals2?.length ?? 0) === 1);

// ---- recovery --------------------------------------------------------------
const a2 = await seedSubmitted();
const { data: r1 } = await claim(a2);
check("recovery: fresh claim -> run", action(r1) === "run");

// simulate a crashed evaluation: the lease is now stale.
await A.from("challenge_attempts")
  .update({ evaluation_started_at: new Date(Date.now() - 200_000).toISOString() })
  .eq("id", a2);
const { data: r2 } = await claim(a2, 90);
check("recovery: stale lease is reclaimed -> run", action(r2) === "run");

const { data: r3 } = await claim(a2, 90);
check("recovery: fresh lease again -> in_progress", action(r3) === "in_progress");

const { error: resetErr } = await A.rpc("reset_attempt_to_submitted", { p_attempt_id: a2 });
check("recovery: reset_to_submitted succeeds", !resetErr);
check("recovery: status back to submitted", (await statusOf(a2)) === "submitted");
const { data: r4 } = await claim(a2);
check("recovery: claim after reset -> run", action(r4) === "run");

// ---- cleanup ---------------------------------------------------------------
for (const id of [a1, a2]) if (id) await A.from("challenge_attempts").delete().eq("id", id);
await A.from("user_competencies").delete().eq("user_id", uid);

console.log(`\n${failures === 0 ? "IDEMPOTENCY + RECOVERY VERIFIED." : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
