// Pure DCF maths. Educational model only — not investment advice.

// ─── Types ───────────────────────────────────────────────────────
export interface DCFInputs {
  symbol: string;
  fcf: number;
  growthRate: number;         // Stage 1
  stage2Growth: number;       // Stage 2 (fade)
  terminalGrowth: number;
  discountRate: number;
  years: number;
  stage2Years: number;
  sharesOutstanding: number;
  terminalMethod: "perpetuity" | "exitMultiple";
  exitMultiple: number;
  netDebt: number;
}

export interface WACCInputs {
  riskFreeRate: number;
  beta: number;
  equityRiskPremium: number;
  costOfDebt: number;
  taxRate: number;
  debtToEquity: number;
}

export interface Scenario {
  label: string;
  color: string;
  growthRate: number;
  stage2Growth: number;
  terminalGrowth: number;
  discountRate: number;
}

// ─── Calculations ────────────────────────────────────────────────
export function calculateWACC(w: WACCInputs): number {
  const costOfEquity = w.riskFreeRate + w.beta * w.equityRiskPremium;
  const afterTaxDebt = w.costOfDebt * (1 - w.taxRate / 100);
  const equityWeight = 1 / (1 + w.debtToEquity);
  const debtWeight = w.debtToEquity / (1 + w.debtToEquity);
  return costOfEquity * equityWeight + afterTaxDebt * debtWeight;
}

export interface DCFProjection { year: number; fcf: number; pv: number; phase: string }

export interface DCFResult {
  perShare: number;
  totalPV: number;
  pvFCFs: number;
  pvTerminal: number;
  projections: DCFProjection[];
}

/**
 * Two-stage DCF: high growth, then a linear fade to `stage2Growth`, then a terminal value.
 * Returns `perShare: NaN` when the perpetuity method is requested with
 * terminal growth >= discount rate (the Gordon growth model is undefined there).
 */
export function calculateDCF(inputs: DCFInputs): DCFResult {
  let totalPVFCFs = 0;
  let fcf = inputs.fcf;
  const projections: DCFProjection[] = [
    { year: 0, fcf: inputs.fcf, pv: inputs.fcf, phase: "Current" },
  ];

  // Stage 1: high growth
  for (let y = 1; y <= inputs.years; y++) {
    fcf *= 1 + inputs.growthRate / 100;
    const pv = fcf / Math.pow(1 + inputs.discountRate / 100, y);
    totalPVFCFs += pv;
    projections.push({ year: y, fcf: Math.round(fcf), pv: Math.round(pv), phase: "High Growth" });
  }

  // Stage 2: fade to terminal
  for (let y = 1; y <= inputs.stage2Years; y++) {
    const fadeRate = inputs.growthRate - ((inputs.growthRate - inputs.stage2Growth) * y) / inputs.stage2Years;
    fcf *= 1 + fadeRate / 100;
    const totalYear = inputs.years + y;
    const pv = fcf / Math.pow(1 + inputs.discountRate / 100, totalYear);
    totalPVFCFs += pv;
    projections.push({ year: totalYear, fcf: Math.round(fcf), pv: Math.round(pv), phase: "Fade" });
  }

  const totalProjectionYears = inputs.years + inputs.stage2Years;

  // Terminal value
  let terminalValue: number;
  if (inputs.terminalMethod === "exitMultiple") {
    terminalValue = fcf * inputs.exitMultiple;
  } else {
    const spread = inputs.discountRate / 100 - inputs.terminalGrowth / 100;
    terminalValue = spread > 0 ? (fcf * (1 + inputs.terminalGrowth / 100)) / spread : NaN;
  }
  const pvTerminal = terminalValue / Math.pow(1 + inputs.discountRate / 100, totalProjectionYears);

  const enterpriseValue = totalPVFCFs + pvTerminal;
  const equityValue = enterpriseValue - inputs.netDebt;
  const perShare = equityValue / inputs.sharesOutstanding;

  return { perShare, totalPV: enterpriseValue, pvFCFs: totalPVFCFs, pvTerminal, projections };
}

export function reverseImpliedGrowth(inputs: DCFInputs, targetPrice: number): number {
  let lo = -10, hi = 50;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const result = calculateDCF({ ...inputs, growthRate: mid });
    if (result.perShare > targetPrice) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function monteCarloSimulation(
  inputs: DCFInputs,
  iterations: number = 5000,
  random: () => number = Math.random,
): number[] {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const randGrowth = inputs.growthRate + (random() - 0.5) * 10;
    const randDiscount = inputs.discountRate + (random() - 0.5) * 4;
    const randTerminal = inputs.terminalGrowth + (random() - 0.5) * 2;
    const { perShare } = calculateDCF({
      ...inputs,
      growthRate: Math.max(0, randGrowth),
      discountRate: Math.max(5, randDiscount),
      terminalGrowth: Math.max(0, Math.min(randDiscount - 1, randTerminal)),
    });
    if (isFinite(perShare) && perShare > 0) results.push(perShare);
  }
  return results.sort((a, b) => a - b);
}
