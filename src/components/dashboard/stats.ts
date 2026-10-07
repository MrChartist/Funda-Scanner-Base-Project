// src/components/dashboard/stats.ts — sector medians over the loaded data. Groups never mix peer
// classes (a bank is not compared with a manufacturer), and every median carries its n.
import type { MetricId, MetricStore, PeerClass } from "@/lib/contracts";
import { PEER_MIN } from "@/lib/contracts";

export interface SectorRow {
  key: string;
  sector: string;
  peerClass: PeerClass;
  companies: number;
  /** Companies with a value for the metric. */
  n: number;
  /** Null when n is below PEER_MIN.median. */
  median: number | null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const PEER_CLASS_LABEL: Readonly<Record<PeerClass, string>> = {
  non_financial: "non-financial",
  bank: "banks",
  nbfc: "NBFCs",
  insurance: "insurers",
};

export function sectorMedians(store: MetricStore, metricId: MetricId): SectorRow[] {
  const column = store.column(metricId);
  const groups = new Map<string, { sector: string; peerClass: PeerClass; companies: number; values: number[] }>();
  for (let i = 0; i < store.size; i++) {
    const sector = store.sector(i) || "Unclassified";
    const peerClass = store.peerClass(i);
    const key = `${peerClass}::${sector}`;
    let g = groups.get(key);
    if (!g) {
      g = { sector, peerClass, companies: 0, values: [] };
      groups.set(key, g);
    }
    g.companies += 1;
    const v = column.values[i];
    if (Number.isFinite(v)) g.values.push(v);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      sector: g.sector,
      peerClass: g.peerClass,
      companies: g.companies,
      n: g.values.length,
      median: g.values.length >= PEER_MIN.median ? median(g.values) : null,
    }))
    .sort((a, b) => b.companies - a.companies || a.sector.localeCompare(b.sector));
}
