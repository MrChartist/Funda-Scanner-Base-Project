// src/hooks/use-learn-mode.tsx — whether the short explanations on the Dashboard are shown.
// Stored under "funda-learn-mode"; on by default.
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { learnModeStore } from "@/lib/user/learn-mode";

interface LearnModeContextValue {
  learnMode: boolean;
  setLearnMode: (on: boolean) => void;
}

const LearnModeContext = createContext<LearnModeContextValue | null>(null);

function useLearnModeValue(): LearnModeContextValue {
  const raw = useSyncExternalStore(learnModeStore.subscribe, learnModeStore.snapshot, learnModeStore.snapshot);
  const learnMode = useMemo(() => learnModeStore.parse(raw), [raw]);
  const setLearnMode = useCallback((on: boolean) => {
    learnModeStore.save(on);
  }, []);
  return { learnMode, setLearnMode };
}

export function LearnModeProvider({ children }: { children: ReactNode }) {
  const value = useLearnModeValue();
  return <LearnModeContext.Provider value={value}>{children}</LearnModeContext.Provider>;
}

export function useLearnMode(): LearnModeContextValue {
  const ctx = useContext(LearnModeContext);
  const fallback = useLearnModeValue();
  return ctx ?? fallback;
}
