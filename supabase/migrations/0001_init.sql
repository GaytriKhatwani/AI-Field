-- AI Field — M0 schema, RLS, and atomic RPCs.
-- Apply with the Supabase SQL editor or `supabase db push`.
--
-- Design rules (from SPEC):
--  * user_id is denormalised onto every child row so every policy is auth.uid() = user_id.
--  * Anonymous auth is created explicitly by the app bootstrap; this schema treats an
--    anonymous user like any other auth.users row. Account-linking can be added later
--    without migration (nothing here assumes email/identity).
--  * Idempotent evaluation via a timestamp lease on challenge_attempts, not a queue.

-- ----------------------------------------------------------------------------
-- profiles: one row per user (identity + onboarding). PK is the auth user id.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text,
  ai_usage    text,
  goal        text,
  onboarded   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- user_competencies: one row per (user, competency). Stored 0–100; exposed only
-- as bands by app code. A competency a user has never exercised simply has no row
-- (treated as score 0 / not_shown).
-- ----------------------------------------------------------------------------
create table if not exists public.user_competencies (
  user_id     uuid not null references auth.users (id) on delete cascade,
  competency  text not null check (competency in
                ('context','direction','iteration','verification','synthesis')),
  score       integer not null default 0 check (score between 0 and 100),
  updated_at  timestamptz not null default now(),
  primary key (user_id, competency)
);

-- ----------------------------------------------------------------------------
-- challenge_attempts: one per mission attempt. Carries the evaluation lifecycle.
-- ----------------------------------------------------------------------------
create table if not exists public.challenge_attempts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  mission_id            text not null,
  mission_version       text not null,
  status                text not null default 'in_progress'
                          check (status in ('in_progress','submitted','evaluating','evaluated')),
  submitted_deliverable jsonb,
  submitted_at          timestamptz,
  evaluation_started_at timestamptz,          -- the recoverable lease
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists challenge_attempts_user_idx
  on public.challenge_attempts (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- workbench_messages: the streamed chat, one row per turn, ordered by seq.
-- ----------------------------------------------------------------------------
create table if not exists public.workbench_messages (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.challenge_attempts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  seq         integer not null,
  role        text not null check (role in ('user','ai')),
  content     text not null,
  created_at  timestamptz not null default now(),
  unique (attempt_id, seq)
);

-- ----------------------------------------------------------------------------
-- attempt_events: session signals the judge reads (e.g. attaching a resource).
-- ----------------------------------------------------------------------------
create table if not exists public.attempt_events (
  id          uuid primary key default gen_random_uuid(),
  attempt_id  uuid not null references public.challenge_attempts (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  seq         integer not null,
  kind        text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (attempt_id, seq)
);

-- ----------------------------------------------------------------------------
-- evaluations: one canonical evaluation per attempt (attempt_id UNIQUE).
-- ----------------------------------------------------------------------------
create table if not exists public.evaluations (
  id                    uuid primary key default gen_random_uuid(),
  attempt_id            uuid not null unique references public.challenge_attempts (id) on delete cascade,
  user_id               uuid not null references auth.users (id) on delete cascade,
  raw_evaluation        jsonb not null,      -- the judge's full output
  competency_results    jsonb not null,      -- the deterministic per-competency moves
  model_id              text not null,
  judge_prompt_version  text not null,
  judge_schema_version  text not null,
  created_at            timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- rate_limits: fixed-window counters for per-user caps.
-- ----------------------------------------------------------------------------
create table if not exists public.rate_limits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  bucket_key    text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (user_id, bucket_key, window_start)
);

-- ============================================================================
-- Row Level Security — every table: a user sees and writes only their own rows.
-- ============================================================================
alter table public.profiles           enable row level security;
alter table public.user_competencies  enable row level security;
alter table public.challenge_attempts enable row level security;
alter table public.workbench_messages enable row level security;
alter table public.attempt_events     enable row level security;
alter table public.evaluations        enable row level security;
alter table public.rate_limits        enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_competencies','challenge_attempts',
    'workbench_messages','attempt_events','evaluations','rate_limits'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format('drop policy if exists %I on public.%I;', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I;', t || '_update', t);
    execute format('drop policy if exists %I on public.%I;', t || '_delete', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id);',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id);',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id);',
      t || '_delete', t);
  end loop;
end $$;

-- ============================================================================
-- RPCs. All SECURITY INVOKER so RLS still applies (they act as the calling user).
-- ============================================================================

-- Atomically claim an attempt for evaluation, or report why it can't be claimed.
-- A single UPDATE is the race-safe claim: it succeeds only from 'submitted' or a
-- STALE 'evaluating' lease. Returns one row: action ∈
--   'run'            -> caller holds the lease, run the judge
--   'return_existing'-> already evaluated, read the evaluation
--   'in_progress'    -> a fresh lease is held elsewhere, tell the client to wait
--   'not_found'      -> no such attempt for this user, or not submittable
create or replace function public.claim_attempt_for_evaluation(
  p_attempt_id uuid,
  p_stale_seconds integer default 90
)
returns table (action text, status text)
language plpgsql
security invoker
as $$
declare
  v_claimed boolean := false;
  v_status  text;
begin
  update public.challenge_attempts a
     set status = 'evaluating',
         evaluation_started_at = now(),
         updated_at = now()
   where a.id = p_attempt_id
     and a.user_id = auth.uid()
     and (
       a.status = 'submitted'
       or (a.status = 'evaluating'
           and a.evaluation_started_at < now() - make_interval(secs => p_stale_seconds))
     );
  get diagnostics v_claimed = row_count;

  if v_claimed then
    return query select 'run'::text, 'evaluating'::text;
    return;
  end if;

  select a.status into v_status
    from public.challenge_attempts a
   where a.id = p_attempt_id and a.user_id = auth.uid();

  if v_status is null then
    return query select 'not_found'::text, null::text; return;
  elsif v_status = 'evaluated' then
    return query select 'return_existing'::text, v_status; return;
  elsif v_status = 'evaluating' then
    return query select 'in_progress'::text, v_status; return;
  else
    -- 'in_progress' attempt was never submitted
    return query select 'not_found'::text, v_status; return;
  end if;
end $$;

-- Release a claimed attempt back to 'submitted' after a judge failure (before any
-- evaluation was persisted), so it can be retried.
create or replace function public.reset_attempt_to_submitted(p_attempt_id uuid)
returns void
language plpgsql
security invoker
as $$
begin
  update public.challenge_attempts a
     set status = 'submitted',
         evaluation_started_at = null,
         updated_at = now()
   where a.id = p_attempt_id
     and a.user_id = auth.uid()
     and a.status = 'evaluating';
end $$;

-- Finalize one attempt in a single transaction: insert the canonical evaluation,
-- upsert the user's competency scores, and flip the attempt to 'evaluated'.
-- UNIQUE(attempt_id) is the duplicate-write backstop: a concurrent finalize raises
-- unique_violation, which the caller treats as "already evaluated".
create or replace function public.finalize_evaluation(
  p_attempt_id           uuid,
  p_raw_evaluation       jsonb,
  p_competency_results   jsonb,
  p_new_scores           jsonb,   -- { "context": 68, "direction": 45, ... }
  p_model_id             text,
  p_judge_prompt_version text,
  p_judge_schema_version text
)
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_comp text;
  v_score integer;
begin
  insert into public.evaluations (
    attempt_id, user_id, raw_evaluation, competency_results,
    model_id, judge_prompt_version, judge_schema_version
  )
  values (
    p_attempt_id, v_user, p_raw_evaluation, p_competency_results,
    p_model_id, p_judge_prompt_version, p_judge_schema_version
  );  -- may raise unique_violation -> caller handles as already-evaluated

  for v_comp, v_score in
    select key, value::text::integer from jsonb_each(p_new_scores)
  loop
    insert into public.user_competencies (user_id, competency, score, updated_at)
    values (v_user, v_comp, v_score, now())
    on conflict (user_id, competency)
      do update set score = excluded.score, updated_at = now();
  end loop;

  update public.challenge_attempts a
     set status = 'evaluated', updated_at = now()
   where a.id = p_attempt_id and a.user_id = v_user;
end $$;

-- Fixed-window per-user rate limit. Increments the counter for the current window
-- and returns whether the caller is still under the limit.
create or replace function public.consume_rate_limit(
  p_bucket_key     text,
  p_limit          integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count integer;
begin
  insert into public.rate_limits (user_id, bucket_key, window_start, count)
  values (v_user, p_bucket_key, v_window, 1)
  on conflict (user_id, bucket_key, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end $$;
