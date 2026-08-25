"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import type { Competency } from "./missions/types";
import { FRESH_PROFILE, Profile, scoreToBand } from "./competencies";
import { examine, Session, Debrief } from "./mock/examiner";

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
  onboarded: boolean;
  onboarding: OnboardingAnswers;
  profile: Profile;
  completed: CompletedRep[];
  lastDebrief: Debrief | null;
};

type FieldContextValue = FieldState & {
  saveOnboarding: (a: OnboardingAnswers, markDone: boolean) => void;
  submitAttempt: (session: Session) => Debrief;
  resetAll: () => void;
};

const STORAGE_KEY = "ai-field-state-v1";

const DEFAULT: FieldState = {
  hydrated: false,
  onboarded: false,
  onboarding: {},
  profile: { ...FRESH_PROFILE },
  completed: [],
  lastDebrief: null,
};

const FieldContext = createContext<FieldContextValue | null>(null);

function load(): Partial<FieldState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(s: FieldState) {
  try {
    const { hydrated, ...rest } = s;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* storage may be unavailable; the app still works for the session */
  }
}

export function FieldProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FieldState>(DEFAULT);

  useEffect(() => {
    const saved = load();
    setState((s) => ({ ...s, ...saved, hydrated: true }));
  }, []);

  useEffect(() => {
    if (state.hydrated) persist(state);
  }, [state]);

  const saveOnboarding = useCallback(
    (a: OnboardingAnswers, markDone: boolean) => {
      setState((s) => ({
        ...s,
        onboarding: { ...s.onboarding, ...a },
        onboarded: markDone ? true : s.onboarded,
      }));
    },
    [],
  );

  const submitAttempt = useCallback((session: Session): Debrief => {
    let debrief!: Debrief;
    setState((s) => {
      const completedIds = s.completed.map((c) => c.missionId);
      debrief = examine(session, s.profile, completedIds);
      const shown = debrief.moves
        .filter((m) => m.after !== "not_shown" && m.moved)
        .map((m) => m.competency);
      const rep: CompletedRep = {
        missionId: session.mission.id,
        title: session.mission.title,
        shown,
        at: Date.now(),
      };
      const completed = [
        rep,
        ...s.completed.filter((c) => c.missionId !== session.mission.id),
      ];
      return {
        ...s,
        profile: debrief.newProfile,
        completed,
        lastDebrief: debrief,
      };
    });
    return debrief;
  }, []);

  const resetAll = useCallback(() => {
    setState({ ...DEFAULT, hydrated: true });
  }, []);

  return (
    <FieldContext.Provider
      value={{ ...state, saveOnboarding, submitAttempt, resetAll }}
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
