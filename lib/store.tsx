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
import { ensureAnonymousUser } from "./supabase/bootstrap";

// The app's client-side state, now backed by Supabase (RLS-scoped to the signed-in
// anonymous user). The shape of useField() is kept stable so the surfaces that
// consume it are unchanged. Writes go to the backend; reads are refreshed from it.

export type OnboardingAnswers = {
  role?: string;
  aiUsage?: string;
  goal?: string;
};

export type CompletedRep = {
  missionId: string;
  title: string;
  shown: Competency[];
  at: number;
};

type FieldState = {
  hydrated: boolean;
  userId: string | null;
  onboarded: boolean;
  onboarding: OnboardingAnswers;
  profile: Profile;
  completed: CompletedRep[];
  lastDebrief: Debrief | null;
};

type FieldContextValue = FieldState & {
  saveOnboarding: (a: OnboardingAnswers, markDone: boolean) => Promise<void>;
  setLastDebrief: (d: Debrief) => void;
  refresh: () => Promise<void>;
  resetAll: () => Promise<void>;
};

const DEBRIEF_KEY = "ai-field-last-debrief";

const DEFAULT: FieldState = {
  hydrated: false,
  userId: null,
  onboarded: false,
  onboarding: {},
  profile: { ...FRESH_PROFILE },
  completed: [],
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

async function loadCompleted(supabase: SupabaseClient, userId: string): Promise<CompletedRep[]> {
  const { data: attempts } = await supabase
    .from("challenge_attempts")
    .select("id, mission_id, updated_at")
    .eq("status", "evaluated")
    .order("updated_at", { ascending: false });
  if (!attempts?.length) return [];

  const ids = attempts.map((a) => a.id);
  const { data: evals } = await supabase
    .from("evaluations")
    .select("attempt_id, competency_results")
    .in("attempt_id", ids);
  const movesByAttempt = new Map<string, CompetencyMove[]>(
    (evals ?? []).map((e) => [e.attempt_id as string, (e.competency_results as CompetencyMove[]) ?? []]),
  );

  const seen = new Set<string>();
  const out: CompletedRep[] = [];
  for (const a of attempts) {
    if (seen.has(a.mission_id)) continue; // most recent per mission
    seen.add(a.mission_id);
    const moves = movesByAttempt.get(a.id) ?? [];
    const shown = moves
      .filter((m) => m.moved && m.after !== "not_shown")
      .map((m) => m.competency);
    out.push({
      missionId: a.mission_id,
      title: getMission(a.mission_id)?.title ?? a.mission_id,
      shown,
      at: new Date(a.updated_at as string).getTime(),
    });
  }
  return out;
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

        const [profileRow, profile, completed] = await Promise.all([
          loadProfileRow(supabase as unknown as SupabaseClient, user.id),
          loadCompetencies(supabase as unknown as SupabaseClient, user.id),
          loadCompleted(supabase as unknown as SupabaseClient, user.id),
        ]);
        if (cancelled) return;

        setState({
          hydrated: true,
          userId: user.id,
          onboarded: !!profileRow?.onboarded,
          onboarding: {
            role: profileRow?.role ?? undefined,
            aiUsage: profileRow?.ai_usage ?? undefined,
            goal: profileRow?.goal ?? undefined,
          },
          profile,
          completed,
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
    const [profile, completed] = await Promise.all([
      loadCompetencies(supabase, userId),
      loadCompleted(supabase, userId),
    ]);
    setState((s) => ({ ...s, profile, completed }));
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
    setState((s) => ({ ...s, lastDebrief: d }));
    try {
      sessionStorage.setItem(DEBRIEF_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, []);

  const resetAll = useCallback(async () => {
    try {
      sessionStorage.removeItem(DEBRIEF_KEY);
      await supabaseRef.current?.auth.signOut();
    } catch {
      /* ignore */
    }
    setState({ ...DEFAULT, hydrated: true });
  }, []);

  return (
    <FieldContext.Provider
      value={{ ...state, saveOnboarding, setLastDebrief, refresh, resetAll }}
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
