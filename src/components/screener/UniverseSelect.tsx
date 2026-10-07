import { useMemo } from "react";
import type { MetricStore, UniverseSpec } from "@/lib/contracts";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { universeFromValue, universeValue } from "./helpers";

export interface UniverseSelectProps {
  store: MetricStore;
  value: UniverseSpec;
  onChange: (u: UniverseSpec) => void;
}

function distinct(n: number, pick: (i: number) => string): string[] {
  const set = new Set<string>();
  for (let i = 0; i < n; i++) {
    const s = pick(i).trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Which companies to screen: everyone, your lists, one sector or one industry. */
export function UniverseSelect({ store, value, onChange }: UniverseSelectProps) {
  const sectors = useMemo(() => distinct(store.size, (i) => store.sector(i)), [store]);
  const industries = useMemo(() => distinct(store.size, (i) => store.industry(i)).filter((x) => !sectors.includes(x)), [store, sectors]);
  const match = (list: string[], want: string) => list.find((s) => s.toLowerCase() === want.trim().toLowerCase());
  const matchedSector = value.kind === "sector" ? match(sectors, value.sector) : undefined;
  const matchedIndustry = value.kind === "industry" ? match(industries, value.industry) : undefined;
  const current = matchedSector ? `sector:${matchedSector}` : matchedIndustry ? `industry:${matchedIndustry}` : universeValue(value);
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor="universe-select" className="text-sm">Companies to screen</Label>
      <Select value={current} onValueChange={(v) => onChange(universeFromValue(v, value))}>
        <SelectTrigger id="universe-select" className="min-h-11 w-full text-sm sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectGroup>
            <SelectItem value="all" className="min-h-11">All companies</SelectItem>
            <SelectItem value="watchlist" className="min-h-11">My watchlist</SelectItem>
            <SelectItem value="portfolio" className="min-h-11">My portfolio</SelectItem>
            {value.kind === "symbols" && <SelectItem value="symbols" className="min-h-11">Chosen companies ({value.symbols.length})</SelectItem>}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Sector</SelectLabel>
            {sectors.map((s) => <SelectItem key={s} value={`sector:${s}`} className="min-h-11">{s}</SelectItem>)}
            {value.kind === "sector" && !sectors.some((s) => s.toLowerCase() === value.sector.trim().toLowerCase()) && (
              <SelectItem value={current} className="min-h-11">{value.sector}</SelectItem>
            )}
          </SelectGroup>
          {industries.length > 0 && (
            <SelectGroup>
              <SelectLabel>Industry</SelectLabel>
              {industries.map((s) => <SelectItem key={s} value={`industry:${s}`} className="min-h-11">{s}</SelectItem>)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
