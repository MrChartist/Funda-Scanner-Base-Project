import { describe, expect, it } from "vitest";
import { NULL_REASONS, VF, type MetricValue, type NullReason } from "@/lib/contracts";
import { metricDef } from "@/lib/metrics/variants";
import { NULL_REASON_TEXT, formatMetric, formatUnitValue, nullReasonText } from "./metric-value";

const def = (id: string) => {
  const d = metricDef(id);
  if (!d) throw new Error(id);
  return d;
};
const val = (v: number | null, flags = 0, reason: NullReason | null = null): MetricValue => ({ v, reason: v === null ? reason ?? "missing_input" : null, flags });

describe("formatMetric", () => {
  it("formats each unit as §C.8 shows", () => {
    expect(formatMetric(def("pe"), val(24.53))).toBe("24.5x");
    expect(formatMetric(def("roce"), val(22.43))).toBe("22.4%");
    expect(formatMetric(def("debtor_days"), val(48.2))).toBe("48 days");
    expect(formatMetric(def("debtor_days"), val(1))).toBe("1 day");
    expect(formatMetric(def("market_cap"), val(192000))).toBe("₹1.92 lakh Cr");
    expect(formatMetric(def("market_cap"), val(52140))).toBe("₹52,140 Cr");
    expect(formatMetric(def("price"), val(1210.5))).toBe("₹1,210.50");
    expect(formatMetric(def("promoter_holding_chg_1y"), val(1.2))).toBe("+1.20 pp");
    expect(formatMetric(def("q_opm_change_yoy"), val(-0.8))).toBe("-0.8 pp");
    expect(formatMetric(def("dividend_streak"), val(11))).toBe("11 years");
    expect(formatMetric(def("dividend_streak"), val(11, VF.LimitOfData))).toBe("at least 11 years (limit of data)");
    expect(formatMetric(def("latest_fy"), val(2026))).toBe("FY26");
    expect(formatMetric(def("piotroski_f"), val(7))).toBe("7");
    expect(formatMetric(def("red_flag_count"), val(2))).toBe("2");
    expect(formatMetric(def("shares_outstanding_ye"), val(10.5))).toBe("10.50 Cr shares");
    expect(formatMetric(def("num_shareholders"), val(152040))).toBe("1,52,040");
  });

  it("uses an ASCII minus for negatives", () => {
    expect(formatMetric(def("net_debt"), val(-1234))).toBe("-₹1,234 Cr");
    expect(formatMetric(def("cash_conversion_cycle"), val(-12))).toBe("-12 days");
    expect(formatMetric(def("roe"), val(-3.25))).toBe("-3.3%");
  });

  it("marks zero debt as debt-free", () => {
    expect(formatMetric(def("debt_equity"), val(0))).toBe("0.00x · debt-free");
    expect(formatMetric(def("debt_equity_prev"), val(0))).toBe("0.00x · debt-free");
    expect(formatMetric(def("debt_ebitda"), val(0))).toBe("0.00x · debt-free");
    expect(formatMetric(def("net_debt_equity"), val(0))).toBe("0.00x");
    expect(formatMetric(def("debt_equity"), val(0.35))).toBe("0.35x");
  });

  it("renders null as a dash whatever the reason", () => {
    for (const r of NULL_REASONS) {
      if (r === "none") continue;
      expect(formatMetric(def("roce"), { v: null, reason: r, flags: 0 })).toBe("—");
    }
  });

  it("formats unit values directly", () => {
    expect(formatUnitValue("pct", 1, Number.NaN)).toBe("—");
    expect(formatUnitValue("x", 1, 3)).toBe("3.0x");
  });
});

describe("NULL_REASON_TEXT", () => {
  it("has short and long text for every reason, matching §C.2", () => {
    for (const r of NULL_REASONS) {
      if (r === "none") continue;
      const t = NULL_REASON_TEXT[r];
      expect(t.short.length, r).toBeGreaterThan(0);
      expect(t.long.length, r).toBeGreaterThan(t.short.length - 1);
    }
    expect(NULL_REASON_TEXT.missing_input).toEqual({ short: "Not provided", long: "An input needed for this figure is not in your data." });
    expect(NULL_REASON_TEXT.non_positive_denominator).toEqual({ short: "Not meaningful", long: "The figure it divides by is zero or negative." });
    expect(NULL_REASON_TEXT.too_few_peers.short).toBe("Too few comparable companies in your data");
    expect(NULL_REASON_TEXT.transition_period.short).toBe("Period not comparable (restated or transition year)");
    expect(NULL_REASON_TEXT.no_price.short).toBe("Price not provided");
    expect(NULL_REASON_TEXT.too_few_inputs.short).toBe("Too few inputs to calculate");
  });

  it("words the not-applicable text by family", () => {
    expect(nullReasonText("not_applicable_financial", "lender").short).toBe("N/A for lenders");
    expect(nullReasonText("not_applicable_financial", "insurance").short).toBe("N/A for insurers");
    expect(nullReasonText("not_applicable_financial").short).toBe("Not applicable");
    expect(nullReasonText("loss_making", "lender").short).toBe("Loss-making");
  });

  it("contains no forbidden words", () => {
    const text = JSON.stringify(NULL_REASON_TEXT).toLowerCase();
    for (const w of ["buy", "sell", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot", "will go bankrupt"]) {
      expect(new RegExp(`\\b${w}\\b`).test(text), w).toBe(false);
    }
  });
});
