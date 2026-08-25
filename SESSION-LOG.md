# AI Field — Session Log

**Dates:** 2026-08-24 → 2026-08-25
**Phase:** Planning complete, design direction locked. **Full MVP flow designed + implemented as a real Next.js app** (all six surfaces, walkable end-to-end on a mocked examiner).

---

## Current status

- **Plan & spec are done** and unchanged: `plan.md`, `SPEC.md` (authoritative product truth; not modified this phase).
- **Design worked through the Impeccable skill**, in deliberate stages, each saved to the repo:
  1. `PRODUCT.md` — durable product record (users = broad non-technical professionals; a11y = WCAG 2.2 AA).
  2. `EXPERIENCE-THESIS.md` — experience POV, emotional progression, principles, personality, signature idea.
  3. `ANTI-PATTERNS.md` — the 10-pattern dashboard/LMS/ChatGPT-wrapper rut to actively avoid.
  4. `DESIGN-DIRECTIONS.md` — three explored directions (Bench / Session Line / Standing Assignment).
  5. `DESIGN-CHARTER.md` — the **locked direction**: **Standing Assignment**, raised by B (evidence line in Debrief) and A (deliberate context-giving).
  6. `THE-FIELD-COMPOSITIONS.md` + `THE-FIELD-STRESS-TEST.md` — three IA models for The Field, stress-tested across four states → **"Foreground Assignment / Peripheral World"** chosen, revised to the bounded-slice model that survives scale.
- **The Field is built and published** as the high-fidelity visual reference: `the-field.html`.
  - **Live artifact:** https://claude.ai/code/artifact/144a8118-1f06-4a26-9580-d2f5d5bd7dc8
  - Verified desktop + mobile, light + dark. Fixed during finish: a class-name collision, a register "shelf" (cells not filling height), viewport/charset robustness, and a layout-property hover animation (→ transform).

## The locked design

- **Composition — "Standing Assignment over a bounded practice ground":** one uncontained recommended assignment (dominant by scale/space/position/contrast) carrying its *because-<gap>* reason + the sole **Begin**; a bounded practice world (~2–3 missions incl. a not-yet-relevant one + a quiet "see all", no card grid); a fixed five-capability register (marker ○/● + evidence-phrase labels, no bars/%/radar); a compact record (full history one layer deeper).
- **Visual world:** warm mineral-stone ground `#E7E6DF` / near-black olive ink / one **petrol** accent `#0E5C6A`; **Bricolage Grotesque** display + **Public Sans** body; zero cards, drafting hairlines, sharp geometry; full light + dark themes.
- Backbone: *do the work → leave an evidence trail → receive an honest read → the gap generates the next assignment.*

## Deliverables in the project

| File / link | What it is |
|---|---|
| `plan.md`, `SPEC.md` | Product truth (unchanged). |
| `PRODUCT.md` | Impeccable product record. |
| `EXPERIENCE-THESIS.md` · `ANTI-PATTERNS.md` | Experience POV; the rut to avoid. |
| `DESIGN-DIRECTIONS.md` · `DESIGN-CHARTER.md` | Directions explored; the locked charter. |
| `THE-FIELD-COMPOSITIONS.md` · `THE-FIELD-STRESS-TEST.md` | The Field IA + stress test. |
| `the-field.html` + artifact link | **The Field — high-fidelity visual reference.** |

## MVP frontend build (this phase)

- **`DESIGN-SYSTEM.md`** written — the small practical system (type, color roles, spacing, surfaces, geometry, mission + capability states, motion) extracted from `the-field.html` and the charter.
- **Next.js (App Router) + React + Tailwind app scaffolded** — no shadcn (the world is too custom; hand-built primitives keep it pure). Tokens live in `app/globals.css`; fonts via `next/font` (Bricolage Grotesque + Public Sans).
- **All six surfaces built as real routes**, driven by real Meeting Chaos content (`lib/missions/*`) and a **mocked** literal-tool AI + examiner (`lib/mock/*`): Onboarding, The Field, Briefing, Workbench, Evaluating, Debrief → next assignment. State persists per browser (`lib/store.tsx`).
- The Field was ported from `the-field.html` to React; the built app is now the visual reference. `the-field.html` is retained as the origin artifact.
- Verified: full desktop loop walked end-to-end; `npm run build` passes (8 routes). Mobile implemented via standard `md:` breakpoints + the register's 5→2→1 queries — **not visually confirmed** (the automation environment locked the CSS viewport wide).
- **Five finish fixes applied** after walking the journey: (1) debrief headline shortened + resized off a many-line wall; (2) evidence line uses resource labels not ids; (3) named gap follows the demonstrated miss (trap survived → Verification → *Don't Trust the AI*, matching the charter loop + reference); (4) Workbench empty-column void removed (composer follows content, still sticky); (5) `data-gramm="false"` on all editable fields.

### Code map

- `app/` routes: `page.tsx` (entry redirect) · `onboarding/` · `field/` · `briefing/[missionId]/` · `workbench/[missionId]/` · `evaluating/` · `debrief/`. Tokens + base in `app/globals.css`; fonts + provider in `app/layout.tsx`/`app/providers.tsx`.
- `lib/missions/` — `types.ts`, `meeting-chaos.ts` (fully authored), `catalog.ts` (missions 2–4, playable), `index.ts`. `lib/competencies.ts` — bands, marker/phrase states, gap. `lib/mock/` — `ai.ts` (literal-tool AI, includes the Sept-date trap) + `examiner.ts` (session-signal judge). `lib/store.tsx` — per-browser state (`localStorage` key `ai-field-state-v1`).
- `components/` — `icons.tsx` (drawn SVGs), `CapabilityRegister.tsx` (register + `Marker`).

## M1 DISCRIMINATION GATE — PASSED (2026-08-25)

The hard go/no-go is cleared. The real judge (Claude **Sonnet 5**, effort high, Zod-constrained structured output) was run on a scripted STRONG vs WEAK Meeting Chaos transcript (`scripts/gate-meeting-chaos.ts`). All 9 assertions pass and the read is qualitatively honest, not just numerically divergent:

| Competency | Strong | Weak |
|---|---|---|
| Context | 79 (proficient) | 23 (emerging) |
| Direction | 79 (proficient) | 23 (emerging) |
| Iteration | 31 (developing) | 0 (not shown) |
| Verification | **strong band** (57) | 0 (not shown) |
| Synthesis | 61 (proficient) | 0 (not shown) |
| Next rep → | Iteration | **Verification** |

The judge named the exact trap (weak attempt: "three invented due dates and one invented owner" reached the deliverable) and routed the weak next-rep to Verification, the strong next-rep to Iteration — matching the charter's Meeting Chaos loop. **This is the SPEC stop point: gate passed, do not build missions 2–4 or polish (M2/M3) without a fresh go-ahead.**

**Provider:** switched Gemini → **Anthropic Claude Sonnet 5** for both roles (Gemini free tier capped at 20 req/day, which blocked the gate). Single provider, still behind the one `lib/ai/provider.ts` seam. Workbench = literal tool, effort low; Judge = rubric evaluator, effort high, Zod structured output. Rate limits / 12-msg ceiling / idempotency unchanged. Downgrading only the workbench to Haiku later is a one-line model change.

## Real backend build (M0 + backend half of M1) — 2026-08-25

The **entire server side is now built and typechecks**; `npm run build` passes with 3 new dynamic API routes + middleware. The app **still runs end-to-end on the mock** (the backend is additive — no frontend cutover yet, so nothing regressed).

**Deps added:** `@google/genai@2.18`, `@supabase/ssr@0.12`, `@supabase/supabase-js@2.112`, `server-only`.

**What was built (all credential-free to write; verified where possible):**
- `.env.local.example` — the env contract (`GEMINI_API_KEY`, `GEMINI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). `.env*.local` is gitignored.
- **Provider isolation** `lib/ai/provider.ts` — the ONE LLM seam. `streamWorkbench()` (streamed, non-pedagogical system instruction, thinkingLevel LOW) + `runJudge()` (structured output against `JUDGE_SCHEMA`, thinkingLevel HIGH). Behaviour via structured output + thinking level, not temp/top-p (per SPEC).
- **Judge** `lib/judge/*` — `types.ts` (JudgeOutput contract + version stamps), `schema.ts` (closed-enum structured-output schema), `prompt.ts` (unified ID'd timeline `msg_NN`/`evt_NN` + deliverable + weighted competencies + judgeGuidance; cite by turn id, never quote).
- **Deterministic progression** `lib/progression/*` — `update.ts` (bands→0–100 blend, weight-scaled, `ALLOW_REGRESSION=false`, weight-0 frozen), `recommend.ts` (next mission by named gap), `profile.ts` (rows↔Profile). The LLM never runs these.
- **Debrief assembly** `lib/debrief/*` — `types.ts` (same `Debrief` shape the UI already renders, moved out of the mock namespace) + `build.ts` (session line grounded in real cited turns).
- **Supabase** `lib/supabase/*` — `env.ts`, `client.ts` (browser, publishable key), `server.ts` (cookie-bound, acts as the user so RLS applies; `requireUserId`), `middleware.ts` + root `middleware.ts` (session refresh only), `bootstrap.ts` (explicit anonymous sign-in + profile row).
- **Migration** `supabase/migrations/0001_init.sql` — all 7 tables (`profiles`, `user_competencies`, `challenge_attempts`, `workbench_messages`, `attempt_events`, `evaluations` w/ UNIQUE(attempt_id), `rate_limits`), RLS `auth.uid()=user_id` on every table, and 4 SECURITY-INVOKER RPCs: `claim_attempt_for_evaluation` (atomic lease claim), `reset_attempt_to_submitted`, `finalize_evaluation` (eval insert + competency upsert + status flip in one fn), `consume_rate_limit`.
- **Routes:** `/api/workbench` (create/resume attempt, hard 12-msg ceiling, per-user rate limit, attach→`attempt_events`, streamed Gemini, persist ai msg on close; only user-given materials injected), `/api/submit` (deliverable→`submitted`, idempotent), `/api/evaluate` (lease claim → judge → deterministic update+recommend → `finalize_evaluation`; idempotency branches: return_existing / in_progress(202) / run; judge failure resets lease; unique-violation backstop).

**Verified now (no creds):** `npx tsc --noEmit` clean; `npm run build` passes (8 routes + middleware); **`npx tsx scripts/verify-progression.ts` PASSES** — proves the deterministic half of the thesis: strong vs weak judged bands diverge on every competency, weight-0 bars stay frozen, recommendations resolve. This is NOT the discrimination gate (that's the real judge producing the bands).

## Next actions (need the credentials in `.env.local`)

1. **Frontend cutover** — rewire `lib/store.tsx` (+ onboarding/workbench/evaluating/field) from the mock to: anonymous bootstrap on mount, `/api/workbench` streaming, `/api/submit`, `/api/evaluate`, profile/completed from Supabase. Deliberately deferred so it can be verified live rather than written blind. The mock (`lib/mock/*`) stays until cutover is proven, then is removed.
2. **Apply the migration** to the Supabase project; verify RLS isolation (second anon user can't read the first's rows) and that no secret key appears in any browser payload.
3. **The discrimination gate (M1 go/no-go):** real Gemini judge on a strong vs weak Meeting Chaos transcript → assert bands/coaching/profile differ correctly; tune prompt+weights until reliable. **Then STOP and report.**
4. (Owed) `DESIGN.md` standalone record; real-device mobile QA.

**Blocking dependency:** a Gemini API key + a Supabase project (URL + publishable + secret keys) in `.env.local` — see `.env.local.example`.

## Prior next actions (design debt, still open)

1. **`DESIGN.md`** — still owed as the standalone incumbent-world record (`/impeccable document` from the built app). `DESIGN-SYSTEM.md` covers the same ground pragmatically for now.
2. Mobile visual QA on a real device/emulator.

## Open dependencies for the build

- A **Gemini API key** and a **Supabase project** (into `.env.local`) before M0/M1 runs end-to-end.
- Run the app: `npm run dev` → http://localhost:3000. **Run it in a real terminal, not a Claude background task** — a server started inside the assistant's session environment is network-isolated from the user's browser and won't be reachable.

---

# Session — 2026-08-26 (M1 live, hardening, latency)

**Phase:** M0+M1 shipped on the real backend and past the discrimination gate. This session: interactive walk, M1 gap-fixing, mock cleanup, and a latency pass. All the changes below are in this commit.

## Milestones reached (this + immediately prior sessions)
- **Frontend cutover done** — the app runs entirely on anon-auth + Supabase + the 3 API routes; the mock is gone.
- **Provider switched Gemini → Anthropic Claude Sonnet 5** (Gemini free tier's ~20 req/day cap blocked the gate). One seam: `lib/ai/provider.ts` (workbench effort `low`, judge effort `high` + Zod structured output). `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` in `.env.local`.
- **Migration applied live; RLS isolation verified; discrimination gate PASSED** on Meeting Chaos.

## Interactive UI walk (Claude drove the user's Chrome)
Walked onboarding→field→briefing→workbench(give-to-AI, real instrument, select-to-capture)→submit→judge(~30s)→debrief→profile update→next assignment. Thesis holds live: honest, evidence-anchored read; deterministic band movement with weight-0 freeze; gap-driven next rep.

## Fixes made this session (all `tsc` + `npm run build` + verify suite green)
- **Field ↔ Debrief gap contradiction** — Field re-derived the gap via `gapCompetency(profile)` instead of the judge's `practice_competency`; now sources it from `lastDebrief.practice` / durable `recommendation.practice`.
- **Evaluating page could strand a finished eval** — removed the `started` re-entry guard so an effect re-run (dev Fast Refresh) restarts the poll (safe via route idempotency) instead of completing server-side but never navigating.
- **Recommendation was sessionStorage-only** — now derived durably from the latest stored evaluation on bootstrap (survives new tab / cleared storage).
- **Tone-to-experience wired** — evaluate route passes `profiles.ai_usage` as `operatorExperience` to the judge (tone only, never the bar); was stubbed in the prompt, never passed.
- **Review a past rep** — Field record rows → `/debrief?attemptId=…` review mode (idempotent return_existing fetch) with a read-only **"What you submitted"** section; debrief page wrapped in `<Suspense>` for `useSearchParams`.
- **select-to-capture** polish — strip list markers; table capture targets the content column, not col-0.
- **Register copy** — `shown once` / `shown in a few reps` → `beginning to show` / `clearly shown` (they asserted false rep counts).
- **SPEC.md** — de-Gemini'd (provider is Claude).

## Missing tests written (repo `verify-*` convention, DB boundary, real anon user)
- `scripts/verify-idempotency.mjs` — exactly-once + recovery via the evaluation RPCs (claim→run/in_progress/return_existing, duplicate-finalize rejected, stale-lease reclaim, reset).
- `scripts/verify-guardrails.mjs` — rate-limit 429 mechanism (`consume_rate_limit`).
- `scripts/verify-no-secret-leak.mjs` — no ANTHROPIC/SUPABASE secret in `.next/static`.
- (Workbench ~12-msg ceiling stays app-layer; covered by the walk.)

## Mock cleanup
- Deleted orphaned `lib/mock/` (ai.ts + examiner.ts) — nothing imported it after the cutover.
- Fixed the stale `catalog.ts` comment that claimed missions 2–4's examiner is mocked (they run the real judge; only their gate tuning is deferred to M2).
- Confirmed: no live mocks remain — AI, examiner, DB, auth, progression, recommendation are all real.

## Latency pass
- Cold `/field` load cut from ~6 sequential Supabase round-trips to **4 parallel** (network-verified). `bootstrap.ts` trusts the local `getSession()` for returning users (dropping a `getUser()` network call + redundant profile upsert); `store.tsx` collapses `loadCompleted` to one nested embed and replaces the 2-query `loadRecommendation` with a 1-query JSON-arrow `loadLatestPractice`, run inside the same `Promise.all`.

## CAUTION learned
- **Never run `npm run build` while the user's `next dev` is running** — both write `.next/` and the production build corrupts the dev server (intermittent 404s on all routes). Fix: stop dev, `rm -rf .next`, `npm run dev`. For verifying code changes during a live dev session, use `tsc --noEmit`, not `build`.

## Deferred (explicit)
- **M2 = judge tuning + discrimination gate for missions 2–4** (The Bad Prompt, The Brief, Don't Trust the AI) — the agreed next milestone; real per-mission API cost; `scripts/gate-meeting-chaos.ts` is the pattern.
- Held until after M2: making mission content real (CMS/uploads), hardcoded fallback ids, provisional progression-curve constants.
- User-owned: CAPTCHA/Turnstile (Supabase dashboard) + Vercel deploy, still building.
- Still owed: `DESIGN.md`, real-device mobile QA.
