# AI Field — Production Deployment Checklist

Work top to bottom. Grounded in this repo: env contract (`.env.local.example`), the
feature flag (`lib/flags.ts`), the single migration (`supabase/migrations/0001_init.sql`),
and the auth/analytics wiring. **Use fresh PROD projects** (Supabase + Mixpanel) —
do not point prod at your dev projects.

> ⚠️ **Build-time inlining:** every `NEXT_PUBLIC_*` var is baked in at **build**, not
> runtime. After changing any of them in Vercel you must **redeploy** for it to take effect.

---

## 1. Environment variables (Vercel → Settings → Environment Variables → Production)

**Required**
- [ ] `ANTHROPIC_API_KEY` — server-side only; backs both the workbench tool and the judge. Pay-as-you-go key from console.anthropic.com.
- [ ] `ANTHROPIC_MODEL` — optional; defaults `claude-sonnet-5`. Set explicitly to pin the model.
- [ ] `NEXT_PUBLIC_SUPABASE_URL` — prod project URL.
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — prod **publishable** key (new key naming, not legacy `anon`).
- [ ] `SUPABASE_SECRET_KEY` — prod **secret** key. Server-only. **Never** prefix with `NEXT_PUBLIC_`.

**Analytics (optional — safe no-op if blank)**
- [ ] `NEXT_PUBLIC_MIXPANEL_TOKEN` — token from a **separate PROD Mixpanel project** (dev currently uses your main project; split before launch so impl/tester traffic doesn't mix).
- [ ] `NEXT_PUBLIC_MIXPANEL_API_HOST` — optional data-residency host.
- [ ] `NEXT_PUBLIC_APP_VERSION` — stamp a real version (git SHA or release tag); otherwise defaults to `0.1.0`.

**Feature flag**
- [ ] `NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING` — set `true` **only after** Google is fully configured on prod Supabase (§3). Leave unset/`false` to ship the anonymous-only loop with every account-conversion affordance hidden (landing "Sign in", the debrief Save moment, the Field save line).

---

## 2. Supabase (dedicated PROD project)

- [ ] Create the prod project (separate from dev).
- [ ] Apply the schema: run `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
- [ ] Confirm **RLS is ON** for every table — the app's privacy model is `auth.uid() = user_id`; without RLS, users could read each other's sessions.
- [ ] Enable **Anonymous sign-ins** (Auth → Providers → Anonymous). The no-signup loop mints an anon user; without this the app can't start.
- [ ] Verify the RPCs the app calls exist after the migration: `consume_rate_limit`, `finalize_evaluation`, `reset_attempt_to_submitted` (used in `app/api/workbench` and `app/api/evaluate`).
- [ ] Copy prod URL + publishable + secret keys into Vercel (§1).

---

## 3. Google OAuth — only if enabling account linking

- [ ] Google Cloud Console → create an OAuth 2.0 **Web** client.
- [ ] Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Authorized JS origin: your prod domain.
- [ ] Supabase → Auth → Providers → **Google**: paste client id + secret, enable.
- [ ] Supabase → Auth settings: enable **Manual linking** (the in-place anon→Google upgrade uses `linkIdentity`).
- [ ] App redirect is automatic: it uses `${window.location.origin}/auth/callback?next=/field`, so it resolves to the prod domain once deployed there.
- [ ] Only after all of the above: set `NEXT_PUBLIC_ENABLE_ACCOUNT_LINKING=true` and redeploy.

> Your personal Google account is currently linked to a **dev** test user — that's on the dev Supabase project and does not carry to prod.

---

## 4. Vercel

- [ ] Connect the GitHub repo; production branch = `main` (continuous deploy).
- [ ] Framework auto-detects Next.js; build `next build` (default). No `vercel.json` needed.
- [ ] Add all §1 vars to **Production** scope, then deploy.
- [ ] Add + verify custom domain (DNS, HTTPS).

---

## 5. Analytics readiness (Mixpanel)

- [ ] Separate **prod** Mixpanel project + token (see §1).
- [ ] `ignore_dnt: true` is currently set (measures Do-Not-Track browsers). **Revisit consent/DNT before broad/public exposure** — acceptable for a controlled MVP cohort, documented in `ANALYTICS.md`.
- [ ] No cookie/consent banner exists — decide if one is required for your audience/region before public launch.
- [ ] After first deploy, watch Mixpanel **Live View** and confirm the funnel lands: Get Started Clicked → Onboarding Started/Completed → Mission Viewed/Started → Workbench Message Sent → Deliverable Submitted → **Evaluation Completed** → Next Mission Clicked (+ Save Profile trio if linking on).

---

## 6. Pre-launch quality gates

- [ ] `next build` passes on Vercel; `npx tsc --noEmit` clean.
- [ ] **M1 discrimination gate** — the core MVP bet is the examiner reliably telling strong from weak AI-working on Meeting Chaos. Run the gate (`scripts/gate-meeting-chaos.ts`, via `tsx`) against the prod model config and confirm discrimination holds before opening to testers.
- [ ] Smoke-test the full loop on the prod URL: fresh visitor → landing → onboarding → Meeting Chaos → workbench (real AI streams) → submit → evaluation → debrief → (if linking) Save → Google → Field; confirm data persists across a reload.
- [ ] Confirm the workbench "don't paste confidential data" warning is present (materials are synthetic; the Anthropic key stays server-side).
- [ ] Real-device check: **mobile at phone width** (couldn't be verified via tooling) and reduced-motion.

---

## 7. Cost & safety

- [ ] Anthropic: set a **spend limit / budget alert** in the console (judge = effort:high, 16k tokens; workbench streams). App already enforces a hard ceiling (~12 msgs/attempt) + per-user rate limit.
- [ ] Confirm `SUPABASE_SECRET_KEY` and `ANTHROPIC_API_KEY` are **not** `NEXT_PUBLIC_` and never reach the client.

---

## 8. Post-deploy verification

- [ ] `/` renders the **landing** for a fresh visitor (not a redirect); a returning session goes to `/field` (onboarded) or `/onboarding`.
- [ ] The new asymmetric hero renders correctly on the prod domain at desktop **and** mobile.
- [ ] Tag the release / set `NEXT_PUBLIC_APP_VERSION` and redeploy.
