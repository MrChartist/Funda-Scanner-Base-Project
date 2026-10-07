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
  "Sample · no date". The financial-year labels are for illustration only and describe no real
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

The rule-based checks and red flags (§C.9 of the specification) are documented here together
with their thresholds when the insight rules are implemented.
