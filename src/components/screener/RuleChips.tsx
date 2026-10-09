import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { Chip, ChipModel, CompiledQuery, MetricStore } from "@/lib/contracts";
import { fromChips, hasComments, toChips } from "@/lib/query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RuleChip } from "./RuleChip";

export interface RuleChipsProps {
  store: MetricStore;
  /** The current query text and its compiled form. */
  draft: string;
  compiled: CompiledQuery | null;
  /** Called with the new query text whenever a chip changes. */
  onQueryChange: (text: string) => void;
  /** Switch to Query mode (for advanced rules and for fixing errors). */
  onEditAsText: () => void;
}

const EMPTY: ChipModel = { chips: [], tail: "" };

/** Simple rules: one chip per top-level clause, kept in two-way sync with the query text. */
export function RuleChips({ store, draft, compiled, onQueryChange, onEditAsText }: RuleChipsProps) {
  const [model, setModel] = useState<ChipModel>(() => (compiled && compiled.ok ? toChips(compiled) : EMPTY));
  const [source, setSource] = useState(draft);
  const [beginner, setBeginner] = useState(true);
  const counter = useRef(0);

  // The text changed somewhere else (Query mode, a template, a link): rebuild the chips from it.
  if (draft !== source && compiled && compiled.ok) {
    setModel(toChips(compiled));
    setSource(draft);
  }

  const update = (next: ChipModel) => {
    const text = fromChips(next);
    setModel(next);
    setSource(text);
    onQueryChange(text);
  };
  const change = (id: string, chip: Chip) => update({ ...model, chips: model.chips.map((c) => (c.id === id ? chip : c)) });
  const remove = (id: string) => update({ ...model, chips: model.chips.filter((c) => c.id !== id) });
  const add = () => {
    counter.current += 1;
    const chip: Chip = { kind: "simple", id: `n${counter.current}`, metric: "", selector: null, op: ">", value: "", value2: "" };
    setModel({ ...model, chips: [...model.chips, chip] });
  };

  const broken = compiled !== null && !compiled.ok && draft !== source;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="type-caption">Every rule must hold for a company to be listed.</p>
        <div className="flex min-h-11 shrink-0 items-center gap-2 lg:min-h-8">
          <Switch id="beginner-view" checked={beginner} onCheckedChange={setBeginner} />
          <Label htmlFor="beginner-view" className="text-xs">Beginner view</Label>
        </div>
      </div>
      {broken && (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          <p>The query has an error, so the rules below may be out of date. Fix it in Query mode.</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={onEditAsText}>Open Query mode</Button>
        </div>
      )}
      {model.chips.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          No rules yet. Add a rule, or start from a template above. With no rules, every company in the universe is shown.
        </p>
      ) : (
        <ul className="space-y-2">
          {model.chips.map((chip, i) => (
            <RuleChip
              key={chip.id}
              chip={chip}
              index={i}
              store={store}
              beginner={beginner}
              onChange={(c) => change(chip.id, c)}
              onRemove={() => remove(chip.id)}
              onEditAsText={onEditAsText}
            />
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="min-h-11 w-full border-dashed lg:min-h-9" onClick={add}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Add rule
      </Button>
      {model.tail && (
        <p className="text-sm text-muted-foreground">
          Ordering and limit kept from your query: <code className="font-mono">{model.tail}</code>. Edit them in Query mode.
        </p>
      )}
      {hasComments(draft) && <p className="text-sm text-muted-foreground">Comments are kept only in Query mode.</p>}
    </div>
  );
}
