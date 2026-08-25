// Proves no server secret reaches the browser (SPEC "Secondary checks"): scans
// the built CLIENT bundle for the literal secret values. Server chunks may hold
// them; the client static output must not.
//   run: npm run build && node scripts/verify-no-secret-leak.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "  ok  " : "FAIL  "} ${name}`);
  if (!cond) failures++;
};

const clientDir = join(root, ".next", "static");
if (!existsSync(clientDir)) {
  console.log("FAIL  .next/static missing — run `npm run build` first.");
  process.exit(1);
}

// Only genuine secrets. The publishable Supabase key and public URL are meant to
// ship to the browser, so they are NOT secrets to scan for.
const secrets = Object.entries({
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
  SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  SUPABASE_DB_URL: env.SUPABASE_DB_URL,
}).filter(([, v]) => v && v.length > 8);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else yield p;
  }
}

const leaks = [];
for (const file of files(clientDir)) {
  const text = readFileSync(file, "utf8");
  for (const [name, value] of secrets) {
    if (text.includes(value)) leaks.push({ name, file: file.replace(root, ".") });
  }
}

check(`scanned client bundle for ${secrets.length} secret value(s)`, secrets.length > 0);
check("no server secret appears in any client chunk", leaks.length === 0);
for (const l of leaks) console.log(`   -> ${l.name} found in ${l.file}`);

console.log(`\n${failures === 0 ? "NO SECRET LEAK — client bundle is clean." : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
