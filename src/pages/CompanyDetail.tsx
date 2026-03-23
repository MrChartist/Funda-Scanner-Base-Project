import { useParams, useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Printer } from "lucide-react";
import { getMockCompanyIntelligence } from "@/lib/mock-data";
import { exportCompanyPDF, exportCompanyExcel } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { KeyRatiosGrid } from "@/components/company/KeyRatiosGrid";
import { ProsConsSection } from "@/components/company/ProsCons";
import { PriceChart } from "@/components/company/PriceChart";
import { AnalystRatings } from "@/components/company/AnalystRatings";
import { QuarterlyResults } from "@/components/company/QuarterlyResults";
import { FinancialStatements } from "@/components/company/FinancialStatements";
import { RatioTrendAnalysis } from "@/components/company/RatioTrendAnalysis";
import { ShareholdingPattern } from "@/components/company/ShareholdingPattern";
import { CorporateActions } from "@/components/company/CorporateActions";
import { PeerComparison } from "@/components/company/PeerComparison";
import { Documents } from "@/components/company/Documents";
import { MutualFundHoldings } from "@/components/company/MutualFundHoldings";
import { InsiderDeals } from "@/components/company/InsiderDeals";
import { RevenueSegmentation } from "@/components/company/RevenueSegmentation";
import { ManagementInfo } from "@/components/company/ManagementInfo";
import { CompanyPageNav } from "@/components/company/CompanyPageNav";
import { CompanyBreadcrumb } from "@/components/company/CompanyBreadcrumb";
import { ShareSection } from "@/components/company/ShareSection";
import { DataFreshness } from "@/components/company/DataFreshness";

export default function CompanyDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const location = useLocation();
  const data = useMemo(() => getMockCompanyIntelligence(symbol || "RELIANCE"), [symbol]);

  useEffect(() => {
    if (!symbol) return;
    try {
      const recent: string[] = JSON.parse(localStorage.getItem("funda-recent") || "[]");
      const updated = [symbol, ...recent.filter((s) => s !== symbol)].slice(0, 10);
      localStorage.setItem("funda-recent", JSON.stringify(updated));
    } catch {}

    // Deep link: scroll to hash section
    const hash = location.hash.replace("#", "");
    if (hash) {
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 500);
    } else {
      window.scrollTo(0, 0);
    }
  }, [symbol, location.hash]);

  const section = (id: string, delay: number, children: React.ReactNode, freshness?: string | number) => (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.06, duration: 0.4, ease: "easeOut" }}
      className="scroll-mt-20 group/section"
    >
      {/* Section share + freshness bar */}
      <div className="flex items-center justify-end gap-2 mb-1 opacity-0 group-hover/section:opacity-100 transition-opacity" data-no-print>
        {freshness !== undefined && <DataFreshness updatedAt={freshness} />}
        <ShareSection sectionId={id} sectionLabel={id.replace(/-/g, " ")} />
      </div>
      {children}
    </motion.div>
  );

  return (
    <>
      <CompanyPageNav />
      <div className="container max-w-7xl py-2 md:py-4 space-y-5 xl:ml-48">
        {/* Breadcrumb */}
        <CompanyBreadcrumb />

        {/* Export toolbar */}
        <div className="flex justify-end gap-2" data-no-print>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCompanyPDF(symbol || "RELIANCE")} className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> PDF Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCompanyExcel(symbol || "RELIANCE")} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Excel Export
          </Button>
        </div>

        {/* Print-only header */}
        <div className="print-header hidden">
          <h1 style={{ fontSize: "18pt", fontWeight: 700 }}>{data.company.name}</h1>
          <p style={{ fontSize: "10pt", color: "#666" }}>
            {data.company.symbol} · {data.company.sector} · Generated {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {section("header", 0, <CompanyHeader company={data.company} />, "live")}
        {section("ratios-grid", 1, <KeyRatiosGrid company={data.company} ratios={data.intelligence.ratio_rows} />, 15)}
        {section("pros-cons", 2, <ProsConsSection pros={data.company.pros} cons={data.company.cons} />, 1440)}
        {section("price-chart", 3, <PriceChart priceHistory={data.intelligence.price_history} />, "live")}
        {section("analyst-ratings", 4, <AnalystRatings ratings={data.intelligence.analyst_ratings} currentPrice={data.company.price} />, 4320)}
        {section("quarterly", 5, <QuarterlyResults rows={data.intelligence.quarterly_rows} />, 2880)}
        {section("financials", 6, <FinancialStatements rows={data.intelligence.statement_rows} />, 4320)}
        {section("ratio-trends", 7, <RatioTrendAnalysis rows={data.intelligence.ratio_rows} />, 4320)}
        {section("shareholding", 8, <ShareholdingPattern data={data.intelligence.shareholding} />, 2880)}
        
        {/* Revenue & Holdings side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div id="segments" className="scroll-mt-20">{section("segments-inner", 9, <RevenueSegmentation />, 4320)}</div>
          <div>{section("holdings", 10, <MutualFundHoldings />, 2880)}</div>
        </div>

        {section("insider-deals", 11, <InsiderDeals />, 1440)}
        {section("management", 12, <ManagementInfo />, 10080)}
        {section("documents", 13, <Documents documents={data.intelligence.documents} />, 4320)}
        {section("corporate-actions", 14, <CorporateActions actions={data.intelligence.corporate_actions} />, 4320)}
        
        {/* Peer Comparison at bottom - full width */}
        {section("peers", 15, <PeerComparison peers={data.intelligence.peers} currentSymbol={data.company.symbol} company={data.company} />, 15)}
      </div>
    </>
  );
}
