// src/lib/metrics/company-type.ts — company type from the data, or inferred from sector and
// industry keywords (spec §C.7). An inferred type is flagged so the UI can say "Type inferred
// from sector". Matching is on whole words, so "Bankura Mills" is not a bank.
import type { CompanyRecord, CompanyType } from "@/lib/contracts";

const INSURANCE = /\b(insurance|insurer|insurers|reinsurance|assurance)\b/;
const SMALL_FINANCE_BANK = /\bsmall finance banks?\b/;
const NBFC = /\b(nbfcs?|non[\s-]banking)\b/;
/** Investment banks advise and arrange deals; they are not lenders. */
const INVESTMENT_BANK = /\binvestment bank(s|ing)?\b/;
const BANK = /\b(banks?|banking)\b/;
const OTHER_LENDER = /\b(finance|financier|financiers|microfinance|housing finance|lending|lender|lenders)\b/;

/** Keyword inference (§C.7): insurance → insurance; bank, small finance bank → bank; NBFC, finance, housing finance, microfinance → nbfc. */
export function inferCompanyType(sector: string, industry: string | null): CompanyType {
  const text = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();
  if (INSURANCE.test(text)) return "insurance";
  if (SMALL_FINANCE_BANK.test(text)) return "bank";
  if (NBFC.test(text)) return "nbfc";
  if (BANK.test(text) && !INVESTMENT_BANK.test(text)) return "bank";
  if (OTHER_LENDER.test(text)) return "nbfc";
  return "non_financial";
}

/** The type supplied with the data, or the inferred one (flagged). */
export function resolveCompanyType(c: Pick<CompanyRecord, "company_type" | "sector" | "industry">): { type: CompanyType; inferred: boolean } {
  if (c.company_type) return { type: c.company_type, inferred: false };
  return { type: inferCompanyType(c.sector, c.industry), inferred: true };
}
