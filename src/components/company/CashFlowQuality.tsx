import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { formatUnitValue } from "@/lib/format/metric-value";
import { statementView } from "@/lib/views/company-view";
import { FinancialStatement } from "./FinancialStatements";
import { TrendChart } from "./TrendChart";

export interface CashFlowQualityProps {
  store: MetricStore;
  index: number;
}

/** The cash-flow statement with cash from operations and free cash flow charted over it. */
export function CashFlowQuality({ store, index }: CashFlowQualityProps) {
  const view = useMemo(() => statementView(store, index, "cash_flow"), [store, index]);
  const cfo = view.rows.find((r) => r.id === "cfo");
  const fcf = view.rows.find((r) => r.id === "fcf");
  const chart = cfo ? [{ key: "cfo", label: "Cash from operations", values: cfo.values.map((v) => v.v) }, ...(fcf ? [{ key: "fcf", label: "Free cash flow", values: fcf.values.map((v) => v.v) }] : [])] : [];
  return (
    <div className="space-y-3">
      {chart.length > 0 && (
        <TrendChart
          ariaLabel="Cash from operations and free cash flow by year. The table below has the same figures."
          periods={view.periods.map((p) => p.label)}
          series={chart}
          format={(n) => formatUnitValue("inr_cr", 0, n)}
        />
      )}
      <FinancialStatement store={store} index={index} statement="cash_flow" />
    </div>
  );
}
