import { Link } from "react-router-dom";
import { X } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";
import { ValueCell } from "@/components/common/ValueCell";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL } from "@/lib/views/company-view";
import type { CompareModel } from "./compare-view";

export interface CompareCardsProps {
  store: MetricStore;
  indices: readonly number[];
  model: CompareModel;
  onRemove: (symbol: string) => void;
}

/** One header card per company: name, type, reference price and market cap, how many figures it leads on, and a remove control. */
export function CompareCards({ store, indices, model, onRemove }: CompareCardsProps) {
  const synthetic = store.meta.isSynthetic;
  const price = store.def("price");
  const cap = store.def("market_cap");
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Companies being compared">
      {indices.map((i, k) => {
        const c = store.company(i);
        const t = store.companyType(i);
        const family = store.family(i);
        return (
          <li key={c.symbol} className="flex flex-col rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/company/${encodeURIComponent(c.symbol)}`} className="block break-words text-sm font-semibold underline-offset-2 hover:underline">
                  <CompanyName name={c.name} isSynthetic={synthetic} />
                </Link>
                <p className="text-xs text-muted-foreground">{c.symbol} · {TYPE_LABEL[t.type]}{t.inferred ? " (inferred)" : ""}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="-mr-2 -mt-1 min-h-11 min-w-11 shrink-0 px-2" onClick={() => onRemove(c.symbol)} aria-label={`Remove ${c.name} from the comparison`}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Reference price</dt>
                <dd className="font-semibold">{price && <ValueCell def={price} value={store.get("price", i)} family={family} />}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Market cap</dt>
                <dd className="font-semibold">{cap && <ValueCell def={cap} value={store.get("market_cap", i)} family={family} />}</dd>
              </div>
            </dl>
            <p className="mt-auto pt-2 text-xs text-muted-foreground">
              {model.comparable === 0 ? (
                "Not enough figures to compare"
              ) : (
                <>
                  Leads on <span className="font-medium text-foreground">{model.leads[k]}</span> of {model.comparable} figures
                </>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
