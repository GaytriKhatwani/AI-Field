# AI Field

**A practice environment for working with AI — "a gym for directing AI."** You take on a
realistic **mission** (e.g. turn a messy set of meeting notes into decisions and action
items), do the work with a real AI inside a focused **workbench**, submit a **deliverable**
you curate, and an AI **examiner** reads the whole session and hands back a **debrief**:
what worked, what you missed, how a strong operator would approach it, and the one skill to
practise next. It measures **how you directed the AI**, not the polish of the artifact.

> **The MVP bet (the "M1 gate"):** the examiner can reliably tell *strong* AI-working from
> *weak* on the same mission (Meeting Chaos). If that holds, the skill bars mean something.

This is a greenfield MVP. There are **no real users, customers, testimonials, or benchmarks** —
all mission content is synthetic and hand-authored.

---

## The loop (five surfaces)

`Landing → Onboarding (FTUE) → The Field → Briefing → Workbench → Debrief → (back to a new Briefing)`

1. **Onboarding** — ≤3 skippable taps (role → AI experience → goal). Tunes coaching *tone*, never the evaluation standard.
2. **The Field** — home; a map of missions + the Operator Profile as five bands + one recommended next mission.
3. **Briefing** — scenario, objective, constraints, what you'll submit.
4. **Workbench** — mission context + AI chat + attachable resources on one side, the deliverable you're building on the other.
5. **Debrief** — coaching, which competency bands moved (before → after), and the single next mission.

No signup wall: an **anonymous** account is created invisibly and progress persists per browser.
Signed-in account linking (Google, in-place upgrade) is behind a feature flag.

### The Operator Profile — five competencies

| Competency | Question it scores |
|---|---|
| **Context** | Did they give the AI the information it needed? |
| **Direction** | Did they set a clear objective, constraints, and output shape? |
| **Iteration** | Did they improve the AI's answer instead of accepting the first draft? |
| **Verification** | Did they catch the AI's mistakes, gaps, and invented claims? |
| **Synthesis** | Did they turn AI output into something genuinely useful? |

Stored 0–100 internally, **always shown as bands** (`not shown · emerging · developing · proficient · strong`).
The LLM produces *evidence*; deterministic app code keeps score and picks the next mission.

---

## Tech stack

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/docs) · [React 19](https://react.dev) · [TypeScript](https://www.typescriptlang.org/) · [Tailwind CSS](https://tailwindcss.com/docs)
- **Backend / data:** [Supabase](https://supabase.com/docs) — Postgres + anonymous auth + Row Level Security. Single migration in `supabase/migrations/0001_init.sql`.
- **AI provider:** [Anthropic Claude](https://docs.claude.com) (`claude-sonnet-5`) — server-side only, isolated in `lib/ai/provider.ts`. Backs both the workbench tool and the examiner judge (same model, different system prompt + effort). Judge output is schema-enforced with [zod](https://zod.dev).
- **Product analytics:** [Mixpanel](https://docs.mixpanel.com) (browser SDK) — client-side, funnel/behavioural only. Safe no-op when unconfigured.
- **Hosting:** [Vercel](https://vercel.com/docs) — continuous deploy from GitHub `main`.

**Architecture principles:** all AI runs server-side (keys never reach the browser) · Supabase is the
source of truth, Mixpanel is funnel-only (never a second copy of product data) · RLS (`auth.uid() = user_id`)
makes each user's data private by construction · scoring is deterministic (the LLM never keeps score).

---

## External services & dependencies (evaluation reference)

Services this project uses, and where to reference them:

| Service | Role here | Reference |
|---|---|---|
| **Anthropic Claude** | Workbench AI + examiner judge (server-side) | Console: https://console.anthropic.com · Docs: https://docs.claude.com |
| **Supabase** | Postgres, anonymous auth, Google OAuth linking, RLS | Dashboard: https://supabase.com/dashboard · Docs: https://supabase.com/docs · [Anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous) · [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) |
| **Mixpanel** | Client-side product/funnel analytics | Dashboard: https://mixpanel.com/report · Docs: https://docs.mixpanel.com · [Browser SDK](https://docs.mixpanel.com/docs/tracking-methods/sdks/javascript) |
| **Vercel** | Hosting / CI deploy | Dashboard: https://vercel.com/dashboard · Docs: https://vercel.com/docs |
| **Google Cloud (OAuth)** | Google sign-in for account linking (flagged) | Console: https://console.cloud.google.com/apis/credentials |

Key npm libraries: [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) ·
[`@supabase/ssr`](https://github.com/supabase/auth-helpers) · [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) ·
[`mixpanel-browser`](https://github.com/mixpanel/mixpanel-js) · [`zod`](https://github.com/colinhacks/zod).

> **Project-specific consoles** (fill in for evaluators who need direct access):
> - Supabase project: `<add your project dashboard URL>`
> - Mixpanel project: `<add your project URL>`
> - Vercel deployment: `<add your live URL>`

---

## Running locally

```bash
cp .env.local.example .env.local   # then fill in the values below
npm install
npm run dev                        # http://localhost:3000
```

Environment contract (see `.env.local.example` for the authoritative list):

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Server-side LLM key (workbench + judge). |
| `ANTHROPIC_MODEL` | no | Model id; defaults `claude-sonnet-5`. |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Supabase publishable key. |
| `SUPABASE_SECRET_KEY` | yes | Supabase secret key (server-only). |
| `NEXT_PUBLIC_MIXPANEL_TOKEN` | no | Mixpanel token; analytics is a safe no-op if blank. |
| `NEXT_PUBLIC_MIXPANEL_API_HOST` | no | Optional data-residency host. |
| `NEXT_PUBLIC_APP_VERSION` | no | Stamped onto analytics events; defaults `0.1.0`. |
| `NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING` | no | Feature flag (default off). `true` reveals Google sign-in + the debrief Save moment; requires Google configured on Supabase. |

> `NEXT_PUBLIC_*` variables are inlined at **build time** — after changing one in a deployment, redeploy.

---

## Repository docs

- **[PRODUCT.md](PRODUCT.md)** — durable product truth (users, purpose, positioning, constraints).
- **[docs/SPEC.md](docs/SPEC.md)** — buildable requirements, user stories, the M1 gate.
- **[docs/plan.md](docs/plan.md)** — plan + rationale (plain-English layer).
- **[docs/ANALYTICS.md](docs/ANALYTICS.md)** — the Mixpanel event catalog and the locked analytics contract.
- **[docs/SPEC-activation-layer.md](docs/SPEC-activation-layer.md)** — landing + FTUE + Google account-conversion layer.
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — production deployment checklist.
- **Design docs (in [`docs/`](docs/)):** `DESIGN-SYSTEM.md`, `DESIGN-CHARTER.md`, `DESIGN-DIRECTIONS.md`, `EXPERIENCE-THESIS.md`, `ANTI-PATTERNS.md`, and `THE-FIELD-*.md`.

---

## Project layout

```
app/            Next.js App Router
  page.tsx        public landing (server entry gate)
  (app)/          the authenticated loop: onboarding, field, briefing, workbench, evaluating, debrief
  api/            server routes: workbench (AI stream), submit, evaluate (judge)
  auth/callback/  OAuth return
components/      Landing + shared UI/icons
lib/
  ai/provider.ts  the single LLM boundary (Anthropic)
  analytics/      Mixpanel layer (typed event catalog + client)
  missions/       hand-authored missions (e.g. meeting-chaos)
  judge/          examiner prompt + schema
  progression/    deterministic profile update + next-mission recommendation
  supabase/       client/server/bootstrap (anonymous auth)
supabase/migrations/0001_init.sql
```
