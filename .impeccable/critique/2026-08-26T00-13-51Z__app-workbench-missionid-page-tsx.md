---
target: the workbench
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-26T00-13-51Z
slug: app-workbench-missionid-page-tsx
---
# Critique — The Workbench (`app/workbench/[missionId]/page.tsx`)

Method: A ran as an isolated sub-agent (design review). ⚠️ DEGRADED for B: the detector sub-agent hit the session limit and crashed before producing output; the deterministic scan was re-run in the parent context. Browser/overlay inspection skipped — no dev server running and the app is not a static build. Mode: **Operate**.

## Design Health Score — 30/40 (Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Thinking dots, streaming reply, and "Submitting…" are visual-only; no `aria-live`/`role=status` reached this surface. |
| 2 | Match System / Real World | 4 | "Give to the AI", "Direct the AI", "You're building" — domain-true, plain language. |
| 3 | User Control and Freedom | 2 | A given resource can never be un-given; no undo on capture; no cancel/confirm on Submit; Escape doesn't dismiss the capture toolbar. |
| 4 | Consistency and Standards | 3 | Strong internal + cross-page consistency; dinged only by error text mimicking AI replies. |
| 5 | Error Prevention | 3 | Submit disabled while empty (good); nothing prevents submitting a deliverable that violates the mission's own constraints. |
| 6 | Recognition Rather Than Recall | 3 | Select-to-capture is taught only in the deliverable empty state and disappears after first capture; AI text has no "selectable" affordance. |
| 7 | Flexibility and Efficiency | 3 | Cmd/Ctrl+Enter, select-to-capture, direct typing — good; no keyboard path to the capture toolbar. |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely restrained; honors "a map, not a dashboard." |
| 9 | Error Recovery | 2 | Submit failure is silent (button just re-enables); errors aren't announced. |
| 10 | Help and Documentation | 3 | Inline contextual help well-judged, nothing excessive. |
| **Total** | | **30/40** | **Good — solid foundation, clear priority fixes** |

## Design Specificity Verdict — PASS (high)

**Design review:** Unmistakably authored for AI Field, not a reskinned template. The product thesis is encoded in the mechanics: the `Give to the AI` → `Given to the AI` affordance plus "The AI only knows what you give it. Deciding what it needs is part of the rep."; the literal-tool empty state ("It executes what you ask — it won't coach you, fill in what you left out, or fix a vague request"); and select-to-capture wired to mission-specific deliverable fields with product-aware logic (`tableTargetColumn` avoids the Owner cell, `stripListMarker` cleans AI prefixes). Strip these and nothing generic remains. Restraint matches brand: one petrol accent, no numeric score, no progress bar, no turn dial — it actively refuses all four brand anti-references.

**Deterministic scan:** detector returned **0 findings** on the workbench and on the supporting files (CapabilityRegister, briefing, globals.css). No slop patterns, no false positives. Crucially, a clean detector does not mean the surface is finished: every real issue below lives in interaction and dynamic state — precisely what a static HTML/CSS rule engine cannot see. The two assessments agree on the visual layer and are complementary, not redundant.

**Visual overlays:** none — no dev server, so no user-visible overlay was injected.

## Overall Impression

The strongest thing on this surface is that it teaches the product's hardest idea — the AI is a literal tool you must brief — through interaction, not a tutorial. The visual craft and restraint are genuinely high. The single biggest opportunity is that the surface's *dynamic* life (the AI responding, capture landing, the moment of handing in) is under-communicated: silent to screen readers, invisible on mobile, and unreassured at the point of no return. The polish that reached the static markup has not yet reached the moments that actually carry the task.

## What's Working

1. **The resource-giving mechanic + literal-tool empty state make the measured skill tangible.** Design doing the product's job: "Deciding what it needs is part of the rep" turns the Context competency into an on-screen affordance.
2. **Disciplined restraint that earns the brand promise.** One accent, no score, no bar, no counter dial — the anti-references are refused in the CSS, not just the pitch.
3. **Select-to-capture is engineered for the real content.** `tableTargetColumn`, `stripListMarker`, and scoping the toolbar to `data-role="ai"` show someone imagined the actual transcript, not an abstract chat.

## Priority Issues

**[P0] Select-to-capture — the signature interaction — is effectively mouse-only.** The toolbar appears at viewport coords but focus never moves to it, there's no Escape to dismiss, and capture is never announced. A keyboard/SR user can select text but has no discoverable, focus-managed path to the "Add to" buttons and no confirmation it worked. *Fix:* move focus into the toolbar on open (roving `menuitem`), Escape to dismiss and restore selection focus, and an `aria-live` announcement ("Added to Decisions") on capture.

**[P0] No `aria-live`/`role=status` on the transcript, thinking indicator, or streaming reply.** The recent `role=status` work reached the loading/evaluating screens but not here — the thinking dots, the token-by-token stream, and "Submitting…" are all silent to a screen reader. *Fix:* wrap the transcript in an `aria-live="polite"` region (or `role=status` on the thinking indicator + a live region for the completed reply).

**[P1] Submit is a silent, no-confirmation point of no return.** Clicking Submit routes straight to `/evaluating`; a failed request silently re-enables the button with no message — a "no silent failure" violation at the highest-stakes moment of a 5–15 min session. *Fix:* surface submit errors inline; add a lightweight "hand in — you can't edit after this" confirm/review affordance before navigating.

**[P1] Mobile capture feedback is invisible.** You select AI text on the Instrument tab, but the capture buttons write to the Deliverable tab, which is hidden on mobile — so the `animate-wash` flash and `scrollIntoView` fire off-screen, and the native selection menu collides with the custom toolbar. *Fix:* after capture on mobile, auto-switch to the Deliverable tab (or show a toast "Added to Decisions →").

**[P2] A given resource can never be un-given.** `giveResource` is append-only and the badge is static. Since *deciding what to give* is the scored Context skill, a one-way door quietly punishes exploration and gives no undo for a mis-give. *Fix:* make the badge toggle back to "Give to the AI" (confirm if it's already referenced in the transcript).

## Persona Red Flags

**Sam (keyboard + screen reader) — worst-served.** No live region on thinking/streaming/submitting; select-to-capture has no focus management, Escape, or announcement. *Credit:* inputs carry real `aria-label`s, the mode switch uses `aria-pressed`+`aria-controls`, the remove-row header has an `sr-only` label, and `:focus-visible` is a clear 2px accent outline — the static markup is conscientious; the dynamic states fail.

**Casey (distracted, one-handed mobile).** Capture confirmation plays on the hidden tab; the mission objective is hidden on mobile (`sm:inline`) so the goal reminder vanishes while working; "+ add"/"+ add row" (~18px) and the "Give to the AI" ghost button (~23px) are under the 24px touch minimum. *Credit:* `100dvh` is present so the composer isn't buried; the "×" buttons are 24px; mode tabs are tall.

**Jordan (confused first-timer).** The only teaching of select-to-capture disappears after the first capture, so someone who types their first item manually never learns the mechanic exists; the disabled Submit explains itself only via a hover `title`; the one-way resource give can't be undone and nothing says it's permanent.

## Minor Observations

- **[P3] AI error messages are indistinguishable from real AI replies** — `errorText` returns bracketed strings rendered with the same `text-ink` styling as genuine output. *Fix:* distinct styling + `role="alert"`.
- No Escape dismisses the capture toolbar (only resize/scroll).
- The header objective truncates even on desktop, with no reveal for long objectives.
- The turn-count hint "You've used 3" is the one place the surface brushes the forbidden gamified counter, even softly framed.
- Reduced-motion is handled globally — credit.

## Questions to Consider

1. If *deciding what to give the AI* is a scored skill, why is "Given to the AI" a one-way door — are you measuring judgment, or penalizing exploration?
2. The only place teaching select-to-capture disappears the instant the deliverable is non-empty. How does a user discover they can capture the AI's *second, better* answer?
3. "Most operators finish in 4–8 exchanges. You've used 3." — what separates that from the gamified turn-counter the brand forbids, beyond gentler wording?
