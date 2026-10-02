import { useSyncExternalStore } from "react";
import { getDataProvider, subscribeDataProvider, type DataProvider } from "@/lib/data-provider";

/** Current data provider; re-renders when it is swapped (e.g. after an import). */
export function useDataProvider(): DataProvider {
  return useSyncExternalStore(subscribeDataProvider, getDataProvider, getDataProvider);
}
