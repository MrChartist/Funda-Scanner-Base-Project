import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { useDataset } from "@/hooks/use-dataset";
import { EmptyState } from "@/components/common/EmptyState";
import { CompareHistory } from "@/components/compare/CompareHistory";
import { CompareTable } from "@/components/compare/CompareTable";
import { CompanyPicker } from "@/components/compare/CompanyPicker";
import { buildCompare, MAX_COMPARE, parseSymbols } from "@/components/compare/compare-view";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/layout";
import { INSIGHTS_FOOTER } from "@/lib/insights";

function ReadyCompare({ store }: { store: Extract<ReturnType<typeof useDataset>, { status: "ready" }>["store"] }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("symbols");
  const parsed = useMemo(() => parseSymbols(raw, store), [raw, store]);
  const model = useMemo(() => buildCompare(store, parsed.indices), [store, parsed.indices]);
  const symbols = parsed.indices.map((i) => store.symbols[i]);

  const write = (list: readonly string[]) => setParams(list.length > 0 ? { symbols: list.join(",") } : {}, { replace: true });
  const everything = [...symbols, ...parsed.unknown];

  return (
    <>
      <CompanyPicker store={store} chosen={symbols} disabled={symbols.length >= MAX_COMPARE} onAdd={(s) => write([...everything, s])} />

      {parsed.unknown.length > 0 && (
        <ul className="space-y-1" aria-label="Symbols not in your data">
          {parsed.unknown.map((s) => (
            <li key={s} className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-1 text-sm">
              <span className="font-mono">{s}</span>
              <span className="text-muted-foreground">Not in your data</span>
              <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1" onClick={() => write(everything.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                <X className="h-4 w-4" aria-hidden="true" /> Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {parsed.overflow.length > 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          Only {MAX_COMPARE} companies can be compared at a time. Not shown: {parsed.overflow.join(", ")}.
        </p>
      )}

      {symbols.length === 0 ? (
        <EmptyState title="Choose companies to compare" description={`Add up to ${MAX_COMPARE} companies from the data you are viewing. Two or more are needed to see who leads on each figure.`} />
      ) : (
        <>
          {symbols.length === 1 && <p className="text-sm text-muted-foreground" role="status">Add one more company to see who leads on each figure.</p>}
          <CompareTable store={store} indices={parsed.indices} model={model} onRemove={(s) => write(everything.filter((x) => x !== s))} />
          <p className="text-xs text-muted-foreground">
            "Leads" marks the better value in a row by the usual reading of that figure (for example higher return or lower debt). Figures with no better side are not counted. The industry median is that of the first company's industry. {INSIGHTS_FOOTER}
          </p>
          <section aria-labelledby="compare-history-title" className="rounded-lg border bg-card p-3 sm:p-4">
            <h2 id="compare-history-title" className="mb-3 text-base font-semibold">Ten-year history</h2>
            <CompareHistory store={store} indices={parsed.indices} />
          </section>
        </>
      )}
    </>
  );
}

export default function Compare() {
  const state = useDataset();
  return (
    <PageShell>
      <PageHeader title="Compare companies" description="Side-by-side figures for companies in the data you are viewing." />
      {state.status === "loading" && <div role="status" aria-live="polite" className="py-20 text-center text-sm text-muted-foreground">Loading company data…</div>}
      {state.status === "error" && (
        <EmptyState title="The data could not be loaded." description={state.message} action={<Button type="button" variant="outline" className="min-h-11" onClick={state.retry}>Try again</Button>} />
      )}
      {state.status === "ready" && <ReadyCompare store={state.store} />}
    </PageShell>
  );
}
