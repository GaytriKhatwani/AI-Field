// Proves the security model end-to-end against the live project:
//  1. anonymous sign-in is enabled,
//  2. a user can read/write their own rows,
//  3. RLS blocks a second anonymous user from reading the first's rows.
// Run: node scripts/verify-rls.mjs
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

const mkClient = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const A = mkClient();
const B = mkClient();

// 1. Anonymous sign-in works (settings enabled).
const { data: aAuth, error: aErr } = await A.auth.signInAnonymously();
check("anonymous sign-in enabled (user A)", !aErr && !!aAuth?.user);
if (aErr) {
  console.log("   ->", aErr.message, "(enable Authentication -> Allow anonymous sign-ins)");
  process.exit(1);
}
const { data: bAuth } = await B.auth.signInAnonymously();
const aId = aAuth.user.id;
const bId = bAuth.user.id;
check("two distinct anonymous users", aId !== bId);

// 2. A writes its own rows.
await A.from("profiles").upsert({ user_id: aId }, { onConflict: "user_id", ignoreDuplicates: true });
const { data: aAttempt, error: aInsErr } = await A
  .from("challenge_attempts")
  .insert({ user_id: aId, mission_id: "meeting-chaos", mission_version: "1", status: "in_progress" })
  .select("id")
  .single();
check("A can insert its own attempt", !aInsErr && !!aAttempt?.id);

const { data: aReadOwn } = await A
  .from("challenge_attempts")
  .select("id")
  .eq("user_id", aId);
check("A can read its own attempt", (aReadOwn?.length ?? 0) >= 1);

// 3. B must NOT see A's rows — the core isolation guarantee.
const { data: bReadAsA } = await B
  .from("challenge_attempts")
  .select("id")
  .eq("user_id", aId);
check("B cannot read A's rows by user_id filter", (bReadAsA?.length ?? 0) === 0);

const { data: bReadAll } = await B.from("challenge_attempts").select("id");
check("B's unfiltered select returns none of A's rows", (bReadAll?.length ?? 0) === 0);

const { data: bReadProfiles } = await B.from("profiles").select("user_id");
const leaked = (bReadProfiles ?? []).some((r) => r.user_id === aId);
check("B cannot read A's profile", !leaked);

// 4. B cannot forge a row as A (insert check).
const { error: forgeErr } = await B
  .from("challenge_attempts")
  .insert({ user_id: aId, mission_id: "meeting-chaos", mission_version: "1", status: "in_progress" });
check("B cannot insert a row owned by A (RLS with_check)", !!forgeErr);

// Cleanup A's test rows.
if (aAttempt?.id) await A.from("challenge_attempts").delete().eq("id", aAttempt.id);

console.log(`\n${failures === 0 ? "RLS VERIFIED — isolation holds." : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
