import { useMemo, useState } from "react";
import type { MetricId, MetricStore } from "@/lib/contracts";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricInfo } from "@/components/common/MetricInfo";
import { groupMetrics } from "./helpers";

export interface MetricPickerProps {
  store: MetricStore;
  /** Any metric id; a period variant selects its base metric. */
  value: MetricId;
  onChange: (baseId: MetricId) => void;
  /** Beginner view lists the basic metrics first. */
  beginner: boolean;
  label: string;
}

/** Grouped metric chooser (SelectGroup/SelectLabel) with an ⓘ card for the chosen metric. */
export function MetricPicker({ store, value, onChange, beginner, label }: MetricPickerProps) {
  // Radix keeps closed items mounted so it can show the chosen label; with ~90 metrics per rule
  // that is slow, so the full list is rendered only while the list is open.
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => (open ? groupMetrics(store, beginner) : []), [store, beginner, open]);
  const def = value ? store.def(value) : undefined;
  const base = def ? store.def(def.base) ?? def : undefined;
  return (
    <div className="flex items-center gap-1">
      <Select value={base ? base.id : undefined} onValueChange={onChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger aria-label={label} className="min-h-11 min-w-[11rem] flex-1 text-sm lg:min-h-9">
          <SelectValue placeholder="Choose a metric" />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {groups.map((g) => (
            <SelectGroup key={g.label}>
              <SelectLabel>{g.label}</SelectLabel>
              {g.defs.map((d) => (
                <SelectItem key={d.id} value={d.id} className="min-h-11 text-sm">
                  {d.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          {/* A metric id that is not in the picker (for example from a link) stays selectable text. */}
          {base && (!open || !groups.some((g) => g.defs.some((d) => d.id === base.id))) && (
            <SelectItem value={base.id} className="min-h-11 text-sm">{base.label}</SelectItem>
          )}
        </SelectContent>
      </Select>
      {base && <MetricInfo def={base} />}
    </div>
  );
}
