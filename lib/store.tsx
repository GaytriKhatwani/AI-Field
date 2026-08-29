"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Competency } from "./missions/types";
import { getMission } from "./missions";
import { FRESH_PROFILE, Profile, scoreToBand } from "./competencies";
import type { Debrief } from "./debrief/types";
import type { CompetencyMove } from "./progression/update";
import { recommendNext } from "./progression/recommend";
import { ensureAnonymousUser } from "./supabase/bootstrap";
import { identifyUser, resetAnalytics } from "./analytics/client";

// The app's client-side state, now backed by Supabase (RLS-scoped to the signed-in
// anonymous user). The shape of useField() is kept stable so the surfaces that
// consume it are unchanged. Writes go to the backend; reads are refreshed from it.

export type OnboardingAnswers = {
  role?: string;
  aiUsage?: string;
  goal?: string;
};

export type CompletedRep = {
  attemptId: string;
  missionId: string;
  title: string;
  shown: Competency[];
  at: number;
};

// The next-rep recommendation, derivable from the latest stored evaluation. Kept
// in state (not just sessionStorage) so the Field shows the right assignment and
// gap even on a cold load in a fresh tab, where lastDebrief is absent.
export type Recommendation = {
  nextMissionId: string;
  practice: Competency;
};

type FieldState = {
  hydrated: boolean;
  userId: string | null;
  isAnonymous: boolean;
  onboarded: boolean;
  onboarding: OnboardingAnswers;
  profile: Profile;
  completed: CompletedRep[];
  recommendation: Recommendation | null;
  lastDebrief: Debrief | null;
};

type FieldContextValue = FieldState & {
  saveOnboarding: (a: OnboardingAnswers, markDone: boolean) => Promise<void>;
  setLastDebrief: (d: Debrief) => void;
  refresh: () => Promise<void>;
  resetAll: () => Promise<void>;
  // Upgrade the current anonymous user to a permanent Google account IN PLACE —
  // same auth.users.id, so every attempt/evaluation/competency row stays attached
  // (RLS unchanged). Kicks off the OAuth redirect; the round-trip returns via
  // /auth/callback. Throws if the client is absent or Supabase rejects the link.
  linkGoogle: () => Promise<void>;
};

const DEBRIEF_KEY = "ai-field-last-debrief";

const DEFAULT: FieldState = {
  hydrated: false,
  userId: null,
  isAnonymous: true,
  onboarded: false,
  onboarding: {},
  profile: { ...FRESH_PROFILE },
  completed: [],
  recommendation: null,
  lastDebrief: null,
};

const FieldContext = createContext<FieldContextValue | null>(null);

// -- helpers that read the user's own rows (RLS enforces ownership) ------------

async function loadProfileRow(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("role, ai_usage, goal, onboarded")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

async function loadCompetencies(supabase: SupabaseClient, userId: string): Promise<Profile> {
  const { data } = await supabase
    .from("user_competencies")
    .select("competency, score")
    .eq("user_id", userId);
  const p: Profile = { ...FRESH_PROFILE };
  for (const row of data ?? []) {
    if (row.competency in p) p[row.competency as Competency] = row.score as number;
  }
  return p;
}

type CompletedRow = {
  id: string;
  mission_id: string;
  updated_at: string;
  // 1:1 embed (evaluations.attempt_id is UNIQUE); PostgREST may hand it back as
  // an object or a single-element array depending on version.
  evaluations:
    | { competency_results: CompetencyMove[] }
    | { competency_results: CompetencyMove[] }[]
    | null;
};

async function loadCompleted(supabase: SupabaseClient): Promise<CompletedRep[]> {
  // One round-trip: each evaluated attempt with its evaluation embedded. RLS
  // scopes the rows to the caller.
  const { data: attempts } = await supabase
    .from("challenge_attempts")
    .select("id, mission_id, updated_at, evaluations(competency_results)")
    .eq("status", "evaluated")
    .order("updated_at", { ascending: false });
  if (!attempts?.length) return [];

  const seen = new Set<string>();
  const out: CompletedRep[] = [];
  for (const a of attempts as unknown as CompletedRow[]) {
    if (seen.has(a.mission_id)) continue; // most recent per mission
    seen.add(a.mission_id);
    const ev = Array.isArray(a.evaluations) ? a.evaluations[0] : a.evaluations;
    const moves = ev?.competency_results ?? [];
    const shown = moves
      .filter((m) => m.moved && m.after !== "not_shown")
      .map((m) => m.competency);
    out.push({
      attemptId: a.id,
      missionId: a.mission_id,
      title: getMission(a.mission_id)?.title ?? a.mission_id,
      shown,
      at: new Date(a.updated_at).getTime(),
    });
  }
  return out;
}

// The current gap is the judge's practice_competency from the most recent
// evaluation — the single authority behind the recommendation. Pulled as just
// that one string via a JSON arrow, so it's a tiny query that runs in parallel
// with the rest of the load instead of a second sequential round-trip.
async function loadLatestPractice(supabase: SupabaseClient): Promise<Competency | null> {
  const { data } = await supabase
    .from("evaluations")
    .select("practice:raw_evaluation->>practice_competency")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const practice = (data as { practice?: string } | null)?.practice;
  return (practice as Competency | undefined) ?? null;
}

// Pure: same authority (recommendNext) the server uses, so no duplicated state.
function buildRecommendation(
  practice: Competency | null,
  completedIds: string[],
): Recommendation | null {
  if (!practice) return null;
  return { nextMissionId: recommendNext(practice, completedIds), practice };
}

export function FieldProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FieldState>(DEFAULT);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  // Bootstrap: sign in anonymously, then load the profile + progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Restore an in-flight debrief (survives a refresh on the debrief page).
      let lastDebrief: Debrief | null = null;
      try {
        const raw = sessionStorage.getItem(DEBRIEF_KEY);
        if (raw) lastDebrief = JSON.parse(raw);
      } catch {
        /* ignore */
      }

      try {
        const { supabase, user } = await ensureAnonymousUser();
        supabaseRef.current = supabase as unknown as SupabaseClient;
        if (!user) throw new Error("no anonymous user");

        // Bind analytics identity to the anonymous user; until this runs, all
        // product events are a no-op (no userId → no event).
        identifyUser(user.id);

        const client = supabase as unknown as SupabaseClient;
        const [profileRow, profile, completed, practice] = await Promise.all([
          loadProfileRow(client, user.id),
          loadCompetencies(client, user.id),
          loadCompleted(client),
          loadLatestPractice(client),
        ]);
        if (cancelled) return;

        const recommendation = buildRecommendation(
          practice,
          completed.map((c) => c.missionId),
        );

        // `is_anonymous` is read from the LOCAL session (getSession, no refresh),
        // and that claim can lag the real state right after a Google link —
        // leaving a signed-in user still marked anonymous (so the sign-out control
        // and the "already saved" logic misfire). A genuinely anonymous user has
        // no email and only the "anonymous" provider, so treat any real identity
        // as non-anonymous regardless of the possibly-stale flag.
        const providers = (user.app_metadata?.providers ?? []) as string[];
        const hasRealIdentity =
          !!user.email || providers.some((p) => p && p !== "anonymous");

        setState({
          hydrated: true,
          userId: user.id,
          isAnonymous: (user.is_anonymous ?? true) && !hasRealIdentity,
          onboarded: !!profileRow?.onboarded,
          onboarding: {
            role: profileRow?.role ?? undefined,
            aiUsage: profileRow?.ai_usage ?? undefined,
            goal: profileRow?.goal ?? undefined,
          },
          profile,
          completed,
          recommendation,
          lastDebrief,
        });
      } catch {
        // Backend unreachable/misconfigured — still let the app render.
        if (!cancelled) setState((s) => ({ ...s, hydrated: true, lastDebrief }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    const supabase = supabaseRef.current;
    const userId = state.userId;
    if (!supabase || !userId) return;
    const [profile, completed, practice] = await Promise.all([
      loadCompetencies(supabase, userId),
      loadCompleted(supabase),
      loadLatestPractice(supabase),
    ]);
    const recommendation = buildRecommendation(
      practice,
      completed.map((c) => c.missionId),
    );
    setState((s) => ({ ...s, profile, completed, recommendation }));
  }, [state.userId]);

  const saveOnboarding = useCallback(
    async (a: OnboardingAnswers, markDone: boolean) => {
      // Optimistic local update so navigation feels instant.
      setState((s) => ({
        ...s,
        onboarding: { ...s.onboarding, ...a },
        onboarded: markDone ? true : s.onboarded,
      }));
      const supabase = supabaseRef.current;
      const userId = state.userId;
      if (!supabase || !userId) return;
      const merged = { ...state.onboarding, ...a };
      try {
        await supabase.from("profiles").upsert(
          {
            user_id: userId,
            role: merged.role ?? null,
            ai_usage: merged.aiUsage ?? null,
            goal: merged.goal ?? null,
            onboarded: markDone ? true : state.onboarded,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      } catch {
        // Best-effort: local state already reflects the choice; a failed write
        // just means the answers aren't persisted across a reload.
      }
    },
    [state.userId, state.onboarding, state.onboarded],
  );

  const setLastDebrief = useCallback((d: Debrief) => {
    // Keep the recommendation consistent with the debrief immediately, before the
    // next refresh reloads it from the backend.
    setState((s) => ({
      ...s,
      lastDebrief: d,
      recommendation: { nextMissionId: d.nextMissionId, practice: d.practice },
    }));
    try {
      sessionStorage.setItem(DEBRIEF_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, []);

  const linkGoogle = useCallback(async () => {
    const supabase = supabaseRef.current;
    if (!supabase) throw new Error("no supabase client");
    // In-place identity upgrade: the anon user gains a Google identity, keeping
    // the same id. Redirects to Google; returns through /auth/callback → /field.
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/field` },
    });
    if (error) throw error;
  }, []);

  const resetAll = useCallback(async () => {
    try {
      sessionStorage.removeItem(DEBRIEF_KEY);
      // Discard the analytics identity + dedup state so the next anonymous user
      // starts on a fresh distinct_id.
      resetAnalytics();
      await supabaseRef.current?.auth.signOut();
    } catch {
      /* ignore */
    }
    setState({ ...DEFAULT, hydrated: true });
  }, []);

  return (
    <FieldContext.Provider
      value={{ ...state, saveOnboarding, setLastDebrief, refresh, resetAll, linkGoogle }}
    >
      {children}
    </FieldContext.Provider>
  );
}

export function useField(): FieldContextValue {
  const ctx = useContext(FieldContext);
  if (!ctx) throw new Error("useField must be used within FieldProvider");
  return ctx;
}

export { scoreToBand };
