# AI Field — MVP Spec (Core Practice Loop, "Meeting Chaos" vertical slice)

> Companion to `plan.md`. The plan carries the architecture and rationale; this spec states the buildable requirements, contracts, and acceptance criteria. Scope of this spec is **M0 + M1 only** — the first mission working end-to-end, stopped at the discrimination gate.

---

## Problem Statement

I already use AI for simple things — writing an email, summarising a note. But when I try to use it for real work (turning a mess into a decision, producing a brief, checking a document), I don't really know how to *direct* it, and I have no way to practise or to find out whether I'm any good at it. Courses and "prompt tips" don't help — they're content to consume, not reps to do. I want realistic practice and honest, specific feedback on *how I worked with the AI*, not another chatbot and not a meaningless score.

## Solution

AI Field is a practice environment. I take on realistic **missions**: I'm given a scenario, a goal, and constraints, and I direct a real AI inside a focused **workbench** to produce a **deliverable** I choose to submit. An AI **examiner** then reads my whole session and gives me a **debrief** — what worked, what I missed, how an expert would have approached it, one skill I showed, one to practise next — and moves my five-skill **Operator Profile**. It always points me at one next mission aimed at my weakest skill. The MVP proves this loop end-to-end on one mission and proves the examiner can reliably tell strong AI-working from weak.

The five durable skills (the "Operator Profile"): **Context, Direction, Iteration, Verification, Synthesis**.

## User Stories

**Onboarding & identity**
1. As a new user, I want to start using the product with no signup form, so that I can experience value before committing to an account.
2. As a new user, I want a real account created for me invisibly, so that my progress persists when I return in the same browser.
3. As a new user, I want to answer at most three quick questions (my role, how often I use AI, what I want to improve), so that the experience feels tailored without slowing me down.
4. As a hurried user, I want to skip onboarding, so that I can get to a mission immediately.
5. As a returning user, I want to land straight on The Field without repeating onboarding, so that I can pick up where I left off.

**The Field (home)**
6. As a user, I want a clearly highlighted recommended next mission, so that I always know the most useful thing to do next.
7. As a user, I want to see my five skill bars at a glance, so that I understand where I currently stand.
8. As a user, I want the home screen to feel like a map of missions rather than a course dashboard, so that it feels like practice, not an LMS.
9. As a first-time user, I want Meeting Chaos recommended first, so that I start with a concrete, universal task.
10. As a returning user, I want my recommended mission to reflect my weakest demonstrated skill, so that practice targets my actual gap.

**Briefing**
11. As a user, I want a short briefing with scenario, objective, constraints, and what I'll submit, so that the task feels realistic and I know what "done" means.
12. As a user, I want a clear "enter the workbench" action, so that starting the mission feels like a deliberate step.
13. As a user, I want a visible reminder not to paste confidential data, so that I use the free-tier AI safely.

**Workbench — AI interaction**
14. As a user, I want to chat with a capable real AI to do the task, so that I'm practising with the real thing.
15. As a user, I want the AI to do what I tell it well but not coach me or fix my vague instructions, so that the feedback reflects *my* skill, not the AI's helpfulness.
16. As a user, I want the AI's responses to stream in, so that it feels responsive.
17. As a user, I want the mission objective visible the whole time, so that I stay oriented.
18. As a user, I want a gentle "most people finish in 4–8 exchanges" cue, so that I aim for efficient direction without being scored on turn count.
19. As a user, I want to be stopped from running the AI indefinitely (a safety cap), so that the mission stays bounded.

**Workbench — materials/resources**
20. As a user, I want to see the mission's source materials, so that I know what I'm working from.
21. As a user, I want to explicitly choose which materials to give the AI, so that *deciding what context it needs* is part of my practice.
22. As a user, I want my decision to attach (or not attach) materials recorded, so that the examiner can judge my Context skill fairly.
23. As a user with a large source document, I want to attach it as a resource rather than copy-paste it, so that I'm judged on recognising what's needed, not on manual effort.

**Workbench — deliverable & submission**
24. As a user, I want a separate panel to build the exact thing I'll submit, so that I can decide what's good enough rather than dumping the chat.
25. As a user, I want to pull an AI response into my deliverable and edit it, so that I can curate and combine.
26. As a user, I want the deliverable's shape to match the mission (e.g. Decisions / Action-items / Open-questions for Meeting Chaos), so that it feels like real output.
27. As a user, I want to submit only when I decide I'm ready, so that judging "good enough" is my call.
28. As a user, I want my submitted deliverable saved, so that it can be evaluated and I can review it later.

**Evaluation & debrief**
29. As a user, I want a purposeful "grading your mission" state, so that I understand the examiner is doing real work.
30. As a user, I want feedback that references specific moments in my session, so that it feels earned and concrete.
31. As a user, I want plain coaching (what worked / what I missed / how an expert would do it / a skill I showed / a skill to practise next), so that I can actually improve.
32. As a user, I do NOT want a big numeric score as the headline, so that feedback stays actionable rather than arbitrary.
33. As a user, I want to see which skill bars moved after this mission, so that progress feels tangible.
34. As a user, I want exactly one recommended next mission on the debrief, so that the next action is obvious.
35. As a beginner, I want the *tone* of feedback pitched to my stated experience, but the *standard* to be the same as everyone's, so that my profile means something.

**Progression & retention**
36. As a user, I want each skill shown as a band (e.g. "developing") not a fake-precise number, so that progress reads honestly.
37. As a user, I want a skill I never exercised in a mission to stay unmoved, so that merely finishing missions doesn't inflate every bar.
38. As a user, I want to feel my profile is visibly incomplete with a named next rep, so that I have a reason to come back that isn't a streak.

**Persistence, privacy, safety, reliability**
39. As a user, I want my attempts, transcripts, deliverables, evaluations, and skills saved to a real backend, so that my history is durable.
40. As a user, I want to be unable to see anyone else's data (and them mine), so that my practice is private.
41. As a user, I want the app to never leak its AI or database secret keys to my browser, so that the service can't be abused through me.
42. As a user, I want evaluation to run exactly once per attempt even if I double-click or the network hiccups, so that my profile isn't double-counted.
43. As a user, I want a crashed/timed-out evaluation to recover so I can retry, so that I'm never permanently stuck on "grading".
44. As the operator of the service, I want per-user rate limits and (before public exposure) bot protection on anonymous signup, so that the free AI tier can't be abused.

## Implementation Decisions

**App shell & delivery**
- Next.js (App Router) + React + Tailwind + selective shadcn/ui. Hosted on Vercel, continuous deploy from GitHub.
- All AI calls happen **server-side** via two API routes; secrets never reach the browser.
- AI provider is isolated behind one thin module (`lib/ai/provider.ts`); Gemini is the only provider. Model id via `GEMINI_MODEL` (default `gemini-3.7-flash`). Configure behaviour via **structured output + thinking level**, not temperature/top-p/top-k (removed on newer Flash models).

**Identity & data**
- Supabase (Postgres + Auth + RLS), using **publishable/secret** key naming (not legacy anon/service_role).
- **Anonymous auth created explicitly** by an app bootstrap when no user exists — not implicitly in middleware. Middleware only refreshes/propagates the session. Dynamic rendering where anonymous auth requires it. Account-linking is deferred; schema/RLS designed so it can be added later without migration.
- Tables: `profiles`, `challenge_attempts`, `workbench_messages`, `attempt_events`, `evaluations`, `user_competencies`, `rate_limits`. `user_id` denormalised onto child rows so RLS is `auth.uid() = user_id` everywhere.
- `challenge_attempts` carries `status (in_progress|submitted|evaluating|evaluated)`, `mission_version`, `submitted_deliverable`, `submitted_at`, and `evaluation_started_at` (a recoverable timestamp lease).
- `evaluations` carries `raw_evaluation`, `competency_results`, and the versions that produced it (`model_id`, `judge_prompt_version`, `judge_schema_version`); `attempt_id` is **UNIQUE** (one canonical evaluation per attempt).

**Workbench**
- `/api/workbench`: streamed chat. AI system behaviour = "capable but not pedagogical": executes with only the context the user provides/attaches; does not coach, volunteer missing requirements, auto-repair vague instructions, or reveal the rubric; a genuine clarifying question only when strictly necessary.
- Materials are **attach-by-choice**, never auto-injected; each attach is recorded in `attempt_events`.
- Soft guidance copy ("~4–8 exchanges"); hard safety ceiling (~12 messages/attempt) enforced server-side; turn count never influences any score.
- Deliverable is a **mission-specific structured form**, curated by the user, saved on the attempt at submit.

**Evaluation → profile → recommendation**
- `/api/evaluate`: passes the judge a **unified, ID'd timeline** (`msg_04`, `evt_02`, …) + deliverable + the mission's allowed competencies/weights/`judgeGuidance`. Judge returns three blocks — `attempt_evaluation` (Approach/Iteration/Judgment/Outcome), `competency_evidence` (per-skill band from `not_shown|emerging|developing|proficient|strong`, with `why` + evidence referenced **by turn_id, never quoted**), and user-facing `coaching`.
- Judge output is enforced against a schema (structured output); a competency with mission-weight 0 is not scored.
- **Profile update is deterministic app code** (`lib/progression/update.ts`), not the LLM: map bands→internal 0–100, blend toward evidence weighted by mission emphasis. Exact curve, initialization, and whether poor attempts can lower a bar are **tunable and decided at the M1 gate**. Raw evaluation is stored separately so progression is recomputable.
- **Recommendation is deterministic** (`lib/progression/recommend.ts`): the judge names `practice_competency`; the app picks the next mission from the catalog by that competency + mission weights + completion history. The LLM never picks a mission id.

**Evaluation idempotency & recovery** (timestamp lease, not a queue)
- `evaluated` → return existing evaluation. `evaluating` + evaluation exists → return it. `evaluating` + recent lease → safe "in progress" response. `evaluating` + stale lease → reclaim/retry. `submitted` → atomically claim (`→ evaluating`, set `evaluation_started_at`), then run.
- On a Gemini failure before persistence, reset to `submitted` where safe. Final insert + competency updates + transition to `evaluated` run in one transaction/RPC; `UNIQUE(attempt_id)` is the duplicate-write backstop.

**Missions as content**
- Missions are hand-authored TS in the repo (`lib/missions/*`), no CMS. Each declares scenario/objective/constraints, resources, a neutral `workbenchSystemContext` (not the rubric), a `DeliverableSpec`, `competencyWeights`, and `judgeGuidance`.

**Guardrails**
- Per-attempt ceiling + short-window per-user caps via an atomic Postgres RPC on `rate_limits` (429 on exceed). Before public exposure, enable Supabase-supported invisible CAPTCHA / Cloudflare Turnstile on anonymous signup.

## Testing Decisions

**What makes a good test here:** assert **external, observable behaviour** — HTTP responses, rows written, competency deltas, the recommended mission id — never internal function calls or prompt wording.

**Primary seam — the `/api/evaluate` route with the Gemini judge mocked.** This single high seam is where the thesis lives and is tested deterministically by feeding **canned judge JSON** for a given attempt fixture, then asserting:
- the correct `evaluations` row is written (with version stamps) and competency bars move as the deterministic rule dictates;
- **exactly-once** behaviour: a second/concurrent call returns the same canonical evaluation, makes no second (mock) judge call, and does not double-move the profile;
- **recovery**: a stale `evaluating` lease can be reclaimed; a simulated judge failure resets the attempt to `submitted`.

**The discrimination gate — a separate real-LLM eval (the M1 go/no-go).** Not a unit test: run the real judge against a **strong** scripted transcript (attaches notes, sets audience/constraints, iterates, verifies) and a **weak** one (single vague prompt, first answer accepted, nothing attached) for Meeting Chaos, and assert the resulting bands, coaching, and profile movement **meaningfully differ** in the expected direction. Tune judge prompt + weights until this holds reliably. **A technically-passing pipeline that cannot discriminate does not pass the gate.**

**Secondary checks:** the `/api/workbench` route enforces the ~12-message ceiling and rate limits (429); RLS prevents a second anonymous user from reading the first's rows; neither the Gemini key nor the Supabase secret key appears in any browser payload.

**Prior art:** none — greenfield. This spec establishes the pattern: route-level integration tests with the AI provider mocked at `lib/ai/provider.ts`, plus a small real-LLM eval harness for the gate.

## Out of Scope

- Missions 2–4 (The Bad Prompt, The Brief, Don't Trust the AI) — not built until the gate passes.
- Account linking / OAuth / magic links / account management / recovery UI.
- Content CMS, admin panel, authoring tools.
- Social features, leaderboards, notifications, teams/orgs.
- Real-time sync, offline mode, analytics infrastructure, multi-provider AI.
- A visible overall "rank/level" as a meaningful mechanic (the five bars are the point).

## Further Notes

- **Free-tier privacy:** all mission resources are synthetic/hand-authored; the workbench carries a standing "don't paste confidential data" warning. Revisit before inviting real professionals with real artifacts.
- **Versioning matters** precisely because the judge is tuned at the gate: without `mission_version` + judge/schema versions, two evaluations aren't comparable and "recomputable progression" is false.
- **Sequencing:** M0 scaffold (incl. verifying no unrelated ancestor `CLAUDE.md` loads) → M1 vertical slice on Meeting Chaos, deployed → **stop at the discrimination gate and report** before M2 (missions 2–4) or M3 (polish).
