// src/lib/user/learn-mode.ts — whether the short explanations on the Dashboard are shown (WS7).
import { STORAGE_KEYS } from "@/lib/contracts";
import { createLocalStore } from "./local-store";

export const learnModeStore = createLocalStore<boolean>({
  key: STORAGE_KEYS.learnMode,
  version: 1,
  normalise: (d) => d !== false,
  migrate: (raw) => (typeof raw === "boolean" ? raw : raw === "false" ? false : raw === "true" ? true : null),
  empty: () => true,
  backupKey: null,
});
