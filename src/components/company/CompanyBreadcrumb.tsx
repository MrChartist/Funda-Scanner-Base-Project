import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { CompanyName } from "@/components/common/CompanyName";

export interface CompanyBreadcrumbProps {
  /** Absent while loading or when the symbol is not in the data. */
  store?: MetricStore | null;
  index?: number;
  symbol: string;
}

export function CompanyBreadcrumb({ store, index, symbol }: CompanyBreadcrumbProps) {
  const company = store && index !== undefined && index >= 0 ? store.company(index) : null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-0.5 overflow-x-auto text-sm text-muted-foreground">
      <Link to="/" className="inline-flex min-h-11 md:min-h-8 shrink-0 items-center gap-1 hover:text-foreground">
        <Home className="h-4 w-4" aria-hidden="true" />
        <span>Home</span>
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      <Link to="/screener" className="inline-flex min-h-11 md:min-h-8 shrink-0 items-center hover:text-foreground">Screener</Link>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      {company ? (
        <>
          <Link to={`/screener?u=${encodeURIComponent(`sector:${company.sector}`)}`} className="inline-flex min-h-11 md:min-h-8 max-w-[10rem] shrink-0 items-center truncate hover:text-foreground">
            {company.sector}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="shrink-0 font-medium text-foreground" aria-current="page">
            <CompanyName name={company.name} isSynthetic={store?.meta.isSynthetic ?? false} />
          </span>
        </>
      ) : (
        <span className="shrink-0 font-mono text-foreground" aria-current="page">{symbol}</span>
      )}
    </nav>
  );
}
