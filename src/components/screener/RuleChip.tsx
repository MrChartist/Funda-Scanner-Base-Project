import { X } from "lucide-react";
import type { Chip, CmpOp, MetricStore, TypeTest } from "@/lib/contracts";
import { TYPE_TESTS, isChipComplete, printSelector } from "@/lib/query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MetricPicker } from "./MetricPicker";
import { OPERATOR_LABEL, UNIT_SUFFIX, periodOptions } from "./helpers";

const OPERATORS = Object.keys(OPERATOR_LABEL) as (CmpOp | "between")[];

const TYPE_LABEL: Readonly<Record<TypeTest, string>> = {
  bank: "a bank", nbfc: "an NBFC", insurer: "an insurer", lender: "a bank or NBFC", financial: "a financial company",
  non_financial: "a non-financial company", consolidated: "reported on a consolidated basis", standalone: "reported on a standalone basis",
};

export interface RuleChipProps {
  chip: Chip;
  index: number;
  store: MetricStore;
  beginner: boolean;
  onChange: (chip: Chip) => void;
  onRemove: () => void;
  onEditAsText: () => void;
}

/** One editable rule: metric, period, comparison and value, with the unit always visible. */
export function RuleChip({ chip, index, store, beginner, onChange, onRemove, onEditAsText }: RuleChipProps) {
  const n = index + 1;
  const complete = isChipComplete(chip);
  const shell = cn("flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2.5", !complete && "border-dashed border-amber-500/60");
  const remove = (
    <Button type="button" variant="ghost" size="icon" className="ml-auto h-11 w-11 shrink-0 lg:h-9 lg:w-9" aria-label={`Remove rule ${n}`} onClick={onRemove}>
      <X className="h-4 w-4" aria-hidden="true" />
    </Button>
  );

  if (chip.kind === "advanced") {
    return (
      <li className={shell} aria-label={`Rule ${n}`}>
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">Advanced rule</span>
        <span className="min-w-[14rem] flex-1 basis-full text-sm sm:basis-0">{chip.english}</span>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onEditAsText}>Edit as text</Button>
        {remove}
      </li>
    );
  }

  if (chip.kind === "type") {
    return (
      <li className={shell} aria-label={`Rule ${n}`}>
        <span className="text-sm">Company</span>
        <Select value={chip.negated ? "is_not" : "is"} onValueChange={(v) => onChange({ ...chip, negated: v === "is_not" })}>
          <SelectTrigger aria-label={`Rule ${n} is or is not`} className="min-h-11 w-28 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="is" className="min-h-11">is</SelectItem>
            <SelectItem value="is_not" className="min-h-11">is not</SelectItem>
          </SelectContent>
        </Select>
        <Select value={chip.test} onValueChange={(v) => onChange({ ...chip, test: v as TypeTest })}>
          <SelectTrigger aria-label={`Rule ${n} company type`} className="min-h-11 min-w-[12rem] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_TESTS.map((t) => <SelectItem key={t} value={t} className="min-h-11">{TYPE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        {remove}
      </li>
    );
  }

  const def = chip.metric ? store.def(chip.metric) : undefined;
  const unit = def ? UNIT_SUFFIX[def.unit] : "";
  const periods = chip.metric && !chip.selector ? periodOptions(store, chip.metric) : [];
  const setMetric = (base: string) => onChange({ ...chip, metric: base, selector: null, value: "", value2: "" });
  const valueInput = (which: "value" | "value2", labelText: string) => (
    <span className="inline-flex items-center gap-1">
      <Input
        inputMode="decimal"
        aria-label={labelText}
        value={chip[which]}
        onChange={(e) => onChange({ ...chip, [which]: e.target.value })}
        className="min-h-11 w-24 text-sm lg:min-h-9"
      />
      {unit && <span className="text-sm text-muted-foreground" data-testid="unit-suffix">{unit}</span>}
    </span>
  );

  return (
    <li className={shell} aria-label={`Rule ${n}`}>
      <div className="flex basis-full items-center gap-1">
        <div className="min-w-0 flex-1"><MetricPicker store={store} value={chip.metric} onChange={setMetric} beginner={beginner} label={`Rule ${n} metric`} /></div>
        {remove}
      </div>
      {periods.length > 1 && (
        <Select value={chip.metric} onValueChange={(v) => onChange({ ...chip, metric: v })}>
          <SelectTrigger aria-label={`Rule ${n} period`} className="min-h-11 min-w-[8rem] flex-1 text-sm lg:min-h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((p) => <SelectItem key={p.id} value={p.id} className="min-h-11">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {chip.selector && <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{printSelector(chip.selector)}</span>}
      <Select value={chip.op} onValueChange={(v) => onChange({ ...chip, op: v as CmpOp | "between" })}>
        <SelectTrigger aria-label={`Rule ${n} comparison`} className="min-h-11 w-36 text-sm lg:min-h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPERATORS.map((o) => <SelectItem key={o} value={o} className="min-h-11">{OPERATOR_LABEL[o]}</SelectItem>)}
        </SelectContent>
      </Select>
      {valueInput("value", `Rule ${n} value`)}
      {chip.op === "between" && (
        <>
          <span className="text-sm">and</span>
          {valueInput("value2", `Rule ${n} upper value`)}
        </>
      )}
      {!complete && <p className="basis-full text-sm text-amber-700 dark:text-amber-400">Incomplete. Not applied.</p>}
    </li>
  );
}
