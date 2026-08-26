# Analytics — Mixpanel product-analytics layer (MVP)

> Locked via a grilling pass (2026-08-26). This is the source-of-truth record;
> the **typed catalog in `lib/analytics/events.ts` is the enforcing authority**.
> Scope is deliberately small: the core MVP funnel + critical learning behaviours.

## Principles

- **Supabase stays the source of truth** for users, attempts, transcripts,
  evaluations, competencies. Mixpanel is **behavioural analytics + funnel only** —
  never a second copy of product data.
- **Client-side only** (Mixpanel browser SDK). The client already learns the
  authoritative result of every server action, so no server-side tracking.
- **Identified-only.** `mixpanel.identify(userId)` once the Supabase anonymous
  user resolves; before that, `track()` is a no-op (dev-warns). No pre-identify
  merging, no event queue. **No `userId` → no product event.** `mixpanel.reset()`
  in `resetAll()` so a new anonymous user gets a fresh identity.
- **Every event answers a product question** (below). No page-view spam, no
  autocapture, no interaction telemetry, no session replay/heatmaps.
- **Strict egress allowlist.** Only ids / enums / counts / bands / booleans /
  durations leave the app. **Never** transcript, prompts, AI output, deliverable
  content, judge prose, evidence observations, or free-text onboarding answers.
- **Safe no-op** when the Mixpanel token is unset — the app must behave identically.

## Identity

- `distinct_id` = the Supabase anonymous `user.id` (via `identify`), not repeated
  as a property.
- Global super-properties: `app_version`, `platform: "web"` only. Everything else
  is explicit per event. `mission_version` is per-event (it varies by mission).

## Event catalog & the question each answers

| Event | Question it answers | Properties (beyond app_version/platform) |
|---|---|---|
| Onboarding Started | Are people getting through initial setup? | — |
| Onboarding Completed | ″ | `completed: boolean` (false = skipped), `role_enum?`, `ai_usage_enum?` — fixed chips only; omitted for "Other"/free-text |
| Mission Viewed | Do users understand what to do? | `mission_id`, `mission_version` |
| Mission Started | Do they enter the mission? (enter-workbench intent) | `mission_id`, `mission_version` — **no attempt_id** (created lazily on first message) |
| Resource Attached | Do users recognise context must be supplied? | `mission_id`, `mission_version`, `resource_id`, `attempt_id?` (**omit the key entirely** if no attempt yet — never send null) |
| Workbench Message Sent | How much interaction does a mission take? | `mission_id`, `mission_version`, `attempt_id`, `turn_index` |
| Deliverable Submitted | Do users reach the core commitment point? | `mission_id`, `mission_version`, `attempt_id` |
| Evaluation Completed | Does the loop complete? what skills/gaps? | `mission_id`, `mission_version`, `attempt_id`, `practice_competency`, `bands` (per-competency band map, enums only) |
| Next Mission Clicked | Does the debrief create intent to continue? | `from_mission_id`, `to_mission_id`, `practice_competency` |

**Firing points (tie to successful outcomes, never optimistic intent):**
- Onboarding Started → onboarding screen shown, after `hydrated && userId`, once.
- Onboarding Completed → finish/skip resolves.
- Mission Viewed → briefing renders. Mission Started → "Enter Workbench" click.
- Resource Attached → user attaches a resource.
- Workbench Message Sent → **after** `/api/workbench` responds ok.
- Deliverable Submitted → **after** `/api/submit` succeeds.
- Evaluation Completed → **first** time the poll observes the canonical `evaluated`.
- Next Mission Clicked → debrief/field CTA click.

Useful drop-off this shape measures: **entered workbench but never sent a message**
(Mission Started with no following Workbench Message Sent). Do **not** restructure
product state (e.g. lazy attempt creation) to make analytics cleaner.

## Evaluation Completed — double-fire guard

The evaluating page re-POSTs `/api/evaluate` on a poll and can observe `evaluated`
more than once (re-render, refresh, hot-reload). Two independent guards:
- `localStorage` flag `aifield.mp.evalTracked.<attemptId>` — set on first fire.
- Stable Mixpanel `$insert_id = "eval:<attemptId>"` — server-side dedup defence
  (kept inside the analytics wrapper).
Cleared in `resetAll()`. No Supabase write for dedup.

## SDK configuration

`autocapture: false`, `track_pageview: false`, `record_sessions_percent: 0`,
`ip: false` (no geolocation). Token via `NEXT_PUBLIC_MIXPANEL_TOKEN`; optional
`NEXT_PUBLIC_MIXPANEL_API_HOST` for data residency (do **not** hardcode a region —
set it once the project is created). Missing token → the layer is a safe no-op.

## Dev correctness harness (mechanical guardrails)

The typed layer + a dev-only logger at the tracking boundary must, in development:
- reject unknown event names and unknown property keys (closed catalog),
- block (and warn) any `track()` before identity,
- flag any prohibited content field,
- dedupe the protected `Evaluation Completed`,
- log `{ event, allowed props, identified user, status: sent|blocked|deduped|no-token }`
  — never logging prohibited content.

## Pre-testing verification pass (run one full mission, confirm in Mixpanel)

1. Onboarding Started fires once.
2. Onboarding Completed carries only allowed enums/booleans.
3. Mission Viewed + Mission Started carry mission identity, **no fabricated attempt_id**.
4. Resource Attached has `resource_id`; includes `attempt_id` only when one exists.
5. First successful workbench interaction introduces the stable `attempt_id`.
6. Workbench → submit → evaluation retain the **same** `attempt_id`.
7. Evaluation Completed fires once — including after refresh/re-render.
8. `bands` contain enums only.
9. No transcript / prompt / AI output / deliverable / judge prose / free-text onboarding reaches Mixpanel.
10. `resetAll()` produces a new Mixpanel identity.
11. Missing Mixpanel config does not affect product behaviour.

Prefer a **separate dev Mixpanel project/token** so implementation traffic doesn't
pollute the real tester cohort.

## Launch checklist (revisit before broader/public use)

- Privacy/consent requirements must be revisited before public/EU exposure (not
  built as legal/privacy infrastructure for this controlled MVP).
- Confirm data-residency `api_host` matches the real project.

## Out of scope (do not add in this slice)

Server-side Mixpanel; a custom analytics/admin dashboard; more events; autocapture/
session replay; any Supabase schema change for analytics; changing when attempts
are created. A thin Supabase-backed reviewer view (attempt → transcript +
deliverable + evaluation) stays on the roadmap, built only when dashboard
inspection becomes painful or a non-developer needs to review sessions.
