import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, Download, GitCompare, MoreHorizontal, Printer } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { TYPE_LABEL } from "@/lib/views/company-view";
import { CompanyName } from "@/components/common/CompanyName";
import { FictionalBadge } from "@/components/common/FictionalBadge";
import { ValueCell } from "@/components/common/ValueCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useFollow } from "./use-follow";

export interface CompanyHeaderProps {
  store: MetricStore;
  index: number;
  /** Export actions live in a menu on the card. */
  onDownload?: () => void;
  onPrint?: () => void;
}

/** Name, classification, reference price and market cap. Nothing here is invented: no website, codes or dates. */
export function CompanyHeader({ store, index, onDownload, onPrint }: CompanyHeaderProps) {
  const c = store.company(index);
  const type = store.companyType(index);
  const family = store.family(index);
  const { following, toggle } = useFollow(c.symbol);
  const priceDef = store.def("price");
  const capDef = store.def("market_cap");
  const industry = store.industry(index);
  return (
    <header id="company-header" className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
            <CompanyName name={c.name} isSynthetic={store.meta.isSynthetic} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{c.symbol}</span>
            <span aria-hidden="true"> · </span>
            <span>{c.sector}</span>
            {industry && industry !== c.sector && (
              <>
                <span aria-hidden="true"> › </span>
                <span>{industry}</span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABEL[type.type]}
              {type.inferred ? " (inferred from sector)" : ""}
            </Badge>
            <Badge variant="outline" className="text-xs">{c.statement_basis === "standalone" ? "Standalone figures" : "Consolidated figures"}</Badge>
            {store.meta.isSynthetic && <FictionalBadge />}
            {c.isin && <span className="text-muted-foreground">ISIN {c.isin}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-no-print>
          <Button type="button" variant={following ? "secondary" : "outline"} onClick={toggle} aria-pressed={following} className="min-h-11 gap-1.5">
            {following ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
            {following ? "Following" : "Follow"}
          </Button>
          <Button asChild variant="outline" className="min-h-11 gap-1.5">
            <Link to={`/compare?symbols=${encodeURIComponent(c.symbol)}`}>
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              Compare
            </Link>
          </Button>
          {(onDownload || onPrint) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="min-h-11 min-w-11 px-2.5" aria-label="More actions: download or print">
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onDownload && (
                  <DropdownMenuItem className="min-h-11 gap-2" onSelect={onDownload}>
                    <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
                  </DropdownMenuItem>
                )}
                {onPrint && (
                  <DropdownMenuItem className="min-h-11 gap-2" onSelect={onPrint}>
                    <Printer className="h-4 w-4" aria-hidden="true" /> Print view
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-2 border-t pt-3">
        <div>
          <dt className="text-xs text-muted-foreground">Reference price</dt>
          <dd className="text-lg font-semibold leading-tight">
            {priceDef && <ValueCell def={priceDef} value={store.get("price", index)} family={family} />}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {c.market.price_date ? `as of ${c.market.price_date}` : "price date not provided"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Market capitalisation</dt>
          <dd className="text-lg font-semibold">{capDef && <ValueCell def={capDef} value={store.get("market_cap", index)} family={family} />}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-xs text-muted-foreground">The price is a reference figure supplied with the data. It is not a live quote.</p>
    </header>
  );
}

/** Name, reference price and Follow, for the sticky bar once the header card has scrolled away. */
export function CompanyMiniHeader({ store, index }: CompanyHeaderProps) {
  const c = store.company(index);
  const family = store.family(index);
  const { following, toggle } = useFollow(c.symbol);
  const priceDef = store.def("price");
  return (
    <>
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="truncate text-sm font-semibold"><CompanyName name={c.name} isSynthetic={store.meta.isSynthetic} /></span>
        <span className="shrink-0 text-sm text-muted-foreground">
          {priceDef && <ValueCell def={priceDef} value={store.get("price", index)} family={family} />}
          {" "}<span className="sr-only text-xs sm:not-sr-only">{c.market.price_date ? `as of ${c.market.price_date}` : "reference price"}</span>
        </span>
      </div>
      <Button type="button" size="sm" variant={following ? "secondary" : "outline"} onClick={toggle} aria-pressed={following} className="min-h-11 shrink-0 gap-1.5">
        {following ? <BookmarkCheck className="h-4 w-4" aria-hidden="true" /> : <Bookmark className="h-4 w-4" aria-hidden="true" />}
        {following ? "Following" : "Follow"}
      </Button>
    </>
  );
}
