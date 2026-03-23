import { useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Download } from "lucide-react";
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

export default function CompanyDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const data = useMemo(() => getMockCompanyIntelligence(symbol || "RELIANCE"), [symbol]);

  useEffect(() => {
    if (!symbol) return;
    try {
      const recent: string[] = JSON.parse(localStorage.getItem("funda-recent") || "[]");
      const updated = [symbol, ...recent.filter((s) => s !== symbol)].slice(0, 10);
      localStorage.setItem("funda-recent", JSON.stringify(updated));
    } catch {}
    window.scrollTo(0, 0);
  }, [symbol]);

  const section = (id: string, delay: number, children: React.ReactNode) => (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.06, duration: 0.4, ease: "easeOut" }}
      className="scroll-mt-20"
    >
      {children}
    </motion.div>
  );

  return (
    <>
      <CompanyPageNav />
      <div className="container max-w-7xl py-6 md:py-8 space-y-5 xl:ml-48">
        {/* Export toolbar */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCompanyPDF(symbol || "RELIANCE")} className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> PDF Report
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCompanyExcel(symbol || "RELIANCE")} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Excel Export
          </Button>
        </div>
        {section("header", 0, <CompanyHeader company={data.company} />)}
        {section("ratios-grid", 1, <KeyRatiosGrid company={data.company} ratios={data.intelligence.ratio_rows} />)}
        {section("pros-cons", 2, <ProsConsSection pros={data.company.pros} cons={data.company.cons} />)}
        {section("price-chart", 3, <PriceChart priceHistory={data.intelligence.price_history} />)}
        {section("analyst-ratings", 4, <AnalystRatings ratings={data.intelligence.analyst_ratings} currentPrice={data.company.price} />)}
        {section("quarterly", 5, <QuarterlyResults rows={data.intelligence.quarterly_rows} />)}
        {section("financials", 6, <FinancialStatements rows={data.intelligence.statement_rows} />)}
        {section("ratio-trends", 7, <RatioTrendAnalysis rows={data.intelligence.ratio_rows} />)}
        {section("shareholding", 8, <ShareholdingPattern data={data.intelligence.shareholding} />)}
        
        {/* Revenue & Holdings side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div id="segments" className="scroll-mt-20">{section("segments-inner", 9, <RevenueSegmentation />)}</div>
          <div>{section("holdings", 10, <MutualFundHoldings />)}</div>
        </div>

        {section("insider-deals", 11, <InsiderDeals />)}
        {section("management", 12, <ManagementInfo />)}
        {section("documents", 13, <Documents documents={data.intelligence.documents} />)}
        {section("corporate-actions", 14, <CorporateActions actions={data.intelligence.corporate_actions} />)}
        
        {/* Peer Comparison at bottom - full width */}
        {section("peers", 15, <PeerComparison peers={data.intelligence.peers} currentSymbol={data.company.symbol} company={data.company} />)}
      </div>
    </>
  );
}
