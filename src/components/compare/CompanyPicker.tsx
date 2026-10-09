import { useId, useState } from "react";
import { Plus } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CompanyPickerProps {
  store: MetricStore;
  /** Symbols already chosen. */
  chosen: readonly string[];
  disabled?: boolean;
  onAdd: (symbol: string) => void;
}

function stripFictional(name: string): string {
  return name.replace(/\s*\(fictional\)\s*$/i, "").trim().toLowerCase();
}

/** Picks a company from the loaded data by symbol or name. Nothing outside the dataset can be added. */
export function CompanyPicker({ store, chosen, disabled, onAdd }: CompanyPickerProps) {
  const listId = useId();
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const wanted = text.trim();
    if (!wanted) return;
    let symbol: string | null = null;
    const bySymbol = store.indexOf(wanted);
    if (bySymbol >= 0) symbol = store.symbols[bySymbol];
    else {
      const key = stripFictional(wanted);
      const found = store.symbols.find((s, i) => stripFictional(store.company(i).name) === key);
      symbol = found ?? null;
    }
    if (!symbol) {
      setProblem(`'${wanted}' is not in the data you are viewing.`);
      return;
    }
    if (chosen.includes(symbol)) {
      setProblem(`${symbol} is already in the comparison.`);
      return;
    }
    setProblem(null);
    setText("");
    onAdd(symbol);
  };

  return (
    <form onSubmit={submit} className="space-y-1" data-no-print>
      <label htmlFor={`${listId}-input`} className="text-sm font-medium">Add a company</label>
      <div className="flex gap-2">
        <Input
          id={`${listId}-input`}
          list={listId}
          value={text}
          onChange={(e) => { setText(e.target.value); setProblem(null); }}
          disabled={disabled}
          placeholder="Symbol or company name"
          autoComplete="off"
          className="min-h-11 text-base sm:text-sm"
          aria-describedby={problem ? `${listId}-problem` : undefined}
          aria-invalid={problem ? true : undefined}
        />
        <Button type="submit" disabled={disabled} className="min-h-11 gap-1"><Plus className="h-4 w-4" aria-hidden="true" /> Add</Button>
      </div>
      <datalist id={listId}>
        {store.symbols.map((s, i) => (
          <option key={s} value={s}>{store.company(i).name}</option>
        ))}
      </datalist>
      {disabled && <p className="text-sm text-muted-foreground">Four companies is the limit. Remove one to add another.</p>}
      {problem && <p id={`${listId}-problem`} role="alert" className="text-sm text-red-700 dark:text-red-400">{problem}</p>}
    </form>
  );
}
