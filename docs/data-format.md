# Data format

Funda Scanner can load your own fundamentals from a **CSV** or **JSON** file
(Screener → *Import data*). Files are parsed in your browser and are never uploaded.
The imported dataset is kept in your browser's `localStorage` until you choose *Use demo data*.

Samples: [`public/sample-data/`](../public/sample-data/) — `fundamentals-template.csv`, `fundamentals-sample.csv`, `fundamentals-sample.json`.
All sample companies are fictional.

## Columns

| Column | Required | Unit | Notes |
|--------|----------|------|-------|
| `symbol` | **Yes** | text | Upper-cased on import. Duplicates: the later row wins. Aliases: `ticker`, `code`, `nse_code` |
| `name` | No | text | Defaults to the symbol. Alias: `company` |
| `sector`, `industry` | No | text | |
| `market_cap` | No | ₹ crore | Aliases: `mcap`, `market cap (cr)` |
| `price` | No | ₹ | Reference price for valuation, not a live quote. Aliases: `cmp`, `close` |
| `pe` | No | x | Alias: `p/e`, `pe ratio` |
| `eps` | No | ₹ | |
| `price_book` | No | x | Aliases: `pb`, `p/b` |
| `roe`, `roce` | No | % | |
| `debt_equity` | No | x | Aliases: `de`, `d/e` |
| `debt_ebitda` | No | x | |
| `dividend_yield` | No | % | Alias: `div yield` |
| `sales_growth`, `profit_growth` | No | % | Aliases: `revenue growth`, `pat growth` |
| `fcf_yield` | No | % | |

Header matching ignores case, spaces, punctuation and unit suffixes, so `ROCE (%)` and `roce` are the same column.

## Missing and invalid values

- Blank, `-`, `NA`, `N/A`, `null` mean **missing**. A company with a missing value is excluded by any filter on that metric and shown as “—”.
- `1,234.5`, `12%` and `₹ 99` are accepted (commas, `%`, `₹` are stripped).
- Anything else non-numeric is treated as missing and reported as a warning.
- Rows without a symbol are skipped. Unknown columns are ignored with a warning.
- Limits: 5 MB and 20,000 rows.

## JSON

Either an array of objects, or `{ "rows": [ … ] }`, using the same column names. Use `null` for missing numbers.

```json
{ "rows": [ { "symbol": "ALPHA", "name": "Alpha Software Ltd", "market_cap": 52000, "roce": 35.1, "pe": 24.5 } ] }
```

## Scope

Imported data currently powers the **Screener** only. Company detail pages (statements, shareholding, peers)
still show demo data until they are moved behind the data-provider interface.

You are responsible for the accuracy and licence of any data you import.
