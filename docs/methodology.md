# Methodology

This document explains how Funda Scanner builds its fictional sample data and how its learning
content is written. Metric formulas are documented in `docs/metrics.md`, which is generated from
the metric catalogue.

> Nothing in Funda Scanner is a recommendation. Checks, scores and rules of thumb are rule-based
> observations on the data you load.

## 1. The fictional sample

### 1.1 What it is

The built-in sample contains **150 fictional companies**. Their names, symbols and figures were
produced by a fixed formula and describe no real business. Every company is labelled
"(fictional)" in the app, the dataset carries `meta.isSynthetic = true`, and exports made from it
are marked as synthetic.

- **History:** financial years FY2016 to FY2026 (11 years); 13 quarters ending June 2023 to June
  2026; 13 shareholding quarters ending on the same dates. The generator simulates FY2027
  internally and publishes only its first quarter, so trailing-twelve-month (TTM) figures differ
  from FY2026.
- **No invented dates:** `meta.asOf` and every `price_date` are `null`. The app shows
  "price date not provided" and "Data as of: not provided" instead. The financial-year labels are for illustration only and describe no real
  period.
- **Units:** money in ₹ crore, share counts in crore shares, percentages as percent numbers.
- **Generator metadata:** `meta.generator = { name: "funda-sample", version: "1.0.0", seed }`,
  with seed 24301 for the bundled sample.

### 1.2 Mix

| Group | Companies |
|---|---|
| Non-financial (122) | IT services 12, FMCG 10, Pharmaceuticals 10, Automobiles and auto parts 10, Capital goods 10, Specialty chemicals 10, Cement 8, Metals and mining 8, Power utilities 8, Real estate 8, Oil and gas 6, Retail (lease-heavy) 6, Textiles 6, Telecom and aviation (lease-heavy) 4, Holding companies 2, Capital markets (`other_financial`) 4 |
| Lenders (24) | Private sector banks 8, public sector banks 4, NBFCs 8, housing finance companies 4 |
| Insurers (4) | Kept below the minimum peer-group size of five on purpose, so their peer statistics honestly show "Too few comparable companies in your data" |

### 1.3 Archetypes and why each company is there

Every company has one behaviour **archetype** and any number of structural **traits**. Its
`sample_note` ("why this fictional company is in the sample") is built from them.

| Archetype | Count | What it teaches |
|---|---|---|
| Compounder | 14 | Double-digit growth, high returns on capital, little debt |
| Cyclical | 10 | Sales and margins that follow an industry cycle; P/E is lowest at the peak |
| Cash-rich and debt-free | 6 | No borrowings or leases, so finance cost is exactly 0 and interest coverage is "No interest cost" |
| Leveraged utility | 6 | Heavy fixed assets funded mostly with debt; thin interest cover |
| Value trap | 6 | Low P/E with shrinking sales and slipping margins |
| Turnaround | 6 | Thin profits, then losses in FY2020–FY2024, then a return to profit from FY2025 with lower borrowing |
| Expensive grower | 6 | Fast growth with a very high P/E |
| Dividend payer | 6 | High payout (about 60–80% of profit), modest growth |
| Red-flag cases | 6 | 2 receivable build-up, 2 high and rising promoter pledge, 2 weak cash conversion |
| Serial diluter | 3 | New shares issued every year (share count up more than 5% a year) |
| Loss-maker | 4 | Operating losses funded by equity and debt; priced on sales |
| Negative net worth | 2 | Accumulated losses exceed capital |
| Good bank | 6 | Steady loan growth, low NPAs, healthy ROA |
| Stressed bank | 4 | NPA cycle in the middle years, loss years and fresh capital |
| Typical | rest | Ordinary members that make peer groups large enough for medians and percentiles; they grow a little slower and earn slightly lower margins than the sector leaders |

| Trait | Count | Effect |
|---|---|---|
| New listing | 4 | Only FY2023–FY2026 are published, so 5-year and 10-year figures show "Not enough history" |
| Transition year | 1 | FY2021 is flagged `transition` (a merger enlarged the business); growth and averages across it are not calculated |
| Standalone basis | 4 | `statement_basis = "standalone"`, no minority interest |
| No quarterly block | 4 | `quarterly = []`, so TTM figures fall back to the latest financial year |
| No shareholding block | 3 | `shareholding = []` |
| Company type omitted | 6 | `company_type = null`, so the app infers it from the sector name (Banks, Finance, Insurance) |

The archetype checks in `src/lib/sample/sample.test.ts` use simple arithmetic on the raw fields
(for example, compounders have an average ROCE above 15% over FY2022–FY2026, and the weak cash
conversion cases have five-year CFO below 70% of five-year profit). Calibration against the full
metrics engine and the check rules is part of the integration tests.

### 1.4 Determinism

- `generateSampleDataset({ seed = 24301, count = 150 })` is pure and synchronous. It never reads
  the clock, never calls `Math.random` and keeps no module state.
- Each company has its own pseudo-random stream, `mulberry32(fnv1a32("<seed>:<slug>"))`, where
  the slug is a stable roster id such as `it-01`. Adding a company never changes the others.
- Only `+ − × ÷` and `Math.round/floor/min/max/abs/sqrt` are used for figures (plus `Math.imul`
  inside the hash and the generator), so the output is identical on every JavaScript engine.
  Business cycles come from small integer-indexed tables, not from trigonometric or exponential
  functions. A test scans the source to enforce this.
- Generating twice gives deep-equal output, whatever the system clock says.

### 1.5 Accounting identities

All money is rounded to 2 decimals (paise). Tests check every identity below for every
company-year, within ₹0.01 crore (₹0.05 crore where a dividend total is recomputed from the
rounded dividend per share).

**Non-financial companies**

1. Sales roll forward with trend, cycle and noise. EBITDA = sales × margin; operating expenses =
   sales − EBITDA; COGS = operating expenses × a COGS share (null for service businesses).
2. Receivables = debtor days ÷ 365 × sales; inventories and payables use the same pattern on COGS,
   or on sales (inventories) and operating expenses (payables) when there is no COGS.
3. Depreciation = rate × opening net fixed assets; net fixed assets = opening + capex − depreciation.
4. PBT = EBITDA + other income − depreciation − finance cost + exceptional items;
   tax = rate × max(PBT, 0); net profit = PBT − tax; owners' profit = net profit × (1 − minority share).
5. CFO = net profit + depreciation − Δ(receivables + inventories − payables).
6. Cash = opening cash + CFO − capex − dividends + Δborrowings + equity issued. When cash would
   fall below a floor (2% of sales), current borrowings are drawn.
7. Other equity = opening other equity + owners' profit − dividends + share premium;
   equity share capital = shares × face value; minority interest grows by the minority share of profit.
8. Total current assets and liabilities are built from their parts. Total assets equal the larger
   of the asset side and the liability side; the difference is a plug in other non-current items
   that is never negative. Current investments are held constant, lease liabilities are matched by
   right-of-use assets (kept in other non-current assets), and other current assets equal other
   current liabilities, so none of these moves cash and the plug stays at rounding size.
9. The four quarters of every published financial year add up **exactly** to the annual figure:
   the split is done in paise and Q4 takes the remainder.
10. Reference price = P/E × TTM earnings per share, with the P/E drawn from the sector or
    archetype range. Companies without positive TTM earnings are priced on sales instead.

**Lenders (banks, NBFCs, housing finance)**

- Gross advances grow each year. The gross NPA ratio follows a deterministic cycle (a sharper one
  for stressed banks); net NPA = gross NPA × (1 − provision coverage); net advances = gross
  advances − provisions held.
- Interest earned = yield × average advances + yield × average investments; interest expended =
  cost of funds × average deposits and borrowings; other income = fee ratio × average advances.
- Operating expenses = cost-to-income × (net interest income + other income); provisions =
  credit cost × average advances.
- PBT = interest earned − interest expended + other income − operating expenses − depreciation −
  provisions; net profit = PBT − tax.
- Equity is raised when net worth would fall below a minimum share of total assets.
- CFO is the balancing item of the cash identity: cash = opening cash + CFO − dividends +
  Δborrowings + equity issued.
- Fields that do not apply to lenders (COGS, finance cost, current assets and liabilities,
  inventories, receivables, payables, fixed assets, capex, leases) are `null`, never 0.

**Insurers** carry minimal fields only: revenue, operating expenses, depreciation, profit lines,
dividends, equity, total assets, cash and operating cash flow. Everything else is `null`.

**Shareholding.** Promoter, FII and DII holdings move slowly; their total never exceeds 100% (the
public holds the rest). The pledge is a percentage of the promoter holding. Only the two high-pledge
red-flag cases carry a pledge above 10%.

### 1.6 Names and the real-name guard

- Names combine an invented syllable stem with a sector noun, for example "Varnex Infotech Ltd".
  The stems were written and reviewed by hand to avoid well-known Indian companies, groups and
  brands. Symbols are 5–10 invented upper-case letters (the first six letters of the stem plus a
  sector code) and are unique.
- `src/test/fixtures/sample/real-name-denylist.ts` holds about 320 well-known NSE symbols and about
  190 group and brand words (Tata, Reliance, Adani, Birla, Bajaj, Mahindra, HDFC, ICICI, Infosys,
  Wipro, Kotak, Godrej, Hero, Maruti, Airtel, Vedanta, Jindal, Murugappa, TVS and others). Tests
  check every generated name, symbol and note, and the new public files, against it. The list is
  test-only and never ships in the app.
- A private or unlisted company could still share an invented name by chance. The "(fictional)"
  label, the synthetic flag and the provenance notes cover that case.

### 1.7 Stress set

`generateSampleDataset({ count: 5000 })` builds a stress-test dataset for performance tests. It
reuses the 150 profiles in order, with symbols `SYN0001` … `SYN5000` and names such as
"Synthetic Company 0001 (stress test)". A count of 150 or fewer returns the first companies of the
roster with their normal names.

### 1.8 Public sample files

`src/lib/sample/sample-files.test.ts` writes five files in `public/sample-data/` for 12 archetype
companies, using `toMatchFileSnapshot`:

- `funda-sample-12.json` — canonical dataset JSON;
- `funda-sample-companies.csv`, `funda-sample-annual.csv`, `funda-sample-quarterly.csv` and
  `funda-sample-shareholding.csv` — the same data as four wide CSV files with canonical field
  names as headers. Missing values are empty cells, never 0.

The first line of each CSV is
`# Fictional sample data generated by Funda Scanner (seed 24301). It describes no real company.`,
which the importer skips. After changing the generator, run `npm run sample:files` and commit the
regenerated files; in CI a file that differs fails the test.

## 2. Learning content

### 2.1 Glossary

`src/lib/learn/glossary.ts` holds a hand-written entry for every **basic-level** base metric (25)
and every **intermediate-level** base metric (49). Variants such as `roce_avg_5y` use the entry of
their base metric. Each entry has:

- **What it tells you** — two or three sentences in plain language;
- **How to read it** — which direction is better and what to compare it with;
- **A worked example** — round numbers in ₹ crore;
- **Rules of thumb** — each with its context (for example "Non-financial companies" or "Banks").
  They are labelled as rules of thumb in the app and are never presented as standards;
- **Pitfalls** — common ways the figure misleads;
- **Not applicable** — why the metric is not shown for some company types (for example, why ROCE
  does not apply to lenders);
- **Related metrics** — links to other base metrics.

The text is original, written in simple, formal Indian English, and free of advice wording (a
test checks it against the list of forbidden words in §F.6 of the specification). Thresholds quoted as rules of thumb
match those used by the app's checks, so a learner sees the same number in both places. They are
listed in §H.2 of the specification for review by an Indian-market educator.

### 2.2 Concepts

`src/lib/learn/concepts.ts` explains ten ideas used throughout the app: trailing twelve months,
CAGR, financial years, lakh and crore, consolidated and standalone accounts, percentiles and peer
groups, why lenders are read differently, why some values are missing, what a screen cannot tell
you, and the fictional sample. Bodies are plain text paragraphs and are rendered as text, never
as HTML.

### 2.3 Facts quoted in the content

Where the content states a fact about Indian rules, it is limited to well-established points:
SEBI's mutual-fund categories by market-capitalisation rank (top 100 large caps, next 150 mid
caps), the minimum public shareholding of 25%, the 25.17% effective rate under Section 115BAA,
the taxation of dividends in the hands of shareholders, and the 45-day payment limit for dues to
micro and small enterprises. These should be re-checked whenever the rules change.

## 3. Checks and red flags

The company page shows a set of rule-based **checks** (a "met" result is a pass) and **red flags**
(a "met" result means the flag is triggered; the UI heading for these is "Worth checking"). The
rules live in `src/lib/insights/checks/*.ts` and implement §C.9 of the specification.

Every block that shows them carries the footer: "Rule-based observations on the data you loaded.
Not a recommendation."

### 3.1 How a rule works

- **Each rule is a visible FSQL query** (see `docs/query-language.md`), for example
  `roce_avg_5y > 15`. The query is shown next to the result, so anyone can run the same rule as a
  screen. Rules are compiled by the same query engine as the Screener, once per loaded dataset,
  and evaluated for every company in one pass.
- **Thresholds are rules of thumb**, not standards or regulatory limits. They are common
  starting points for reading Indian company accounts and are meant to prompt questions, not to
  rank companies. A company can fail a check for good reasons (a capital-heavy business, a
  cyclical low), and a red flag can have an innocent explanation that the annual report gives.
- **Results.** For each company a rule is:
  - *not applicable* when it is not designed for the company's family (for example, ROCE checks
    for a bank, or bad-loan checks for a manufacturer);
  - *not evaluated* when a value it needs is missing, with the reason (not enough history,
    loss-making, negative net worth, a transition year inside the window, and so on). Missing data
    is never treated as a pass, a fail or a zero;
  - otherwise *met* or *not met*, using three-valued logic: an `AND` with one false part is not
    met even if another part is missing, and an `OR` with one true part is met.
- **No interest cost.** A company that reports no finance cost has no interest coverage ratio.
  "Interest well covered" treats it as passing and "Weak interest cover" as not triggered, and the
  message says "no interest cost".
- **Messages** are filled from the query engine's explanation of each clause, so they always
  quote the measured value, its period and the threshold, for example "ROCE · 5Y avg 22.4%
  (FY22–FY26); needs above 15%." Yearly rules list every year's value; rules that compare two
  measures ("at most 1.2 times debtor days three years earlier") also list the inputs.
- **Evidence** lists the metrics behind each rule with their values, so the reader can open the
  relevant section of the company page and the glossary entry for each metric.

### 3.2 Checks

`NF` = non-financial companies (including brokers and asset managers), `L` = lenders (banks, NBFCs,
housing finance companies), `All` = every family including insurers.

| Area | Id | Title | Query | Applies to |
|---|---|---|---|---|
| Profitability | PR-01 | Earns well on its capital | `roce_avg_5y > 15` | NF |
| Profitability | PR-02 | Return held up every year | `every(roce > 12, 5y)` | NF |
| Profitability | PR-03 | Margin is steady | `opm_stdev_5y < 4` | NF |
| Profitability | PR-04 | Margin not falling | `opm >= opm_avg_5y - 1` | NF |
| Growth record | GR-01 | Sales compounding | `sales_cagr_5y > 10` | NF |
| Growth record | GR-02 | Profit compounding | `net_profit_cagr_5y > 10` | NF |
| Growth record | GR-03 | Grew in most years | `count(sales_growth > 0, 5y) >= 4` | NF |
| Growth record | GR-04 | Growth not diluted | `eps_cagr_5y >= net_profit_cagr_5y - 2` | NF |
| Balance-sheet strength | BS-01 | Modest borrowing | `debt_equity < 0.5` | NF |
| Balance-sheet strength | BS-02 | Interest well covered | `interest_coverage > 4` | NF |
| Balance-sheet strength | BS-03 | Short-term bills covered | `current_ratio > 1.2` | NF |
| Balance-sheet strength | BS-04 | Outside the distress zone | `altman_z > 2.6` | NF |
| Cash conversion | CC-01 | Profit backed by cash | `cum_cfo_to_pat_5y > 0.8` | NF |
| Cash conversion | CC-02 | Positive free cash in most years | `count(fcf > 0, 5y) >= 3` | NF |
| Cash conversion | CC-03 | Low accruals | `accruals_ratio < 5` | NF |
| Cash conversion | CC-04 | Collections not slowing | `debtor_days <= 1.2 * debtor_days[fy-3]` | NF |
| Valuation vs peers | VA-01 | P/E below industry median | `pe < industry_median(pe)` | NF |
| Valuation vs peers | VA-02 | Earnings yield above industry median | `earnings_yield > industry_median(earnings_yield)` | NF |
| Valuation vs peers | VA-03 | Reasonable FCF yield | `fcf_yield_3y > 3` | NF |
| Shareholder returns | SR-01 | Dividend paid 5 years in a row | `dividend_streak >= 5` | All |
| Shareholder returns | SR-02 | Shares part of profit | `dividend_payout_avg_3y >= 15` | All |
| Shareholder returns | SR-03 | Book value per share compounding | `bvps_cagr_5y > 10` | All |
| Profitability | LP-01 | Earns well on its assets | `roa_avg_3y > 1` | L |
| Profitability | LP-02 | Earns well on shareholders' equity | `roe_avg_3y > 12` | L |
| Asset quality | AQ-01 | Few bad loans | `gnpa_ratio < 4` | L |
| Asset quality | AQ-02 | Few bad loans after provisions | `nnpa_ratio < 1.5` | L |
| Asset quality | AQ-03 | Bad loans well provided for | `provision_coverage > 60` | L |
| Efficiency | EF-01 | Runs at a reasonable cost | `cost_to_income < 50` | L |
| Efficiency | EF-02 | Loan losses kept low | `credit_cost < 1.5` | L |

That is 29 checks: 19 for non-financial companies, 3 shareholder-return checks for every family
and 7 for lenders. (The specification's summary line says 26; its table, implemented here, lists
29.)

Notes on the thresholds:

- **Returns (PR-01, PR-02, LP-01, LP-02).** ROCE of 15% and ROE of 12% to 15% are widely used
  rules of thumb for a business that earns more than its cost of capital in India; ROA of 1% is a
  common yardstick for lenders, whose assets are mostly loans.
- **Margins (PR-03, PR-04).** A standard deviation below 4 percentage points means the operating
  margin moved in a narrow band; "not falling" allows a 1-point dip below the 5-year average.
- **Growth (GR-01 to GR-04).** 10% a year roughly doubles a figure in seven years. GR-04 asks
  whether earnings per share kept pace with total profit, which they do not when new shares are
  issued.
- **Balance sheet (BS-01 to BS-04).** Debt below half of equity, interest covered more than four
  times and current assets above 1.2 times current liabilities are conservative starting points.
  The Altman Z'' cut-offs (above 2.6 safe, below 1.1 distress) come from the model itself
  (§C.6 of the specification and `docs/metrics.md`).
- **Cash conversion (CC-01 to CC-04).** Over five years, operating cash flow should be close to
  reported profit; 0.8 allows for growth in working capital. Accruals below 5% of assets and
  debtor days that have not risen by more than a fifth in three years point the same way.
- **Valuation (VA-01 to VA-03).** These compare the company with the median of its industry
  **among the companies in your data** (falling back to the sector or peer class when the industry
  has fewer than five members). A cheaper-than-median company is not necessarily good value.
- **Lender asset quality and cost (AQ, EF).** Gross NPAs below 4%, net NPAs below 1.5%,
  provision coverage above 60%, cost to income below 50% and credit cost below 1.5% are common
  reference points in Indian bank and NBFC analysis.

### 3.3 Red flags ("Worth checking")

| Id | Title | Query | Applies to |
|---|---|---|---|
| RF-01 | Profit not backed by cash | `cum_cfo_to_pat_5y < 0.7` | NF |
| RF-02 | Receivables rising faster than sales | `debtor_days > 1.3 * debtor_days[fy-3] AND sales_cagr_3y < 10` | NF |
| RF-03 | High or rising pledge | `pledged_pct > 25 OR pledged_pct_chg_1y > 5` | All |
| RF-04 | Promoters cut stake sharply | `promoter_holding_chg_1y < -5` | All |
| RF-05 | Large other income | `other_income_to_pbt > 30` | NF |
| RF-06 | Weak interest cover | `interest_coverage < 1.5` | NF |
| RF-07 | Negative net worth | `net_worth < 0` | All |
| RF-08 | Persistently low tax | `every(effective_tax_rate < 10, 3y)` | All |
| RF-09 | Distress zone | `altman_z < 1.1` | NF |
| RF-10 | Repeated exceptional items | `count(abs(exceptional_items) > 0.2 * abs(pbt), 3y) >= 2` | All |
| RF-11 | Equity dilution | `shares_outstanding_ye > 1.05 * shares_outstanding_ye[prev]` | All |
| RF-12 | Inventory building up | `inventory_days > 1.3 * inventory_days[fy-3] AND sales_cagr_3y < 10` | NF |
| LF-01 | Bad loans rising | `gnpa_ratio - gnpa_ratio[prev] > 1` | L |
| LF-02 | Thin provisions | `provision_coverage < 50` | L |
| LF-03 | High credit cost | `credit_cost > 2.5` | L |
| LF-04 | High pledge (lenders) | `pledged_pct > 25` | L |

A red flag is a prompt to read the annual report and the notes to accounts, not a verdict. Some
have ordinary explanations: a holding company earns mostly other income (RF-05); a company in a
tax holiday pays little tax (RF-08); a fast-growing company may raise equity (RF-11). Pledge is
measured as a share of the promoters' own holding; when there is no promoter holding the pledge
ratio is not meaningful and RF-03 and LF-04 are not evaluated.

### 3.4 Red-flag count

`red_flag_count` is a column on the metric store, so it can be shown in the Screener and used in
queries (the "Value with a safety check" template uses `red_flag_count = 0`). It is the number of
red flags of the company's family that are triggered. When more than four of the family's red
flags cannot be evaluated, the count is shown as missing ("Too few inputs to calculate") instead
of a reassuring 0. No rule may use `red_flag_count` itself, which a test checks.

### 3.5 Area summaries

The "At a glance" row groups the checks that apply to a company by area (Profitability, Growth
record, Balance-sheet strength, Cash conversion, Valuation vs peers, Shareholder returns, Asset
quality, Efficiency) and reports "met of evaluated" with the total, so "3 of 4 checks passed, 1 not
evaluated" is distinguishable from "3 of 4 failed". Red flags are counted separately.

### 3.6 Calibration on the sample

Tests in `src/lib/insights/*.test.ts` run every rule on the 150-company sample and on small crafted
fictional companies, and check that:

- every rule compiles without errors, uses only catalogue metrics and never `red_flag_count`;
- each message quotes its thresholds and the values compared;
- the compounders pass at least 14 of their 16 quality checks;
- the red-flag teaching cases trigger the flag they were built for (receivables, pledge, cash
  conversion, negative net worth), and every red flag can be triggered by a crafted case;
- at least 70% of non-financial companies have at most one red flag, and no flag fires for more
  than a fifth of the companies it applies to;
- lenders get the lender checks, and the non-financial checks show as not applicable for them.
