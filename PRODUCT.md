# Product

<!-- impeccable:product-schema 1 -->

> Distilled from the authoritative in-repo docs `plan.md` and `SPEC.md` (settled with the user through a full grilling pass) plus a short init interview. This file captures durable product truth only. It invents no visual world and defines no surface strategy; those live in DESIGN.md and the surface briefs. If this file and `plan.md`/`SPEC.md` ever disagree, those docs win — reconcile here.

## Platform

web

## Stack

Settled in `plan.md` (not re-opened at init): Next.js (App Router) + React + Tailwind + **selective** shadcn/ui primitives, on Vercel with continuous deploy from GitHub. Supabase (Postgres + anonymous auth + Row Level Security; publishable/secret key naming). Gemini as the only AI provider (`gemini-3.7-flash`, configurable via `GEMINI_MODEL`) behind one thin module `lib/ai/provider.ts`. **All AI runs server-side; secret keys never reach the browser.**

Note for design work: the component library is implementation infrastructure, not the product's visual identity. shadcn/ui is a starting set of primitives to restyle, not the look.

## Users

**Primary (confirmed):** broad non-technical professionals who already use AI for simple tasks (writing an email, summarising a note) but cannot yet *direct* it through real work — briefing it properly, checking what it returns, pushing it to something genuinely useful. Roles span marketing, operations, product/PM, founder/business, and adjacent knowledge work; the first mission (Meeting Chaos) is deliberately universal so no single vertical is assumed.

**Situation & job:** a self-directed practice session in a browser, typically ~5–15 minutes, done to get better at directing AI and to get honest, specific feedback on *how they worked* — not to consume a course and not to chat with a bot.

## Product Purpose

AI Field is a **practice environment** — "a gym for working with AI." The user takes on realistic **missions**, directs a real AI inside a focused **workbench** to produce a **deliverable** they choose to submit, and an AI **examiner** reads the whole session and returns a **debrief**: what worked, what they missed, how an expert would approach it, one skill they showed, one to practise next. Their five-skill **Operator Profile** moves, and one next mission is always recommended.

The MVP exists to prove one belief end-to-end: **the examiner can reliably tell strong AI-working from weak on the same mission.** If it can't, the skill bars are decoration. Success for the MVP is that discrimination holding on Meeting Chaos (the hard M1 gate).

## Positioning

The mechanism a neighbouring product could not truthfully copy: AI Field measures and coaches the **process of directing AI**, not the artifact produced.

- **Reps, not content.** Realistic missions you *do*, not lessons or prompt tips you consume.
- **A literal-tool workbench.** The AI executes instructions well but never coaches, never volunteers missing requirements, never repairs vague instructions — so feedback reflects the *user's* skill, not the model's helpfulness.
- **An examiner that cites specific moments** and scores five durable competencies, then hands the score-keeping to deterministic app code.
- **The LLM never keeps score and never picks the next mission** — fair, tunable, recomputable progression by construction.

## Operating Context

A single self-contained loop across **five surfaces**, designed to feel like *entering a mission*, not browsing a course:

1. **Onboarding** — ≤3 skippable full-screen taps (role → AI experience → goal), ~30s. Personalises framing and coaching tone, **never the evaluation standard**.
2. **The Field (home)** — a *map of missions* with the Operator Profile as five compact bands and one highlighted recommended next mission.
3. **Briefing** — scenario, objective, constraints, what you'll submit, and a privacy note; a deliberate "I'm entering a mission" step.
4. **Workbench** — mission context + AI chat + attachable resources on one side, the deliverable being built on the other.
5. **Debrief** — coaching, which bands moved (before → after), and the single next mission.

The loop closes back to a new briefing. No signup wall: an anonymous account is created invisibly and progress persists per browser. Because the MVP runs on Gemini's free tier, **all mission materials are synthetic/hand-authored** and the workbench carries a standing "don't paste confidential data" warning.

## Capabilities and Constraints

**The five competencies (Operator Profile):**

| Competency | Meaning |
|---|---|
| **Context** | Did they recognise what information the AI needed and provide it? |
| **Direction** | Did they set a clear objective, constraints, and desired output? |
| **Iteration** | Did they improve the AI's answer instead of accepting the first draft? |
| **Verification** | Did they catch the AI's mistakes, gaps, and made-up claims? |
| **Synthesis** | Did they turn AI output into something genuinely useful? |

- Stored internally 0–100, **always displayed as bands** (`not shown · emerging · developing · proficient · strong`), never a fake-precise number.
- Each mission declares **competency weights**; a competency not meaningfully exercised returns `not_shown` and **does not move** the profile (finishing missions doesn't inflate every bar).
- **Materials are attach-by-choice**, never auto-injected — recognising what the AI needs is part of the Context measurement.
- Soft nudge ("most operators finish in 4–8 exchanges") + hard server-side ceiling (~12 messages/attempt). **Turn count never affects any score.**
- **Deliverable is a mission-specific structured form** the user curates, saved on the attempt at submit (Meeting Chaos → Decisions / Action Items[owner, task, due] / Open Questions).
- The examiner references evidence **by turn id, never quoted**; output is schema-enforced; evaluation runs **exactly once** per attempt with crash recovery; **RLS** makes each user's data private by construction.

**Explicitly undecided product facts (calibrated at the M1 gate — do not lock in design):** the exact progression curve, competency initialization, and whether a poor later attempt can *lower* a band. **Deferred:** account linking / OAuth (schema is designed so it drops in later without migration); **out of scope for MVP:** missions 2–4, CMS/admin/authoring, social/leaderboards/notifications/teams, a visible overall rank/level as a mechanic.

## Brand Commitments

- **Name:** AI Field. The user is addressed as an **"Operator"**; their profile is the **"Operator Profile."**
- **Ubiquitous language (use consistently):** The Field (home/mission map), Mission, Briefing, Workbench, Resources, Deliverable, Submit, Examiner / judge, Debrief, Operator Profile, the five competency names, and the band labels above.
- **Voice:** honest, specific, and earned; coaching, never grading; plain over clever. Tone is pitched to the operator's stated experience, but the **standard is identical for everyone** so the profile means something.
- **Binding anti-references (the experience we must NOT create):** an LMS / course dashboard (no tables, no numeric grades), a generic chatbot, a gamified turn-count countdown, and a big numeric score as the headline. A map, not a dashboard.

## Evidence on Hand

- Greenfield. **No real users, testimonials, customers, benchmarks, press, or logos exist — future work must not fabricate any.**
- Mission content is **synthetic and hand-authored**; Meeting Chaos is authored, three more are planned (`lib/missions/*`, no CMS).
- Authoritative product docs in-repo: `plan.md` (plan + rationale, plain-English layer) and `SPEC.md` (buildable requirements, user stories, the M1 gate). A prior wireframe attempt (a static editorial "design canvas") was **rejected and reverted** — treat it as anti-reference, not direction.

## Product Principles

1. **Measure the process, not the artifact.** Everything optimises for judging *how* the user directed the AI, not the polish of the output.
2. **The workbench AI is a tool, not a tutor.** Its refusal to coach protects the integrity of the measurement; nothing in the experience should quietly rescue the user.
3. **Honest signal over vanity metrics.** Bands not numbers, unexercised skills stay unmoved, no headline score — progress must read as truthful.
4. **Deterministic where fairness lives.** The LLM produces evidence; app code keeps score and picks the next rep — fair, tunable, recomputable.
5. **A map, not a course.** Every surface should feel like entering a mission, and always name the one next rep so returning has a reason that isn't a streak.

## Accessibility & Inclusion

Target **WCAG 2.2 AA** across all surfaces (confirmed at init): full keyboard paths, sufficient contrast, visible focus, and honored reduced-motion. Coaching language adapts to the operator's stated experience without changing the evaluation standard.
