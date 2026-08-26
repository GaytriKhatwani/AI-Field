# Spec — Activation layer: Landing + FTUE + post-value account conversion

> Synthesized from the design/implementation session (2026-08-26). The working
> mission engine, workbench, evaluation, progression and Field are unchanged.
> Companion planning doc: `~/.claude/plans/we-are-entering-the-validated-whisper.md`.
> Not yet published to an issue tracker (none configured this session).

## Problem Statement

A first-time visitor is dropped almost directly into the first mission (Meeting Chaos) with no explanation of what AI Field is, why it matters, what a mission involves, or what they receive afterward. That makes the product unsuitable for user testing — people are asked to invest (answer questions, work a 10-minute mission) before any promise is made. Separately, there is no way to preserve earned work: all progress is tied to an anonymous browser session with no path to a durable account, and signing out abandons the anonymous user.

## Solution

An activation layer built around the working product:

1. A public **landing page** that communicates, in ~20 seconds, what AI Field is, what you'll do, and what you get — leading with the **evidence-backed read** as the payoff (not a profile dashboard), in the existing spare visual language.
2. A reframed entry into the **existing 3-question FTUE**, which now flows straight into the first mission.
3. After the first debrief, an inline **"keep what you earned"** moment that upgrades the anonymous user to a permanent **Google** account *in place* — same `auth.users.id`, so the completed assignment, feedback, and capability record stay attached.

First-time flow: **Landing → FTUE → Meeting Chaos → Debrief → Save → Field.** The entire first mission is playable with no account; account creation happens only after value is delivered. Returning authenticated (or already-onboarded anonymous) users bypass the landing and FTUE and enter the Field.

## User Stories

1. As a first-time non-technical professional, I want a landing page that explains what AI Field is in a few seconds, so that I understand the product before committing.
2. As a first-time visitor, I want to see what I'll actually do (real work with a real AI, not lessons), so that I can decide if it's worth my time.
3. As a first-time visitor, I want to see what I'll get back (an honest, specific read on how I worked), so that the payoff is clear before I start.
4. As a skeptical visitor who assumes this is another prompt course, I want the page to state plainly that it isn't, so that I don't dismiss it.
5. As a busy visitor, I want to grasp the offer and find the primary action within one screen, so that I can start without scrolling or reading marketing.
6. As a first-time visitor, I want to start my first mission without signing up, so that there's no friction before I've seen value.
7. As a first-time visitor, I want reassurance about the cost ("no signup · ~10 minutes"), so that I know what I'm committing to.
8. As a new user, I want the three quick setup questions to feel like tuning (not a cold interview), so that they make sense after the landing explained the product.
9. As a new user, I want to be able to skip the setup questions, so that I'm never blocked from starting.
10. As a new user, I want to go straight into the first mission after setup, so that the flow feels like entering an assignment, not browsing.
11. As a user who just finished my first mission, I want to absorb my read before any account prompt, so that the value lands first.
12. As a user who just earned a read, I want to keep it — the assignment, feedback, record, and next rep — so that my effort isn't lost.
13. As a user saving my work, I want a one-click Google option (no password), so that it's fast and I don't manage credentials.
14. As a user, I want "Not now" to keep my anonymous progress on this device, so that declining doesn't cost me anything.
15. As a user who declined saving, I want a quiet, dismissible reminder later on the Field, so that I can still save without being nagged.
16. As a returning signed-in user, I want to skip the landing and FTUE and land in the Field, so that I resume immediately.
17. As a returning anonymous user on the same device who already onboarded, I want to skip the landing, so that I'm not re-introduced to the product.
18. As a user linking a Google account, I want my anonymous user upgraded in place, so that my completed mission and profile stay attached with the same identity.
19. As a user whose Google email is already used by another account, I want a clear, non-destructive failure, so that I keep practicing and can try again.
20. As a returning user on a new browser/device, I want a way to sign back in, so that I can reach my work anywhere.
21. As the product team, I want to measure landing-page intent ("Get Started Clicked") ahead of the existing funnel, so that we can see top-of-funnel conversion.
22. As the product team, I want to measure the save conversion (viewed/clicked/skipped), so that we can evaluate the account-conversion step.
23. As the product team, I want account linking behind a feature flag, so that a Google-setup blocker can't destabilize the anonymous MVP.
24. As a bounced visitor, I want viewing the landing to create no account, so that the funnel and user table aren't polluted.

## Implementation Decisions

- **Route-group split.** The public landing renders outside the store provider; all app surfaces live under an `(app)` route group whose layout owns `FieldProvider` (which mints/hydrates the anonymous user). URLs are unchanged. Consequence: the anonymous user is created **lazily on the Start action**, never on landing view.
- **Entry gate.** The root route is a server component that reads the Supabase session from cookies: no session → render the Landing; session present → redirect (`onboarded` → Field, otherwise resume the FTUE). No minting occurs in the gate.
- **Start action.** The landing CTA mints the anonymous user, binds the analytics identity, emits `Get Started Clicked`, then routes into the FTUE. Because the mint precedes the event, the identity-gated analytics contract is preserved.
- **FTUE routing.** The existing 3-question onboarding is reused unchanged in substance; on finish and on skip it now routes into the first mission's briefing (via the catalog's first-mission id), not the Field.
- **Inline Save moment.** Shown only on the first *live* debrief, only for a still-anonymous user, and only when the flag is on; it replaces the "next assignment" CTA. Every later debrief keeps the normal next-rep CTA. The signal for "first rep" is the refreshed completed-attempts count, which is reloaded before the debrief renders.
- **Google in-place upgrade.** `supabase.auth.linkIdentity({ provider: 'google', redirectTo })` adds a Google identity to the existing anonymous user (same id). A server OAuth callback exchanges the code for a session and returns to the Field; on failure it returns with an error flag and the anonymous session is untouched. No passwords, no email magic link.
- **Feature flag.** `NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING` (default off) gates every conversion affordance — the landing "Sign in", the first-debrief Save moment, and the Field save line. With it off, the anonymous first-mission loop is fully intact.
- **Analytics.** Added to the closed, compile-time-enforced catalog: `Get Started Clicked` (funnel top) and `Save Profile Viewed` / `Save Profile Clicked {auth_provider}` / `Save Profile Skipped`. Identity-gated, allowlist-safe, no broader homepage tracking.
- **Field re-surface.** A quiet, dismissible one-line "connect an account" affordance for an anonymous user with reps; dismissal is remembered per device.
- **Copy.** Landing sells user benefit in plain workplace language (no evaluator/product-internal terms); the payoff shown is the evidence-backed read mirroring the real debrief's section labels, with the cumulative capability record as a single quiet line. Save copy frames preserving earned work and is honest that data persists but is only reachable in this browser until connected.

## Testing Decisions

- **Test external behavior, not internals.** Assertions: a fresh visitor mints no user; Start creates exactly one anonymous user; after linking, the same user's first-mission rows still return under RLS; rep-2 debriefs show the next-rep CTA, not Save.
- **Highest existing seam = the DB boundary**, exercised by the repo's `verify-*` scripts against a real anonymous user (prior art: `scripts/verify-rls.mjs`, `scripts/verify-idempotency.mjs`, `scripts/verify-progression.ts`). Reuse these; no new seam needed for progression/data-integrity.
- **Route-group + activation routing** verified by `tsc --noEmit`, route-status checks, and a live browser walk (landing renders with no mint on view; Start mints + routes to the FTUE; returning session bypasses the landing).
- **The critical new behavior to prove is the linkIdentity round-trip**: the anonymous `auth.users.id` and all first-mission data (attempt, transcript, evaluation, competencies) must survive the OAuth trip. This needs the Supabase Google provider + manual linking enabled; until then it is verified by design, not by run.

## Out of Scope

- Mission mechanics, evaluation logic, progression math, and additional missions — explicitly untouched.
- Email magic link and password authentication (Google only for MVP; email link can be added later if Google blocks a tester).
- Account **merge** across two existing accounts (Supabase cannot merge; only in-place upgrade of an anonymous user is supported).
- Admin/reviewer analytics view; broad homepage click tracking.
- CAPTCHA/Turnstile, Vercel deploy configuration, and Google Cloud OAuth client creation (user-owned infra).

## Further Notes

- Google linking is the highest-risk new behavior; shipping it behind the flag means a Google-setup blocker degrades to "hide the conversion CTA," never a broken anonymous MVP.
- User-owned prerequisites before turning the flag on: enable the Google provider and **Manual Linking** in the Supabase dashboard, create a Google OAuth client and register the callback URLs, then set `NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING=true`.
- Verified in this session: tsc clean; progression suite passes; all routes 200; live walk of landing → Start (mint) → FTUE, plus returning-user bypass.
