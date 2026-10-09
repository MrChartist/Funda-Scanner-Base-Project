// src/test/fixtures/sample/real-name-denylist.ts — TEST-ONLY guard against real names (§F.4).
// Well-known NSE symbols plus group and brand words. Generated sample names and symbols, and
// the new public sample files, must not match any entry. This file never ships in the bundle:
// only tests import it. The list was compiled from public index memberships and widely known
// group names; it is a guard, not a complete register, and is reviewed by the project owner.

/** Well-known NSE trading symbols (upper case, as listed). */
export const DENYLIST_SYMBOLS: readonly string[] = [
  // Large caps
  "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "HINDUNILVR", "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK",
  "LT", "AXISBANK", "ASIANPAINT", "MARUTI", "HCLTECH", "SUNPHARMA", "TITAN", "ULTRACEMCO", "BAJFINANCE", "WIPRO",
  "NESTLEIND", "ONGC", "NTPC", "POWERGRID", "M&M", "TATAMOTORS", "TATASTEEL", "JSWSTEEL", "ADANIENT", "ADANIPORTS",
  "COALINDIA", "BAJAJFINSV", "TECHM", "GRASIM", "HINDALCO", "DIVISLAB", "DRREDDY", "CIPLA", "BRITANNIA", "EICHERMOT",
  "HEROMOTOCO", "BAJAJ-AUTO", "APOLLOHOSP", "INDUSINDBK", "SBILIFE", "HDFCLIFE", "TATACONSUM", "UPL", "BPCL", "SHREECEM",
  "LTIM", "ADANIGREEN", "ADANIPOWER", "ADANIENSOL", "ATGL", "AMBUJACEM", "ACC", "DMART", "AVENUE", "PIDILITIND",
  "DABUR", "GODREJCP", "GODREJPROP", "MARICO", "COLPAL", "BERGEPAINT", "HAVELLS", "SIEMENS", "ABB", "BOSCHLTD",
  "BEL", "HAL", "BHEL", "IOC", "GAIL", "HINDPETRO", "PETRONET", "IGL", "MGL", "OIL",
  "VEDL", "HINDZINC", "NMDC", "SAIL", "JINDALSTEL", "JSWENERGY", "TATAPOWER", "ADANITRANS", "TORNTPOWER", "NHPC",
  "SJVN", "IRFC", "IRCTC", "RVNL", "IRCON", "CONCOR", "LICI", "ICICIPRULI", "ICICIGI", "GICRE",
  "NIACL", "SBICARD", "BAJAJHLDNG", "CHOLAFIN", "MUTHOOTFIN", "MANAPPURAM", "SHRIRAMFIN", "LICHSGFIN", "PNBHOUSING", "CANFINHOME",
  "PFC", "RECLTD", "IDFCFIRSTB", "BANDHANBNK", "FEDERALBNK", "AUBANK", "YESBANK", "RBLBANK", "IDBI", "PNB",
  "BANKBARODA", "CANBK", "UNIONBANK", "INDIANB", "BANKINDIA", "MAHABANK", "IOB", "UCOBANK", "CENTRALBK", "PSB",
  "KARURVYSYA", "CUB", "DCBBANK", "SOUTHBANK", "J&KBANK", "EQUITASBNK", "UJJIVANSFB", "HDFCAMC", "NAM-INDIA", "UTIAMC",
  "ABSLAMC", "ANGELONE", "MOTILALOFS", "IIFL", "BSE", "MCX", "CDSL", "CAMS", "KFINTECH", "POLICYBZR",
  "PAYTM", "NYKAA", "ZOMATO", "DELHIVERY", "NAUKRI", "INDIGO", "SPICEJET", "IDEA", "TATACOMM", "TATAELXSI",
  "TATACHEM", "TATAINVEST", "VOLTAS", "TRENT", "TITAGARH", "INDHOTEL", "MPHASIS", "PERSISTENT", "COFORGE", "LTTS",
  "OFSS", "KPITTECH", "CYIENT", "ZENSARTECH", "SONACOMS", "MOTHERSON", "BHARATFORG", "BALKRISIND", "MRF", "APOLLOTYRE",
  "CEATLTD", "ASHOKLEY", "TVSMOTOR", "ESCORTS", "EXIDEIND", "AMARAJABAT", "ENDURANCE", "SUNDRMFAST", "BOSCH", "SCHAEFFLER",
  "TIMKEN", "SKFINDIA", "CUMMINSIND", "THERMAX", "KIRLOSENG", "AIAENG", "POLYCAB", "KEI", "FINCABLES", "DIXON",
  "VGUARD", "CROMPTON", "WHIRLPOOL", "BLUESTARCO", "AMBER", "LUPIN", "AUROPHARMA", "ZYDUSLIFE", "CADILAHC", "TORNTPHARM",
  "ALKEM", "BIOCON", "GLENMARK", "IPCALAB", "ABBOTINDIA", "PFIZER", "GLAXO", "SANOFI", "LAURUSLABS", "GRANULES",
  "NATCOPHARM", "AJANTPHARM", "MANKIND", "MAXHEALTH", "FORTIS", "NH", "METROPOLIS", "LALPATHLAB", "SRF", "DEEPAKNTR",
  "AARTIIND", "ATUL", "NAVINFLUOR", "PIIND", "SUMICHEM", "COROMANDEL", "CHAMBLFERT", "GNFC", "GSFC", "BAYERCROP",
  "CLEAN", "FINEORG", "VINATIORGA", "ALKYLAMINE", "BALAMINES", "GUJGASLTD", "GSPL", "ADANIGAS", "DALBHARAT", "RAMCOCEM",
  "JKCEMENT", "INDIACEM", "HEIDELBERG", "STARCEMENT", "NUVOCO", "JKLAKSHMI", "ORIENTCEM", "BIRLACORPN", "PRSMJOHNSN", "DLF",
  "OBEROIRLTY", "PRESTIGE", "BRIGADE", "SOBHA", "PHOENIXLTD", "LODHA", "MACROTECH", "SUNTV", "ZEEL", "PVRINOX",
  "JUBLFOOD", "DEVYANI", "WESTLIFE", "VBL", "UBL", "MCDOWELL-N", "RADICO", "TATACOFFEE", "EMAMILTD", "JYOTHYLAB",
  "GILLETTE", "PGHH", "HONAUFON", "BATAINDIA", "RELAXO", "PAGEIND", "RAYMOND", "ARVIND", "WELSPUNLIV", "TRIDENT",
  "VARDHMAN", "KPRMILL", "ABFRL", "SHOPERSTOP", "VMART", "KALYANKJIL", "RAJESHEXPO", "ASTRAL", "SUPREMEIND", "FINPIPE",
  "KAJARIACER", "CERA", "HINDCOPPER", "NATIONALUM", "MOIL", "WELCORP", "JSL", "APLAPOLLO", "RATNAMANI", "GODREJIND",
  "ADANIWILMAR", "PATANJALI", "HATSUN", "HERITGFOOD", "ZYDUSWELL", "GODFRYPHLP", "VSTIND", "BHARATRAS", "INDIAMART", "JUSTDIAL",
];

/** Group, family and brand words that must not appear in a fictional name or symbol. */
export const DENYLIST_WORDS: readonly string[] = [
  "Tata", "Reliance", "Adani", "Birla", "Bajaj", "Mahindra", "HDFC", "ICICI", "Infosys", "Wipro",
  "Kotak", "Godrej", "Hero", "Maruti", "Airtel", "Vedanta", "Jindal", "Murugappa", "TVS", "Ambani",
  "Piramal", "Hinduja", "Wadia", "Essar", "Lodha", "Kirloskar", "Thermax", "Dabur", "Marico", "Emami",
  "Haldiram", "Amul", "Patanjali", "Britannia", "Nestle", "Hindustan", "Bharat", "Larsen", "Toubro", "Ultratech",
  "Asian Paints", "Titan", "Cipla", "Lupin", "Sun Pharma", "Dr Reddy", "Biocon", "Zydus", "Cadila", "Torrent",
  "Glenmark", "Aurobindo", "Mankind", "Apollo", "Fortis", "Shriram", "Muthoot", "Manappuram", "Chola", "Sundaram",
  "Ashok Leyland", "Eicher", "Escorts", "Bosch", "Siemens", "Havells", "Polycab", "Voltas", "Blue Star", "Whirlpool",
  "Raymond", "Arvind", "Welspun", "Trident", "Vardhman", "Bata", "Trent", "Avenue", "DMart", "Nykaa",
  "Zomato", "Swiggy", "Paytm", "Flipkart", "IndiGo", "SpiceJet", "Vodafone", "Jio", "Idea", "BSNL",
  "Coal India", "ONGC", "NTPC", "GAIL", "SBI", "LIC", "PNB", "IDBI", "Canara", "Baroda",
  "Yes Bank", "IndusInd", "Federal Bank", "Bandhan", "RBL", "Ujjivan", "Equitas", "AU Small", "IDFC", "Axis",
  "JSW", "Hindalco", "Nalco", "Sail", "NMDC", "Hindustan Zinc", "Ambuja", "ACC", "Shree Cement", "Ramco",
  "Dalmia", "Prestige", "Sobha", "Oberoi", "DLF", "Brigade", "Godrej Properties", "Pidilite", "Berger", "Kansai",
  "Nerolac", "Colgate", "Gillette", "Procter", "Unilever", "Jubilant", "Tech Mahindra", "HCL", "Mphasis", "Persistent",
  "Coforge", "Mindtree", "Cyient", "Zensar", "Sonata", "Hexaware", "Mastek", "Firstsource", "Motherson", "Bharat Forge",
  "MRF", "Apollo Tyres", "CEAT", "Exide", "Amara Raja", "Cummins", "Schaeffler", "Timken", "SKF", "Dixon",
  "Tanishq", "Kalyan", "Malabar", "Senco", "Page Industries", "Jockey", "Peter England", "Allen Solly", "Bisleri", "Parle",
  "ITC", "Wagh Bakri", "Mother Dairy", "Tata Consumer", "Hatsun", "Heritage", "Radico", "United Spirits", "United Breweries", "Kingfisher",
  "Zee", "Sun TV", "PVR", "INOX", "Info Edge", "Naukri", "IRCTC", "IRFC", "Indian Oil", "Indian Railways",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORD_PATTERNS: readonly { word: string; re: RegExp }[] = DENYLIST_WORDS.map((word) => ({
  word,
  re: new RegExp(`(^|[^A-Za-z])${escapeRegExp(word)}([^A-Za-z]|$)`, "i"),
}));

/** Letters-only upper-case forms of the brand words that are long enough to test inside a symbol. */
const SYMBOL_FRAGMENTS: readonly string[] = DENYLIST_WORDS
  .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""))
  .filter((w) => w.length >= 4);

const SYMBOL_SET: ReadonlySet<string> = new Set(DENYLIST_SYMBOLS);

/** Denylisted words or phrases found as whole words in a piece of text (case-insensitive). */
export function denylistWordHits(text: string): string[] {
  return WORD_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.word);
}

/** Why a symbol is denied: an exact NSE symbol, or a brand word of 4+ letters inside it. */
export function denylistSymbolHits(symbol: string): string[] {
  const upper = symbol.toUpperCase();
  const hits: string[] = [];
  if (SYMBOL_SET.has(upper)) hits.push(upper);
  for (const f of SYMBOL_FRAGMENTS) if (upper.includes(f)) hits.push(f);
  return hits;
}
