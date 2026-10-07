import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import type { MetricStore } from "@/lib/contracts";
import { useCompany } from "@/hooks/use-dataset";
import { EmptyState } from "@/components/common/EmptyState";
import { DataHealthPanel } from "@/components/data/DataHealthPanel";
import { Button } from "@/components/ui/button";
import { AtAGlance } from "@/components/company/AtAGlance";
import { CashFlowQuality } from "@/components/company/CashFlowQuality";
import { CompanyBreadcrumb } from "@/components/company/CompanyBreadcrumb";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { CompanyPageNav } from "@/components/company/CompanyPageNav";
import { CompanySection } from "@/components/company/CompanySection";
import { DividendAnalysis } from "@/components/company/DividendAnalysis";
import { FinancialStatement } from "@/components/company/FinancialStatements";
import { KeyMetrics } from "@/components/company/KeyMetrics";
import { PeerComparison } from "@/components/company/PeerComparison";
import { ProvenanceNote } from "@/components/company/ProvenanceNote";
import { QuarterlyResults } from "@/components/company/QuarterlyResults";
import { RatioTrendAnalysis } from "@/components/company/RatioTrendAnalysis";
import { ScoresSection } from "@/components/company/ScoresSection";
import { ScreensPassed } from "@/components/company/ScreensPassed";
import { ShareholdingPattern } from "@/components/company/ShareholdingPattern";
import { StrengthsAndChecks } from "@/components/company/StrengthsAndChecks";
import { downloadCompanyCsv, openPrintView } from "@/lib/export-utils";
import { readRaw, writeRaw } from "@/lib/user/storage";
import { STORAGE_KEYS } from "@/lib/contracts";
import { remapHash } from "@/lib/views/company-view";

/** Remembers the last companies opened (symbols only, newest first). */
function rememberVisit(symbol: string): void {
  try {
    const parsed: unknown = JSON.parse(readRaw(STORAGE_KEYS.recent) ?? "[]");
    const recent = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    writeRaw(STORAGE_KEYS.recent, JSON.stringify([symbol, ...recent.filter((s) => s !== symbol)].slice(0, 10)));
  } catch {
    // unreadable value: skip
  }
}

function NotInData({ symbol }: { symbol: string }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        title={`'${symbol}' is not in the data you are viewing`}
        description={
          <>
            Another company is never shown in its place. Check the symbol, or{" "}
            <Link to="/screener" className="underline underline-offset-2">browse the screener</Link> to find companies in your data.
          </>
        }
      />
    </div>
  );
}

function CompanyView({ store, index }: { store: MetricStore; index: number }) {
  const symbol = store.symbols[index];
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    rememberVisit(symbol);
  }, [symbol]);

  // Old hashes (#pros-cons, #financials ...) land on the section that replaced them.
  useEffect(() => {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    const target = remapHash(raw);
    if (target && target !== raw) {
      navigate({ pathname: location.pathname, search: location.search, hash: `#${target}` }, { replace: true });
      return;
    }
    const id = target ?? raw;
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView?.({ block: "start" }), 0);
    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, location.search, navigate]);

  const noPopup = () => window.alert("The print view was blocked by the browser. Allow pop-ups for this page and try again.");

  return (
    <>
      <CompanyBreadcrumb store={store} index={index} symbol={symbol} />
      <div className="flex flex-wrap justify-end gap-2" data-no-print>
        <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => downloadCompanyCsv(store, index)}>
          <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
        </Button>
        <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => { if (!openPrintView(store, index)) noPopup(); }}>
          <Printer className="h-4 w-4" aria-hidden="true" /> Print view
        </Button>
      </div>
      <CompanyHeader store={store} index={index} />
      <ProvenanceNote store={store} index={index} />
      <CompanyPageNav />

      <CompanySection id="summary" title="Summary" symbol={symbol} description="Checks by area, then the headline figures.">
        <div className="space-y-5">
          <AtAGlance store={store} index={index} />
          <KeyMetrics store={store} index={index} />
        </div>
      </CompanySection>
      <CompanySection id="checks" title="Strengths and checks" symbol={symbol} description="What the rules found on the data you loaded, including what could not be evaluated.">
        <StrengthsAndChecks store={store} index={index} />
      </CompanySection>
      <CompanySection id="scores" title="Scores" symbol={symbol} description="Two published scores, each with its working.">
        <ScoresSection store={store} index={index} />
      </CompanySection>
      <CompanySection id="screens" title="Screens this company passes" symbol={symbol} description="The same rules the Screener uses, applied to this company.">
        <ScreensPassed store={store} index={index} />
      </CompanySection>
      <CompanySection id="quarterly" title="Quarterly results" symbol={symbol}>
        <QuarterlyResults store={store} index={index} />
      </CompanySection>
      <CompanySection id="pnl" title="Profit and loss" symbol={symbol}>
        <FinancialStatement store={store} index={index} statement="pnl" />
      </CompanySection>
      <CompanySection id="balance-sheet" title="Balance sheet" symbol={symbol}>
        <FinancialStatement store={store} index={index} statement="balance_sheet" />
      </CompanySection>
      <CompanySection id="cash-flow" title="Cash flow" symbol={symbol}>
        <CashFlowQuality store={store} index={index} />
      </CompanySection>
      <CompanySection id="ratios" title="Ratios over time" symbol={symbol}>
        <RatioTrendAnalysis store={store} index={index} />
      </CompanySection>
      <CompanySection id="shareholding" title="Shareholding" symbol={symbol}>
        <ShareholdingPattern store={store} index={index} />
      </CompanySection>
      <CompanySection id="dividends" title="Dividends" symbol={symbol}>
        <DividendAnalysis store={store} index={index} />
      </CompanySection>
      <CompanySection id="peers" title="Peers" symbol={symbol}>
        <PeerComparison store={store} index={index} />
      </CompanySection>
      <CompanySection id="data-health" title="Data health" symbol={symbol} description="What the figures on this page rest on.">
        <DataHealthPanel store={store} index={index} />
      </CompanySection>
    </>
  );
}

export default function CompanyDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const state = useCompany(symbol);
  return (
    <div className="container max-w-6xl space-y-3 py-2 md:py-3">
      {state.status === "loading" && (
        <div role="status" aria-live="polite" className="py-24 text-center text-sm text-muted-foreground">Loading company data…</div>
      )}
      {state.status === "error" && (
        <EmptyState
          title="The data could not be loaded."
          description={state.message}
          action={<Button type="button" variant="outline" className="min-h-11" onClick={state.retry}>Try again</Button>}
        />
      )}
      {state.status === "not_found" && <NotInData symbol={state.symbol || (symbol ?? "")} />}
      {state.status === "ready" && <CompanyView key={state.symbol} store={state.store} index={state.index} />}
    </div>
  );
}
