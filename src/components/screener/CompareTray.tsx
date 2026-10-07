import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { MAX_COMPARE } from "./helpers";

export interface CompareTrayProps {
  store: MetricStore;
  symbols: readonly string[];
  onRemove: (symbol: string) => void;
  onClear: () => void;
}

/** Companies picked in the results, ready to open in Compare (up to four). */
export function CompareTray({ store, symbols, onRemove, onClear }: CompareTrayProps) {
  if (symbols.length === 0) return null;
  const href = `/compare?symbols=${symbols.map(encodeURIComponent).join(",")}`;
  return (
    <aside aria-label="Compare tray" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background p-3 shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Compare ({symbols.length} of {MAX_COMPARE})</p>
        <ul className="flex flex-1 flex-wrap gap-2">
          {symbols.map((s) => {
            const i = store.indexOf(s);
            const name = i >= 0 ? store.company(i).name : s;
            return (
              <li key={s} className="inline-flex items-center rounded-full border bg-muted pl-3 text-sm">
                <span className="max-w-[10rem] truncate">{s}</span>
                <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${name} from compare`} onClick={() => onRemove(s)}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="outline" className="min-h-11" onClick={onClear}>Clear</Button>
        {symbols.length >= 2 ? (
          <Button asChild className="min-h-11"><Link to={href}>Compare now</Link></Button>
        ) : (
          <span className="text-sm text-muted-foreground">Pick at least two companies.</span>
        )}
      </div>
    </aside>
  );
}
