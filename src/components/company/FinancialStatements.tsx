import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { NO_ANNUAL_TEXT, statementView } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";

export interface FinancialStatementProps {
  store: MetricStore;
  index: number;
  statement: "pnl" | "balance_sheet" | "cash_flow";
}

const CAPTION = {
  pnl: "Profit and loss, in rupees crore, oldest year first",
  balance_sheet: "Balance sheet at year end, in rupees crore, oldest year first",
  cash_flow: "Cash flow, in rupees crore, oldest year first",
} as const;

/** One annual statement: line items from the dataset's field list, then derived rows in italics. */
export function FinancialStatement({ store, index, statement }: FinancialStatementProps) {
  const view = useMemo(() => statementView(store, index, statement), [store, index, statement]);
  if (store.slots(index, "fy") === 0) {
    return <EmptyState title={NO_ANNUAL_TEXT} description="History-based figures, checks and scores need annual statements. Import them to see this section." />;
  }
  if (view.rows.length === 0) {
    return <EmptyState title="Nothing in this statement was provided." description="The file holds no values for the lines of this statement." />;
  }
  return (
    <div className="space-y-2">
      <PeriodTable caption={CAPTION[statement]} periods={view.periods} rows={view.rows} family={store.family(index)} />
      <p className="text-xs text-muted-foreground">
        Amounts are in the units shown. Rows in italics are worked out from the lines above them.
        {view.hidden.length > 0 && ` Not shown because they were not provided: ${view.hidden.join(", ")}.`}
      </p>
    </div>
  );
}
