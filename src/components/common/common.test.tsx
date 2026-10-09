import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { VF, type MetricDef } from "@/lib/contracts";
import { metricDef } from "@/lib/metrics/variants";
import { CompanyName } from "./CompanyName";
import { EmptyState } from "./EmptyState";
import { FictionalBadge } from "./FictionalBadge";
import { MetricInfo } from "./MetricInfo";
import { NotApplicableChip } from "./NotApplicableChip";
import { NullReasonHint } from "./NullReasonHint";
import { PassFailIcon } from "./PassFailIcon";
import { ValueCell } from "./ValueCell";

const def = (id: string) => metricDef(id) as MetricDef;

describe("ValueCell", () => {
  it("renders a formatted value with an optional period tag", () => {
    const { container } = render(<ValueCell def={def("roce")} value={{ v: 22.43, reason: null, flags: 0 }} showPeriod />);
    expect(container.textContent).toBe("22.4%FY");
  });

  it("renders the debt-free note and flag notes for screen readers", () => {
    const { container } = render(<ValueCell def={def("debt_equity")} value={{ v: 0, reason: null, flags: VF.Provided }} />);
    expect(container.textContent).toContain("0.00x · debt-free");
    expect(screen.getByText(/Value supplied in your file/)).toHaveClass("sr-only");
  });

  it("shows the FY period tag when TTM fell back to FY", () => {
    const { container } = render(<ValueCell def={def("pe")} value={{ v: 20, reason: null, flags: VF.FyFallback }} showPeriod />);
    expect(container.textContent).toMatch(/20\.0x.*FY$/);
  });

  it("renders a null as a dash with its reason", () => {
    render(<ValueCell def={def("pe")} value={{ v: null, reason: "loss_making", flags: 0 }} />);
    expect(screen.getByText("Loss-making")).toHaveClass("sr-only");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a not-applicable chip worded by family", () => {
    render(<ValueCell def={def("roce")} value={{ v: null, reason: "not_applicable_financial", flags: 0 }} family="lender" />);
    expect(screen.getByText("N/A for lenders")).toBeInTheDocument();
  });
});

describe("small components", () => {
  it("NullReasonHint and NotApplicableChip expose their text", () => {
    render(<NullReasonHint reason="no_price" />);
    expect(screen.getByText("Price not provided")).toBeInTheDocument();
    render(<NotApplicableChip family="insurance" />);
    expect(screen.getByText("N/A for insurers")).toHaveAttribute("title");
  });

  it("CompanyName always writes (fictional) inline for synthetic data, once", () => {
    const { container, rerender } = render(<CompanyName name="Tinymill Engineering Ltd" isSynthetic />);
    expect(container.textContent).toBe("Tinymill Engineering Ltd (fictional)");
    rerender(<CompanyName name="Alpha Software Ltd (fictional)" isSynthetic />);
    expect(container.textContent).toBe("Alpha Software Ltd (fictional)");
    rerender(<CompanyName name="Real Data Ltd" isSynthetic={false} symbol="RDL" showSymbol />);
    expect(container.textContent).toBe("Real Data LtdRDL");
  });

  it("FictionalBadge says Fictional", () => {
    render(<FictionalBadge />);
    expect(screen.getByText("Fictional")).toHaveAttribute("title", "Generated sample data. It describes no real company.");
  });

  it("PassFailIcon always shows text next to the icon", () => {
    const { rerender, container } = render(<PassFailIcon status="pass" />);
    expect(screen.getByText("Passes")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    rerender(<PassFailIcon status={0} />);
    expect(screen.getByText("Fails")).toBeInTheDocument();
    rerender(<PassFailIcon status={2} />);
    expect(screen.getByText("Not checked")).toBeInTheDocument();
    rerender(<PassFailIcon status="pass" label="Met" />);
    expect(screen.getByText("Met")).toBeInTheDocument();
  });

  it("EmptyState renders title, description and action", () => {
    render(<EmptyState title="No companies match" description="Try lowering a threshold." action={<button type="button">Reset</button>} />);
    expect(screen.getByRole("status")).toHaveTextContent("No companies match");
    expect(screen.getByRole("button", { name: "Reset" })).toBeInTheDocument();
  });

  it("MetricInfo opens a formula card that falls back to the catalogue", () => {
    render(<MetricInfo def={def("roce_avg_5y")} glossary={null} />);
    fireEvent.click(screen.getByRole("button", { name: "About Return on capital employed · 5Y avg" }));
    expect(screen.getByText("Pre-tax return on all money from shareholders and lenders.")).toBeInTheDocument();
    expect(screen.getByText(/^avg\(roce, 5y\), where roce = ebit/)).toBeInTheDocument();
    expect(screen.getByText("roce_avg_5y")).toBeInTheDocument();
  });

  it("contains no forbidden words in rendered copy", () => {
    const { container } = render(
      <div>
        <PassFailIcon status="pass" /><PassFailIcon status="fail" /><PassFailIcon status="unknown" />
        <FictionalBadge /><NotApplicableChip family="lender" /><NullReasonHint reason="missing_input" />
      </div>,
    );
    const text = `${container.textContent} ${Array.from(container.querySelectorAll("[title]")).map((e) => e.getAttribute("title")).join(" ")}`.toLowerCase();
    for (const w of ["buy", "sell", "strong buy", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot", "will go bankrupt"]) {
      expect(new RegExp(`\\b${w}\\b`).test(text), w).toBe(false);
    }
  });
});
