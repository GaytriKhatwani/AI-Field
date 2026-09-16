# Handoff — current state

_Last updated: 2026-09-16. Keep this short; history lives in `SESSION-LOG.md`._

## Where things stand

- **Code:** everything is on `origin/main` (`b0f7a60`). Working tree clean.
- **Live site:** https://ai-field.vercel.app redeploys automatically from `main`.
  Backend is the dev Supabase project (ref `jrsaxotvdnzmnpfplmuz`), Anthropic Claude Sonnet 5 for both the workbench AI and the judge. See `DEPLOYMENT.md`.
- **Quality bar:** `tsc --noEmit` clean. `verify-*` scripts pass. All discrimination gates pass:
  `gate-meeting-chaos`, `gate-the-bad-prompt`, `gate-the-brief`, `gate-dont-trust-the-ai`
  (bundled by `gate-catalog`), plus `gate-e2e-meeting-chaos` (real workbench AI, scripted person).
- **Plans:** `PLAN-progression-and-content.md` is DONE. `SPEC-activation-layer.md` and
  `SPEC-workbench-transfer-redesign.md` are shipped.

## What changed most recently

- **2026-09-12 QA sweep** (`460cf50`): the judge now reads the mission's source material as
  ground truth (it never had it before); API input caps and validation; the dropped-keystroke
  bug in deliverable fields fixed; AI replies render markdown; transcript follows the stream;
  drafts scoped per user. Full findings list in `SESSION-LOG.md`.
- **2026-09-15 content close-out** (`b0f7a60`): The Brief's notes no longer name the trap and
  gained a "Where we stand" resource; The Bad Prompt's material is Sam's actual message;
  Don't Trust the AI has the AI draft it asks you to check.

## Next

1. **Tester feedback from prod.** The judge is tuned only on an observed miss. For every
   reported unfair read, keep the attempt id and its judge output so tuning has evidence.
2. **Before public exposure (owner):** enable CAPTCHA/Turnstile in the Supabase dashboard.
3. **Small known-open items** (none blocking, all listed under "Known, not fixed" in the
   2026-09-12 session-log entry): table-row blocks transfer into one column by design; the
   debrief repeats the five bands in the Save block; first-rep Save moment keys on distinct
   missions; post-submit immutability relies on RLS own-row rules; a no-chat double submit
   without an attempt id can create two attempts.
4. **Still owed whenever:** decide on a standalone `DESIGN.md`; real-device mobile QA.

## How to work on it

- Run the app yourself: `npm run dev` (Claude-started servers are fine for automation but
  never run `npm run build` while `next dev` is up — it corrupts `.next`).
- Verify without a build: `npx tsc --noEmit`, then `npx tsx scripts/verify-progression.ts`
  and `npx tsx scripts/verify-workbench-transfer.ts` (free), the `verify-*.mjs` scripts
  (need `.env.local`), and the `gate-*` scripts (paid API calls, run per mission after a
  content or judge change, `gate-catalog` once at the end).
- The workbench AI's rules live in `lib/ai/workbenchSystem.ts`; the judge prompt in
  `lib/judge/prompt.ts`; missions in `lib/missions/`. Changing any of these means re-gating.
- Pushing needs the owner's GitHub token; from a Claude session use `! git push origin main`.
