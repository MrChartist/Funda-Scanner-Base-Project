// src/lib/user/dashboard-layout.ts — which Dashboard widgets are shown, and in what order (WS7).
// v0 stored a bare { id, label, visible }[] under "funda-dashboard-layout", including widgets that no
// longer exist (market ticker, FII/DII feeds, movers). Unknown ids are dropped on read.
import { STORAGE_KEYS } from "@/lib/contracts";
import { createLocalStore } from "./local-store";

export const DASHBOARD_LAYOUT_VERSION = 2;

export interface DashboardWidgetDef {
  id: string;
  label: string;
}

export const DASHBOARD_WIDGETS: readonly DashboardWidgetDef[] = [
  { id: "dataset", label: "About your data" },
  { id: "guided", label: "Guided screens" },
  { id: "universe", label: "The universe at a glance" },
  { id: "sectors", label: "Sector medians" },
  { id: "spread", label: "How returns are spread" },
  { id: "learn", label: "Learn one metric" },
  { id: "recent", label: "Recently viewed" },
];

export interface DashboardLayoutItem {
  id: string;
  visible: boolean;
}

const KNOWN = new Set(DASHBOARD_WIDGETS.map((w) => w.id));

/** Keeps known ids once each, in stored order, then appends any widget that is missing. */
export function cleanLayout(list: unknown): DashboardLayoutItem[] {
  const out: DashboardLayoutItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(list)) {
    for (const item of list) {
      if (typeof item !== "object" || item === null) continue;
      const { id, visible } = item as { id?: unknown; visible?: unknown };
      if (typeof id !== "string" || !KNOWN.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, visible: visible !== false });
    }
  }
  for (const w of DASHBOARD_WIDGETS) if (!seen.has(w.id)) out.push({ id: w.id, visible: true });
  return out;
}

export const defaultLayout = (): DashboardLayoutItem[] => DASHBOARD_WIDGETS.map((w) => ({ id: w.id, visible: true }));

export const layoutStore = createLocalStore<DashboardLayoutItem[]>({
  key: STORAGE_KEYS.dashboardLayout,
  version: DASHBOARD_LAYOUT_VERSION,
  normalise: cleanLayout,
  migrate: (raw) => (Array.isArray(raw) ? cleanLayout(raw) : null),
  empty: defaultLayout,
  backupKey: null,
});
