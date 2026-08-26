---
target: the debrief
total_score: 27
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T07-54-18Z
slug: app-debrief-page-tsx
---
# Critique — The Debrief (`app/debrief/page.tsx`)

Method: dual-agent (A: design review · B: detector + source evidence), both isolated. Browser/overlay skipped — no dev server reachable; app is not a static build. Mode: **Read** with a **Persuade** close.

## Design Health Score — 27/32 (Good, upper band ≈ 84%)

Heuristics 7 (Flexibility) and 10 (Help) are n/a on this linear Read surface; scored over the 8 that apply.

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Review-mode fetch reuses the generic breathe loader — a slow judge fetch reads as a hang |
| 2 | Match System / Real World | 4 | Plain and human ("a strong operator", "held your ground"); bands are words. "Rep" is mild jargon |
| 3 | User Control and Freedom | 3 | Back-to-Field always present, forward CTA clear; terminal surface |
| 4 | Consistency and Standards | 4 | Shared `Row` helper, type roles, tokens, hairline rhythm — rigorously consistent |
| 5 | Error Prevention | 3 | Few inputs; review-error path handled |
| 6 | Recognition vs Recall | 4 | Everything on screen — evidence inline, mission title, submitted deliverable in review |
| 7 | Flexibility and Efficiency | n/a | Linear Read surface, no power-user path |
| 8 | Aesthetic and Minimalist | 3 | Beautifully restrained, but the wide rail gutter + indented hero weaken top hierarchy |
| 9 | Error Recovery | 3 | "That debrief didn't load" is plain and offers an exit |
| 10 | Help and Documentation | n/a | Self-explanatory read |
| **Total** | | **27/32** | **Good (upper), approaching Excellent** |

## Design Specificity Verdict — PASS, with one borrowed structure

**Design review:** The *substance* is unmistakably AI Field and defies its anti-references, enforced in code: bands render as word→word transitions (`bandLabel`), no %, no bar, no radar; the anti-inflation copy ("Finishing a mission never inflates a bar you didn't use") is an inoculation no LMS ships; the evidence timeline resolves real turn ids back to actual text; and the forward resolution is a causal sentence ("Because your Verification is emerging, your next rep is built to draw it out"), not a recommendation widget. The **one category-generic element is the rail/side-heading structure itself** — clean editorial convention, but the least AI-Field-specific decision and (below) over-scaled.

**Deterministic scan:** detector returned **0 findings** on both full and layout scopes. No slop, no false positives. As with the workbench, the real issues live in hierarchy, emotional sequencing, and a11y semantics — where the static rule engine is blind.

**Visual overlays:** none (no dev server).

## Overall Impression

The hardest part of the brief — an honest read that coaches instead of grades, in words not numbers — is genuinely met, and the gap→next-assignment close is the best-resolved moment on the page. The opportunity is the *top* of the page and the *sequence*: the emotional peak (the verdict) is indented and body-aligned so it opens flat, and a first-timer meets the coldest content (a blunt headline, then gap-toned dots) before a single word of affirmation. The rework fixed the "wall of text"; the next move is emotional and hierarchical, not structural.

## What's Working

1. **On-charter defiance of the anti-references, enforced in code** — words-not-numbers, no bars/%, the explicit anti-inflation sentence. The hardest part of the brief, genuinely met.
2. **Evidence timeline grounded in real turns** — tone dots + scrubbed plain-text notes; the "evidence trail" is concrete, not decorative.
3. **The gap→next-assignment resolution** — a causal sentence linking the named weak competency to the next rep; robust review/empty/error states; reduced-motion honored; and (B-verified) clean `h1→h2→h3` order with rail DOM order = reading order.

## Priority Issues

**[P1] The hero loses its punch.** The headline is the emotional peak, yet it's indented ~266px into the content column and aligned to the *same left edge as body prose*, with the mission folio in the rail. It surrenders the full-bleed force an opening verdict wants. *Fix:* let the h1 break the rail to the main's left edge; keep the mission/mode as a small kicker above it. → `/impeccable layout`

**[P1] Gaps are emotionally front-loaded for the first-timer.** The order is verdict → gap-dotted timeline → "What worked" → "What you missed" — so the first beats after a blunt standalone headline are gaps, before any affirmation. For Jordan's first honest read this reads closer to "polite grading" than coaching. *Fix:* add one orienting line beneath the headline (what this read is; that it's coaching), and/or surface "What worked" ahead of the timeline. → `/impeccable layout` + `/impeccable clarify`

**[P2] Evidence-timeline tone is signaled by color alone.** *Cross-validated by both assessments.* The good/gap/neutral marker dots are `aria-hidden` and encode tone only by color; the note switches to `--warn` when it's a gap; there is no text token ("Strength"/"Gap") for the classification. A colorblind or screen-reader reader gets the tone only from the note's wording. WCAG 1.4.1 (Use of Color). *Fix:* add a visually-hidden or visible per-moment label. *Note:* the related contrast worry is resolved — `--warn` #7f5d2c (4.79:1) and `--ink-3` #63635a (4.85:1) on `--ground` both pass AA for small text (verified from tokens), and dark mode is higher. → `/impeccable harden`

**[P2] Data-cleaning asymmetry in `lib/debrief/build.ts`.** *B's finding.* `plainText` (markdown strip) is applied only to the turn `text`; `scrubTurnIds` only to the `note`. So markdown leaking into a note (`ev.why`) would not be stripped, and a raw `msg_03` appearing in a turn's `text` would not be scrubbed — each field gets only one of the two cleaners. *Fix:* run both cleaners on both fields. → `/impeccable harden`

**[P2] The rail is over-scaled → empty gutter + split-attention.** At `minmax(150px,210px)` the rail carries three words across ~20% of the width at ≥900px, and the two-column grid engages at 768px where the content column is tightest (~450px/55ch). *Fix:* tighten the rail toward ~150–170px and/or raise the two-column breakpoint so the transition doesn't land at its most cramped. → `/impeccable layout`

## Persona Red Flags

**Jordan (first honest read)** — worst-served by the two P1s: an unbuffered blunt headline and a row of gap dots before a word of praise; "Rep" is unfamiliar jargon with no one-time gloss.

**Sam (keyboard + screen reader)** — *strong overall*: real `h1→h2→h3` with no skips, semantic `<ol>`/`<ul>`, rail DOM order = visual order (stacks label-above-content on mobile), `:focus-visible` ring. *Flags:* the color-only tone signal (P2); three `section`s (What worked / missed / expert) have no `aria-label` so aren't exposed as named landmarks (heading still reachable); a few other `aria-label`s duplicate their `h2` (verbose, harmless).

**Casey (one-handed mobile)** — *mostly fine*: rail stacks to one column, CTA reachable at the bottom, review tables scroll. *Flags:* the top "The Field" back link is a 0.82rem target with no min tap height; the primary CTA's ~44px is borderline.

## Minor Observations

- Review-mode fetch reuses the generic breathe loader — no distinct "opening this rep…" status.
- **[P3]** Headline sizing cliffs on raw char count (hard 42/70 thresholds) — a 71-char verdict abruptly drops to 2rem; smoother/measure-based scaling would avoid the tier jump.
- Non-review CTA uses `next!` / `getMission(...)!` non-null assertions — a bad `nextMissionId` crashes rather than degrades (robustness only).
- The "Nothing moved" empty-state copy is excellent — keep it verbatim.

## Questions to Consider

1. If the headline is the emotional peak, why does it start a quarter of the way across the page on the same left edge as body copy — is the verdict being hedged instead of landing?
2. A first-timer's first honest read opens with a blunt judge line and a row of gap dots before one word of affirmation — is that coaching, or grading with better manners?
3. The rail is your editorial signature, but it carries three words across 200px of air — is the side-heading serving the reader, or borrowed magazine styling a single column would out-read on a phone?
