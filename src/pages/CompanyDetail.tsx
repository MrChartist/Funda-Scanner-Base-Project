import { useParams } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { getMockCompanyIntelligence } from "@/lib/mock-data";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { KeyRatiosGrid } from "@/components/company/KeyRatiosGrid";
import { ProsConsSection } from "@/components/company/ProsCons";
import { PriceChart } from "@/components/company/PriceChart";
import { AnalystRatings } from "@/components/company/AnalystRatings";
import { QuarterlyResults } from "@/components/company/QuarterlyResults";
import { FinancialStatements } from "@/components/company/FinancialStatements";
import { RatiosTable } from "@/components/company/RatiosTable";
import { ShareholdingPattern } from "@/components/company/ShareholdingPattern";
import { CorporateActions } from "@/components/company/CorporateActions";
import { PeerComparison } from "@/components/company/PeerComparison";

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
  }, [symbol]);

  const section = (delay: number, children: React.ReactNode) => (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.05 }}>
      {children}
    </motion.div>
  );

  return (
    <div className="container py-6 space-y-6">
      {section(0, <CompanyHeader company={data.company} />)}
      {section(1, <KeyRatiosGrid company={data.company} ratios={data.intelligence.ratio_rows} />)}
      {section(2, <ProsConsSection pros={data.company.pros} cons={data.company.cons} />)}
      {section(3, <PriceChart priceHistory={data.intelligence.price_history} />)}
      {section(4, <AnalystRatings ratings={data.intelligence.analyst_ratings} currentPrice={data.company.price} />)}
      {section(5, <QuarterlyResults rows={data.intelligence.quarterly_rows} />)}
      {section(6, <FinancialStatements rows={data.intelligence.statement_rows} />)}
      {section(7, <RatiosTable rows={data.intelligence.ratio_rows} />)}
      {section(8, <ShareholdingPattern data={data.intelligence.shareholding} />)}
      {section(9, <CorporateActions actions={data.intelligence.corporate_actions} />)}
      {section(10, <PeerComparison peers={data.intelligence.peers} currentSymbol={data.company.symbol} company={data.company} />)}
    </div>
  );
}
