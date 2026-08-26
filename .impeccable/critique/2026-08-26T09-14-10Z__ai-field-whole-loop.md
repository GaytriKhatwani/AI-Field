---
target: AI Field whole loop
total_score: 35
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T09-14-10Z
slug: ai-field-whole-loop
---
# /impeccable critique — AI Field (whole loop)

Method: dual-agent (A: design review · B: deterministic detector), isolated parallel sub-agents. Browser overlay skipped (detector URL mode needs puppeteer). Dev server up on localhost:3000.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Strong feedback; no persistent attempt-progress sense |
| 2 | Match System / Real World | 4 | Ubiquitous language airtight |
| 3 | User Control and Freedom | 3 | Refresh mid-Workbench destroys all work, no guard |
| 4 | Consistency and Standards | 4 | Token system applied uniformly |
| 5 | Error Prevention | 3 | Good submit guards; no navigation/loss guard |
| 6 | Recognition Rather Than Recall | 4 | Objective persists, resources always on-screen |
| 7 | Flexibility and Efficiency | 3 | Capture is mouse-only |
| 8 | Aesthetic and Minimalist Design | 4 | Editorial restraint |
| 9 | Error Recovery | 4 | Plain-language errors, real retry path |
| 10 | Help and Documentation | 3 | Core capture mechanic taught in one missable sentence |
| Total | | 35/40 | Good |

## Design Specificity Verdict

Authored for this product, not category-interchangeable. Numbers never leak (enforced at data layer via scoreToBand/bandToState/bandLabel). Field leads with one mission as display headline, not a course grid. Debrief is an editorial document, verdict-first, "What worked" before "What you missed." Risk: 4/5 surfaces open with identical kicker→giant-headline template; CapabilityRegister 5-cell grid is the one component that could regress into a scorecard.

Deterministic scan: 0 findings, exit 0, legitimately clean (detector verified capable of firing). No raw hex, all inline colors reference CSS vars. The two assessments agree: nothing mechanical is wrong; every real issue is behavioral/interaction.

## What's Working

1. Numbers never leak, enforced at the data layer — structurally guaranteed.
2. The Field's single-next-rep hero collapses a multi-option decision into one confident action.
3. Good/gap signal never rides on color alone — timeline dots paired with "strength"/"to sharpen" words; markers encode band by shape.

## Priority Issues

- [P1] Select-to-capture is mouse-only — signature mechanic inaccessible to keyboard/SR users. Fix: focusable "Add to deliverable" affordance per AI message. → harden
- [P1] Refresh/navigation mid-Workbench destroys all work — no draft persistence, no beforeunload guard, contradicts "Your work is safe" copy. Fix: localStorage draft keyed by attempt + exit guard. → harden
- [P2] Streaming transcript re-announces on every token — role=log aria-live=polite node replaced each chunk. Fix: aria-busy during stream, announce once on completion. → harden
- [P2] Disabled Submit explains only via title — invisible on touch, unreliable for SR. Fix: inline hint on empty-click. → clarify
- [P3] Deliverable cells clip multi-line captured text — textarea rows=1. Fix: auto-grow to content height. → layout

## Persona Red Flags

Jordan (first-timer): capture mechanic inferred from one easily-missed sentence; on mobile default tab is Deliverable so "select the AI's reply" points at an empty tab; constraints left behind on Briefing.
Sam (a11y/keyboard/SR): locked out of select-to-capture; streaming SR noise; no skip-link; client navigations don't move focus to new page heading; capture toolbar role=menu without arrow-key roving.
Riley (edge cases): refresh = total loss is the sharpest edge; empty states otherwise the most thoroughly handled area; onboarding has no Back.

## Minor Observations

- Onboarding options use aria-pressed for single-select; radiogroup/radio matches better.
- ink-3 on ground ~4.87:1 — passes AA but little headroom; used for nearly all small meta/section-label text.
- Capture toolbar role=menu/menuitem over-promises; plain buttons in a labeled group would be honest.
- Field and Debrief rebuild recommendation/gap independently — one-fact-two-sources risk.
