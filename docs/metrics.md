# Metrics reference

<!-- Generated from src/lib/metrics/catalogue.ts by src/lib/metrics/docs.test.ts. Do not edit by hand; run `npm run docs:metrics`. -->

Catalogue version 2026.1. 129 base metrics (including line items that expose a field of your data directly).
Every figure is calculated only from the data you load; nothing is estimated or filled in.

## Conventions

- Money is in ₹ crore; per-share values in ₹; percentages are percent numbers (15.2 means 15.2%).
- A bare yearly metric means the latest financial year (FY). TTM (trailing twelve months) is the sum of the latest four
  quarters, matched by date; when any of them is missing, the latest FY figure is used and marked as such.
- avg(X) is the average of the opening and closing balance; in the first available year the closing balance is used and marked.
- owners' profit = net profit attributable to owners, or net profit when that is not given. EBITDA = revenue − operating expenses;
  EBIT = EBITDA + other income − depreciation; net worth = equity share capital + other equity; total equity = net worth + minority
  interest; total debt = borrowings (non-current and current) + lease liabilities; spare cash = cash and bank + current investments.
- The tax rate for ROIC is tax / PBT when PBT is positive and the ratio is between 0 and 50%; otherwise 25.17% (Section 115BAA).
- Only other income, exceptional items, minority interest, lease liabilities and current investments are treated as 0 when
  missing, and every such assumption is marked. Every other missing input leaves the figure empty, with a reason.
- Growth, CAGR, averages and totals across a restated or transition year are not calculated.
- Banks and NBFCs get lender metrics; metrics built for non-financial companies show "N/A for lenders".
- Peer statistics (percentiles, medians) never mix banks, NBFCs, insurers and non-financial companies. A group smaller than 5
  companies falls back from industry to sector to all companies of the same class; a median needs 3 values and a percentile 5.

## Why a figure can be empty

| Reason | Short text | Meaning |
|---|---|---|
| `missing_input` | Not provided | An input needed for this figure is not in your data. |
| `non_positive_denominator` | Not meaningful | The figure it divides by is zero or negative. |
| `negative_net_worth` | Negative net worth | Shareholders' funds are negative, so this ratio is not meaningful. |
| `loss_making` | Loss-making | The company made a loss (or zero profit) in the period, so this ratio is not meaningful. |
| `not_applicable_financial` | Not applicable | This measure does not apply to this type of company. |
| `insufficient_history` | Not enough history | Your data does not hold enough periods to calculate this figure. |
| `ev_not_positive` | EV not positive | Enterprise value is zero or negative (spare cash exceeds market value plus debt), so this ratio is not meaningful. |
| `no_interest_cost` | No interest cost | The company reports no finance cost, so there is no interest to cover. |
| `too_few_peers` | Too few comparable companies in your data | Fewer comparable companies than the minimum needed have data for this figure. |
| `transition_period` | Period not comparable (restated or transition year) | A restated or transition year falls in the period, so comparisons across it are not meaningful. |
| `no_price` | Price not provided | Your data does not include a reference price for this company. |
| `too_few_inputs` | Too few inputs to calculate | Too few of the required inputs could be evaluated to calculate this figure. |

## Period variants

| Suffix | Meaning |
|---|---|
| `_prev` | x[prev] |
| `_ttm` | x[ttm] |
| `_avg_3y` | avg(x, 3y) |
| `_avg_5y` | avg(x, 5y) |
| `_avg_10y` | avg(x, 10y) |
| `_min_5y` | min(x, 5y) |
| `_stdev_5y` | stdev(x, 5y) |
| `_cagr_3y` | cagr(x, 3y) |
| `_cagr_5y` | cagr(x, 5y) |
| `_cagr_10y` | cagr(x, 10y) |
| `_cum_3y` | sum(x, 3y) |
| `_cum_5y` | sum(x, 5y) |
| `_cum_10y` | sum(x, 10y) |
| `_chg_1q` | x - x[q-1] |
| `_chg_1y` | x - x[q-4] |
| `_chg_3y` | x - x[q-12] |

## Size

### Market capitalisation (`market_cap`)

What the stock market values the whole company at: share price × number of shares.

| | |
|---|---|
| Short label | Mkt cap |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | basic |
| Formula | price × shares_outstanding; else market_cap_supplied (Provided) |
| When it is missing | Price not provided; Not provided. |
| Other names | market cap, mcap |

### Reference price (`price`)

Closing price supplied with your data; not a live quote.

| | |
|---|---|
| Short label | Price |
| Unit | ₹, 2 decimals, neutral |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | basic |
| Formula | market.price as supplied |
| When it is missing | Price not provided. |
| Other names | share price |

### Enterprise value (`enterprise_value`)

Market value plus debt, minus spare cash: the rough cost of buying the whole business.

| | |
|---|---|
| Short label | EV |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | market_cap + total_debt + NCI − cash_like (latest FY) |
| When it is missing | Price not provided, Not provided. Not applicable to banks, NBFCs and insurers. |

### Sales (`sales`)

Money earned from the main business in the period, before any costs.

| | |
|---|---|
| Short label | Sales |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | basic |
| Formula | revenue (rawField); TTM Σ4q |
| When it is missing | Not provided. |
| Other names | revenue, revenue from operations, turnover, net sales |
| Variants | `sales_prev` = sales[prev]; `sales_ttm` = sales[ttm]; `sales_cagr_3y` = cagr(sales, 3y); `sales_cagr_5y` = cagr(sales, 5y); `sales_cagr_10y` = cagr(sales, 10y) |

### Operating profit (`ebitda`)

Profit from the core business before depreciation, interest and tax; other income is left out.

| | |
|---|---|
| Short label | EBITDA |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | intermediate |
| Formula | revenue − operating_expenses |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Variants | `ebitda_prev` = ebitda[prev]; `ebitda_ttm` = ebitda[ttm]; `ebitda_cagr_3y` = cagr(ebitda, 3y); `ebitda_cagr_5y` = cagr(ebitda, 5y); `ebitda_cagr_10y` = cagr(ebitda, 10y) |

### EBIT (`ebit`)

Profit before interest and tax.

| | |
|---|---|
| Short label | EBIT |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | ebitda + other_income − depreciation |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Other names | earnings before interest tax |
| Variants | `ebit_prev` = ebit[prev] |

### Net profit (`net_profit`)

Profit left for shareholders after all expenses, interest and tax.

| | |
|---|---|
| Short label | Net profit |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | basic |
| Formula | owners_pat; TTM Σ4q (owners ?? PAT) |
| When it is missing | Not provided. |
| Other names | profit, earnings |
| Variants | `net_profit_prev` = net_profit[prev]; `net_profit_ttm` = net_profit[ttm]; `net_profit_cagr_3y` = cagr(net_profit, 3y); `net_profit_cagr_5y` = cagr(net_profit, 5y); `net_profit_cagr_10y` = cagr(net_profit, 10y); `net_profit_cum_5y` = sum(net_profit, 5y) |

### Net worth (`net_worth`)

What shareholders own on paper: assets minus all liabilities.

| | |
|---|---|
| Short label | Net worth |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | equity_share_capital + other_equity |
| When it is missing | Not provided (negative shown). |
| Other names | book value, shareholders funds |
| Variants | `net_worth_prev` = net_worth[prev] |

### Total debt incl. leases (`total_debt`)

All borrowings, including lease obligations.

| | |
|---|---|
| Short label | Debt |
| Unit | ₹ crore, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | borrowings_nc + borrowings_c + lease_liabilities |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Other names | borrowings, total borrowings |
| Variants | `total_debt_prev` = total_debt[prev] |

### Net debt (`net_debt`)

Debt left after using spare cash; a negative figure means net cash.

| | |
|---|---|
| Short label | Net debt |
| Unit | ₹ crore, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | total_debt − cash_like (NetCash if < 0) |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Variants | `net_debt_prev` = net_debt[prev] |

### Capital employed (`capital_employed`)

Long-term money from shareholders and lenders.

| | |
|---|---|
| Short label | Capital employed |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | total_equity + total_debt |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |

## Valuation

### Price to earnings (`pe`)

Years of current profit you pay for the share; lower is cheaper, other things being equal.

| | |
|---|---|
| Short label | P/E |
| Unit | times (x), 1 decimal, lower is better |
| Applies to | all companies |
| History | latest only; period tag "TTM" |
| Level | basic |
| Formula | market_cap / net_profit_ttm (FyFallback) |
| When it is missing | Loss-making (≤ 0), Price not provided. |
| Other names | pe ratio, price earnings, price earnings ratio |

### Price to book (`pb`)

Market value compared with shareholders' book value.

| | |
|---|---|
| Short label | P/B |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | basic |
| Formula | market_cap / net_worth (latest FY) |
| When it is missing | Negative net worth, Price not provided. |
| Other names | pb ratio, price book, price to book value |

### Price to sales (`price_to_sales`)

Market value for every rupee of yearly sales.

| | |
|---|---|
| Short label | P/S |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | market_cap / sales_ttm (FyFallback) |
| When it is missing | Not meaningful, Price not provided. Not applicable to banks, NBFCs and insurers. |
| Other names | ps ratio, price sales |

### EV / EBITDA (`ev_ebitda`)

Value of the whole business compared with its operating profit.

| | |
|---|---|
| Short label | EV/EBITDA |
| Unit | times (x), 1 decimal, lower is better |
| Applies to | non-financial companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | enterprise_value / ebitda_ttm (FyFallback) |
| When it is missing | EV not positive, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | ev to ebitda, enterprise value to ebitda |

### Earnings yield (EBIT / EV) (`earnings_yield`)

Operating profit as a percentage of the business's total value.

| | |
|---|---|
| Short label | Earnings yield |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | op_ebit_ttm / EV × 100; op_ebit_ttm = Σ4q (rev − opex − dep), FY fallback |
| When it is missing | EV not positive; negative kept. Not applicable to banks, NBFCs and insurers. |
| Other names | ebit yield |

### Earnings to price (`earnings_to_price`)

Net profit as a percentage of market value; the inverse of P/E, defined for losses too.

| | |
|---|---|
| Short label | E/P |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | net_profit_ttm / market_cap × 100 |
| When it is missing | Price not provided; negative kept. |

### FCF yield (`fcf_yield`)

Latest year's free cash flow as a percentage of market value.

| | |
|---|---|
| Short label | FCF yield |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | fcf (latest FY) / market_cap × 100 |
| When it is missing | Not provided, Price not provided; negative kept. Not applicable to banks, NBFCs and insurers. |
| Other names | free cash flow yield |

### FCF yield (3Y average FCF) (`fcf_yield_3y`)

Three-year average free cash flow against market value; steadier than one year.

| | |
|---|---|
| Short label | FCF yield 3Y |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | latest only; period tag "3Y" |
| Level | intermediate |
| Formula | mean(fcf, latest 3 FY) / market_cap × 100 |
| When it is missing | Not enough history (all 3 needed), Price not provided. Not applicable to banks, NBFCs and insurers. |

### PEG ratio (`peg`)

P/E divided by 3-year EPS growth; around 1 or lower suggests a reasonable price for the growth.

| | |
|---|---|
| Short label | PEG |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies and lenders |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | pe / eps_cagr_3y |
| When it is missing | null if pe null; Not meaningful if CAGR ≤ 0 or null. Not applicable to insurers. |

### Price to Graham number (`price_to_graham`)

Below 1 means the price is under Graham's conservative ceiling based on earnings and book value.

| | |
|---|---|
| Short label | P/Graham |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | latest only; period tag "Latest" |
| Level | advanced |
| Formula | price / √(22.5 × eps_ttm × bvps) |
| When it is missing | Loss-making (eps ≤ 0), Negative net worth (bvps ≤ 0). Not applicable to banks, NBFCs and insurers. |

## Profitability

### Return on capital employed (`roce`)

Pre-tax return on all money from shareholders and lenders.

| | |
|---|---|
| Short label | ROCE |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | ebit / avg(capital_employed) × 100 |
| When it is missing | Not meaningful (avg CE ≤ 0). Not applicable to banks, NBFCs and insurers. |
| Variants | `roce_prev` = roce[prev]; `roce_avg_3y` = avg(roce, 3y); `roce_avg_5y` = avg(roce, 5y); `roce_avg_10y` = avg(roce, 10y); `roce_min_5y` = min(roce, 5y) |

### Return on invested capital (`roic`)

After-tax return on the capital actually used in operations, leaving out spare cash.

| | |
|---|---|
| Short label | ROIC |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | op_ebit × (1 − tax_rate) / avg(invested_capital) × 100 |
| When it is missing | Not meaningful (net-cash business). Not applicable to banks, NBFCs and insurers. |
| Variants | `roic_prev` = roic[prev]; `roic_avg_3y` = avg(roic, 3y); `roic_avg_5y` = avg(roic, 5y) |

### Return on equity (`roe`)

Profit earned for shareholders on the money they have in the business.

| | |
|---|---|
| Short label | ROE |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | owners_pat / avg(net_worth) × 100 |
| When it is missing | Negative net worth (avg ≤ 0). |
| Variants | `roe_prev` = roe[prev]; `roe_avg_3y` = avg(roe, 3y); `roe_avg_5y` = avg(roe, 5y); `roe_avg_10y` = avg(roe, 10y); `roe_min_5y` = min(roe, 5y) |

### Return on assets (`roa`)

Profit earned on everything the company owns; a key measure for banks.

| | |
|---|---|
| Short label | ROA |
| Unit | %, 2 decimals, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | pat / avg(total_assets) × 100 |
| When it is missing | Not meaningful. |
| Variants | `roa_prev` = roa[prev]; `roa_avg_3y` = avg(roa, 3y); `roa_avg_5y` = avg(roa, 5y) |

### Operating profit margin (`opm`)

Share of sales left as operating profit after running costs.

| | |
|---|---|
| Short label | OPM |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | basic |
| Formula | ebitda / revenue × 100; TTM ebitda_ttm / sales_ttm |
| When it is missing | Not meaningful (revenue ≤ 0). Not applicable to banks, NBFCs and insurers. |
| Other names | operating margin, ebitda margin |
| Variants | `opm_prev` = opm[prev]; `opm_ttm` = opm[ttm]; `opm_avg_3y` = avg(opm, 3y); `opm_avg_5y` = avg(opm, 5y); `opm_stdev_5y` = stdev(opm, 5y) |

### Gross margin (`gross_margin`)

Share of sales left after paying for the goods sold.

| | |
|---|---|
| Short label | Gross margin |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | (revenue − cogs) / revenue × 100 |
| When it is missing | Not provided if cogs null (never 0). Not applicable to banks, NBFCs and insurers. |
| Variants | `gross_margin_prev` = gross_margin[prev]; `gross_margin_avg_5y` = avg(gross_margin, 5y) |

### Net profit margin (`npm`)

Share of each rupee of sales that ends up as net profit.

| | |
|---|---|
| Short label | NPM |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | basic |
| Formula | pat / revenue × 100 |
| When it is missing | Not meaningful. |
| Other names | net margin, profit margin |
| Variants | `npm_prev` = npm[prev]; `npm_ttm` = npm[ttm]; `npm_avg_5y` = avg(npm, 5y) |

### Effective tax rate (`effective_tax_rate`)

Share of pre-tax profit paid as tax.

| | |
|---|---|
| Short label | Eff. tax rate |
| Unit | %, 1 decimal, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | tax_expense / pbt × 100 |
| When it is missing | Loss-making (pbt ≤ 0). |
| Other names | tax rate |
| Variants | `effective_tax_rate_prev` = effective_tax_rate[prev]; `effective_tax_rate_avg_3y` = avg(effective_tax_rate, 3y) |

### Other income share of PBT (`other_income_to_pbt`)

How much of the profit comes from interest, dividends and other non-core income.

| | |
|---|---|
| Short label | Other income % PBT |
| Unit | %, 1 decimal, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | other_income / pbt × 100 |
| When it is missing | Loss-making (pbt ≤ 0). Not applicable to banks, NBFCs and insurers. |
| Variants | `other_income_to_pbt_avg_3y` = avg(other_income_to_pbt, 3y) |

## Efficiency

### Asset turnover (`asset_turnover`)

Sales produced for every rupee of assets.

| | |
|---|---|
| Short label | Asset turnover |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | revenue / avg(total_assets) |
| When it is missing | Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `asset_turnover_prev` = asset_turnover[prev]; `asset_turnover_avg_5y` = avg(asset_turnover, 5y) |

### Fixed asset turnover (`fixed_asset_turnover`)

Sales for every rupee in plant, machinery and other fixed assets.

| | |
|---|---|
| Short label | FA turnover |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | revenue / avg(net_fixed_assets) |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `fixed_asset_turnover_prev` = fixed_asset_turnover[prev] |

### Debtor days (`debtor_days`)

Average number of days customers take to pay.

| | |
|---|---|
| Short label | Debtor days |
| Unit | days, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | trade_receivables / revenue × 365 |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | receivable days, receivables days |
| Variants | `debtor_days_prev` = debtor_days[prev]; `debtor_days_avg_5y` = avg(debtor_days, 5y) |

### Inventory days (`inventory_days`)

Days of stock the company holds.

| | |
|---|---|
| Short label | Inventory days |
| Unit | days, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | inventories / cogs × 365; cogs null → on revenue (SalesBasis) |
| When it is missing | Not provided (inventories null; explicit 0 → 0), Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | stock days |
| Variants | `inventory_days_prev` = inventory_days[prev] |

### Payable days (`payable_days`)

Average number of days the company takes to pay its suppliers.

| | |
|---|---|
| Short label | Payable days |
| Unit | days, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | trade_payables / cogs × 365 (SalesBasis fallback) |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | creditor days |
| Variants | `payable_days_prev` = payable_days[prev] |

### Cash conversion cycle (`cash_conversion_cycle`)

Days between paying for inputs and collecting cash from customers; negative is valid.

| | |
|---|---|
| Short label | CCC |
| Unit | days, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | debtor + inventory − payable days (Approximate if any part on sales basis) |
| When it is missing | Not provided if any part null. Not applicable to banks, NBFCs and insurers. |
| Variants | `cash_conversion_cycle_prev` = cash_conversion_cycle[prev] |

### Working capital days (`working_capital_days`)

Days of sales tied up in day-to-day operations; negative is valid.

| | |
|---|---|
| Short label | WC days |
| Unit | days, 0 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | ((TCA − cash_like) − (TCL − borrowings_current)) / revenue × 365 |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `working_capital_days_prev` = working_capital_days[prev]; `working_capital_days_avg_3y` = avg(working_capital_days, 3y) |

## Leverage & Liquidity

### Debt to equity (`debt_equity`)

Borrowings for every rupee of shareholders' money.

| | |
|---|---|
| Short label | D/E |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | total_debt / total_equity |
| When it is missing | Negative net worth (≤ 0); 0 = debt-free. Not applicable to banks, NBFCs and insurers. |
| Other names | debt to equity ratio, gearing |
| Variants | `debt_equity_prev` = debt_equity[prev] |

### D/E excl. leases (`debt_equity_ex_leases`)

Debt to equity without lease obligations; closer to what companies usually report.

| | |
|---|---|
| Short label | D/E excl. leases |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | (total_debt − lease_liabilities) / total_equity |
| When it is missing | Negative net worth. Not applicable to banks, NBFCs and insurers. |

### Net debt to equity (`net_debt_equity`)

Borrowings less spare cash, against shareholders' money; negative means net cash.

| | |
|---|---|
| Short label | Net D/E |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | net_debt / total_equity |
| When it is missing | Negative net worth. Not applicable to banks, NBFCs and insurers. |

### Debt to EBITDA (`debt_ebitda`)

Years of operating profit needed to repay all debt.

| | |
|---|---|
| Short label | Debt/EBITDA |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | total_debt / ebitda; 0 when total_debt = 0 |
| When it is missing | Not meaningful (ebitda ≤ 0 with debt > 0). Not applicable to banks, NBFCs and insurers. |
| Variants | `debt_ebitda_prev` = debt_ebitda[prev] |

### Net debt to EBITDA (`net_debt_ebitda`)

Years of operating profit to repay debt after using spare cash; negative means net cash.

| | |
|---|---|
| Short label | Net debt/EBITDA |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | net_debt / ebitda |
| When it is missing | Not meaningful (ebitda ≤ 0). Not applicable to banks, NBFCs and insurers. |

### Interest coverage (`interest_coverage`)

How many times operating profit covers interest; below 1.5 is a warning sign.

| | |
|---|---|
| Short label | Int. coverage |
| Unit | times (x), 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | ebit / finance_cost |
| When it is missing | No interest cost (finance_cost = 0), Not provided. Not applicable to banks, NBFCs and insurers. |
| Other names | interest cover, icr |
| Variants | `interest_coverage_prev` = interest_coverage[prev] |

### Current ratio (`current_ratio`)

Short-term assets compared with bills due within a year.

| | |
|---|---|
| Short label | Current ratio |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | TCA / TCL |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `current_ratio_prev` = current_ratio[prev] |

### Quick ratio (`quick_ratio`)

Current ratio without stock, which can be slow to turn into cash.

| | |
|---|---|
| Short label | Quick ratio |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | (TCA − inventories) / TCL |
| When it is missing | Not provided (incl. inventories null), Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | acid test ratio |

### Equity multiplier (`equity_multiplier`)

Assets for every rupee of equity; part of the DuPont breakdown of ROE.

| | |
|---|---|
| Short label | Equity multiplier |
| Unit | times (x), 2 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | avg(total_assets) / avg(total_equity) |
| When it is missing | Negative net worth. |

## Growth

### Sales growth (FY YoY) (`sales_growth`)

How much sales rose or fell compared with the previous financial year.

| | |
|---|---|
| Short label | Sales growth |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | (revenue_t / revenue_t−1 − 1) × 100 |
| When it is missing | Not meaningful (prev ≤ 0), Period not comparable, Not enough history. |
| Other names | revenue growth |
| Variants | `sales_growth_prev` = sales_growth[prev] |

### Net profit growth (FY YoY) (`profit_growth`)

Change in net profit compared with the previous financial year.

| | |
|---|---|
| Short label | Profit growth |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | owners_pat YoY |
| When it is missing | Not meaningful (+Turnaround if prev ≤ 0 < now), Period not comparable, Not enough history. |
| Other names | earnings growth, pat growth |
| Variants | `profit_growth_prev` = profit_growth[prev] |

### Sales growth (TTM vs previous TTM) (`ttm_sales_growth`)

Sales in the latest 12 months against the 12 months before.

| | |
|---|---|
| Short label | Sales growth TTM |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | sales[ttm] / sales[ttm-1] − 1 |
| When it is missing | Not enough history (8 consecutive quarters), Not meaningful. |

### Net profit growth (TTM) (`ttm_profit_growth`)

Net profit in the latest 12 months against the 12 months before.

| | |
|---|---|
| Short label | Profit growth TTM |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | latest only; period tag "TTM" |
| Level | intermediate |
| Formula | net_profit[ttm] / net_profit[ttm-1] − 1 |
| When it is missing | Not enough history, Not meaningful (+Turnaround). |

### Quarterly sales growth (YoY) (`q_sales_yoy`)

Latest quarter's sales against the same quarter last year.

| | |
|---|---|
| Short label | Qtr sales YoY |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | intermediate |
| Formula | q_sales[q] / q_sales[q-4] − 1 (date-matched) |
| When it is missing | Not enough history, Not meaningful. |

### Quarterly profit growth (YoY) (`q_profit_yoy`)

Latest quarter's net profit against the same quarter last year.

| | |
|---|---|
| Short label | Qtr profit YoY |
| Unit | %, 1 decimal, higher is better |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | intermediate |
| Formula | q_net_profit YoY |
| When it is missing | Not enough history, Not meaningful (+Turnaround). |

### Quarterly OPM change (YoY) (`q_opm_change_yoy`)

Whether the operating margin widened or narrowed against the same quarter last year.

| | |
|---|---|
| Short label | Qtr OPM change YoY |
| Unit | percentage points, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | q_opm[q] − q_opm[q-4] |
| When it is missing | Not enough history. Not applicable to banks, NBFCs and insurers. |

## Cash Flow

### Cash from operations (`cfo`)

Cash produced by day-to-day operations.

| | |
|---|---|
| Short label | CFO |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | as reported |
| When it is missing | Not provided; Not enough history for sums. |
| Other names | operating cash flow, cash flow from operations |
| Variants | `cfo_prev` = cfo[prev]; `cfo_cum_3y` = sum(cfo, 3y); `cfo_cum_5y` = sum(cfo, 5y); `cfo_cum_10y` = sum(cfo, 10y) |

### Capital expenditure (`capex`)

Money spent on new fixed assets.

| | |
|---|---|
| Short label | Capex |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | as reported (positive) |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Variants | `capex_prev` = capex[prev]; `capex_cum_5y` = sum(capex, 5y) |

### Free cash flow (`fcf`)

Cash left after the investment needed to keep and grow the business.

| | |
|---|---|
| Short label | FCF |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | cfo − capex |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Variants | `fcf_prev` = fcf[prev]; `fcf_cum_3y` = sum(fcf, 3y); `fcf_cum_5y` = sum(fcf, 5y); `fcf_cum_10y` = sum(fcf, 10y) |

### CFO to net profit (`cfo_to_pat`)

How much of reported profit came in as cash; around 1 or above is healthy.

| | |
|---|---|
| Short label | CFO/PAT |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | cfo / pat |
| When it is missing | Loss-making (pat ≤ 0). Not applicable to banks, NBFCs and insurers. |
| Variants | `cfo_to_pat_prev` = cfo_to_pat[prev] |

### CFO to net profit (5Y cumulative) (`cum_cfo_to_pat_5y`)

Over five years, how much of reported profit came in as cash; smooths yearly swings.

| | |
|---|---|
| Short label | CFO/PAT 5Y |
| Unit | times (x), 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "5Y" |
| Level | intermediate |
| Formula | Σcfo / Σpat over the 5 FYs ending at the offset |
| When it is missing | Not enough history (all 5 of both needed), Loss-making (Σpat ≤ 0). Not applicable to banks, NBFCs and insurers. |

### CFO to EBITDA (`cfo_to_ebitda`)

Share of operating profit that turned into operating cash.

| | |
|---|---|
| Short label | CFO/EBITDA |
| Unit | %, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | cfo / ebitda × 100 |
| When it is missing | Not meaningful (ebitda ≤ 0). Not applicable to banks, NBFCs and insurers. |

### Capex intensity (`capex_to_sales`)

Share of sales spent on new fixed assets.

| | |
|---|---|
| Short label | Capex/Sales |
| Unit | %, 1 decimal, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | capex / revenue × 100 |
| When it is missing | Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `capex_to_sales_avg_3y` = avg(capex_to_sales, 3y) |

### Capex to depreciation (`capex_to_depreciation`)

Whether investment exceeds the wear and tear of existing assets.

| | |
|---|---|
| Short label | Capex/Dep. |
| Unit | times (x), 2 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | capex / depreciation |
| When it is missing | Not meaningful. Not applicable to banks, NBFCs and insurers. |

### Accruals ratio (`accruals_ratio`)

Profit not backed by cash, as a share of assets; lower suggests better-quality earnings.

| | |
|---|---|
| Short label | Accruals ratio |
| Unit | %, 1 decimal, lower is better |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | (pat − cfo) / avg(total_assets) × 100 |
| When it is missing | Not meaningful. Not applicable to banks, NBFCs and insurers. |

## Shareholding

### Promoter holding (`promoter_holding`)

Share of the company owned by its founders or controlling group.

| | |
|---|---|
| Short label | Promoter |
| Unit | %, 2 decimals, neutral |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | basic |
| Formula | promoter_pct |
| When it is missing | Not provided. |
| Other names | promoter stake, promoters |
| Variants | `promoter_holding_prev` = promoter_holding[prev]; `promoter_holding_chg_1q` = promoter_holding - promoter_holding[q-1]; `promoter_holding_chg_1y` = promoter_holding - promoter_holding[q-4]; `promoter_holding_chg_3y` = promoter_holding - promoter_holding[q-12] |

### Promoter pledge (% of promoter holding) (`pledged_pct`)

Share of promoters' holding given as security for loans.

| | |
|---|---|
| Short label | Pledge |
| Unit | %, 2 decimals, lower is better |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | basic |
| Formula | promoter_pledged_pct |
| When it is missing | Not provided; Not meaningful when promoter_pct = 0. |
| Other names | promoter pledge, pledged |
| Variants | `pledged_pct_chg_1q` = pledged_pct - pledged_pct[q-1]; `pledged_pct_chg_1y` = pledged_pct - pledged_pct[q-4] |

### Pledged shares (% of all shares) (`pledged_pct_of_total`)

Pledged promoter shares as a share of all shares.

| | |
|---|---|
| Short label | Pledge % total |
| Unit | %, 2 decimals, lower is better |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | advanced |
| Formula | promoter_pct × pledged / 100 |
| When it is missing | Not provided. |

### FII / FPI holding (`fii_holding`)

Share owned by foreign portfolio investors.

| | |
|---|---|
| Short label | FII |
| Unit | %, 2 decimals, neutral |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | intermediate |
| Formula | fii_pct |
| When it is missing | Not provided. |
| Other names | fpi holding, fii holding |
| Variants | `fii_holding_chg_1q` = fii_holding - fii_holding[q-1]; `fii_holding_chg_1y` = fii_holding - fii_holding[q-4]; `fii_holding_chg_3y` = fii_holding - fii_holding[q-12] |

### DII holding (`dii_holding`)

Share owned by Indian institutions such as mutual funds and insurers.

| | |
|---|---|
| Short label | DII |
| Unit | %, 2 decimals, neutral |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | intermediate |
| Formula | dii_pct |
| When it is missing | Not provided. |
| Variants | `dii_holding_chg_1q` = dii_holding - dii_holding[q-1]; `dii_holding_chg_1y` = dii_holding - dii_holding[q-4]; `dii_holding_chg_3y` = dii_holding - dii_holding[q-12] |

### Public and others (`public_holding`)

Share held by everyone other than promoters and institutions (approximate).

| | |
|---|---|
| Short label | Public |
| Unit | %, 2 decimals, neutral |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | intermediate |
| Formula | max(0, 100 − promoter − fii − dii) |
| When it is missing | Not provided if any input null. |
| Other names | public holding |

## Dividend

### Dividend per share (`dps`)

Cash dividend declared for each share for the year.

| | |
|---|---|
| Short label | DPS |
| Unit | ₹, 2 decimals, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | dividend_per_share |
| When it is missing | Not provided (missing is never 0). |
| Variants | `dps_prev` = dps[prev]; `dps_cagr_3y` = cagr(dps, 3y); `dps_cagr_5y` = cagr(dps, 5y); `dps_cagr_10y` = cagr(dps, 10y) |

### Dividend yield (`dividend_yield`)

Yearly dividend as a percentage of the share price.

| | |
|---|---|
| Short label | Div. yield |
| Unit | %, 2 decimals, higher is better |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | basic |
| Formula | dps (latest FY) / price × 100 |
| When it is missing | Not provided, Price not provided. |

### Dividend payout (`dividend_payout`)

Share of profit paid out as dividends.

| | |
|---|---|
| Short label | Payout |
| Unit | %, 1 decimal, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | dps × shares_ye / owners_pat × 100 (PayoutOver100) |
| When it is missing | Loss-making, Not provided. |
| Other names | payout ratio |
| Variants | `dividend_payout_prev` = dividend_payout[prev]; `dividend_payout_avg_3y` = avg(dividend_payout, 3y); `dividend_payout_avg_5y` = avg(dividend_payout, 5y) |

### Years of dividend in a row (`dividend_streak`)

How many years in a row the company has paid a dividend.

| | |
|---|---|
| Short label | Dividend streak |
| Unit | years, 0 decimals, higher is better |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | consecutive latest FYs with dps > 0 (LimitOfData if all supplied years) |
| When it is missing | Not provided (latest dps null). |

## Per Share

### Earnings per share (`eps`)

Profit earned for each share.

| | |
|---|---|
| Short label | EPS |
| Unit | ₹, 2 decimals, higher is better |
| Applies to | all companies |
| History | yearly, with a TTM form; period tag "FY" |
| Level | basic |
| Formula | owners_pat / shares_ye; TTM net_profit_ttm / shares_outstanding |
| When it is missing | Not provided; Approximate if shares_ye missing. |
| Variants | `eps_prev` = eps[prev]; `eps_ttm` = eps[ttm]; `eps_cagr_3y` = cagr(eps, 3y); `eps_cagr_5y` = cagr(eps, 5y); `eps_cagr_10y` = cagr(eps, 10y) |

### Book value per share (`bvps`)

Shareholders' book value for each share.

| | |
|---|---|
| Short label | BVPS |
| Unit | ₹, 2 decimals, higher is better |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | basic |
| Formula | net_worth / shares_ye |
| When it is missing | Not provided. |
| Variants | `bvps_prev` = bvps[prev]; `bvps_cagr_3y` = cagr(bvps, 3y); `bvps_cagr_5y` = cagr(bvps, 5y); `bvps_cagr_10y` = cagr(bvps, 10y) |

## Banking & NBFC

### Net interest income (`nii`)

Interest earned on loans minus interest paid on deposits and borrowings.

| | |
|---|---|
| Short label | NII |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | revenue − interest_expended |
| When it is missing | Not provided. Applies only to banks and NBFCs. |
| Variants | `nii_prev` = nii[prev]; `nii_cagr_3y` = cagr(nii, 3y); `nii_cagr_5y` = cagr(nii, 5y) |

### NIM (approx., on total assets) (`nim_approx`)

Interest spread earned on the lender's balance sheet (approximation).

| | |
|---|---|
| Short label | NIM |
| Unit | %, 2 decimals, higher is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | nii / avg(total_assets) × 100 (Approximate always) |
| When it is missing | Not meaningful. Applies only to banks and NBFCs. |
| Other names | net interest margin |
| Variants | `nim_approx_prev` = nim_approx[prev]; `nim_approx_avg_3y` = avg(nim_approx, 3y) |

### Pre-provision operating profit (`ppop`)

A lender's operating profit before provisions for bad loans.

| | |
|---|---|
| Short label | PPOP |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | nii + other_income − operating_expenses |
| When it is missing | Not provided. Applies only to banks and NBFCs. |
| Variants | `ppop_prev` = ppop[prev] |

### Cost to income (`cost_to_income`)

Share of a lender's income spent on running costs.

| | |
|---|---|
| Short label | Cost/income |
| Unit | %, 1 decimal, lower is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | operating_expenses / (nii + other_income) × 100 |
| When it is missing | Not meaningful. Applies only to banks and NBFCs. |
| Other names | cost income ratio |
| Variants | `cost_to_income_prev` = cost_to_income[prev] |

### Credit cost (`credit_cost`)

Money set aside for bad loans as a share of the loan book.

| | |
|---|---|
| Short label | Credit cost |
| Unit | %, 2 decimals, lower is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | provisions_contingencies / avg(advances) × 100 |
| When it is missing | Not provided, Not meaningful. Applies only to banks and NBFCs. |
| Variants | `credit_cost_prev` = credit_cost[prev]; `credit_cost_avg_3y` = avg(credit_cost, 3y) |

### Gross NPA ratio (`gnpa_ratio`)

Share of loans that have stopped paying.

| | |
|---|---|
| Short label | GNPA |
| Unit | %, 2 decimals, lower is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | gross_npa / (advances + gross_npa − net_npa) × 100 |
| When it is missing | Not provided, Not meaningful. Applies only to banks and NBFCs. |
| Variants | `gnpa_ratio_prev` = gnpa_ratio[prev] |

### Net NPA ratio (`nnpa_ratio`)

Bad loans left after provisions, as a share of the loan book.

| | |
|---|---|
| Short label | NNPA |
| Unit | %, 2 decimals, lower is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | net_npa / advances × 100 |
| When it is missing | Not provided, Not meaningful. Applies only to banks and NBFCs. |
| Variants | `nnpa_ratio_prev` = nnpa_ratio[prev] |

### Provision coverage (`provision_coverage`)

How much of the bad loans the lender has already provided for.

| | |
|---|---|
| Short label | PCR |
| Unit | %, 1 decimal, higher is better |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | intermediate |
| Formula | (gross_npa − net_npa) / gross_npa × 100 |
| When it is missing | Not meaningful when gross_npa = 0 (UI "No NPAs"). Applies only to banks and NBFCs. |
| Other names | provision coverage ratio |

### Price to adjusted book value (`p_abv`)

P/B after deducting bad loans not yet provided for.

| | |
|---|---|
| Short label | P/ABV |
| Unit | times (x), 2 decimals, lower is better |
| Applies to | banks and NBFCs |
| History | latest only; period tag "Latest" |
| Level | advanced |
| Formula | market_cap / (net_worth − net_npa) |
| When it is missing | Not meaningful, Price not provided. Applies only to banks and NBFCs. |

## Scores & Checks

### Piotroski F-score (`piotroski_f`)

Nine yes/no tests of profitability, balance sheet and efficiency; 8–9 strong, 0–3 weak.

| | |
|---|---|
| Short label | Piotroski F |
| Unit | score, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | 9 criteria (§C.6) |
| When it is missing | Too few inputs unless all 9 evaluable. Not applicable to banks, NBFCs and insurers. |
| Other names | piotroski, f score |

### Altman Z'' score (`altman_z`)

A balance-sheet distress screen; above 2.6 is the safe zone, below 1.1 the distress zone.

| | |
|---|---|
| Short label | Altman Z'' |
| Unit | score, 2 decimals, higher is better |
| Applies to | non-financial companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | Z'' = 6.56·X1 + 3.26·X2 + 6.72·X3 + 1.05·X4 (§C.6) |
| When it is missing | Not provided, Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Other names | altman, z score |

### Red flags triggered (`red_flag_count`)

Number of warning signs worth checking in the annual report.

| | |
|---|---|
| Short label | Red flags |
| Unit | count, 0 decimals, lower is better |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | count of the family's red-flag rules that are met (§C.9; provided by WS2) |
| When it is missing | Too few inputs when more than 4 rules are not evaluated. |

## Data

### Latest financial year (`latest_fy`)

The most recent financial year in your data for this company.

| | |
|---|---|
| Short label | Latest FY |
| Unit | financial year, 0 decimals, neutral |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | intermediate |
| Formula | fiscal_year of annual slot 0 |
| When it is missing | Not enough history. |

### Years of history (`years_of_history`)

How many financial years of statements your data holds.

| | |
|---|---|
| Short label | History |
| Unit | years, 0 decimals, neutral |
| Applies to | all companies |
| History | latest only; period tag "Latest" |
| Level | advanced |
| Formula | annual slots with data |
| When it is missing | never null. |

## Line items

### Quarterly sales (`q_sales`)

Sales in one quarter.

| | |
|---|---|
| Short label | Qtr sales |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | intermediate |
| Formula | quarterly revenue (rawField) |
| When it is missing | Not provided. |
| Variants | `q_sales_prev` = q_sales[prev] |

### Quarterly operating profit (`q_operating_profit`)

Operating profit in one quarter.

| | |
|---|---|
| Short label | Qtr op. profit |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | non-financial companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | q revenue − q operating_expenses |
| When it is missing | Not provided. Not applicable to banks, NBFCs and insurers. |
| Variants | `q_operating_profit_prev` = q_operating_profit[prev] |

### Quarterly OPM (`q_opm`)

Operating margin in one quarter.

| | |
|---|---|
| Short label | Qtr OPM |
| Unit | %, 1 decimal, higher is better |
| Applies to | non-financial companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | q_operating_profit / q_sales × 100 |
| When it is missing | Not meaningful. Not applicable to banks, NBFCs and insurers. |
| Variants | `q_opm_prev` = q_opm[prev] |

### Quarterly net profit (`q_net_profit`)

Net profit for shareholders in one quarter.

| | |
|---|---|
| Short label | Qtr net profit |
| Unit | ₹ crore, 0 decimals, higher is better |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | intermediate |
| Formula | q net_profit_owners ?? q net_profit |
| When it is missing | Not provided. |
| Variants | `q_net_profit_prev` = q_net_profit[prev] |

### Operating expenses (excl. interest and depreciation) (`operating_expenses`)

Operating expenses (excl. interest and depreciation), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Opex |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | operating_expenses, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `operating_expenses_prev` = operating_expenses[prev] |

### Cost of goods sold (`cogs`)

Cost of goods sold, as given in your data (₹ crore).

| | |
|---|---|
| Short label | COGS |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | cogs, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `cogs_prev` = cogs[prev] |

### Other income (`other_income`)

Other income, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Other income |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | other_income, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided. |
| Variants | `other_income_prev` = other_income[prev] |

### Depreciation and amortisation (`depreciation`)

Depreciation and amortisation, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Depreciation |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | depreciation, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `depreciation_prev` = depreciation[prev] |

### Finance costs (`finance_cost`)

Finance costs, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Finance cost |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | finance_cost, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `finance_cost_prev` = finance_cost[prev] |

### Exceptional items (gain +, loss −) (`exceptional_items`)

Exceptional items (gain +, loss −), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Exceptional items |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | exceptional_items, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided. |
| Variants | `exceptional_items_prev` = exceptional_items[prev] |

### Profit before tax (`pbt`)

Profit before tax, as given in your data (₹ crore).

| | |
|---|---|
| Short label | PBT |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | pbt, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `pbt_prev` = pbt[prev] |

### Tax expense (`tax_expense`)

Tax expense, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Tax |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | tax_expense, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `tax_expense_prev` = tax_expense[prev] |

### Net profit (PAT, incl. minority share) (`pat`)

Net profit (PAT, incl. minority share), as given in your data (₹ crore).

| | |
|---|---|
| Short label | PAT |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | net_profit, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `pat_prev` = pat[prev] |

### Net profit attributable to owners (`net_profit_owners`)

Net profit attributable to owners, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Owners' PAT |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | net_profit_owners, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `net_profit_owners_prev` = net_profit_owners[prev] |

### Interest expended (`interest_expended`)

Interest expended, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Interest expended |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | interest_expended, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Applies only to banks and NBFCs. |
| Variants | `interest_expended_prev` = interest_expended[prev] |

### Provisions and contingencies (excl. tax) (`provisions_contingencies`)

Provisions and contingencies (excl. tax), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Provisions |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | provisions_contingencies, as reported in the profit and loss statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Applies only to banks and NBFCs. |
| Variants | `provisions_contingencies_prev` = provisions_contingencies[prev] |

### Equity share capital (`equity_share_capital`)

Equity share capital, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Share capital |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | equity_share_capital, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `equity_share_capital_prev` = equity_share_capital[prev] |

### Other equity (reserves and surplus) (`other_equity`)

Other equity (reserves and surplus), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Other equity |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | other_equity, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `other_equity_prev` = other_equity[prev] |

### Non-controlling interest (`non_controlling_interest`)

Non-controlling interest, as given in your data (₹ crore).

| | |
|---|---|
| Short label | NCI |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | non_controlling_interest, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided. |
| Variants | `non_controlling_interest_prev` = non_controlling_interest[prev] |

### Non-current borrowings (`borrowings_non_current`)

Non-current borrowings, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Long-term borrowings |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | borrowings_non_current, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `borrowings_non_current_prev` = borrowings_non_current[prev] |

### Current borrowings (incl. current maturities) (`borrowings_current`)

Current borrowings (incl. current maturities), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Short-term borrowings |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | borrowings_current, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `borrowings_current_prev` = borrowings_current[prev] |

### Lease liabilities (`lease_liabilities`)

Lease liabilities, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Leases |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | lease_liabilities, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided. |
| Variants | `lease_liabilities_prev` = lease_liabilities[prev] |

### Trade payables (`trade_payables`)

Trade payables, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Payables |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | trade_payables, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `trade_payables_prev` = trade_payables[prev] |

### Total current liabilities (`total_current_liabilities`)

Total current liabilities, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Current liabilities |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | total_current_liabilities, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `total_current_liabilities_prev` = total_current_liabilities[prev] |

### Total assets (`total_assets`)

Total assets, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Total assets |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | total_assets, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `total_assets_prev` = total_assets[prev] |

### Net fixed assets (PPE and right-of-use) (`net_fixed_assets`)

Net fixed assets (PPE and right-of-use), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Net fixed assets |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | net_fixed_assets, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `net_fixed_assets_prev` = net_fixed_assets[prev] |

### Inventories (`inventories`)

Inventories, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Inventories |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | inventories, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `inventories_prev` = inventories[prev] |

### Trade receivables (`trade_receivables`)

Trade receivables, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Receivables |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | trade_receivables, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `trade_receivables_prev` = trade_receivables[prev] |

### Cash and bank balances (`cash_and_bank`)

Cash and bank balances, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Cash |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | cash_and_bank, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `cash_and_bank_prev` = cash_and_bank[prev] |

### Current investments (`current_investments`)

Current investments, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Current investments |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | current_investments, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. When it is missing, calculations that use it treat it as 0 and data health lists the assumption; the line itself shows Not provided. |
| Variants | `current_investments_prev` = current_investments[prev] |

### Total current assets (`total_current_assets`)

Total current assets, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Current assets |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | non-financial companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | total_current_assets, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Not applicable to banks, NBFCs and insurers. |
| Variants | `total_current_assets_prev` = total_current_assets[prev] |

### Shares outstanding at year end (`shares_outstanding_ye`)

Shares outstanding at year end, as given in your data (crore shares).

| | |
|---|---|
| Short label | Shares (YE) |
| Unit | crore shares, 2 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | shares_outstanding_ye, as reported in the balance sheet (crore shares). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `shares_outstanding_ye_prev` = shares_outstanding_ye[prev] |

### Advances (loan book, net) (`advances`)

Advances (loan book, net), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Advances |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | advances, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Applies only to banks and NBFCs. |
| Variants | `advances_prev` = advances[prev] |

### Gross NPA (Stage 3) (`gross_npa`)

Gross NPA (Stage 3), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Gross NPA |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | gross_npa, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Applies only to banks and NBFCs. |
| Variants | `gross_npa_prev` = gross_npa[prev] |

### Net NPA (`net_npa`)

Net NPA, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Net NPA |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | banks and NBFCs |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | net_npa, as reported in the balance sheet (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. Applies only to banks and NBFCs. |
| Variants | `net_npa_prev` = net_npa[prev] |

### Proceeds from issue of equity (`equity_issuance`)

Proceeds from issue of equity, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Equity issued |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | yearly; period tag "FY" |
| Level | advanced |
| Formula | equity_issuance, as reported in the cash flow statement (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `equity_issuance_prev` = equity_issuance[prev] |

### Quarterly operating expenses (`q_operating_expenses`)

Quarterly operating expenses, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Qtr opex |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | operating_expenses, as reported in the quarterly results (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `q_operating_expenses_prev` = q_operating_expenses[prev] |

### Quarterly depreciation (`q_depreciation`)

Quarterly depreciation, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Qtr depreciation |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | depreciation, as reported in the quarterly results (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `q_depreciation_prev` = q_depreciation[prev] |

### Quarterly net profit (PAT) (`q_pat`)

Quarterly net profit (PAT), as given in your data (₹ crore).

| | |
|---|---|
| Short label | Qtr PAT |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | net_profit, as reported in the quarterly results (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `q_pat_prev` = q_pat[prev] |

### Quarterly net profit attributable to owners (`q_net_profit_owners`)

Quarterly net profit attributable to owners, as given in your data (₹ crore).

| | |
|---|---|
| Short label | Qtr owners' PAT |
| Unit | ₹ crore, 0 decimals, neutral |
| Applies to | all companies |
| History | quarterly; period tag "Latest qtr" |
| Level | advanced |
| Formula | net_profit_owners, as reported in the quarterly results (₹ crore). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `q_net_profit_owners_prev` = q_net_profit_owners[prev] |

### Number of shareholders (`num_shareholders`)

Number of shareholders, as given in your data (count).

| | |
|---|---|
| Short label | Shareholders |
| Unit | count, 0 decimals, neutral |
| Applies to | all companies |
| History | shareholding quarters; period tag "Latest qtr" |
| Level | advanced |
| Formula | num_shareholders, as reported in the shareholding pattern (count). |
| When it is missing | Not provided when the field is missing from your data. |
| Variants | `num_shareholders_prev` = num_shareholders[prev] |
