# AI Field — MVP Implementation Plan

> **How to read this plan.** It has two layers. The **plain-English layer** — this overview, the glossary, and the *"In plain terms"* line that opens each technical section — is written for you as the product owner; no engineering background needed, and you can make every decision from it alone. The **technical layer** underneath is for the build and the `/to-spec` step. If a technical section looks dense, read its *"In plain terms"* line and move on.

---

## The product in plain English

**What AI Field is.** A gym for working with AI. Most people can ask an AI to write an email. Far fewer can *direct* AI through a real piece of work — briefing it properly, checking what it hands back, pushing it to something genuinely useful. AI Field is where professionals **practise that skill** on realistic "missions" and get told, specifically, how they did.

**What a user actually experiences (one session, ~5–15 minutes):**
1. **They just start — no signup form.** They land in the product and begin; their progress is quietly saved for when they return.
2. **Three quick questions** — their job, how much they use AI, what they want to improve. Skippable, ~30 seconds.
3. **"The Field"** — a *map of missions* (not a course list). One mission is clearly recommended as their next step.
4. **A short briefing** — the scenario ("your manager dumped messy meeting notes on you…"), the goal, and what they must hand in.
5. **The workbench** — a split screen: on one side they **chat with a real AI** to do the work; on the other, they **build the thing they'll submit**. They choose what information to hand the AI — and that choice is part of what we measure.
6. **They submit** when they decide their deliverable is good enough. (Deciding "good enough" is itself one of the skills.)
7. **A debrief, not a grade** — plain coaching: what worked, what they missed, how an expert would approach it, one skill they showed, one to practise next — plus the *exact next mission* to build that skill.
8. **Their "Operator Profile" moves** — five skill bars that grow as they demonstrate ability. This is the reason to come back: the profile is visibly incomplete and the next rep is already named for them.

**The one belief this MVP must prove.** That our AI "examiner" can genuinely tell a *strong* AI-user from a *weak* one **on the same mission**. If it can't, the skill bars are just decoration and nothing else matters. That's why we build **one** mission fully first and **refuse to build the other three** until the examiner passes that test — the "**gate**."

**The five skills we measure (the "Operator Profile"):**
- **Context** — do they give the AI the information it needs?
- **Direction** — do they set a clear goal, constraints, and desired output?
- **Iteration** — do they improve the AI's answer instead of accepting the first draft?
- **Verification** — do they catch the AI's mistakes, gaps, and made-up claims?
- **Synthesis** — do they turn AI output into something genuinely useful?

**What we're deliberately NOT building yet** (to stay fast and cheap): no admin panel, no content-authoring tools, no login/signup screens, no social features, leaderboards, notifications, or team functionality. Missions are hand-written in the code. **We build the core loop for real and fake everything that doesn't yet prove the core belief.**

## Plain-English glossary

| Term used below | What it means for you |
|---|---|
| **Next.js / React / Tailwind / shadcn** | The standard, popular tools we use to build the website and its screens quickly. |
| **Supabase** | Our database + login system, rented as a service — it remembers users, their attempts, and their progress. |
| **Postgres** | The specific database inside Supabase. |
| **Gemini (Flash)** | Google's AI model. It plays two roles: the AI the user works *with*, and the "examiner" that grades the attempt. Free tier for now. |
| **LLM / model** | The AI itself (Large Language Model). |
| **LLM-as-judge / "the judge"** | A second AI call whose only job is to *evaluate* the user's work and write the coaching feedback. |
| **Anonymous auth** | Giving each user a real, saved account automatically — without making them sign up. |
| **RLS (Row Level Security)** | A database rule guaranteeing each user can only ever see their *own* data. Privacy by construction. |
| **Vercel** | The hosting service the app runs on; it auto-publishes new versions from our code. |
| **API route (e.g. `/api/workbench`)** | A behind-the-scenes endpoint the app calls to reach the AI, keeping our secret keys on the server, never in the browser. |
| **Deterministic (app code)** | Fixed, predictable logic *we* control — as opposed to the AI's judgement. We keep score-keeping deterministic so it's fair and tunable. |
| **Deliverable** | The actual thing the user hands in (a summary, a brief, a recommendation). |
| **Competency weights / bands** | Each mission emphasises certain skills (*weights*); progress shows as labelled *bands* ("developing", "proficient") instead of fake-precise numbers. |
| **Idempotency / lease / atomic** | Safety plumbing so grading runs *exactly once* per attempt, never double-counts, and never gets permanently stuck if something crashes mid-way. |
| **Rate limiting / Turnstile / CAPTCHA** | Guardrails so nobody can abuse the free AI by hammering it or mass-creating accounts. |
| **M0 / M1 / the gate** | Build phases. M0 = setup. M1 = the first full mission working end-to-end. The *gate* = the go/no-go test before we build more. |

---

## Context

**AI Field** is a *practice environment* for non-technical professionals who already use AI for basic tasks but can't yet direct it toward advanced real-world work. It teaches **by doing**, not by lessons. The unit of value is a **mission**: a realistic scenario where the learner directs a real AI model toward a deliverable, then receives evaluation of **how they worked** — not just what they produced.

The product's thesis (and the thing this MVP must prove): *AI Field can measure and improve a person's ability to direct AI toward an outcome.* Everything is optimized around one loop:

> **Do a mission → discover what you're good at → reveal a capability gap → get one recommended next mission that exercises that gap → come back.**

This plan builds that loop for real (real model, real persistence, real evaluation) and fakes everything that doesn't yet prove the thesis (no CMS, admin, social, leaderboards, notifications, teams). The parent `ClaudeProjects/CLAUDE.md` describes an unrelated "Health Tracker" project and is **ignored**.

All product decisions below were settled through a full grilling pass with the user; this plan records the *recommended* resolutions only.

---

## Stack & Infra

> *In plain terms:* the off-the-shelf tools we're building with, and the rule that our secret keys (the AI key, the database key) live on the server and are **never** handed to the user's browser.

- **Next.js (App Router) + React + Tailwind + selective shadcn/ui primitives.**
- **Supabase** — Postgres + **anonymous auth** + Row Level Security (real persistence, no signup wall).
- **Gemini** (`gemini-3.7-flash`, configurable via `GEMINI_MODEL`) behind a thin provider module. No multi-provider framework.
- **Vercel** — continuous deploy from **GitHub**.
- Server-side AI only. `GEMINI_API_KEY` and the Supabase service-role key are **never** exposed to the browser.

### Environment variables
```
GEMINI_API_KEY=                        # server only — never sent to browser
GEMINI_MODEL=gemini-3.7-flash          # configurable; newer Flash models drop temperature/top_p/top_k
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # current Supabase naming (legacy "anon" deprecating end-2026)
SUPABASE_SECRET_KEY=                   # server only, ONLY if elevated backend access is genuinely needed (legacy "service_role" deprecating)
```
Use Supabase's **current publishable/secret key** terminology, not the legacy `anon`/`service_role` names.

### Proposed file structure
```
app/
  page.tsx                       # entry → onboarding or field
  onboarding/page.tsx
  field/page.tsx                 # The Field (mission map + Operator Profile)
  mission/[id]/briefing/page.tsx
  mission/[id]/workbench/page.tsx
  mission/[id]/debrief/page.tsx
  api/workbench/route.ts         # streamed Gemini chat
  api/evaluate/route.ts          # non-streamed judge (strict JSON)
lib/
  ai/provider.ts                 # ONLY place the Gemini SDK is touched
  ai/workbench.ts                # literal-tool system prompt + streamed chat
  ai/judge.ts                    # judge prompt + schema-validated parse
  supabase/{client,server,middleware}.ts   # browser/server clients + anon bootstrap
  missions/types.ts              # Mission, Resource, DeliverableSpec, CompetencyWeights
  missions/index.ts              # mission catalog registry
  missions/meeting-chaos.ts      # first mission content (M1)
  progression/competencies.ts    # the 5 competencies, band<->value maps
  progression/update.ts          # deterministic profile blend (app code, not LLM)
  progression/recommend.ts       # gap competency -> next mission (deterministic)
  ratelimit.ts                   # per-user server-side limiter
components/                      # WorkbenchPanels, DeliverableForm, CompetencyBands, MissionMap, Debrief...
supabase/migrations/             # SQL: tables + RLS
```

---

## Data Model (Supabase)

> *In plain terms:* the list of things we remember about each user and store in the database — who they are (`profiles`), each mission attempt and the deliverable they submitted (`challenge_attempts`), their chat with the AI (`workbench_messages`), which materials they chose to attach (`attempt_events`), the examiner's verdict (`evaluations`), their five skill bars (`user_competencies`), and abuse counters (`rate_limits`). Every row is tagged with its owner so no user can ever see another's data.

Denormalize `user_id` onto child rows so RLS is a simple `auth.uid() = user_id` on every table.

- **profiles**: `user_id (pk)`, `professional_role`, `ai_experience`, `goals`, `onboarding_completed`, `created_at`
- **challenge_attempts**: `id (pk)`, `user_id`, `challenge_id`, `mission_version`, `status` (`in_progress|submitted|evaluating|evaluated`), `submitted_deliverable jsonb`, `submitted_at`, `evaluation_started_at`, `started_at`, `completed_at` — **the final deliverable the evaluator judges is persisted here** (kept on the attempt, no separate table); `mission_version` records which authored version was attempted; the `evaluating` state + `evaluation_started_at` form a **recoverable timestamp lease** so a failed/timed-out evaluation can't lock the attempt forever
- **workbench_messages**: `id (pk)`, `attempt_id`, `user_id`, `role` (`user|assistant`), `content`, `turn_index`, `created_at`
- **attempt_events**: `id (pk)`, `attempt_id`, `user_id`, `type` (`resource_attached|...`), `payload jsonb`, `created_at` — captures non-chat actions (e.g. attaching mission notes) as structured signal
- **evaluations**: `id (pk)`, `attempt_id (UNIQUE)`, `user_id`, `raw_evaluation jsonb` (full judge output), `competency_results jsonb`, `model_id`, `judge_prompt_version`, `judge_schema_version`, `created_at` — **raw eval + the versions that produced it are stored separately from the profile update**, so two evaluations are only compared when their versions match and progression is genuinely recomputable after judge/mission tuning. The **unique constraint on `attempt_id`** enforces exactly one canonical evaluation per attempt
- **user_competencies**: `user_id + competency (composite pk)`, `value int 0–100`, `updated_at`
- **rate_limits**: `user_id`, `bucket_key`, `count`, `window_start` — atomic counter via a Postgres RPC

**Auth**: create the anonymous user **explicitly**, not implicitly in middleware. Middleware/proxy only **refreshes and propagates** the session; a deliberate **anonymous-auth bootstrap** runs when the app discovers no user exists, calling `signInAnonymously()` → real `auth.users` row → `user_id`. Use **dynamic rendering** where anonymous auth requires it (Supabase warns anonymous users don't mix with static rendering). RLS is designed so a **later** account-link drops in without migration. **No linking UI in the MVP** (no OAuth, magic links, or "coming soon" dead-ends).

---

## The Five Competencies (Operator Profile)

The durable skill taxonomy — **not** the four grading lenses:

| Competency | Meaning |
|---|---|
| **Context** | Did the learner recognize what info the AI needed and provide it? |
| **Direction** | Did they define objective, constraints, desired output? |
| **Iteration** | Did they inspect responses and improve rather than accept the first answer? |
| **Verification** | Did they challenge claims, spot weaknesses/hallucinations/gaps? |
| **Synthesis** | Did they turn AI output into a genuinely useful final result? |

Stored internally as 0–100, **always displayed as bands** (never "67/100"). Each mission declares **competency weights**; a competency not meaningfully exercised returns `not_shown` and **does not move the profile** (so merely completing missions doesn't inflate every bar).

---

## The Workbench (the core surface)

> *In plain terms:* the room where the user does the work. The AI here is a **capable tool, not a tutor** — it does exactly what it's told well, but it won't coach the user or quietly fix vague instructions (otherwise we'd be measuring the AI's helpfulness, not the user's skill). The user chooses which materials to hand it, decides when their deliverable is ready, and submits. There's a gentle "most people finish in 4–8 exchanges" nudge and a hard safety cap so nobody can run the free AI forever.

**AI behavior — capable but NOT pedagogical.** System prompt (in `lib/ai/workbench.ts`) instructs the model to:
- execute the learner's instructions well using **only** the context/constraints they explicitly provide or attach;
- **not** coach, suggest prompt improvements, volunteer missing requirements ("you may want to specify the audience"), auto-repair vague instructions, or reveal what the evaluator wants;
- ask a **natural clarifying question only when information is genuinely necessary** to execute — never a Socratic tutor.
- Literal ≠ deliberately bad. It is a capable modern model; a vague instruction simply produces a literal, unrescued result.

**Mission materials — chosen, not injected.** Source materials show in the mission environment; the learner explicitly **attaches** them ("Add notes to AI context" / a Resources area for larger inputs). The model receives **only selected resources**. Each attachment is written to `attempt_events` — so *Context* measures recognizing what the AI needs, not willingness to copy-paste 1,400 words.

**Turn design.** Streamed responses; **configurable thinking level** (test low vs. medium for workbench latency — no `temperature`/`top_p`/`top_k`, which the newer Flash models have dropped). UI guidance copy: *"Most operators complete this mission in 4–8 AI exchanges."* No gamified countdown. A **hard safety ceiling (~12 exchanges/attempt)** is enforced server-side by counting `workbench_messages`; on hit, sends disable and the UI nudges toward Submit. **Turn count never affects any competency score.**

**Deliverable — challenge-specific, curated by the learner.** A separate panel where the learner assembles what they're *willing to submit* (pull AI output in, edit, combine across responses). Shape varies per mission:
- Meeting Chaos → structured summary (Decisions[], ActionItems[{owner, task, due}], OpenQuestions[])
- The Bad Prompt → improved prompt + resulting output
- The Brief → finished brief fields
- Don't Trust the AI → recommendation + supporting evidence + concerns

The evaluator receives: **mission context + full transcript (+ attachment events) + final deliverable.**

**MVP privacy constraint.** Because the MVP runs on Gemini's **free tier** (Google may use free-tier content to improve its products), all mission resources are **synthetic/hand-authored**, and the workbench shows a small standing warning: *don't paste confidential company or personal data.* Revisit this before ever inviting real professionals to bring their real work artifacts.

---

## Evaluation Pipeline

> *In plain terms:* how the "examiner" works. After the user submits, a separate AI call reads their whole session — the chat, what they attached, and their final deliverable — and returns structured coaching plus a read on each of the five skills, pointing to the exact moments that justify it. Then **our own fixed code** (not the AI) nudges the skill bars and picks the next recommended mission. Keeping the score-keeping in our code makes it fair, predictable, and tunable. The rest of this section is safety plumbing so grading runs exactly once and can't get stuck.

### `/api/evaluate` — judge (non-streamed, schema-validated structured output, thinking level ~medium)

The judge is passed a **unified, ID'd timeline** (`msg_04`, `evt_02`, …) plus the deliverable and the mission's allowed competencies + weights + `judgeGuidance`. It returns three separated blocks:

```jsonc
{
  "attempt_evaluation": {          // the four lenses — explain THIS attempt
    "approach":  { "band": "...", "note": "..." },
    "iteration": { "band": "...", "note": "..." },
    "judgment":  { "band": "...", "note": "..." },
    "outcome":   { "band": "...", "note": "..." }
  },
  "competency_evidence": {         // only competencies with weight > 0 this mission
    "context": {
      "band": "developing",        // not_shown | emerging | developing | proficient | strong
      "why": "...",
      "evidence": [ { "turn_id": "msg_03", "observation": "Added owner + deadline requirement after noticing they were omitted." } ]
    }
    /* ...others; unexercised -> band: "not_shown", evidence: [] */
  },
  "coaching": {                    // user-facing
    "what_worked": "...",
    "what_was_missed": "...",
    "stronger_approach": "...",
    "demonstrated_skill": "direction",
    "practice_competency": "verification"
  }
}
```

- **Evidence is referenced by `turn_id`, never quoted** — the model can misquote; IDs are exact and let the UI expand the real message later.
- Enforce the schema via Gemini **structured output** / `responseSchema`; validate on parse and fail loudly. Configure via **thinking level** (start **medium** for the judge), **not** temperature — the newer Flash models have removed the older sampling params.
- Stamp every row with `model_id`, `judge_prompt_version`, `judge_schema_version`, and the attempt's `mission_version` so evaluations are only ever compared like-for-like across tuning.

### Idempotency, atomicity & recovery (evaluation runs exactly once, but is never permanently stuck)
On `/api/evaluate`, resolve the attempt's state before ever calling Gemini — a simple **timestamp-based lease**, not a job/queue system:
- **`evaluated`** → return the canonical existing evaluation. No Gemini call, no progression change.
- **`evaluating` AND an evaluation row already exists** → return it (a prior run finished).
- **`evaluating` AND the lease (`evaluation_started_at`) is recent** → return a safe *"evaluation in progress"* response; do **not** start another Gemini call.
- **`evaluating` BUT the lease is stale** (older than a fixed timeout — a previous request failed/timed out) → allow the attempt to be **reclaimed and retried**.
- **`submitted`** → **atomically claim** it (`submitted → evaluating`, set `evaluation_started_at`) via a conditional update, then run the judge.
- If the **Gemini call fails before persistence**, explicitly **reset the attempt to `submitted`** where safe, so the user can retry.
- The final **evaluation insert + competency updates + transition to `evaluated`** run inside **one transaction/RPC**. `evaluations.attempt_id UNIQUE` is the final duplicate-write backstop — a losing concurrent writer's insert fails instead of double-updating the profile.

Net effect: repeated or concurrent evaluate requests yield the **one canonical result** (never a second Gemini call, never a double progression bump), while a crashed evaluation self-heals via the stale-lease path instead of stranding the attempt.

### Profile update — deterministic app code (`lib/progression/update.ts`), NOT the LLM
The architecture is fixed (LLM produces evidence → deterministic code updates the profile); the **exact formula is a tunable implementation detail, calibrated during the M1 gate**, not locked now. `update.ts` isolates all of it so it can change without touching evaluation behavior. It must explicitly define:
- **Band → target value** map and **band thresholds** for display (starting point: `emerging 25 · developing 50 · proficient 75 · strong 95`; `not_shown` → no change).
- **Blend rule** toward the attempt's evidence, weighted by the mission's emphasis on that competency. A first cut is `new_v = clamp(v + α · w_c · (target − v))`, but **α and how weights normalize are to be calibrated at the gate** — starting from zero, a strong performance must produce *satisfying, visible* movement, so verify the curve rather than inheriting it from the equation.
- **Initialization** — the initial-state value/band for a competency never yet exercised.
- **Downward movement** — an explicit **product decision to observe at the gate**: can a poor later attempt *lower* a competency, or is progression monotonic? Decide by watching real runs, don't inherit it accidentally.
- Write updated values to `user_competencies`; the **raw judge output + versions** live in `evaluations`, so progression is **recomputable** after any formula change. Compute "which bars moved" by diffing pre/post for the debrief.

### Recommendation — deterministic (`lib/progression/recommend.ts`)
The **LLM never picks the next mission.** It returns `practice_competency`; the product chooses an eligible mission from the catalog by: the gap competency, mission competency weights, completion history, and availability. If all missions are complete, recommend replaying the one that best exercises the weakest competency. → **Judge identifies the gap; product chooses the rep.**

---

## Rate Limiting / Abuse Protection (`lib/ratelimit.ts`)

> *In plain terms:* because anyone can use the product without signing up, we add simple guardrails so nobody can run up our free AI bill — a cap per attempt, caps per time-window, and (before we make it public) a quiet check that blocks bots from mass-creating accounts. Intentionally lightweight, not a security project.

Anonymous users can invoke Gemini, so both AI routes are gated server-side per `user_id`:
- **Per-attempt ceiling** (~12 workbench messages) — counted from `workbench_messages`.
- **Short-window caps** (e.g. ~20 workbench msgs / 5 min; ~10 evaluations / hour) via an atomic Postgres RPC on `rate_limits`, run from the server (via a `SECURITY DEFINER` RPC, or the secret-key server client only if genuinely needed). Return **429** when exceeded. Deliberately simple — not an infra project.
- **Before the Vercel deployment is exposed publicly**, enable Supabase-supported **invisible CAPTCHA / Cloudflare Turnstile** on anonymous account creation to stop automated signup abuse. Keep it to the built-in integration — not a larger security project.

---

## Screens (five surfaces)

> *In plain terms:* the five screens a user moves through — sign-in-free onboarding, the mission map ("The Field"), the briefing, the workbench, and the debrief. The deliberate goal is that it feels like *entering a mission*, not browsing a training course (an "LMS" is a traditional online-course dashboard — the thing we're avoiding).

1. **Onboarding** — ≤3 full-screen taps (role → AI experience → goal), **skippable**, ~30s → writes `profiles`. Personalizes scenario framing, examples, terminology, coaching language, and post-attempt recommendations — but **never the evaluation standard** (beginner and expert are judged against the same rubric; experience changes only how feedback is *explained*).
2. **The Field (home)** — a **mission map**, not an LMS dashboard: mission "sites," the Operator Profile as five compact bands, and **one highlighted recommended next mission**. No tables, no numeric grades.
3. **Briefing** — its own lightweight screen (scenario, objective, constraints, what the deliverable is) that flows into the workbench. Kept as a distinct step for the "I'm entering a mission" psychological transition.
4. **Workbench** — conceptually *mission context + AI workspace + deliverable*. Desktop: side-by-side; smaller screens: Deliverable becomes a switchable workspace (responsive design decides — not locked to 50/50).
5. **Debrief** — the coaching fields, the competency movement (which bands moved, before→after), and the **"Your next mission"** CTA (from `recommend.ts`). Evidence expansion via `turn_id` is a polish nice-to-have.

---

## Workflow & Wireframes

> *In plain terms:* the exact path a user walks, what the system quietly does at each step, and rough sketches of every screen. The sketches are layout intent, not final visual design — they show *what's on each screen and why*.

### End-to-end workflow (user action → what happens behind it)

```
┌── FIRST TOUCH ───────────────────────────────────────────────────────────┐
│ User just opens the app.                                                  │
│   ↳ System: silently creates an anonymous account (real, saved user_id).  │
│     No form, no email. Progress will persist for this browser.            │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── ONBOARDING (≤3 taps, skippable, ~30s) ─────────────────────────────────┐
│ User taps: role → AI-experience → goal.                                   │
│   ↳ System: writes `profiles`; marks onboarding_completed.                │
│     Used to flavour scenario wording + coaching tone — NEVER the grade.   │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── THE FIELD (home) ──────────────────────────────────────────────────────┐
│ User sees mission map + their 5 skill bars; one mission highlighted.      │
│   ↳ System: reads `user_competencies`; first-timer → recommends Meeting   │
│     Chaos. Returning user → recommends the gap mission from last debrief.  │
│ User clicks the recommended mission.                                      │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── BRIEFING ──────────────────────────────────────────────────────────────┐
│ User reads scenario, objective, constraints, what to submit + privacy     │
│ note; clicks "Enter Workbench".                                           │
│   ↳ System: creates a `challenge_attempts` row (status=in_progress,       │
│     mission_version stamped).                                             │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── WORKBENCH (the practice) ──────────────────────────────────────────────┐
│ User CHOOSES to attach materials, chats with the AI, iterates, and builds │
│ the Deliverable on the side.                                              │
│   ↳ System: each attach → `attempt_events`; each turn → `workbench_msgs`  │
│     (via /api/workbench, streamed). AI is a literal tool, no coaching.    │
│     Soft "4–8 exchanges" nudge; hard ~12 ceiling; per-user rate limits.   │
│ User decides the Deliverable is ready → clicks "Submit".                  │
│   ↳ System: saves `submitted_deliverable` + `submitted_at`;               │
│     status → submitted.                                                    │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── EVALUATION (invisible, a few seconds) ─────────────────────────────────┐
│ User sees a purposeful "grading your mission…" state.                     │
│   ↳ System (/api/evaluate): atomic claim submitted→evaluating (+lease);   │
│     judge reads transcript+events+deliverable → structured JSON;          │
│     deterministic code maps to the 5 skills + updates bars + picks next   │
│     mission; all in one transaction. Runs exactly once; self-heals if it  │
│     crashes. status → evaluated.                                          │
└───────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── DEBRIEF ───────────────────────────────────────────────────────────────┐
│ User reads coaching, sees which bars moved, and the ONE next mission.     │
│ Clicks "Start" → loops back to a new Briefing.                            │
│   ↳ The reason to return: profile visibly incomplete + next rep named.    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Wireframes (layout intent — ASCII, not final visuals)

**1 · Onboarding** — three sequential full-screen taps (step 1 shown; steps 2 & 3 identical pattern):
```
┌───────────────────────────────────────────────┐
│                                      Skip  →   │
│                                                │
│   Welcome to AI Field                          │
│   Practice directing AI on real work.          │
│                                                │
│   What's your role?                            │
│   ┌────────────┐ ┌────────────┐                │
│   │ Marketing  │ │ Operations │                │
│   ├────────────┤ ├────────────┤                │
│   │ Product/PM │ │ Founder/Biz│                │
│   ├────────────┤ ├────────────┤                │
│   │ Other      │ │ Prefer not │                │
│   └────────────┘ └────────────┘                │
│                                                │
│                       ●○○     [ Continue → ]   │
└───────────────────────────────────────────────┘
   Step 2: "How often do you use AI?" Rarely/Weekly/Daily/Constantly
   Step 3: "What do you want to get better at?" (goal chips)
```

**2 · The Field (home)** — mission map + Operator Profile, one clear next step:
```
┌──────────────────────────────────────────────────────────────┐
│  AI FIELD                                        ◐ Operator   │
├──────────────────────────────────────────────────────────────┤
│  YOUR NEXT MISSION                                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ★ Meeting Chaos                                        │  │
│  │   Turn messy notes into decisions & actions.           │  │
│  │   ~10 min · Context · Direction · Synthesis            │  │
│  │                                          [ Start → ]   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  OPERATOR PROFILE                                            │
│   Context      ▓▓▓▓▓░░░░░  developing                        │
│   Direction    ▓▓▓░░░░░░░  emerging                          │
│   Iteration    ▓▓░░░░░░░░  emerging                          │
│   Verification ░░░░░░░░░░  not yet shown                     │
│   Synthesis    ▓▓▓▓░░░░░░  developing                        │
│                                                              │
│  MORE MISSIONS                                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐              │
│  │ The Bad   │ │ The Brief │ │ Don't Trust   │              │
│  │ Prompt    │ │           │ │ the AI   🔒   │              │
│  └───────────┘ └───────────┘ └───────────────┘              │
└──────────────────────────────────────────────────────────────┘
   (No tables, no numeric grades — a map, not an LMS dashboard.)
```

**3 · Briefing** — the "I'm entering a mission" moment:
```
┌──────────────────────────────────────────────────────────────┐
│  ← The Field           MEETING CHAOS                          │
├──────────────────────────────────────────────────────────────┤
│  THE SCENARIO                                                │
│  Your team just wrapped a 45-min planning call. The notes    │
│  are a mess of half-sentences. Your manager needs the        │
│  decisions and who-owns-what by end of day.                  │
│                                                              │
│  YOUR OBJECTIVE                                              │
│  A clean summary: decisions, action items (owner + due),     │
│  and open questions.                                         │
│                                                              │
│  CONSTRAINTS                                                 │
│  • Only what the notes support — don't invent tasks          │
│  • Every action item needs an owner and a due date           │
│                                                              │
│  YOU'LL SUBMIT — a structured meeting summary                │
│                                                              │
│  ⚠ Don't paste real confidential data (free AI tier).       │
│                                        [ Enter Workbench → ] │
└──────────────────────────────────────────────────────────────┘
```

**4 · Workbench** — mission context pinned; chat + resources on one side, the deliverable you're building on the other:
```
┌───────────────────────────────────────────────────────────────────────────┐
│ MEETING CHAOS   Objective: decisions + owners + due dates      [ Submit ▶ ]│
├─────────────────────────────────┬─────────────────────────────────────────┤
│ RESOURCES                       │ DELIVERABLE — Meeting Summary            │
│  ┌───────────────────────────┐  │  Decisions                              │
│  │ 📄 Raw meeting notes       │ │  ┌───────────────────────────────────┐  │
│  │            [ + Add to AI ] │  │  │ • …                               │  │
│  └───────────────────────────┘  │  └───────────────────────────────────┘  │
│                                 │  Action Items                           │
│ CHAT WITH AI                    │  ┌───────┬──────────────┬────────────┐  │
│  ┌───────────────────────────┐  │  │ Owner │ Task         │ Due        │  │
│  │ You: Summarise these…     │  │  ├───────┼──────────────┼────────────┤  │
│  │ AI:  Here is a summary…   │  │  │ …     │ …            │ …          │  │
│  │ You: Add owners + dates   │  │  └───────┴──────────────┴────────────┘  │
│  │ AI:  …                    │  │  Open Questions                         │
│  └───────────────────────────┘  │  ┌───────────────────────────────────┐  │
│  ┌───────────────────────────┐  │  │ • …                               │  │
│  │ Type an instruction…    ▶ │  │  └───────────────────────────────────┘  │
│  └───────────────────────────┘  │        [ ⟵ pull last AI reply in ]      │
│  Most operators finish in 4–8   │                                         │
│  exchanges.                     │                                         │
└─────────────────────────────────┴─────────────────────────────────────────┘
  Mobile: [ Chat | Deliverable ] toggle; context bar + Submit stay pinned on top.
```

**5 · Debrief** — coaching, the bars that moved, and the single next rep:
```
┌──────────────────────────────────────────────────────────────┐
│  MEETING CHAOS — DEBRIEF                                      │
├──────────────────────────────────────────────────────────────┤
│  ✓ WHAT WORKED                                               │
│    You handed the AI the notes and clearly asked for owners. │
│                                                              │
│  △ WHAT YOU MISSED                                           │
│    You accepted deadlines the notes never actually stated.   │
│                                                              │
│  ★ HOW AN EXPERT WOULD APPROACH IT                           │
│    They'd flag unsupported dates instead of inventing them.  │
│                                                              │
│  SKILLS THAT MOVED                                           │
│    Direction   ▓▓▓░→▓▓▓▓▓   emerging → developing   ▲        │
│    Synthesis   ▓▓▓▓→▓▓▓▓▓   developing → proficient  ▲       │
│                                                              │
│  PRACTISE NEXT →  Verification                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Don't Trust the AI — Catch what the AI gets wrong.     │ │
│  │                                          [ Start → ]   │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Mission Content Schema (`lib/missions/types.ts`)

> *In plain terms:* the fill-in-the-blanks template each mission is written into — its scenario, goal, constraints, the materials it provides, what the user submits, which of the five skills it emphasises, and notes telling the examiner what "strong" looks like for this mission. Written by hand in the code for now; no authoring tool.

Missions are hand-authored TS in the repo (no CMS):
```ts
type Competency = 'context'|'direction'|'iteration'|'verification'|'synthesis';
type Mission = {
  id; title; tagline; domain;
  briefing: { scenario; objective; constraints: string[]; deliverableDescription };
  resources: Resource[];              // {id, label, kind, content} — attachable, not auto-injected
  workbenchSystemContext: string;     // neutral mission framing for the literal-tool AI (NOT the rubric)
  deliverable: DeliverableSpec;       // challenge-specific fields the UI renders
  competencyWeights: Record<Competency, number>;  // 0..1; drives judge scope + profile blend
  judgeGuidance: string;              // mission-specific "what strong looks like" for the judge
};
```

**The four missions:** Meeting Chaos (Context/Direction/Synthesis high) · The Bad Prompt (Iteration/Direction) · The Brief (Direction/Context/Synthesis) · Don't Trust the AI (Verification). Fallback under time pressure: **3 fully-evaluated missions + 1 visibly locked** rather than weakening the core experience.

---

## Milestones

> *In plain terms:* the order we build in. **M0** = set up the plumbing. **M1** = get the *one* Meeting Chaos mission working the whole way through, for real, and deployed. **Then we stop at the gate** and prove the examiner can tell good from bad before spending any time on missions 2–4 (M2) or polish (M3). This sequencing is the single biggest risk-reducer in the plan.

- **M0 — Scaffold.** **First: CLAUDE.md isolation.** The unrelated ancestor Health Tracker `CLAUDE.md` has already been removed by the user (verified: no longer on disk). As a durable guard, add `claudeMdExcludes` to `AI Field/.claude/settings.local.json` explicitly excluding any ancestor `CLAUDE.md` outside the project, and **verify with Claude Code that Health Tracker instructions are no longer loaded** before proceeding (relocate the repo only if that check still fails). Do **not** rely on a child `CLAUDE.md` override. Then: Next app + Tailwind + shadcn; GitHub repo; Supabase project with migrations, **explicit anonymous-auth bootstrap** (not middleware-created), RLS, **publishable/secret** key wiring; skeleton deploy to Vercel.
- **M1 — Vertical slice (Meeting Chaos, end-to-end).** Onboarding → explicit anon user → Field → briefing → resource selection → streamed Gemini conversation → transcript + event persistence → curated **deliverable persisted on the attempt** → versioned evaluation → competency update → debrief → recommendation. Real Supabase, deployed to Vercel.
- **🚦 GATE (hard):** Do **not** start missions 2–4 until Meeting Chaos has been manually completed several times with *deliberately* strong vs. weak prompting strategies and the evaluator **reliably discriminates** strong from weak AI-working behavior (weak one-shot vague → low Direction/Iteration; strong iterative context-rich → higher). Tune the judge prompt + weights until discrimination holds. *A technically-working judge is not sufficient.*
- **M2 — Content.** Author The Bad Prompt, The Brief, Don't Trust the AI against the proven engine (each: resources, deliverable spec, weights, judgeGuidance).
- **M3 — Polish.** Mission-map visuals, responsive workbench, debrief evidence expansion, rate-limit hardening, loading/error/empty states.

---

## Verification (end-to-end)

1. **Loop walk:** `npm run dev` → complete Meeting Chaos start-to-finish; confirm transcript, attach events, **submitted deliverable + `submitted_at`**, evaluation (with `model_id` / `judge_prompt_version` / `judge_schema_version` / `mission_version` stamped), profile movement, and recommended next mission all persist in Supabase.
2. **Discrimination test (the gate):** run the same mission with a **weak** run (one vague prompt, accept first output, no context attached) vs. a **strong** run (attach notes, specify audience/constraints, iterate, verify) → confirm the judge's bands and the coaching meaningfully differ, and the profile moves differently.
3. **Persistence + RLS:** verify a second anonymous user **cannot** read the first user's attempts/messages/evaluations.
4. **Guardrails:** confirm the ~12-message ceiling disables sends and nudges to Submit; confirm 429s fire when short-window caps are exceeded; confirm `GEMINI_API_KEY` / the Supabase **secret** key never reach the browser (network inspect); confirm the "don't paste confidential data" warning is present in the workbench.
5. **Deploy:** Vercel preview from a GitHub PR renders the full loop with env vars set.
