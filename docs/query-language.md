# FSQL: the Funda Scanner query language (v1)

FSQL is a small, readable language for describing a stock screen in terms of a company's
fundamentals. A query is a list of conditions. A company matches when **every** condition is
true for it. Companies whose data is missing are never counted as matches; they are listed as
"not evaluated", with the reason.

```text
# Quality compounders
every(roce > 15, 5y)
debt_equity < 0.5          # a conservative balance sheet
cum_cfo_to_pat_5y > 0.8
SORT BY roce_avg_5y DESC
LIMIT 50
```

Everything in this document is implemented in `src/lib/query/**` and `src/lib/screen/**`, and
the examples are checked by the test suite (`src/test/fixtures/query/golden-queries.ts`).
Thresholds used in examples are illustrations for learning, not recommendations.

---

## 1. Writing conditions

| You write | Meaning |
|---|---|
| `roce > 15` | ROCE for the latest financial year is above 15% |
| `roe BETWEEN 15 AND 25` | 15 ≤ ROE ≤ 25 |
| `roe NOT BETWEEN 15 AND 25` | outside that range |
| `pe < industry_median(pe)` | P/E below the median P/E of the company's industry |
| `sector = "Cement"` | text comparison (case-insensitive, trimmed) |
| `sector IN ("Cement", "Metals & Mining")` | one of a list |
| `is lender` / `IS NOT bank` | company-type tests |
| `has(gross_margin)` | the value is available (never "unknown") |
| `NOT is lender` | negation |
| `(roe > 20 OR roce > 20) AND NOT is lender` | brackets group conditions |

Comparison operators: `>` `>=` `<` `<=` `=` `!=` (also `==` and `<>`).
Arithmetic: `+` `-` `*` `/` and brackets, for example `total_debt < 0.7 * total_debt[fy-3]`.

**Joining conditions.** Write `AND` or `OR`, or put each condition on its own line: a new line is
read as `AND` (the editor shows a faint "AND" in the margin). A new line does not become `AND`
inside brackets, after an operator such as `>`, or while `BETWEEN` is waiting for its `AND`.
`&&` and `||` are not accepted; write `AND` and `OR`.

**Precedence** (tightest first): brackets; period selectors `[..]`; unary minus; `*` `/`;
`+` `-`; comparisons, `BETWEEN` and `IN`; `NOT`; `AND` (including the new-line `AND`); `OR`.
So `a > 1 OR b > 2 AND c > 3` means `a > 1 OR (b > 2 AND c > 3)`. Comparisons cannot be chained:
`10 < roce < 20` is an error with the suggested fix `roce BETWEEN 10 AND 20`.

**Comments** start with `#` and run to the end of the line. They are kept in Query mode only.

**Keywords** are case-insensitive: `AND OR NOT BETWEEN IN IS SORT BY ASC DESC LIMIT`.
`ORDER BY` is read as `SORT BY`, and a leading `WHERE` is ignored (both with a note).
`LET`, `FROM`, `TOP`, `SELECT`, `GROUP` and `RANK` at the start of a condition are reserved and
give an error with a hint (choose the universe with the Universe selector above the query; rank
with `SORT BY rank(x)`).

## 2. Numbers and units

* Numbers have no commas: write `100000`, `1_00_000` or `1 lakh`, never `1,00,000`.
* Suffixes, attached or after one space: `%`, `x`, `cr`/`crore`/`crores`, `k` (× 1,000) and
  `lakh`/`lakhs` (× 1,00,000). Amounts are in ₹ crore, so `market_cap > 1.5lakh` means
  ₹1.5 lakh crore and `market_cap BETWEEN 500cr AND 20k` means ₹500 crore to ₹20,000 crore.
* A number without a suffix takes the unit of the other side.
* Suffixes are checked: `%` suits percentages and percentage points, `x` suits multiples, and
  `cr`/`k`/`lakh` suit ₹ crore amounts. `debt_equity < 50%` is an error ("Debt to equity is a
  multiple (x), not a percentage. Write 0.5, not 50%.").
* Percentages are stored as percent numbers (15.2 means 15.2%). `roe > 0.15` runs but warns
  that you probably meant 15.
* Adding an amount in ₹ crore to a percentage gives a warning.

**Equality uses display precision.** `roe = 15` is true for any ROE that displays as 15.0%
(the tolerance is half a unit of the last decimal shown, or of the decimals you write:
`roe = 15.00` is stricter). Between two calculations the tolerance is a relative 1e-9.

## 3. Metric names

Every metric has a stable id (for example `roce`, `debt_equity`, `sales_cagr_5y`). You can also
write its label or short name: `Return on capital employed`, `debt to equity`, `ROCE`, `D/E`.

* Names are matched as **ordered words**, longest match first, so "price to earnings" (P/E) and
  "earnings to price" (E/P) never get confused.
* `p/e`, `p/b`, `d/e` and `ev/ebitda` written without spaces are read as names; any other
  `a/b` is division (`market_cap/sales`).
* Names with words such as "and" can be written between backticks:
  `` `Cash and bank balances` > 0.2 * market_cap ``.
* Variants are written as ids or as words: `roce_avg_5y`, `roce 5y avg`, `average roce 5 years`.
* A misspelt name gives up to three suggestions: `debt_equty` → "Did you mean Debt to equity
  (debt_equity)?".
* Phrases such as "last year" are ambiguous and are rejected with guidance: write `sales[fy]`
  for the latest financial year or `sales[prev]` for the year before. Idioms such as
  "preceding year" or "N years back" are not accepted.

Text fields `sector`, `industry`, `symbol` and `name` compare as text with `=`, `!=` and `IN`.

## 4. Periods

A bare metric means:

| Metric kind | Bare reference |
|---|---|
| Yearly (most ratios and line items) | the latest financial year (FY) |
| Quarterly (`q_sales`, `q_net_profit`, …) | the latest quarter |
| Shareholding (`promoter_holding`, …) | the latest shareholding quarter |
| Latest-only (`pe`, `market_cap`, `dividend_yield`, scores, …) | its single current value |

There is **no implicit TTM**. Write `net_profit[ttm]` or `net_profit_ttm` for the trailing
twelve months. The plain-English preview always states the period.

Selectors:

| Selector | Meaning |
|---|---|
| `[fy]`, `[fy-3]` | the latest FY, or 3 FYs before it |
| `[ttm]`, `[ttm-1]` | the latest four quarters, or the four before them (only for metrics with a TTM form) |
| `[q]`, `[q-4]` | the latest quarter, or 4 quarters before it (quarterly and shareholding metrics) |
| `[prev]` | one period before, in the metric's own frequency and relative to its context |

Errors: a selector on a latest-only metric (`pe[fy-1]`: "P/E has no yearly history because past
prices are not stored"), `[ttm]` on a metric without a TTM form, and a quarter selector on a yearly
metric (or the reverse). An offset beyond a company's history is not an error: that company is
simply not evaluated ("Not enough history").

## 5. Functions

| Function | Meaning |
|---|---|
| `abs(x)`, `min(a, b, …)`, `max(a, b, …)` | element-wise; any missing input gives a missing result |
| `growth(a, b)` | (a ÷ b − 1) × 100; not meaningful when b ≤ 0 |
| `has(x)` | true when x is available, otherwise false (never unknown) |
| `avg`, `median`, `min`, `max`, `sum`, `stdev` `(x, Ny)` | over the last N financial years (2 to 15) |
| `cagr(x, Ny)` | ((x now ÷ x N years earlier)^(1/N) − 1) × 100; both ends must be positive |
| `every(c, Ny)` / `any(c, Ny)` | the condition held in each / at least one of the last N years |
| `count(c, Ny)` | in how many of the last N years the condition held |
| `streak(c)` | consecutive years, counting back from the latest, in which the condition held |
| `pctl(x)`, `sector_pctl(x)`, `industry_pctl(x)` | percentile (0–100, ascending) among peers |
| `sector_median(x)`, `industry_median(x)` | median of the company's peer group |
| `rank(x [, ASC \| DESC])` | rank among the matching companies; only after `SORT BY` |

**Windows.** Inside a window function metrics are read year by year: write bare yearly metrics,
optionally with `[prev]` (the year before the window's current year). Other selectors, quarterly
or latest-only metrics, and peer functions are errors inside a window. Every year of the window
must have a value, otherwise the result is "Not enough history"; a restated or transition year in
the window makes averages and CAGRs "not comparable". `Nq` windows are reserved for a later
version. `cagr()` applies only to amounts and per-share values, not to ratios such as ROCE.

**Peer functions** are computed over the **whole loaded dataset**, within the company's peer class
(non-financial companies, banks, NBFCs and insurers are never mixed), whatever universe you pick.
A sector or industry group with fewer than 5 companies falls back to the sector and then to the
whole class. A median needs at least 3 values and a percentile at least 5; below that the result
is "Too few comparable companies in your data".

**rank()** ranks only the companies that match the conditions (so adding a company that does not
match changes nothing). 1 is the highest value (DESC, the default) or the lowest (ASC). Ties share
the average rank and missing values rank last. A warning appears when the matches mix peer classes.

## 6. Missing data (three-valued logic)

Every condition is true, false or **unknown** for a company:

* Any comparison with a missing value is unknown, and the reason is kept ("Not provided",
  "N/A for lenders", "Not enough history", …).
* `AND` is false if any part is false, otherwise unknown if any part is unknown.
  `OR` is true if any part is true, otherwise unknown if any part is unknown. `NOT unknown` is
  unknown.
* Only companies for which the whole query is **true** match. Unknown companies are grouped
  under "not evaluated", by reason, for example "12 lenders not evaluated: ROCE does not apply to
  banks and NBFCs".
* Arithmetic with a missing value gives a missing value; division by zero is "Not meaningful".
* **No interest cost:** interest coverage for a company with no finance cost is treated as
  infinitely high in comparisons (`interest_coverage > 4` passes, `< 1.5` fails), and the
  explanation says "no interest cost, treated as passing". Arithmetic on it gives a missing value.
* Missing values are never treated as zero, and there is no function that fills them in. Use
  `has(x)` to require a value explicitly.

## 7. Sorting and limits

```text
pe < 20 SORT BY roce_avg_5y DESC, pe ASC LIMIT 50
is non_financial AND earnings_yield > 0 SORT BY rank(earnings_yield) + rank(roic) ASC LIMIT 30
```

`SORT BY` takes one or more numeric expressions, each `DESC` (the default) or `ASC`. Missing
values sort last in either direction; ties are broken by market capitalisation (largest first) and
then by symbol. Without `SORT BY`, results are ordered by market capitalisation. `LIMIT n`
(1 to 1000) keeps the first n matches and shows a note such as "Showing the top 30 of 54 matches
by your SORT BY." Clicking a column header re-sorts the shown rows only; it never changes which
companies the `LIMIT` keeps.

## 8. Diagnostics

Every problem is reported with its position, a message and, where possible, a suggested fix. After
an error the rest of the query is still checked, so several problems are reported at once. While
the query has an error, the previous results stay on screen, greyed. Limits: 50 conditions,
nesting depth 20 and 4,000 characters.

| Code | Example | Message (abridged) |
|---|---|---|
| `E_UNEXPECTED_END` | `roce >` | The query ends too early. A value is expected after '>'. |
| `E_UNBALANCED_PAREN` | `roce > 15 AND (pe < 20` | This '(' has no matching ')'. |
| `E_UNKNOWN_METRIC` | `debt_equty < 0.5` | Unknown metric "debt_equty". Did you mean Debt to equity (debt_equity)? |
| `E_TYPE_BOOL_EXPECTED` | `roce` | 'ROCE' is a number. Compare it with something, for example ROCE > 15. |
| `E_CHAINED_COMPARISON` | `10 < roce < 20` | Comparisons cannot be chained. Use BETWEEN for a range. |
| `E_UNIT_MISMATCH` | `debt_equity < 50%` | Debt to equity is a multiple (x), not a percentage. Write 0.5, not 50%. |
| `W_LIKELY_FRACTION` | `roe > 0.15` | ROE is stored in percent. Did you mean 15 instead of 0.15? |
| `E_COMMA_IN_NUMBER` | `market_cap > 1,00,000` | Commas cannot be used inside numbers in a query. |
| `E_NO_HISTORY` | `every(pe < 20, 5y)` | P/E has no yearly history because past prices are not stored. |
| `E_SELECTOR_IN_WINDOW` | `every(roce[fy-1] > 15, 5y)` | Inside every(), metrics are read year by year; remove [fy-1]. |
| `E_PEER_IN_WINDOW` | `every(roce > industry_median(roce), 3y)` | Peer values are calculated for the latest period only. |
| `E_RANK_OUTSIDE_SORT` | `rank(roce) > 10` | rank() can be used only after SORT BY. |
| `E_WINDOW_REQUIRED` | `avg(roce) > 10` | avg() needs a period as its last input. |
| `E_WINDOW_RANGE` | `avg(roce, 30y) > 10` | The period must be between 2 and 15 years. |
| `E_QUARTER_WINDOW` | `every(roce > 15, 8q)` | Quarterly windows are not available yet. |
| `E_NOT_GROWTHABLE` | `cagr(roce, 5y) > 5` | CAGR suits amounts and per-share values, not ratios such as ROCE. |
| `E_AMBIGUOUS_PERIOD_WORD` | `sales last year > 100` | 'last year' is ambiguous here. |
| `E_BAD_SELECTOR` | `roce[ttm] > 10` | ROCE has no TTM form. |
| `E_TEXT_COMPARISON` | `sector > 5` | Sector is text. Check it with =, != or IN. |
| `E_RESERVED_WORD` | `FROM watchlist roce > 15` | Use the Universe selector above the query. |
| `E_LIMIT_RANGE` | `pe < 20 LIMIT 0` | LIMIT must be between 1 and 1000. |
| `E_UNEXPECTED_TOKEN` | `pe < 20 AND AND roe > 10` | 'AND' is not expected here. |
| `E_UNTERMINATED_STRING` | `sector = "cement` | This text has no closing quote. |
| `E_UNEXPECTED_CHAR` | `roce @ 5` | The character '@' cannot be used in a query. |
| `E_UNKNOWN_FUNCTION` | `foo(roce) > 1` | Unknown function 'foo'. Available: avg, median, … |

Other warnings: `W_NOT_APPLICABLE_SOME` (a metric does not apply to some company types, for
example lenders), `W_LOW_COVERAGE` and `W_NO_COVERAGE` (few or no companies have the data),
`W_MIXED_UNITS`. Notes: `I_IMPLICIT_AND`, `I_DEFAULT_PERIOD`, `I_KEYWORD_SYNONYM`.

## 9. Plain English, canonical text and rule chips

* Every query has a plain-English rendering, for example `every(roce > 15, 5y)` → "ROCE was
  above 15% in each of the last 5 financial years". It always ends with "Companies with missing
  data are not counted as matches."
* The **canonical text** uses metric ids, lower-case functions, upper-case keywords, an explicit
  `AND`, one line, and numbers with suffixes resolved (`1.5lakh` → `150000`, `15%` → `15`).
  Compiling the canonical text gives the same canonical text.
* **Rule chips** (Simple rules mode): each top-level condition of the form `metric[selector] op
  number` or `metric BETWEEN a AND b` becomes an editable chip; `is X` becomes a type chip;
  anything else becomes an "Advanced rule" chip showing its English text. `SORT BY` and `LIMIT` are
  kept as they are. Converting chips back to text writes one condition per line.

## 10. Screens: universe, results and explanations

* **Universe:** all companies, the watchlist, the portfolio, one sector or industry, or a list of
  symbols. Symbols that are not in the loaded data are reported, not silently dropped.
* **Funnel:** for each condition, how many companies pass, fail or are not evaluated; how many
  remain after each condition in the order written; and how many would match if that condition
  alone were removed. The condition that removes the most companies is marked.
* **Near misses:** companies that fail exactly one condition, nearest first, with the gap, for
  example "ROCE 14.2% (FY26), needs above 15% (0.8 points short)" or "failed in 1 of 5 years
  (FY23: 14.1%)". At most 50 are listed.
* **Why it matched:** for each condition and company, the values, the period, the result and, for
  window functions, every year.
* **Warnings:** companies whose TTM fell back to the latest financial year, companies whose data
  ends before the most common latest year, and companies with no yearly statements.
* **Columns:** name and sector, then market capitalisation, P/E, ROCE, ROE, debt to equity, 3-year
  sales CAGR and dividend yield; then up to 8 metrics used by the query (marked "from query"); then
  the columns you add. A footer row shows the median of each column over the matches.

## 11. Templates

Seven guided templates ship with the app: Quality compounders, Value with a safety check, Steady
growers, Reliable dividend payers, Turnaround watch, Lenders with clean books, and Earnings yield
and return on capital rank. Each explains its idea, every condition, what it will not find and whom
it does not suit. The thresholds are rules of thumb for study, not standards or recommendations.

## 12. Sharing, saving and exporting

* **Share link:** `?v=1&q=<query>&cols=roce_avg_5y,pe&sort=-roce_avg_5y&u=sector:Cement&t=quality&p=2&ps=50`.
  Defaults are left out. The older `?sector=Cement` form still works.
* **Saved screens** are stored in this browser only (key `funda-screens`, version 2). Names must be
  unique. Screens saved by earlier versions are converted to queries automatically; the original
  value is kept once under `funda-screens.v0-backup`. The screen library can be exported as a JSON
  backup and imported again later; imported screens whose names clash get " (2)", " (3)", ….
* **CSV export** starts with `#` lines that record the dataset, whether it is synthetic, the import
  time, the "as of" date (or "not provided"), the query, its English text and the catalogue
  version. Blank cells mean missing or not applicable. An `is_synthetic` column is included and
  sample-data exports are named `SAMPLE-…csv`. Text that a spreadsheet could read as a formula is
  prefixed with an apostrophe; numbers never are.

## 13. Not in this version

Quarterly windows (`8q`), `LET`, `FROM`, `TOP n PER`, weighted rank composites and formula columns
in the editor are planned for later versions. Technical indicators, price momentum and live quotes
are out of scope.
