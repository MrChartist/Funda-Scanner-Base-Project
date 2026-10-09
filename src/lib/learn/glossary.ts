// src/lib/learn/glossary.ts — hand-written learning content for base metrics (§E.4, P0 + P1).
// Original text in plain, formal Indian English. Worked examples use round numbers in ₹ crore.
// Rules of thumb are always labelled as such by the UI; none of them is a standard or advice.
// Variants (for example roce_avg_5y) inherit the entry of their base metric.
import type { GlossaryEntry, MetricId } from "@/lib/contracts";

type Draft = Omit<GlossaryEntry, "base" | "workedExample" | "rulesOfThumb" | "pitfalls" | "notApplicableNote" | "related">
  & Partial<Pick<GlossaryEntry, "workedExample" | "rulesOfThumb" | "pitfalls" | "notApplicableNote" | "related">>;

function entry(base: MetricId, d: Draft): GlossaryEntry {
  return {
    base,
    whatItTells: d.whatItTells,
    howToRead: d.howToRead,
    workedExample: d.workedExample ?? null,
    rulesOfThumb: d.rulesOfThumb ?? [],
    pitfalls: d.pitfalls ?? [],
    notApplicableNote: d.notApplicableNote ?? null,
    related: d.related ?? [],
  };
}

/** Shared note for metrics that apply to non-financial companies only. */
const NAF_LENDERS =
  "Not shown for banks, NBFCs and insurers. Their balance sheets are built from deposits, borrowings, loans and investments, so lender and insurer measures are used instead.";
/** Shared note for metrics that apply to banks and NBFCs only. */
const LENDERS_ONLY =
  "Shown only for banks and NBFCs. Other companies do not earn their income mainly as interest on loans, so the measure has no meaning for them.";

// ── Basic level (P0): all 25 basic base metrics ──────────────────────────────
const BASIC: readonly GlossaryEntry[] = [
  entry("market_cap", {
    whatItTells: "Market capitalisation is the value the stock market puts on the whole company: the share price multiplied by the number of shares in issue. It describes the size of the company as investors see it, not what its assets are worth.",
    howToRead: "Neither a higher nor a lower figure is better; it is a measure of size. Use it to compare companies of similar size and to put other figures, such as profit and debt, in proportion.",
    workedExample: "A company with 50 crore shares at a price of ₹400 has a market capitalisation of 50 × 400 = ₹20,000 crore.",
    rulesOfThumb: [
      { context: "Size groups in India", text: "SEBI's categories for mutual funds rank companies by market capitalisation: the top 100 are large caps, the next 150 mid caps and the rest small caps." },
      { context: "Smaller companies", text: "Smaller companies are usually followed by fewer analysts and traded less, so their prices can move more sharply." },
    ],
    pitfalls: [
      "It moves every day with the share price. Here it uses the reference price in your data, which is not a live quote.",
      "A large market capitalisation says nothing about whether the price is reasonable. Compare it with profit, book value and cash flow.",
    ],
    related: ["price", "enterprise_value", "pe", "pb"],
  }),
  entry("price", {
    whatItTells: "The reference price is the closing share price supplied with your data. The app uses it to work out market value and valuation ratios such as P/E and dividend yield. It is not a live quote.",
    howToRead: "On its own the price says little: a ₹50 share is not cheaper than a ₹5,000 share. What matters is the price compared with what each share earns, owns and pays out.",
    workedExample: "If the price is ₹600 and earnings per share are ₹30, the P/E is 600 ÷ 30 = 20.",
    rulesOfThumb: [
      { context: "Comparing companies", text: "Compare prices only through ratios such as P/E, P/B and dividend yield, never directly." },
    ],
    pitfalls: [
      "Check the price date in your file. The sample data has no price date, and its prices are generated.",
      "After a split or a bonus issue, older per-share figures must be adjusted before they are compared with today's price.",
    ],
    related: ["market_cap", "pe", "eps", "dividend_yield"],
  }),
  entry("sales", {
    whatItTells: "Sales, or revenue from operations, is the money a company earns from its main business in a period, before any costs are deducted. It is the top line of the profit and loss statement and the base from which margins are calculated.",
    howToRead: "Higher is better when it comes with healthy margins. Steady growth in sales over many years usually matters more than one strong year.",
    workedExample: "A company that delivers 10 lakh units at ₹2,000 each records sales of 10,00,000 × 2,000 = ₹2,00,00,00,000, that is, ₹200 crore.",
    rulesOfThumb: [
      { context: "Growth", text: "Sales growth that stays above inflation for five to ten years suggests the business is growing in real terms." },
    ],
    pitfalls: [
      "Other income, such as interest on surplus cash, is not part of sales.",
      "Sales can jump after an acquisition or a merger. Check whether growth came from the existing business before comparing years.",
      "For a bank or an NBFC, sales here means interest earned, which cannot be compared with a manufacturer's revenue.",
    ],
    related: ["sales_growth", "opm", "npm", "price_to_sales"],
  }),
  entry("net_profit", {
    whatItTells: "Net profit is what is left for shareholders after every expense, interest cost and tax has been paid. In consolidated accounts the figure used here is the share that belongs to the owners of the parent company, leaving out the minority holders of subsidiaries.",
    howToRead: "Higher is better, but quality matters as much as size. Profit that turns into cash and repeats every year is worth more than a one-time gain.",
    workedExample: "Sales of ₹1,000 crore, total expenses of ₹850 crore and tax of ₹40 crore leave a net profit of 1,000 − 850 − 40 = ₹110 crore.",
    rulesOfThumb: [
      { context: "Quality of profit", text: "Over several years, cash from operations close to or above net profit suggests that the profit is backed by cash." },
    ],
    pitfalls: [
      "Exceptional gains, such as a profit on the disposal of property, can inflate profit in a single year.",
      "A loss makes P/E and profit growth not meaningful; the app shows the reason instead of a number.",
    ],
    related: ["profit_growth", "npm", "eps", "cfo_to_pat", "pe"],
  }),
  entry("net_worth", {
    whatItTells: "Net worth, or shareholders' funds, is equity share capital plus other equity (reserves and surplus). It is what shareholders own on paper after all liabilities are subtracted from assets, and it grows when the company retains profit.",
    howToRead: "A steadily rising net worth is a good sign. Negative net worth means accumulated losses have wiped out the capital, and ratios such as ROE and P/B are then not meaningful.",
    workedExample: "Equity share capital of ₹50 crore and other equity of ₹950 crore give a net worth of ₹1,000 crore.",
    rulesOfThumb: [
      { context: "Trend", text: "Compare net worth over five to ten years. Growth close to profit growth suggests that profits are being retained and reinvested." },
    ],
    pitfalls: [
      "Book values can differ from what the assets would fetch; brands and know-how are often not on the balance sheet at all.",
      "Fresh equity raised from investors also increases net worth, so growth is not always earned.",
    ],
    related: ["roe", "pb", "bvps", "debt_equity"],
  }),
  entry("total_debt", {
    whatItTells: "Total debt adds up non-current borrowings, current borrowings (including the current portion of long-term loans) and lease liabilities. It shows how much the company owes to lenders and lessors.",
    howToRead: "Lower is generally safer. Debt is not bad in itself, but it must be serviced from profit and cash flow in good years and bad years alike.",
    workedExample: "Long-term loans of ₹300 crore, short-term loans of ₹80 crore and lease liabilities of ₹20 crore make total debt of ₹400 crore.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Judge debt against net worth (debt to equity) and against operating profit (debt to EBITDA) rather than by the amount alone." },
    ],
    pitfalls: [
      "This app includes lease liabilities in debt, so retailers and airlines can show more debt than in their own presentations. 'D/E excl. leases' gives the narrower view.",
      "A company can hold large cash balances at the same time as debt; net debt subtracts that cash.",
    ],
    notApplicableNote: "Not shown for banks, NBFCs and insurers. Borrowed money is the raw material of a lender's business, so its debt is judged through capital, asset quality and returns instead.",
    related: ["debt_equity", "net_debt", "debt_ebitda", "interest_coverage"],
  }),
  entry("pe", {
    whatItTells: "The price-to-earnings ratio divides the company's market value by its net profit over the last twelve months. It tells you how many rupees the market is paying for each rupee of yearly profit.",
    howToRead: "Lower means cheaper for the same profit, other things being equal. A high P/E can be justified by fast and durable growth; a low P/E can reflect shrinking or uncertain earnings.",
    workedExample: "A market capitalisation of ₹20,000 crore and trailing net profit of ₹800 crore give a P/E of 20,000 ÷ 800 = 25.",
    rulesOfThumb: [
      { context: "Across sectors", text: "Compare a company's P/E with its own history and with similar companies; typical levels differ widely between sectors." },
      { context: "Cyclical businesses", text: "The P/E of a cyclical company often looks lowest at the top of the cycle, when profits are at their peak." },
    ],
    pitfalls: [
      "P/E is not meaningful when profit is zero or negative; the app shows 'Loss-making'.",
      "One-time gains inflate profit and make the P/E look lower than it really is.",
      "If the quarterly results are incomplete, the app uses the latest financial year's profit and labels the value 'FY'.",
    ],
    related: ["earnings_to_price", "peg", "eps", "earnings_yield"],
  }),
  entry("pb", {
    whatItTells: "Price to book compares the company's market value with its net worth (book value) at the latest year end. It tells you how much the market pays for each rupee of shareholders' funds.",
    howToRead: "Lower means the market is paying less for the same book value. Companies that earn a high ROE usually trade at a higher P/B, so read the two together.",
    workedExample: "A market capitalisation of ₹6,000 crore and a net worth of ₹2,000 crore give a P/B of 6,000 ÷ 2,000 = 3.",
    rulesOfThumb: [
      { context: "Banks and NBFCs", text: "P/B is a common yardstick for lenders, because their assets are mostly loans carried close to their value." },
      { context: "General", text: "A P/B below 1 can signal that the market doubts the value of the assets or the returns they will earn." },
    ],
    pitfalls: [
      "When net worth is negative, P/B is not meaningful.",
      "Asset-light businesses, such as software or consumer brands, often have small book values, so their P/B looks high.",
    ],
    related: ["bvps", "roe", "net_worth", "p_abv"],
  }),
  entry("roce", {
    whatItTells: "Return on capital employed measures the profit before interest and tax (EBIT) that a company earns on all the long-term money in the business, from shareholders and lenders alike. It shows how well management turns capital into profit, whatever the mix of debt and equity.",
    howToRead: "Higher is better. A ROCE that stays well above the company's cost of borrowing for many years points to a strong business.",
    workedExample: "EBIT of ₹300 crore on average capital employed of ₹1,500 crore gives a ROCE of 300 ÷ 1,500 × 100 = 20%.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Many investors look for a ROCE above about 15%, sustained for five years or more." },
      { context: "Capital-heavy sectors", text: "Utilities, metals and cement usually earn a lower ROCE than software or consumer brands; compare within the sector." },
    ],
    pitfalls: [
      "Large idle cash balances lower ROCE even when the core business is excellent; ROIC leaves that cash out.",
      "A single good year can flatter ROCE, so look at the 5-year average and the 5-year minimum.",
      "In this app, capital employed includes lease liabilities and minority interest.",
    ],
    notApplicableNote: "Not calculated for banks, NBFCs and insurers. For a lender, borrowed money is the raw material of the business rather than a source of long-term capital, so return on assets and return on equity are used instead.",
    related: ["roic", "roe", "ebit", "capital_employed"],
  }),
  entry("roe", {
    whatItTells: "Return on equity measures the net profit earned for shareholders on their average net worth during the year. It shows how productively the company uses the money its shareholders have put in or left in the business.",
    howToRead: "Higher is better, provided it does not come mainly from heavy borrowing. A steady ROE over many years matters more than one high figure.",
    workedExample: "Net profit of ₹150 crore on average net worth of ₹1,000 crore gives an ROE of 150 ÷ 1,000 × 100 = 15%.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "An ROE above about 15% for five years or more is often read as a sign of a good business." },
      { context: "Banks", text: "For a bank, an ROE in the low to middle teens together with a return on assets above 1% is often considered healthy." },
    ],
    pitfalls: [
      "Debt raises ROE because it keeps the equity base small; check debt to equity alongside it.",
      "A small or negative net worth makes ROE very large or not meaningful; the app shows 'Negative net worth' in that case.",
      "Share repurchases and large dividends reduce net worth and can lift ROE without any change in the business.",
    ],
    related: ["roce", "roa", "net_worth", "equity_multiplier"],
  }),
  entry("opm", {
    whatItTells: "Operating profit margin is EBITDA (revenue minus operating expenses, before depreciation, interest, tax and other income) as a percentage of sales. It shows how much of each rupee of sales is left after the costs of running the business.",
    howToRead: "Higher is better, and a stable margin is better than a volatile one. A rising margin can signal pricing power or better efficiency.",
    workedExample: "Sales of ₹1,000 crore and operating expenses of ₹820 crore give EBITDA of ₹180 crore and an OPM of 180 ÷ 1,000 × 100 = 18%.",
    rulesOfThumb: [
      { context: "Across sectors", text: "Margins differ greatly by industry: a retailer may run at 8% and a software company at 25%. Compare within a sector." },
    ],
    pitfalls: [
      "Other income is left out, so a company with large treasury income may show a modest margin and a high net profit.",
      "Under Ind AS 116, lease rent appears partly as depreciation and interest, which lifts the EBITDA margin of lease-heavy businesses.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["ebitda", "gross_margin", "npm", "sales"],
  }),
  entry("npm", {
    whatItTells: "Net profit margin is net profit as a percentage of sales. It shows how much of each rupee of sales ends up as profit after every cost, interest charge and tax.",
    howToRead: "Higher is better. Compare it with the operating margin: a large gap points to heavy interest, depreciation or tax, or to a large minority share.",
    workedExample: "Net profit of ₹90 crore on sales of ₹1,200 crore gives an NPM of 90 ÷ 1,200 × 100 = 7.5%.",
    rulesOfThumb: [
      { context: "Across sectors", text: "Low-margin businesses, such as distribution or refining, can still earn good returns if they turn their assets over quickly." },
    ],
    pitfalls: [
      "Other income and exceptional items flow into net profit, so NPM can rise even when the core business weakens.",
      "This ratio uses profit including the minority share, to match sales, which include subsidiaries in full.",
    ],
    related: ["opm", "net_profit", "roe", "asset_turnover"],
  }),
  entry("debt_equity", {
    whatItTells: "Debt to equity divides total debt, including lease liabilities, by total equity (net worth plus minority interest). It shows how much the company has borrowed for every rupee of shareholders' money.",
    howToRead: "Lower is generally safer. A ratio of 0 means the company is debt-free.",
    workedExample: "Total debt of ₹400 crore and total equity of ₹1,000 crore give a D/E of 400 ÷ 1,000 = 0.4.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "A D/E below about 0.5 is often considered comfortable; above 1, look closely at cash flows and interest cover." },
      { context: "Utilities and infrastructure", text: "Businesses with long, stable contracts often carry more debt; compare within the sector." },
    ],
    pitfalls: [
      "Lease liabilities are included, which raises D/E for retailers and airlines.",
      "When equity is zero or negative, D/E is not meaningful.",
      "A low D/E can still hide risk if most of the debt is short-term and must be rolled over soon.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["total_debt", "net_debt_equity", "debt_ebitda", "interest_coverage"],
  }),
  entry("interest_coverage", {
    whatItTells: "Interest coverage divides EBIT (operating profit plus other income, less depreciation) by finance costs. It shows how many times over the company's profit could pay its interest bill.",
    howToRead: "Higher is safer. Below about 1.5, a small fall in profit could leave the interest unpaid from earnings.",
    workedExample: "EBIT of ₹240 crore and finance costs of ₹40 crore give an interest coverage of 240 ÷ 40 = 6 times.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Coverage above about 3 to 4 times is usually considered comfortable; below 1.5 is a warning sign." },
    ],
    pitfalls: [
      "When there is no interest cost at all, coverage is not a number. The app shows 'No interest cost' and treats it as fully covered in comparisons.",
      "Coverage in one good year can hide a weak average; check several years.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["debt_equity", "ebit", "debt_ebitda", "total_debt"],
  }),
  entry("current_ratio", {
    whatItTells: "The current ratio divides current assets (cash, receivables, inventories and other short-term assets) by current liabilities (bills and borrowings due within a year). It shows whether short-term resources cover short-term obligations.",
    howToRead: "Higher means more cushion. A very high ratio can also mean that money is tied up in stock or in unpaid customer bills.",
    workedExample: "Current assets of ₹600 crore and current liabilities of ₹400 crore give a current ratio of 600 ÷ 400 = 1.5.",
    rulesOfThumb: [
      { context: "Manufacturers", text: "A current ratio between about 1.2 and 2 is often considered healthy." },
      { context: "Retail and FMCG", text: "Businesses whose customers pay at once while suppliers give credit can run safely below 1." },
    ],
    pitfalls: [
      "Inventories may be slow to turn into cash; the quick ratio leaves them out.",
      "Year-end balances can differ from the rest of the year; look at the trend over several years.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["quick_ratio", "working_capital_days", "cash_conversion_cycle", "debt_equity"],
  }),
  entry("sales_growth", {
    whatItTells: "Sales growth is the percentage change in sales compared with the previous financial year. It shows whether the business is expanding or shrinking.",
    howToRead: "Higher is better when the growth is profitable and lasting. Look at growth over several years rather than one.",
    workedExample: "Sales rising from ₹800 crore to ₹920 crore is growth of (920 ÷ 800 − 1) × 100 = 15%.",
    rulesOfThumb: [
      { context: "General", text: "Growth that stays above inflation means the business is growing in real terms." },
    ],
    pitfalls: [
      "A merger or a change in accounting period can distort one year. The app marks such years as transition periods and does not calculate growth across them.",
      "Growth from a very small base can look impressive but may not last.",
      "For growth over several years, use the CAGR forms, such as sales_cagr_5y.",
    ],
    related: ["sales", "profit_growth", "ttm_sales_growth", "q_sales_yoy"],
  }),
  entry("profit_growth", {
    whatItTells: "Net profit growth is the percentage change in net profit attributable to shareholders compared with the previous financial year. It shows whether the business is earning more or less for its owners.",
    howToRead: "Higher is better, especially when sales and cash flow grow too. Profit that grows much faster than sales for many years usually relies on margins that cannot keep rising.",
    workedExample: "Net profit rising from ₹100 crore to ₹125 crore is growth of (125 ÷ 100 − 1) × 100 = 25%.",
    rulesOfThumb: [
      { context: "Quality of growth", text: "Profit growth that comes with similar growth in operating cash flow is more dependable." },
    ],
    pitfalls: [
      "When last year's profit was zero or a loss, a growth percentage is not meaningful; the app marks the change as a turnaround instead.",
      "Exceptional items and changes in tax can swing profit growth in a single year.",
    ],
    related: ["net_profit", "sales_growth", "ttm_profit_growth", "eps"],
  }),
  entry("cfo", {
    whatItTells: "Cash from operations is the cash generated by the company's day-to-day business during the year, after paying suppliers, employees and taxes and after changes in working capital. It is reported in the cash flow statement.",
    howToRead: "Higher is better. Over several years, cash from operations should broadly match or exceed net profit; a persistent shortfall means profit is not turning into cash.",
    workedExample: "Net profit of ₹100 crore plus depreciation of ₹30 crore, less ₹20 crore more tied up in receivables and stock, gives cash from operations of about ₹110 crore.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Cash from operations over five years of at least 80% of the net profit of the same years is a common sign of good earnings quality." },
    ],
    pitfalls: [
      "One year's figure can swing with the timing of collections and payments; use 3-year or 5-year totals.",
      "For banks and NBFCs, operating cash flow moves with lending and deposits and says little about profitability.",
    ],
    related: ["fcf", "cfo_to_pat", "cum_cfo_to_pat_5y", "capex"],
  }),
  entry("fcf", {
    whatItTells: "Free cash flow is cash from operations minus capital expenditure. It is the cash left after the investment needed to maintain and grow the business, available for dividends, debt repayment or acquisitions.",
    howToRead: "Higher is better. Negative free cash flow is normal during a heavy expansion, but a business that never produces free cash must keep raising money.",
    workedExample: "Cash from operations of ₹500 crore and capital expenditure of ₹200 crore give free cash flow of ₹300 crore.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Positive free cash flow in most of the last five years suggests the business funds its own growth." },
    ],
    pitfalls: [
      "Capital expenditure is lumpy; use totals over several years before drawing conclusions.",
      "Spending on acquisitions is not part of capital expenditure here, so free cash flow can look healthy while cash goes out on acquisitions.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["cfo", "capex", "fcf_yield", "cfo_to_pat"],
  }),
  entry("promoter_holding", {
    whatItTells: "Promoter holding is the percentage of the company's shares held by its founders or controlling group, as reported in the quarterly shareholding pattern. It shows how much of the company the people in control own themselves.",
    howToRead: "Neither a high nor a low figure is good in itself. A stable, substantial holding suggests the promoters' interests are aligned with other shareholders; a sharp fall deserves an explanation.",
    workedExample: "If promoters hold 30 crore of the company's 50 crore shares, promoter holding is 30 ÷ 50 × 100 = 60%.",
    rulesOfThumb: [
      { context: "Listed companies in India", text: "Most listed companies must keep at least 25% of their shares with the public, which limits promoter holding to about 75%." },
    ],
    pitfalls: [
      "Professionally managed companies may have no promoter at all; 0% is then normal.",
      "A fall can come from the issue of new shares (dilution) rather than from promoters reducing their stake; check the share count.",
    ],
    related: ["pledged_pct", "fii_holding", "dii_holding", "public_holding"],
  }),
  entry("pledged_pct", {
    whatItTells: "Promoter pledge is the share of the promoters' own holding that has been pledged or otherwise encumbered as security for loans. In this app it is measured as a percentage of the promoter holding, not of all shares.",
    howToRead: "Lower is better, and 0% is ideal. A high or rising pledge means lenders may invoke the pledge and dispose of the shares if the price falls, which can put pressure on the stock.",
    workedExample: "Promoters hold 40 crore shares and have pledged 10 crore of them: the pledge is 10 ÷ 40 × 100 = 25% of the promoter holding, or 10% of all shares if the company has 100 crore shares.",
    rulesOfThumb: [
      { context: "General", text: "A pledge above about 25% of the promoter holding, or one that keeps rising, is commonly treated as worth investigating." },
    ],
    pitfalls: [
      "Some data sources state the pledge as a percentage of all shares; check the definition before importing your own data.",
      "A pledge may secure the company's own borrowing or a promoter's personal loans; the shareholding pattern alone does not say which.",
    ],
    related: ["promoter_holding", "pledged_pct_of_total"],
  }),
  entry("dps", {
    whatItTells: "Dividend per share is the cash dividend declared for each share for the financial year, including interim and final dividends. Past figures are adjusted for later splits and bonus issues so that years can be compared.",
    howToRead: "Higher is better when the dividend is comfortably covered by profit and cash flow. A steadily rising dividend per share is a sign of confidence.",
    workedExample: "A total dividend of ₹120 crore on 40 crore shares is a dividend per share of 120 ÷ 40 = ₹3.",
    rulesOfThumb: [
      { context: "General", text: "Read the dividend per share together with the payout ratio; a dividend paid out of borrowed money cannot last." },
    ],
    pitfalls: [
      "A missing dividend is shown as 'Not provided', never as zero.",
      "A special one-off dividend can make a single year look unusually generous.",
    ],
    related: ["dividend_yield", "dividend_payout", "dividend_streak", "eps"],
  }),
  entry("dividend_yield", {
    whatItTells: "Dividend yield is the latest year's dividend per share as a percentage of the reference share price. It shows the cash return from dividends alone at the current price.",
    howToRead: "Higher means more income for each rupee invested, but a very high yield often reflects a falling price or a dividend that may not continue.",
    workedExample: "A dividend per share of ₹12 and a price of ₹400 give a dividend yield of 12 ÷ 400 × 100 = 3%.",
    rulesOfThumb: [
      { context: "General", text: "Compare the yield with the interest on a bank fixed deposit, and check that the dividend is covered by profit and free cash flow." },
    ],
    pitfalls: [
      "The yield uses the latest financial year's dividend, which may already have been paid.",
      "Dividends are taxed in the hands of shareholders in India, so the return after tax is lower.",
    ],
    related: ["dps", "dividend_payout", "price", "fcf_yield"],
  }),
  entry("eps", {
    whatItTells: "Earnings per share is net profit attributable to shareholders divided by the number of shares. It shows the profit earned for each share.",
    howToRead: "Higher is better, and steady growth in earnings per share over many years is a good sign. Compare its growth with net profit growth to spot dilution.",
    workedExample: "Net profit of ₹200 crore and 25 crore shares give earnings per share of 200 ÷ 25 = ₹8.",
    rulesOfThumb: [
      { context: "General", text: "If earnings per share grow much more slowly than net profit, the company is probably issuing new shares." },
    ],
    pitfalls: [
      "Splits and bonus issues change earnings per share; past figures must be adjusted to the current share count.",
      "TTM earnings per share use the latest share count, so the figure is approximate if the number of shares changed during the year.",
    ],
    related: ["net_profit", "pe", "bvps", "dps"],
  }),
  entry("bvps", {
    whatItTells: "Book value per share is net worth divided by the number of shares at the year end. It shows the shareholders' funds behind each share.",
    howToRead: "Higher is better, and steady growth shows that the company is retaining profit and building equity.",
    workedExample: "A net worth of ₹1,500 crore and 30 crore shares give a book value per share of 1,500 ÷ 30 = ₹50.",
    rulesOfThumb: [
      { context: "General", text: "A company that retains most of its profit should grow its book value per share at roughly its ROE." },
    ],
    pitfalls: [
      "Book value reflects the accounts, not market value; brands and know-how are often missing from it.",
      "Issuing shares at a high price raises book value per share without any profit being earned.",
    ],
    related: ["pb", "net_worth", "roe", "eps"],
  }),
];

// ── Intermediate level (P1) ─────────────────────────────────────────────────
const INTERMEDIATE: readonly GlossaryEntry[] = [
  entry("enterprise_value", {
    whatItTells: "Enterprise value is market capitalisation plus total debt and minority interest, minus cash and current investments. It approximates what it would cost to acquire the whole business, including its debts, while keeping its spare cash.",
    howToRead: "Neither a higher nor a lower figure is better on its own. Enterprise value is the starting point for ratios such as EV/EBITDA and earnings yield.",
    workedExample: "A market capitalisation of ₹10,000 crore, debt of ₹2,000 crore and cash of ₹500 crore give an enterprise value of 10,000 + 2,000 − 500 = ₹11,500 crore.",
    pitfalls: [
      "It combines today's price with the latest year-end balance sheet, so the two parts come from different dates.",
      "A large cash balance can make enterprise value much smaller than market capitalisation.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["market_cap", "ev_ebitda", "earnings_yield", "net_debt"],
  }),
  entry("ebitda", {
    whatItTells: "EBITDA here is revenue from operations minus operating expenses: profit before depreciation, interest, tax and other income. It shows what the core business earns before financing costs and the wear and tear of assets.",
    howToRead: "Higher is better. Read it as a margin (OPM) and against debt (debt to EBITDA) rather than as an amount alone.",
    workedExample: "Sales of ₹1,000 crore and operating expenses of ₹800 crore give EBITDA of ₹200 crore.",
    pitfalls: [
      "EBITDA is not cash: working capital and capital expenditure still have to be funded.",
      "Lease-heavy businesses show a higher EBITDA under Ind AS 116 because lease rent is no longer an operating expense.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["opm", "ebit", "ev_ebitda", "debt_ebitda"],
  }),
  entry("ebit", {
    whatItTells: "EBIT is EBITDA plus other income minus depreciation: profit before interest and tax. It is the profit figure used for ROCE and interest coverage.",
    howToRead: "Higher is better. Compare it with finance costs and with capital employed rather than as an amount alone.",
    workedExample: "EBITDA of ₹200 crore, other income of ₹20 crore and depreciation of ₹40 crore give EBIT of 200 + 20 − 40 = ₹180 crore.",
    pitfalls: ["EBIT includes other income, which may not come from the core business."],
    notApplicableNote: NAF_LENDERS,
    related: ["roce", "interest_coverage", "ebitda"],
  }),
  entry("net_debt", {
    whatItTells: "Net debt is total debt minus cash and current investments. A negative figure means the company holds more cash than it owes, that is, it has net cash.",
    howToRead: "Lower is better, and a negative figure means net cash.",
    workedExample: "Total debt of ₹400 crore and cash and current investments of ₹150 crore give net debt of ₹250 crore.",
    pitfalls: ["Cash may be held in subsidiaries or kept as margin money, so not all of it can repay debt."],
    notApplicableNote: NAF_LENDERS,
    related: ["total_debt", "net_debt_equity", "net_debt_ebitda", "enterprise_value"],
  }),
  entry("capital_employed", {
    whatItTells: "Capital employed is total equity plus total debt: all the long-term money that shareholders and lenders have put into the business. It is the base on which ROCE is measured.",
    howToRead: "Neither a higher nor a lower figure is better; what matters is the profit earned on it.",
    workedExample: "Total equity of ₹1,200 crore and total debt of ₹300 crore give capital employed of ₹1,500 crore.",
    pitfalls: ["Capital employed includes idle cash, which lowers ROCE; ROIC removes it."],
    notApplicableNote: NAF_LENDERS,
    related: ["roce", "roic", "net_worth", "total_debt"],
  }),
  entry("price_to_sales", {
    whatItTells: "Price to sales divides market value by sales over the last twelve months. It is useful when profits are low, negative or distorted by one-time items.",
    howToRead: "Lower is cheaper, but margins differ so much between sectors that comparisons are fair only within a sector.",
    workedExample: "A market capitalisation of ₹3,000 crore and trailing sales of ₹1,500 crore give a price to sales of 2.",
    pitfalls: ["Price to sales ignores profitability: a low ratio can belong to a business that never makes money."],
    notApplicableNote: NAF_LENDERS,
    related: ["pe", "sales", "opm", "ev_ebitda"],
  }),
  entry("ev_ebitda", {
    whatItTells: "EV/EBITDA compares enterprise value with EBITDA over the last twelve months. Because it counts debt and leaves out spare cash, it compares companies with different financing more fairly than P/E does.",
    howToRead: "Lower is cheaper, other things being equal. Compare within a sector.",
    workedExample: "An enterprise value of ₹11,500 crore and trailing EBITDA of ₹1,150 crore give EV/EBITDA of 10.",
    rulesOfThumb: [
      { context: "General", text: "Capital-heavy industries usually trade at lower EV/EBITDA multiples than asset-light ones." },
    ],
    pitfalls: [
      "When enterprise value is zero or negative (cash exceeds market value plus debt), the ratio is not meaningful.",
      "The ratio ignores the capital expenditure a business needs to keep earning its EBITDA.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["enterprise_value", "ebitda", "earnings_yield", "pe"],
  }),
  entry("earnings_yield", {
    whatItTells: "Earnings yield here is operating profit after depreciation (EBIT without other income) over the last twelve months as a percentage of enterprise value. It shows the operating return the business earns on its total value.",
    howToRead: "Higher is cheaper, other things being equal. Compare it within a sector, because capital needs and growth prospects differ.",
    workedExample: "Trailing operating profit of ₹1,000 crore and an enterprise value of ₹10,000 crore give an earnings yield of 10%.",
    rulesOfThumb: [
      { context: "General", text: "Some investors compare earnings yield with government bond yields as a rough check on valuation." },
    ],
    pitfalls: ["A negative value is kept, meaning an operating loss, so rankings remain meaningful."],
    notApplicableNote: NAF_LENDERS,
    related: ["enterprise_value", "ev_ebitda", "earnings_to_price", "roce"],
  }),
  entry("earnings_to_price", {
    whatItTells: "Earnings to price is trailing net profit as a percentage of market value: the inverse of P/E. Unlike P/E, it remains defined when the company makes a loss.",
    howToRead: "Higher is cheaper, other things being equal. A negative value means a loss.",
    workedExample: "Trailing net profit of ₹500 crore and a market capitalisation of ₹10,000 crore give earnings to price of 5%, which matches a P/E of 20.",
    pitfalls: ["It is convenient for ranking companies that include loss-makers, but a negative figure is a loss, not a bargain."],
    related: ["pe", "earnings_yield", "net_profit"],
  }),
  entry("fcf_yield", {
    whatItTells: "FCF yield is the latest year's free cash flow as a percentage of market value. It shows how much spare cash the business produces for each rupee of its market value.",
    howToRead: "Higher is better. A negative figure means the company spent more than it generated.",
    workedExample: "Free cash flow of ₹300 crore and a market capitalisation of ₹6,000 crore give an FCF yield of 5%.",
    pitfalls: ["One year's capital expenditure can swing it; the 3-year version is steadier."],
    notApplicableNote: NAF_LENDERS,
    related: ["fcf", "fcf_yield_3y", "dividend_yield", "earnings_to_price"],
  }),
  entry("fcf_yield_3y", {
    whatItTells: "This version of FCF yield uses the average free cash flow of the latest three financial years, as a percentage of market value. It smooths out lumpy capital expenditure.",
    howToRead: "Higher is better. A steady positive figure suggests the business produces spare cash through good and bad years.",
    workedExample: "Free cash flow of ₹200, ₹350 and ₹250 crore averages about ₹267 crore; with a market capitalisation of ₹8,000 crore, the 3-year FCF yield is about 3.3%.",
    rulesOfThumb: [
      { context: "General", text: "A 3-year FCF yield above about 3% is often read as reasonable value, depending on how fast the company grows." },
    ],
    pitfalls: ["All three years are needed; otherwise the app shows 'Not enough history'."],
    notApplicableNote: NAF_LENDERS,
    related: ["fcf", "fcf_yield", "cfo"],
  }),
  entry("peg", {
    whatItTells: "The PEG ratio divides the P/E by the 3-year growth rate (CAGR) of earnings per share, in percent. It puts valuation and growth side by side.",
    howToRead: "Lower is better. A PEG around 1 or below suggests the price is reasonable for the growth delivered.",
    workedExample: "A P/E of 30 and EPS growth of 20% a year give a PEG of 30 ÷ 20 = 1.5.",
    pitfalls: [
      "Past growth may not continue.",
      "The ratio is not meaningful when growth is zero or negative, or when the P/E is not available.",
    ],
    notApplicableNote: "Not shown for insurers in this app, because their earnings per share are shaped by long-term policy accounting.",
    related: ["pe", "eps"],
  }),
  entry("roic", {
    whatItTells: "Return on invested capital divides operating profit after tax by the average capital actually used in operations: equity plus debt, minus cash and current investments. Unlike ROCE, it leaves out spare cash and other income.",
    howToRead: "Higher is better. It shows the return of the core business on the money tied up in it.",
    workedExample: "Operating profit of ₹250 crore taxed at 25% leaves ₹187.5 crore; on invested capital of ₹1,000 crore, ROIC is 18.75%.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "A ROIC that stays well above the company's cost of borrowing and the return its shareholders expect suggests the business creates value." },
    ],
    pitfalls: [
      "A company with large net cash can have small or negative invested capital, which makes ROIC not meaningful.",
      "The tax rate used is the company's effective rate when it lies between 0% and 50%, and 25.17% otherwise.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["roce", "roe", "capital_employed", "net_debt"],
  }),
  entry("roa", {
    whatItTells: "Return on assets divides net profit by average total assets. It shows how much profit the company earns on everything it owns, and it is a key measure for banks, whose assets are mostly loans.",
    howToRead: "Higher is better. Compare within a sector, because asset-heavy businesses naturally earn a lower ROA.",
    workedExample: "Net profit of ₹120 crore on average total assets of ₹10,000 crore gives an ROA of 1.2%.",
    rulesOfThumb: [
      { context: "Banks", text: "An ROA above about 1% is often considered good for a bank." },
    ],
    pitfalls: ["ROA uses profit including the minority share, to match total assets, which include subsidiaries in full."],
    related: ["roe", "asset_turnover", "equity_multiplier", "nim_approx"],
  }),
  entry("gross_margin", {
    whatItTells: "Gross margin is sales minus the cost of goods sold, as a percentage of sales. It shows how much is left after paying for the goods or materials that were sold.",
    howToRead: "Higher is better. A high and stable gross margin can signal pricing power.",
    workedExample: "Sales of ₹1,000 crore and cost of goods sold of ₹600 crore give a gross margin of 40%.",
    pitfalls: ["It is not shown when cost of goods sold is not provided; the app never assumes it is zero. Service companies often do not report it."],
    notApplicableNote: NAF_LENDERS,
    related: ["opm", "npm", "inventory_days"],
  }),
  entry("effective_tax_rate", {
    whatItTells: "The effective tax rate is the tax expense as a percentage of profit before tax. It shows what share of pre-tax profit went in tax.",
    howToRead: "Neither higher nor lower is better in itself, but a rate far from the normal level needs an explanation.",
    workedExample: "Tax of ₹50 crore on profit before tax of ₹200 crore is an effective tax rate of 25%.",
    rulesOfThumb: [
      { context: "India", text: "Companies that opted for the concessional regime under Section 115BAA pay about 25.17%, including surcharge and cess." },
    ],
    pitfalls: [
      "A persistently very low rate deserves an explanation, such as tax holidays or losses carried forward.",
      "It is not meaningful when profit before tax is zero or negative.",
    ],
    related: ["net_profit", "npm", "pbt"],
  }),
  entry("other_income_to_pbt", {
    whatItTells: "This ratio is other income as a percentage of profit before tax. It shows how much of the profit comes from interest, dividends and other income outside the main business.",
    howToRead: "Lower is better, because it means profit comes mainly from the core business.",
    workedExample: "Other income of ₹40 crore and profit before tax of ₹200 crore give a ratio of 20%.",
    rulesOfThumb: [
      { context: "General", text: "When other income exceeds about 30% of profit before tax, much of the profit does not come from the main business." },
    ],
    pitfalls: [
      "Holding companies naturally show high values, because dividends from investments are their business.",
      "It is not meaningful when profit before tax is zero or negative.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["ebit", "opm", "effective_tax_rate"],
  }),
  entry("asset_turnover", {
    whatItTells: "Asset turnover divides sales by average total assets. It shows how much sales the company produces for each rupee of assets.",
    howToRead: "Higher is better within a sector; capital-heavy industries naturally turn their assets over more slowly.",
    workedExample: "Sales of ₹2,000 crore on average total assets of ₹1,000 crore give an asset turnover of 2 times.",
    pitfalls: ["Large cash balances count as assets and lower the ratio."],
    notApplicableNote: NAF_LENDERS,
    related: ["roa", "fixed_asset_turnover", "npm"],
  }),
  entry("debtor_days", {
    whatItTells: "Debtor days divide year-end trade receivables by sales and multiply by 365. They show the average number of days customers take to pay.",
    howToRead: "Lower is better. A rising trend means more of the reported sales are still waiting to be collected.",
    workedExample: "Receivables of ₹150 crore and sales of ₹1,095 crore give 150 ÷ 1,095 × 365 = 50 days.",
    rulesOfThumb: [
      { context: "General", text: "Debtor days rising by more than about 30% over three years, while sales grow slowly, are worth investigating." },
    ],
    pitfalls: ["Year-end balances can make seasonal businesses look better or worse than their average."],
    notApplicableNote: NAF_LENDERS,
    related: ["cash_conversion_cycle", "inventory_days", "payable_days", "working_capital_days"],
  }),
  entry("inventory_days", {
    whatItTells: "Inventory days divide year-end inventories by the cost of goods sold and multiply by 365. They show how many days of stock the company holds.",
    howToRead: "Lower is better within a sector; rising inventory days can mean slow-moving or unsold stock.",
    workedExample: "Inventories of ₹120 crore and cost of goods sold of ₹730 crore give 120 ÷ 730 × 365 = 60 days.",
    pitfalls: [
      "When cost of goods sold is not provided, the app uses sales instead and marks the value, which makes the days look shorter.",
      "A company that reports zero inventories, such as a services business, shows 0 days.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["debtor_days", "payable_days", "cash_conversion_cycle", "gross_margin"],
  }),
  entry("payable_days", {
    whatItTells: "Payable days divide year-end trade payables by the cost of goods sold and multiply by 365. They show the average number of days the company takes to pay its suppliers.",
    howToRead: "Neither higher nor lower is better in itself. Longer credit from suppliers helps cash flow, but very long payable days can mean the company is struggling to pay.",
    workedExample: "Payables of ₹90 crore and cost of goods sold of ₹730 crore give 90 ÷ 730 × 365 = 45 days.",
    pitfalls: ["Under Indian law, dues to micro and small enterprises generally have to be paid within 45 days, so very long payable days can carry legal risk."],
    notApplicableNote: NAF_LENDERS,
    related: ["debtor_days", "inventory_days", "cash_conversion_cycle"],
  }),
  entry("cash_conversion_cycle", {
    whatItTells: "The cash conversion cycle is debtor days plus inventory days minus payable days. It shows the number of days between paying for inputs and collecting cash from customers.",
    howToRead: "Lower is better. A negative cycle is valid: it means customers pay before suppliers are paid.",
    workedExample: "Debtor days of 50, inventory days of 60 and payable days of 45 give a cycle of 50 + 60 − 45 = 65 days.",
    pitfalls: ["If any part is computed on sales because cost of goods sold is missing, the cycle is approximate and marked so."],
    notApplicableNote: NAF_LENDERS,
    related: ["debtor_days", "inventory_days", "payable_days", "working_capital_days"],
  }),
  entry("working_capital_days", {
    whatItTells: "Working capital days compare operating current assets (current assets less cash and current investments) minus operating current liabilities (current liabilities less current borrowings) with sales, in days. They show how many days of sales are tied up in day-to-day operations.",
    howToRead: "Lower is better. A negative figure is valid and means suppliers and customers effectively fund the business.",
    workedExample: "Operating current assets of ₹400 crore, operating current liabilities of ₹250 crore and sales of ₹1,095 crore give (400 − 250) ÷ 1,095 × 365 = 50 days.",
    pitfalls: ["Year-end balances may not reflect the rest of the year."],
    notApplicableNote: NAF_LENDERS,
    related: ["cash_conversion_cycle", "current_ratio", "debtor_days"],
  }),
  entry("net_debt_equity", {
    whatItTells: "Net debt to equity divides net debt (debt minus cash and current investments) by total equity. It shows borrowing after using spare cash, for every rupee of shareholders' money.",
    howToRead: "Lower is better; a negative figure means the company has net cash.",
    workedExample: "Net debt of ₹250 crore and total equity of ₹1,000 crore give 0.25.",
    pitfalls: ["When equity is zero or negative, the ratio is not meaningful."],
    notApplicableNote: NAF_LENDERS,
    related: ["net_debt", "debt_equity", "net_debt_ebitda"],
  }),
  entry("debt_ebitda", {
    whatItTells: "Debt to EBITDA divides total debt by EBITDA. It shows roughly how many years of operating profit would repay all the debt.",
    howToRead: "Lower is better. A value of 0 means the company has no debt.",
    workedExample: "Debt of ₹600 crore and EBITDA of ₹300 crore give 2 times.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Below about 2 to 3 times is often considered comfortable; above 4 to 5 times can strain the company if profits fall." },
    ],
    pitfalls: ["When EBITDA is zero or negative and the company has debt, the ratio is not meaningful."],
    notApplicableNote: NAF_LENDERS,
    related: ["total_debt", "ebitda", "net_debt_ebitda", "interest_coverage"],
  }),
  entry("net_debt_ebitda", {
    whatItTells: "Net debt to EBITDA divides net debt by EBITDA. It shows roughly how many years of operating profit would repay the debt left after using spare cash.",
    howToRead: "Lower is better; a negative figure means net cash.",
    workedExample: "Net debt of ₹450 crore and EBITDA of ₹300 crore give 1.5 times.",
    pitfalls: ["When EBITDA is zero or negative, the ratio is not meaningful."],
    notApplicableNote: NAF_LENDERS,
    related: ["net_debt", "debt_ebitda", "ebitda"],
  }),
  entry("ttm_sales_growth", {
    whatItTells: "This growth rate compares sales over the latest four quarters with sales over the four quarters before them. It is more recent than the yearly growth rate.",
    howToRead: "Higher is better. Because it covers full twelve-month periods, seasonality does not distort it.",
    workedExample: "Sales of ₹1,150 crore over the latest four quarters against ₹1,000 crore over the previous four give growth of 15%.",
    pitfalls: ["Eight consecutive quarters are needed; otherwise the app shows 'Not enough history'."],
    related: ["sales_growth", "q_sales_yoy", "sales"],
  }),
  entry("ttm_profit_growth", {
    whatItTells: "This growth rate compares net profit over the latest four quarters with net profit over the four quarters before them. It is more recent than the yearly growth rate.",
    howToRead: "Higher is better, especially when sales grow as well.",
    workedExample: "Net profit of ₹130 crore over the latest four quarters against ₹100 crore over the previous four gives growth of 30%.",
    pitfalls: [
      "Eight consecutive quarters are needed.",
      "When the earlier period was a loss, the change is marked as a turnaround instead of a percentage.",
    ],
    related: ["profit_growth", "q_profit_yoy", "net_profit"],
  }),
  entry("q_sales_yoy", {
    whatItTells: "Quarterly sales growth compares the latest quarter's sales with the same quarter a year earlier, matched by date. It is the most recent view of how fast the business is growing.",
    howToRead: "Higher is better. Comparing with the same quarter of the previous year removes most seasonal effects.",
    workedExample: "Sales of ₹330 crore in the June quarter against ₹300 crore in the June quarter a year earlier is growth of 10%.",
    pitfalls: ["A single quarter can be noisy; look at several quarters before concluding anything."],
    related: ["q_sales", "ttm_sales_growth", "sales_growth"],
  }),
  entry("q_profit_yoy", {
    whatItTells: "Quarterly profit growth compares the latest quarter's net profit with the same quarter a year earlier, matched by date. It is the most recent view of the trend in profit.",
    howToRead: "Higher is better, especially when sales grow too.",
    workedExample: "Net profit of ₹44 crore in the latest quarter against ₹40 crore a year earlier is growth of 10%.",
    pitfalls: ["When the earlier quarter was a loss, the change is marked as a turnaround instead of a percentage."],
    related: ["q_net_profit", "ttm_profit_growth", "profit_growth"],
  }),
  entry("q_sales", {
    whatItTells: "Quarterly sales are the revenue from operations reported for a single quarter of three months. Listed companies publish them within weeks of each quarter end, so they are the most recent sales figures available.",
    howToRead: "Compare a quarter with the same quarter of the previous year rather than with the quarter just before it, because many businesses are seasonal.",
    workedExample: "Quarterly sales of ₹250, ₹270, ₹300 and ₹280 crore add up to ₹1,100 crore for the year.",
    pitfalls: ["Quarterly results are usually unaudited (reviewed only) and can be revised later."],
    related: ["q_sales_yoy", "sales", "ttm_sales_growth"],
  }),
  entry("q_net_profit", {
    whatItTells: "Quarterly net profit is the profit attributable to shareholders for a single quarter of three months. Four consecutive quarters add up to the trailing twelve-month (TTM) profit.",
    howToRead: "Compare it with the same quarter of the previous year, and check whether a large change comes from exceptional items.",
    workedExample: "Quarterly net profit of ₹20, ₹25, ₹30 and ₹25 crore adds up to ₹100 crore for the year.",
    pitfalls: ["One-time items affect a single quarter much more than a full year."],
    related: ["q_profit_yoy", "net_profit", "ttm_profit_growth"],
  }),
  entry("cfo_to_pat", {
    whatItTells: "This ratio divides cash from operations by net profit for the same year. It shows how much of the reported profit came in as cash.",
    howToRead: "Higher is better; a ratio around 1 or above is healthy.",
    workedExample: "Cash from operations of ₹90 crore and net profit of ₹100 crore give 0.9.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "A ratio of about 0.8 or more over several years suggests that profit is turning into cash." },
    ],
    pitfalls: [
      "It is not meaningful in a loss year.",
      "A single year is noisy; the 5-year cumulative version is steadier.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["cfo", "cum_cfo_to_pat_5y", "net_profit", "accruals_ratio"],
  }),
  entry("cum_cfo_to_pat_5y", {
    whatItTells: "This ratio divides the total cash from operations of five financial years by the total net profit of the same years. It smooths out yearly swings in working capital.",
    howToRead: "Higher is better. A value well below 1 for five years means a large part of the reported profit has not arrived as cash.",
    workedExample: "Cash from operations totalling ₹400 crore against net profit totalling ₹500 crore over five years gives 0.8.",
    rulesOfThumb: [
      { context: "Non-financial companies", text: "Above about 0.8 is generally reassuring; below about 0.7 is worth investigating." },
    ],
    pitfalls: ["All five years of both figures are needed; otherwise the app shows 'Not enough history'."],
    notApplicableNote: NAF_LENDERS,
    related: ["cfo_to_pat", "cfo", "net_profit"],
  }),
  entry("fii_holding", {
    whatItTells: "FII or FPI holding is the percentage of shares held by foreign portfolio investors, as reported in the shareholding pattern. It shows how much of the company is owned by overseas funds and institutions.",
    howToRead: "Neither high nor low is good in itself. Rising foreign holding can reflect growing interest from large investors.",
    workedExample: "Foreign portfolio investors holding 12 crore of 100 crore shares means FII holding of 12%.",
    pitfalls: ["Foreign portfolio money can move quickly with global conditions."],
    related: ["dii_holding", "promoter_holding", "public_holding"],
  }),
  entry("dii_holding", {
    whatItTells: "DII holding is the percentage of shares held by domestic institutions, such as mutual funds, insurance companies, banks and pension funds. It shows how much of the company Indian institutions own.",
    howToRead: "Neither high nor low is good in itself. Steady domestic institutional holding can add stability to the shareholder base.",
    workedExample: "Domestic institutions holding 15 crore of 100 crore shares means DII holding of 15%.",
    pitfalls: ["Large holdings by a single institution can make the figure jump when that institution changes its position."],
    related: ["fii_holding", "promoter_holding", "public_holding"],
  }),
  entry("public_holding", {
    whatItTells: "Public and others is what remains after promoter, FII and DII holdings are subtracted from 100%. It approximates the share held by individuals and other non-institutional holders.",
    howToRead: "Neither high nor low is good in itself. A large public holding usually means the shares are widely held and actively traded.",
    workedExample: "Promoters at 55%, FIIs at 15% and DIIs at 12% leave 100 − 55 − 15 − 12 = 18% for the public and others.",
    pitfalls: ["It is approximate: some categories, such as foreign direct investors or government bodies, may fall into it."],
    related: ["promoter_holding", "fii_holding", "dii_holding"],
  }),
  entry("dividend_payout", {
    whatItTells: "Dividend payout is the year's dividends (dividend per share × shares) as a percentage of the net profit attributable to shareholders. It shows how much of the profit is paid out rather than kept in the business.",
    howToRead: "Neither higher nor lower is better in itself: a high payout gives income, a low payout leaves more for reinvestment. What matters is whether the payout fits the company's growth and cash flow.",
    workedExample: "Dividends of ₹40 crore on net profit of ₹100 crore are a payout of 40%.",
    rulesOfThumb: [
      { context: "General", text: "A payout above 100% means the company paid more than it earned that year, which cannot continue for long." },
    ],
    pitfalls: ["It is not meaningful in a loss year."],
    related: ["dps", "dividend_yield", "dividend_streak", "net_profit"],
  }),
  entry("dividend_streak", {
    whatItTells: "This counts the consecutive latest financial years in which the company paid a dividend. It shows how consistently the company shares its profit.",
    howToRead: "Higher is better. A long streak shows the company has kept paying dividends through good and bad years.",
    workedExample: "A company that paid a dividend in each of FY22 to FY26 but not in FY21 has a streak of 5 years.",
    pitfalls: ["The count is limited by the history in your data; when every year has a dividend, the app shows 'at least' that many years."],
    related: ["dps", "dividend_payout", "dividend_yield"],
  }),
  entry("nii", {
    whatItTells: "Net interest income is the interest a lender earns on its loans and investments minus the interest it pays on deposits and borrowings. It is the core earnings of a bank or an NBFC.",
    howToRead: "Higher is better, and steady growth matters. Read it together with the net interest margin.",
    workedExample: "Interest earned of ₹1,000 crore and interest expended of ₹600 crore give net interest income of ₹400 crore.",
    notApplicableNote: LENDERS_ONLY,
    related: ["nim_approx", "cost_to_income", "ppop"],
  }),
  entry("nim_approx", {
    whatItTells: "This approximate net interest margin divides net interest income by average total assets. It shows the spread a lender earns on its balance sheet.",
    howToRead: "Higher is better, as long as asset quality holds up.",
    workedExample: "Net interest income of ₹400 crore on average total assets of ₹12,000 crore gives about 3.3%.",
    rulesOfThumb: [
      { context: "Banks", text: "Banks usually report NIM on interest-earning assets only, so their reported figure is somewhat higher than this approximation on total assets." },
    ],
    pitfalls: ["It is always an approximation and is marked as such."],
    notApplicableNote: LENDERS_ONLY,
    related: ["nii", "roa", "cost_to_income"],
  }),
  entry("cost_to_income", {
    whatItTells: "Cost to income divides a lender's operating expenses by its net interest income plus other income. It shows how much of the lender's income goes in running costs.",
    howToRead: "Lower is better. A falling ratio over several years shows the lender is becoming more efficient.",
    workedExample: "Operating expenses of ₹225 crore against net interest income of ₹400 crore and other income of ₹100 crore give 45%.",
    rulesOfThumb: [
      { context: "Banks", text: "A cost to income ratio below about 45% to 50% is often seen as efficient." },
    ],
    pitfalls: ["Lenders that are building branches or technology may run high ratios for a while."],
    notApplicableNote: LENDERS_ONLY,
    related: ["nii", "ppop", "credit_cost"],
  }),
  entry("gnpa_ratio", {
    whatItTells: "The gross NPA ratio is gross non-performing assets (Stage 3 loans) as a percentage of gross advances. It shows the share of loans that have stopped paying.",
    howToRead: "Lower is better. A rising ratio signals deteriorating asset quality.",
    workedExample: "Gross NPAs of ₹300 crore on gross advances of ₹10,000 crore give 3%.",
    rulesOfThumb: [
      { context: "Banks and NBFCs", text: "A gross NPA ratio below about 3% to 4% is generally seen as healthy." },
    ],
    pitfalls: ["Definitions differ slightly between banks (90 days overdue) and NBFCs reporting under Ind AS (Stage 3)."],
    notApplicableNote: LENDERS_ONLY,
    related: ["nnpa_ratio", "provision_coverage", "credit_cost"],
  }),
  entry("nnpa_ratio", {
    whatItTells: "The net NPA ratio is net non-performing assets (bad loans after provisions) as a percentage of net advances. It shows the bad loans not yet covered by provisions.",
    howToRead: "Lower is better. Compare it with the gross NPA ratio to see how much of the bad loans is already provided for.",
    workedExample: "Net NPAs of ₹90 crore on net advances of ₹9,800 crore give about 0.9%.",
    rulesOfThumb: [
      { context: "Banks and NBFCs", text: "A net NPA ratio below about 1.5% is often considered comfortable." },
    ],
    notApplicableNote: LENDERS_ONLY,
    related: ["gnpa_ratio", "provision_coverage", "p_abv"],
  }),
  entry("provision_coverage", {
    whatItTells: "Provision coverage is the part of gross NPAs already provided for, as a percentage: (gross NPA − net NPA) ÷ gross NPA. It shows how much of the bad loans the lender has already absorbed in its accounts.",
    howToRead: "Higher is better. Strong coverage means future losses on existing bad loans should hit profit less.",
    workedExample: "Gross NPAs of ₹300 crore and net NPAs of ₹90 crore give coverage of (300 − 90) ÷ 300 × 100 = 70%.",
    rulesOfThumb: [
      { context: "Banks and NBFCs", text: "Coverage above about 60% is usually considered comfortable; below 50% is thin." },
    ],
    pitfalls: ["When there are no NPAs at all, the ratio is not a number; the app shows 'No NPAs'."],
    notApplicableNote: LENDERS_ONLY,
    related: ["gnpa_ratio", "nnpa_ratio", "credit_cost"],
  }),
  entry("piotroski_f", {
    whatItTells: "The Piotroski F-score adds up nine yes-or-no tests of profitability, borrowing, liquidity and efficiency, comparing the latest year with the one before. It gives a score from 0 to 9.",
    howToRead: "Higher is better. In this app, 8 to 9 is labelled 'Strong', 4 to 7 'Moderate' and 0 to 3 'Weak'; these bands are rules of thumb.",
    workedExample: "A company that passes seven of the nine tests scores 7.",
    pitfalls: [
      "Three years of balance sheets are needed; if any test cannot be evaluated, no score is shown and the app says how many tests could be evaluated.",
      "The score was designed for value stocks in another market, so treat it as a checklist, not a forecast.",
    ],
    notApplicableNote: "Designed for non-financial companies, so it is not shown for banks, NBFCs and insurers.",
    related: ["roa", "cfo", "current_ratio", "gross_margin"],
  }),
  entry("altman_z", {
    whatItTells: "The Altman Z'' score (the version for non-manufacturers and emerging markets) combines four balance-sheet ratios into a single distress score. It looks at liquidity, retained earnings, operating profit and the cushion of equity over liabilities.",
    howToRead: "Higher is better. Above 2.6 is the 'safe zone', 1.1 to 2.6 the 'grey zone' and below 1.1 the 'distress zone'.",
    workedExample: "Working capital, retained earnings, operating profit and equity are each divided by total assets (equity by total liabilities), weighted and added up.",
    pitfalls: [
      "It is a distress screen, not a prediction of default.",
      "This app uses other equity as a stand-in for retained earnings, which can differ.",
    ],
    notApplicableNote: NAF_LENDERS,
    related: ["current_ratio", "debt_equity", "net_worth"],
  }),
  entry("red_flag_count", {
    whatItTells: "This counts how many of the app's rule-based warning signs are triggered for the company, such as profit not backed by cash or a high promoter pledge. Each rule is a visible query that you can read on the company page.",
    howToRead: "Lower is better. Each flag is a prompt to read the annual report more closely, not a verdict on the company.",
    workedExample: "A company with a high pledge and weak interest cover shows 2 red flags.",
    pitfalls: ["When more than four rules cannot be evaluated because data is missing, the count is not shown."],
    related: ["cum_cfo_to_pat_5y", "pledged_pct", "interest_coverage"],
  }),
  entry("latest_fy", {
    whatItTells: "This is the most recent financial year in your data for the company. All latest-year figures and checks refer to it.",
    howToRead: "Check that companies you compare have the same latest year; otherwise you are comparing different periods.",
    workedExample: "A company whose latest annual figures are for the year ended 31 March 2026 shows FY26.",
    pitfalls: ["In the fictional sample, financial-year labels are for illustration only."],
    related: ["years_of_history"],
  }),
];

/** Glossary entries keyed by base metric id. */
export const GLOSSARY: Readonly<Record<MetricId, GlossaryEntry>> = Object.freeze(
  Object.fromEntries([...BASIC, ...INTERMEDIATE].map((e) => [e.base, e])),
);

/** Ids with a basic-level entry (P0) and with an intermediate entry (P1). */
export const GLOSSARY_BASIC_IDS: readonly MetricId[] = BASIC.map((e) => e.base);
export const GLOSSARY_INTERMEDIATE_IDS: readonly MetricId[] = INTERMEDIATE.map((e) => e.base);
