// Proves the per-user rate-limit mechanism that backs the /api/workbench 429
// (SPEC "Secondary checks"), exercising consume_rate_limit as a real anon user.
// The ~12-message hard ceiling is enforced in-route (app/api/workbench/route.ts)
// against workbench_messages and is exercised by the interactive walk, not here.
//   run: node scripts/verify-guardrails.mjs
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

const A = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: auth, error: authErr } = await A.auth.signInAnonymously();
if (authErr || !auth?.user) {
  console.log("FAIL  anonymous sign-in:", authErr?.message);
  process.exit(1);
}

const LIMIT = 3;
const bucket = `test:${auth.user.id}:${Date.now()}`;
const consume = () =>
  A.rpc("consume_rate_limit", { p_bucket_key: bucket, p_limit: LIMIT, p_window_seconds: 60 });

const results = [];
for (let i = 0; i < LIMIT + 2; i++) {
  const { data } = await consume();
  results.push(data);
}
check(`first ${LIMIT} calls within limit are allowed`, results.slice(0, LIMIT).every((r) => r === true));
check("calls beyond the limit are denied (would 429)", results.slice(LIMIT).every((r) => r === false));

// A different bucket is independent (per-user / per-action isolation).
const { data: other } = await A.rpc("consume_rate_limit", {
  p_bucket_key: `${bucket}:other`,
  p_limit: LIMIT,
  p_window_seconds: 60,
});
check("a separate bucket is not affected by another's count", other === true);

console.log(`\n${failures === 0 ? "RATE-LIMIT MECHANISM VERIFIED." : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
