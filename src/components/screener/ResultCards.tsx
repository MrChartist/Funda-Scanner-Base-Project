import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import type { DisplaySort } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyName } from "@/components/common/CompanyName";
import { MAX_COMPARE, clauseResults, companyPath, passCount } from "./helpers";
import { ColumnValue, PaginationBar, type ResultRowsProps } from "./ResultsTable";

export interface ResultCardsProps extends ResultRowsProps {
  sort: DisplaySort | null;
  onSort: (s: DisplaySort) => void;
  page: number;
  pageSize: 25 | 50 | 100;
  onPage: (p: number) => void;
  onPageSize: (n: 25 | 50 | 100) => void;
}

/** Mobile results (below 768 px): one card per company, never a wide table. */
export function ResultCards(props: ResultCardsProps) {
  const { run, store, rows, positions, compared, onToggleCompare, onWhy, sort, onSort, page, pageSize, onPage, onPageSize } = props;
  const synthetic = store.meta.isSynthetic;
  const keys = [{ key: "name", label: "Name" }, ...run.columns.map((c) => ({ key: c.key, label: c.short }))];
  const full = compared.length >= MAX_COMPARE;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="card-sort" className="text-sm">Sort by</Label>
          <Select value={sort?.key} onValueChange={(v) => onSort({ key: v, dir: v === "name" ? "asc" : "desc" })}>
            <SelectTrigger id="card-sort" className="min-h-11 w-44 text-sm"><SelectValue placeholder="Market capitalisation" /></SelectTrigger>
            <SelectContent>
              {keys.map((k) => <SelectItem key={k.key} value={k.key} className="min-h-11">{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {sort && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}>
            {sort.dir === "asc" ? "Ascending" : "Descending"}
          </Button>
        )}
      </div>
      <ul className="space-y-3">
        {rows.map((i) => {
          const symbol = store.symbols[i];
          const name = store.company(i).name;
          const results = clauseResults(run, positions.get(i));
          const key3 = run.columns.slice(0, 3);
          const checked = compared.includes(symbol);
          return (
            <li key={symbol} className="rounded-lg border bg-card p-4" aria-label={name}>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={checked}
                  disabled={!checked && full}
                  onCheckedChange={() => onToggleCompare(symbol)}
                  aria-label={`Add ${name} to compare`}
                  className="relative mt-1 h-5 w-5 shrink-0 before:absolute before:-inset-3 before:content-['']"
                />
                <div className="min-w-0 flex-1">
                  <Link to={companyPath(symbol)} className="inline-flex min-h-11 items-center text-base font-semibold text-primary underline-offset-2 hover:underline">
                    <CompanyName name={name} isSynthetic={synthetic} symbol={symbol} showSymbol />
                  </Link>
                  <p className="text-sm text-muted-foreground">{store.sector(i)}</p>
                </div>
                {results.length > 0 && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span>{passCount(results)}/{results.length}</span>
                    <span className="sr-only"> rules passed</span>
                  </span>
                )}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                {key3.map((c) => (
                  <div key={c.key}>
                    <dt className="text-xs text-muted-foreground">{c.short}</dt>
                    <dd><ColumnValue column={c} store={store} index={i} /></dd>
                  </div>
                ))}
              </dl>
              <Button type="button" variant="ghost" className="mt-1 min-h-11 px-0 text-primary" onClick={() => onWhy(i)} aria-label={`Why ${name} matched`}>
                Why it matched ▸
              </Button>
            </li>
          );
        })}
      </ul>
      <PaginationBar total={run.matched.length} page={page} pageSize={pageSize} onPage={onPage} onPageSize={onPageSize} />
    </div>
  );
}
