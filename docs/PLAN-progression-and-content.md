# Plan — Progression config, mission fallbacks, and content humanization

> **Status:** planned, NOT started. Written after a grilling pass on two parked gaps
> (SESSION-LOG "held item 3 & 4"). **Do not implement until the current
> `m2-gates-and-a11y-hardening` branch is merged to `main` and deployed to Vercel** —
> the user is shipping the existing loop first. This is the first slice of the next
> milestone ("humanize + rebrand the content"); the landing-page/FTUE and admin
> analytics features are separate and out of scope here.

---

## In plain terms

Three small, safe fixes before real people test the missions:

1. **Make the skill-bar maths honest and un-driftable.** Right now two different
   number tables decide "what band is this score" and "where should a score move
   to" — and they disagree, so a rep the examiner calls *Strong* can show as
   *Proficient* on the profile. Fold them into **one table** so they can never
   contradict each other again.
2. **Stop hardcoding which mission comes next.** One screen guesses mission names as
   plain text (`"the-bad-prompt"`, `"meeting-chaos"`) and would crash if a name ever
   changed. Route it through the recommender we already own.
3. **Make the missions feel like real handed-over work**, not exercises — without
   making them any easier or breaking the examiner's ability to tell strong work
   from weak. Polish three missions to a user-testing standard.

Nothing new is built: no new missions, no new profile mechanics, no file upload.

---

## Scope

**In scope**
- One canonical band/target configuration (fixes the judge-band ↔ profile-band contradiction).
- Remove hardcoded fallback mission ids; drive fallback from the catalog + existing recommender.
- Humanize **Meeting Chaos, The Bad Prompt, Don't Trust the AI** to user-testing quality.
- Re-run each mission's discrimination gate after its content pass; full `gate-catalog.ts` at the end.

**Explicitly NOT in scope** (do not expand)
- New missions or mission types.
- Real-artifact / file upload.
- New judge mechanics or judge tuning (reopen the judge only on an *observed* evaluator failure — Q2).
- New progression systems: no confidence, rep-counts, decay, regression, or mastery logic.
- The Brief content polish is deferred (4th priority; keep it functional + gate-passing, don't polish ahead of the first three).
- Landing page / first-time-user experience, rebrand, admin analytics dashboard (separate next-milestone features).

**Sequencing (locked):** (1) progression config → (2) fallback ids → (3) humanize the 3 →
(4) re-gate per mission → (5) full catalog gate → (6) leave The Brief functional, lower priority.

---

## Part 1 — One canonical band configuration

**Problem.** `lib/competencies.ts` `scoreToBand()` uses thresholds `30 / 55 / 80`.
`lib/progression/update.ts` `BAND_TARGET` uses independent anchors
`{emerging 25, developing 45, proficient 68, strong 88}`. They drift: a **Strong**
judged rep on a weight-1.0 competency blends to `88 × 0.9 = 79`, and `scoreToBand(79)`
= **Proficient** — the profile silently contradicts the examiner.

**Fix.** Make `lib/competencies.ts` the single source. Define one scale that carries,
per band, its display range **and** its blend target:

| Band | Display range | Target |
|---|---|---|
| not_shown | 0 | 0 |
| emerging | 1–29 | **20** |
| developing | 30–54 | **42** |
| proficient | 55–79 | **68** |
| strong | 80–100 | **90** |

- `scoreToBand()` derives from the range columns (values already match today — no display change).
- `BAND_TARGET` is **derived from this same table** and re-exported; delete the independent
  copy in `update.ts` and import it instead.
- Keep the blend unchanged: `k = 0.4 + 0.5 × competencyWeight`; `next = prev + (target − prev) × k`.
- Keep `ALLOW_REGRESSION = false`.

**Why these targets work.** A weight-1.0 first attempt lands in the matching band on rep one:
`20·0.9=18→emerging`, `42·0.9=38→developing`, `68·0.9=61→proficient`, `90·0.9=81→strong`. ✅
A Strong rep on a lightly-weighted competency (e.g. weight 0.5 → `90·0.65=58` → Proficient)
moves less — intended: **the debrief reports the attempt; the Operator Profile represents
accumulated demonstrated capability** (Q5). The per-attempt Strong band still shows in the debrief.

**Drift guard.** Add a tiny invariant check (extend `verify-progression.ts`, or a new
`verify-band-config`): assert every band's `target` falls inside its `[min, max]`, and that
`scoreToBand(target) === band`. This mechanically prevents the two systems from ever
diverging again.

**Files:** `lib/competencies.ts` (canonical scale), `lib/progression/update.ts` (import,
drop duplicate), `scripts/verify-progression.ts` (invariant + re-verify strong/weak divergence
still holds).

---

## Part 2 — Remove hardcoded fallback mission ids

**Problem.** `app/field/page.tsx:37–41`:
```ts
const recommendedId =
  lastDebrief?.nextMissionId ??
  recommendation?.nextMissionId ??
  (hasReps ? "the-bad-prompt" : "meeting-chaos");   // arbitrary literals
const recommended = getMission(recommendedId) ?? getMission("meeting-chaos")!; // can crash
```
Two string-literal mission ids duplicated in UI logic, and a non-null assertion that throws
if `meeting-chaos` ever leaves the catalog.

**Fix — catalog is the single source of truth:**
- Add a canonical **`FIRST_MISSION_ID`** to `lib/missions/index.ts`, derived from the catalog
  (the mission whose `availability === "recommended"`, falling back to `MISSIONS[0].id`) — no
  literal in a screen.
- **Cold start** (no reps) → `FIRST_MISSION_ID`.
- **Returning user, no stored recommendation** → derive the gap and use the recommender we
  already own: `recommendNext(gapCompetency(profile), completedIds)` — not an arbitrary
  `"the-bad-prompt"`.
- **Missing/invalid mission** → safe fallback to `getMission(FIRST_MISSION_ID)`, and if *that*
  is somehow absent, render an explicit empty/error state — **never** a runtime crash (remove
  the `!` assertion).

**Files:** `lib/missions/index.ts` (`FIRST_MISSION_ID`), `app/field/page.tsx` (use it +
`recommendNext` fallback + safe render). No mission id string should be duplicated in UI logic
after this.

---

## Part 3 — Content humanization (Meeting Chaos, The Bad Prompt, Don't Trust the AI)

**Goal (Q1, Q8):** each source artifact should read like *"something a colleague genuinely
handed me at work"* — real names/roles, workplace shorthand, half-finished thoughts, natural
inconsistencies, incomplete info, slightly uneven formatting, ambiguity that requires judgment.

**Guardrails:**
- **Preserve the underlying facts and difficulty; remove the instructional scaffolding around
  them** (Q7). Strip lines that teach the rubric or point at the missing information; keep the
  missing information missing and the ambiguity intact.
- **"Messy enough to require judgment, not messy enough to require deciphering"** (Q8).
  Difficulty comes from deciding what matters and how to direct the AI — never from struggling
  to read badly-written content. Do **not** add typos, noise, or fake informality to look "human."
- Independent, self-contained scenarios — no shared fictional universe, no cross-mission continuity.
- **Meeting Chaos** already sets the realism bar (`RAW_NOTES`: half-sentences, self-corrections,
  an unresolved "??"). Bring the other two up to it; Meeting Chaos itself likely needs only a
  light polish, not a rewrite.

**Known giveaways to remove (found in review) — the concrete targets:**
- **Don't Trust the AI** — source ends `"NOTE: enterprise pipeline discussed qualitatively;
  no dollar figure was given"`. That sentence *is* the coaching — it names the trap. **Remove
  the NOTE; keep the source genuinely silent on any enterprise dollar figure** so the invented
  number is still catchable (the gate depends on the silence, not the note).
- **The Brief** (deferred, but same principle when polished) — `"one large logo on their site
  (unverified whether it's a paying customer)"` and `"(rest is rumour)"` hand the user the
  assumption they're meant to catch. Preserve the *fact* (a logo of uncertain status); remove
  the parenthetical that flags it as suspect.
- **The Bad Prompt** — the voice note (`"We never say 'thrilled', 'excited to announce'…"`) is
  legitimate brand guidance, not a giveaway; keep it but make the surrounding scenario read like
  a real forwarded message rather than an exercise prompt.

**Per-mission workflow (Q7):**
1. Humanize the mission's `scenario`, `resources[].content`, and framing.
2. Run that mission's gate: `npx tsx scripts/gate-<mission>.ts`.
3. Confirm strong vs weak still separates in the expected direction.
4. If a *fact* the scripted transcript relies on legitimately changed, update the **scripted
   strong/weak transcript** to match the new source — **never** edit the judge to make a content
   regression pass.
5. Move to the next mission.

**After all three are humanized:** run `npx tsx scripts/gate-catalog.ts` once as the full
regression check. Don't re-run the whole catalog after every wording tweak — only per-mission
gates during the pass, catalog once at the end (unless a change touches shared logic).

**Files:** `lib/missions/meeting-chaos.ts`, `lib/missions/catalog.ts` (theBadPrompt,
dontTrustTheAI). Scripted transcripts in `scripts/gate-*.ts` updated only if source facts move.

---

## Verification checklist (definition of done)

- [ ] One canonical band scale in `lib/competencies.ts`; `update.ts` imports `BAND_TARGET`, no duplicate.
- [ ] Invariant check passes: every target inside its band range; `scoreToBand(target) === band`.
- [ ] `verify-progression.ts` still shows strong vs weak profile divergence; a highly-weighted Strong rep reaches the Strong band.
- [ ] No hardcoded mission-id string literals in `app/`; `FIRST_MISSION_ID` derives from the catalog.
- [ ] Field fallback uses `recommendNext(...)`; no `getMission(...)!` crash path.
- [ ] Meeting Chaos, The Bad Prompt, Don't Trust the AI humanized to the realism bar; giveaways removed, facts + difficulty preserved.
- [ ] Each of the three passes its individual gate; `gate-catalog.ts` passes.
- [ ] `tsc --noEmit` clean; `npm run build` clean (only when no `next dev` is running).
- [ ] The Brief still functional + gate-passing (not necessarily humanized).

---

## Notes carried from the grilling

- **Q2:** the M2 judge is NOT tuned proactively. Reopen only on an *observed* evaluator failure
  during human testing (unfair read, strong-scored-weak, generic coaching, wrong competency,
  evidence mismatch, repeated inconsistency). During testing, retain each attempt alongside its
  judge output so real misses can drive any later tuning.
- **Privacy copy (Q1):** the workbench warning drops the Gemini-free-tier rationale and becomes a
  general safeguard, e.g. *"Use the provided mission materials. Avoid entering confidential,
  proprietary, or sensitive information."* (small copy change, bundle with the content pass.)
