import { INDUSTRY_TERMS } from "./industry-terms.js";

const DEFAULT_APPROVED_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "ft.com",
  "wsj.com",
  "worldbank.org",
  "imf.org",
  "bis.org",
  "bot.or.th"
];

const ALLOWED_CURRENCIES = ["THB", "USD", "JPY", "EUR", "CNY"];

const OPENAI_FAST_MODEL = "gpt-4.1-mini";
const OPENAI_ANALYSIS_MODEL = "gpt-4.1";

const SUBSECTOR_KEYWORD_MAP = {
  "Thai commercial bank": [
    "Thailand banking",
    "Bank of Thailand",
    "digital banking",
    "loan growth",
    "credit risk",
    "NPL",
    "capital adequacy",
    "compliance",
    "trade finance",
    "working capital"
  ],
  "Branches of foreign bank": [
    "foreign bank Thailand",
    "cross-border banking",
    "Bank of Thailand",
    "capital requirements",
    "trade finance",
    "cross-border payments"
  ],
  "Manufacture of computer, electronic and optical products": [
    "electronics manufacturing",
    "semiconductors",
    "chip supply chain",
    "exports",
    "Thailand electronics",
    "trade finance",
    "inventory financing"
  ],
  "Wholesale trade, except of motor vehicles and motorcycles": [
    "wholesale trade",
    "inventory",
    "supplier financing",
    "working capital",
    "trade credit",
    "import distribution"
  ],
  "Retail trade, except of motor vehicles and motorcycles": [
    "retail trade",
    "consumer demand",
    "inventory",
    "supplier payments",
    "working capital",
    "cash conversion cycle"
  ],
  "Food and beverage service activities": [
    "restaurants",
    "food service",
    "tourism",
    "food inflation",
    "working capital",
    "supplier payments"
  ],
  "Computer programming, consultancy and related activities": [
    "software services",
    "IT consulting",
    "digital transformation",
    "cloud services",
    "AI adoption",
    "cross-border services"
  ],
  "Telecommunications": [
    "telecom",
    "5G",
    "mobile network",
    "broadband",
    "network infrastructure",
    "equipment imports"
  ],
  "Air transport": [
    "aviation",
    "airlines",
    "air cargo",
    "passenger traffic",
    "fuel costs",
    "FX exposure"
  ],
  "Warehousing and support activities for transportation": [
    "logistics",
    "warehousing",
    "freight",
    "supply chain",
    "trade flows",
    "inventory financing"
  ]
};

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function getDateRange(timeframeDays) {
  const days = Number(timeframeDays || 30);
  const end = new Date();
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return {
    start_date: formatDate(start),
    end_date: formatDate(end)
  };
}

function inferKeywordsFromText(text) {
  const stopWords = new Set([
    "and", "with", "from", "except", "other", "activities",
    "activity", "service", "services", "related", "supply",
    "including", "not", "elsewhere", "classified", "own",
    "leased", "goods", "bodies", "organizations", "organisation",
    "undifferentiated", "compulsory", "social"
  ]);

  return String(text || "")
    .toLowerCase()
    .replace(/[;,.()/-]/g, " ")
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 3)
    .filter(word => !stopWords.has(word));
}

function extractPromptKeywords(text) {
  const stopWords = new Set([
    "the", "and", "for", "with", "from", "that", "this", "based",
    "recent", "news", "could", "would", "should", "about", "customer",
    "profile", "suggest", "relevant", "themes", "affect", "focus",
    "trade", "finance", "bank", "banking", "relationship", "manager",
    "thailand", "thai", "speaking", "corporate"
  ]);

  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 3)
    .filter(word => !stopWords.has(word))
    .slice(0, 4);
}

function uniqueArray(items) {
  return [...new Set(items.filter(Boolean))];
}

function getIndustryTermProfile({ isicCode = "", industry = "" } = {}) {
  const code = String(isicCode || "").trim();
  if (code && INDUSTRY_TERMS[code]) return INDUSTRY_TERMS[code];

  const cleanIndustry = String(industry || "")
    .replace(/^\d+\s*[-–—:]\s*/, "")
    .toLowerCase()
    .trim();

  if (!cleanIndustry) return { high: [], medium: [], low: [] };

  const match = Object.values(INDUSTRY_TERMS).find(profile =>
    String(profile.description || "").toLowerCase() === cleanIndustry
  );

  return match || { high: [], medium: [], low: [] };
}

function getSearchKeywords({ sector, subsector, industry = "", isicCode = "" }) {
  const manualKeywords = SUBSECTOR_KEYWORD_MAP[subsector] || [];
  const termProfile = getIndustryTermProfile({ isicCode, industry });
  const inferredIndustryKeywords = inferKeywordsFromText(industry);
  const inferredSubsectorKeywords = inferKeywordsFromText(subsector);
  const inferredSectorKeywords = inferKeywordsFromText(sector);

  return uniqueArray([
    ...(termProfile.high || []),
    ...(termProfile.medium || []),
    ...manualKeywords,
    ...inferredIndustryKeywords,
    ...inferredSubsectorKeywords,
    ...inferredSectorKeywords
  ]).slice(0, 28);
}

function countTermMatches(text, terms = []) {
  const haystack = String(text || "").toLowerCase();
  let count = 0;
  const matched = [];

  for (const term of terms || []) {
    const clean = String(term || "").toLowerCase().trim();
    if (!clean || clean.length < 3) continue;
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = clean.includes(" ") ? escaped : `\\b${escaped}\\b`;
    try {
      if (new RegExp(pattern, "i").test(haystack)) {
        count += 1;
        matched.push(clean);
      }
    } catch (_) {
      if (haystack.includes(clean)) {
        count += 1;
        matched.push(clean);
      }
    }
  }

  return { count, matched: matched.slice(0, 8) };
}

function calculateIndustryRelevanceScore(source, termProfile = {}) {
  const text = [source.title, source.summary, source.raw_content].join(" ");
  const high = countTermMatches(text, termProfile.high || []);
  const medium = countTermMatches(text, termProfile.medium || []);
  const low = countTermMatches(text, termProfile.low || []);

  let score = high.count * 5 + medium.count * 2 - low.count * 3;

  if (high.count === 0 && medium.count === 0 && low.count > 0) score -= 6;
  if (high.count >= 2) score += 3;
  if (high.count === 0 && medium.count <= 1) score -= 2;

  return {
    score: Math.max(-10, Math.min(score, 20)),
    highMatches: high.matched,
    mediumMatches: medium.matched,
    weakAdjacencyMatches: low.matched
  };
}

function cleanQueryText(text) {
  return String(text || "")
    .replace(/[^a-zA-Z0-9\s&+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 350);
}

function normalizeCountryList(countries = []) {
  const seen = new Set();
  return (Array.isArray(countries) ? countries : [])
    .map(country => ({
      name: String(country?.name || "").trim(),
      code: String(country?.code || "").trim(),
      label: String(country?.label || country?.name || country?.code || "").trim()
    }))
    .filter(country => country.name || country.code || country.label)
    .filter(country => {
      const key = country.code || country.name || country.label;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeCurrencyList(currencies = []) {
  return uniqueArray((Array.isArray(currencies) ? currencies : [])
    .map(currency => String(currency || "").toUpperCase().trim())
    .filter(currency => ALLOWED_CURRENCIES.includes(currency)));
}

function normalizeTradeFlow(raw = {}, fallbackCountries = [], fallbackCurrencies = []) {
  const purchase = raw?.purchase || {};
  const sales = raw?.sales || {};
  const fallback = normalizeCountryList(fallbackCountries);
  const fallbackCurrencyList = normalizeCurrencyList(fallbackCurrencies);

  return {
    purchase: {
      domestic: Boolean(purchase.domestic),
      international: Boolean(purchase.international),
      countries: normalizeCountryList(purchase.countries || []),
      currencies: normalizeCurrencyList(purchase.currencies || fallbackCurrencyList)
    },
    sales: {
      domestic: Boolean(sales.domestic),
      international: Boolean(sales.international),
      countries: normalizeCountryList(sales.countries || []),
      currencies: normalizeCurrencyList(sales.currencies || fallbackCurrencyList)
    },
    legacyCountries: fallback
  };
}

function deriveTradeRolesFromFlow(tradeFlow, legacyRoles = []) {
  const roles = [];
  if (tradeFlow?.purchase?.international) roles.push("importer");
  if (tradeFlow?.sales?.international) roles.push("exporter");
  const cleanLegacy = (Array.isArray(legacyRoles) ? legacyRoles : [])
    .map(role => String(role).toLowerCase())
    .filter(role => ["importer", "exporter"].includes(role));
  return uniqueArray([...roles, ...cleanLegacy]);
}

function getAllTradeFlowCountries(tradeFlow) {
  return normalizeCountryList([
    ...(tradeFlow?.purchase?.countries || []),
    ...(tradeFlow?.sales?.countries || []),
    ...(tradeFlow?.legacyCountries || [])
  ]);
}

function getAllTradeFlowCurrencies(tradeFlow, legacyCurrencies = []) {
  return uniqueArray([
    ...(tradeFlow?.purchase?.currencies || []),
    ...(tradeFlow?.sales?.currencies || []),
    ...normalizeCurrencyList(legacyCurrencies)
  ]);
}

function listCountries(countries = [], max = 4) {
  return normalizeCountryList(countries).map(country => country.name || country.label || country.code).filter(Boolean).slice(0, max).join(" ");
}

function tradeFlowSummary(tradeFlow) {
  const purchaseMarkets = tradeFlow?.purchase?.international ? listCountries(tradeFlow.purchase.countries, 6) || "international suppliers" : "none";
  const salesMarkets = tradeFlow?.sales?.international ? listCountries(tradeFlow.sales.countries, 6) || "international buyers" : "none";
  return [
    `Purchase from: ${tradeFlow?.purchase?.domestic ? "Thailand domestic" : ""}${tradeFlow?.purchase?.domestic && tradeFlow?.purchase?.international ? "; " : ""}${tradeFlow?.purchase?.international ? purchaseMarkets : ""}`.trim(),
    `Purchase currencies: ${(tradeFlow?.purchase?.currencies || []).join(", ") || "not specified"}`,
    `Sales to: ${tradeFlow?.sales?.domestic ? "Thailand domestic" : ""}${tradeFlow?.sales?.domestic && tradeFlow?.sales?.international ? "; " : ""}${tradeFlow?.sales?.international ? salesMarkets : ""}`.trim(),
    `Sales currencies: ${(tradeFlow?.sales?.currencies || []).join(", ") || "not specified"}`
  ].join("\n");
}

function buildFallbackQueries({ sector, subsector, industry, isicCode, tradeFlow }) {
  const baseKeywords = getSearchKeywords({ sector, subsector, industry, isicCode }).slice(0, 4).join(" ");
  const purchaseMarkets = listCountries(tradeFlow?.purchase?.countries, 3);
  const salesMarkets = listCountries(tradeFlow?.sales?.countries, 3);
  const queries = [
    { label: "purchase_cost_supply_context", query: cleanQueryText(`Thailand ${industry} import sourcing supplier costs ${purchaseMarkets} news`), maxResults: 5 },
    { label: "sales_demand_export_context", query: cleanQueryText(`Thailand ${industry} exports demand buyers ${salesMarkets} news`), maxResults: 5 },
    { label: "industry_trade_context", query: cleanQueryText(`${industry} global supply chain demand prices trade news`), maxResults: 5 },
    { label: "fx_trade_crosswinds", query: cleanQueryText(`Thailand ${industry} FX currency trade impact ${baseKeywords} news`), maxResults: 5 }
  ];
  return queries.filter(item => item.query.length > 0).slice(0, 4);
}

function buildRecoveryQueries({ sector, subsector, industry, isicCode, tradeFlow }) {
  const baseKeywords = getSearchKeywords({ sector, subsector, industry, isicCode }).slice(0, 3).join(" ");
  const markets = listCountries(getAllTradeFlowCountries(tradeFlow), 4);
  return [
    { label: "fallback_thailand_industry", query: cleanQueryText(`Thailand ${industry} trade supply chain demand news`), maxResults: 5 },
    { label: "fallback_exposure_context", query: cleanQueryText(`${industry} ${markets} supply demand logistics tariffs news`), maxResults: 5 },
    { label: "fallback_sector_context", query: cleanQueryText(`${industry} ${baseKeywords} global trade news`), maxResults: 5 }
  ].filter(item => item.query.length > 0).slice(0, 3);
}

function prepareCandidateSources({ sources }) {
  const allCandidateSources = dedupeSources(sources)
    .sort((a, b) => {
      const aThai = isThailandRelatedSource(a) ? 1 : 0;
      const bThai = isThailandRelatedSource(b) ? 1 : 0;
      const aThaiGroup = String(a.source_group || "").includes("thai") ? 1 : 0;
      const bThaiGroup = String(b.source_group || "").includes("thai") ? 1 : 0;
      return bThai - aThai || bThaiGroup - aThaiGroup || (b.score || 0) - (a.score || 0);
    });

  // Keep the review pool balanced so selected-country/global searches do not crowd out Thailand-related sources.
  const candidateLimit = 16;
  const perGroupLimit = 5;
  const groupCounts = new Map();
  const balancedCandidates = [];

  for (const source of allCandidateSources) {
    const group = source.source_group || "unknown";
    const currentCount = groupCounts.get(group) || 0;
    if (currentCount >= perGroupLimit) continue;
    balancedCandidates.push(source);
    groupCounts.set(group, currentCount + 1);
    if (balancedCandidates.length >= candidateLimit) break;
  }

  return balancedCandidates.map((source, index) => ({
    ...source,
    source_number: index + 1
  }));
}

function parseQueryPlan(text) {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed.queries)) return null;

    return parsed.queries
      .map(item => ({
        label: cleanQueryText(item.label || "planned_query").toLowerCase().replace(/\s+/g, "_"),
        query: cleanQueryText(item.query),
        maxResults: Number(item.maxResults || 4)
      }))
      .filter(item => item.query.length > 0)
      .slice(0, 5);
  } catch (_) {
    return null;
  }
}

async function planTavilyQueries({ env, sector, subsector, industry, isicCode, tradeFlow, timeframe }) {
  const fallbackQueries = buildFallbackQueries({ sector, subsector, industry, isicCode, tradeFlow });
  const targetCount = 5;

  const plannerPrompt = `
Create ${targetCount} short Tavily news search queries for a Thailand-based bank RM.

Customer profile:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Directional trade flow:
${tradeFlowSummary(tradeFlow)}
- Timeframe: last ${timeframe} days
- Core industry terms: ${getSearchKeywords({ sector, subsector, industry, isicCode }).slice(0, 10).join(", ")}

Goal:
Generate one consistent premium search plan that separates purchase-side cost/supplier risk from sales-side demand/revenue risk, plus FX/trade crosswinds.

Rules:
- Return JSON only.
- Tavily is keyword search, not reasoning. Keep each query short and keyword-style.
- Use the specific industry as the main anchor.
- Generate queries with DIFFERENT intent:
  1. purchase_cost_supply_context: supplier conditions, input costs, imports, logistics, tariffs, purchase markets.
  2. sales_demand_export_context: export demand, buyer markets, revenue conditions, regulation, sales markets.
  3. thailand_client_context: Thailand industry trade flow / working capital relevance.
  4. industry_trade_context: broader global industry context without overloading all country names.
  5. fx_trade_crosswinds: currency, competitiveness, margin or payment implications tied to selected purchase/sales currencies.
- Do NOT create random country-pair searches unless Thailand is part of the client flow.
- Do NOT force every country into every query.
- Avoid prompts, questions, and long sentences.
- Each query must be under 180 characters.
- Use maxResults 5 for each query.

JSON shape:
{
  "queries": [
    { "label": "purchase_cost_supply_context", "query": "...", "maxResults": 5 },
    { "label": "sales_demand_export_context", "query": "...", "maxResults": 5 }
  ]
}`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model: OPENAI_FAST_MODEL, input: plannerPrompt })
    });

    const data = await response.json();
    if (!response.ok) return fallbackQueries;

    const planned = parseQueryPlan(extractOutputText(data));
    return planned && planned.length >= 3 ? planned.slice(0, targetCount) : fallbackQueries;
  } catch (_) {
    return fallbackQueries;
  }
}

function normalizeTavilyResults(results, sourceGroup) {
  return (results || []).map(item => ({
    title: item.title || item.url || "Untitled source",
    url: item.url,
    source: item.source || "",
    domain: item.url ? new URL(item.url).hostname.replace(/^www\./, "") : "",
    published_at: item.published_date || item.published_at || "",
    summary: item.content || "",
    raw_content: item.raw_content || "",
    score: item.score || 0,
    source_group: sourceGroup
  }));
}

function normalizeSourceTitle(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/\s[-–—|:]\s[^-–—|:]{2,60}$/g, "") // remove publisher suffixes such as " - Reuters"
    .replace(/\b(press release|pr newswire|globenewswire|sponsored content)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

function tokenSimilarity(a = "", b = "") {
  const aTokens = new Set(normalizeSourceText(a).split(" ").filter(token => token.length > 2));
  const bTokens = new Set(normalizeSourceText(b).split(" ").filter(token => token.length > 2));
  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap / Math.min(aTokens.size, bTokens.size);
}

function isSyndicatedOrNearDuplicate(a, b) {
  const titleA = normalizeSourceTitle(a.title);
  const titleB = normalizeSourceTitle(b.title);
  if (!titleA || !titleB) return false;

  if (titleA === titleB) return true;

  const titleScore = tokenSimilarity(titleA, titleB);
  if (titleScore >= 0.9) return true;

  const summaryScore = tokenSimilarity(
    `${a.title || ""} ${a.summary || ""} ${a.raw_content || ""}`,
    `${b.title || ""} ${b.summary || ""} ${b.raw_content || ""}`
  );

  return titleScore >= 0.78 && summaryScore >= 0.72;
}

function preferredSource(a, b) {
  const priorityA = sourcePriority(a);
  const priorityB = sourcePriority(b);
  if (priorityA !== priorityB) return priorityA > priorityB ? a : b;

  const dateA = Date.parse(a.published_at || "") || 0;
  const dateB = Date.parse(b.published_at || "") || 0;
  if (dateA !== dateB) return dateA > dateB ? a : b;

  const richnessA = String(a.raw_content || a.summary || "").length;
  const richnessB = String(b.raw_content || b.summary || "").length;
  if (richnessA !== richnessB) return richnessA > richnessB ? a : b;

  return (a.score || 0) >= (b.score || 0) ? a : b;
}

function mergeDuplicateSource(existing, incoming) {
  const keep = preferredSource(existing, incoming);
  const other = keep === existing ? incoming : existing;
  const syndicatedVia = [
    ...(Array.isArray(existing.syndicated_via) ? existing.syndicated_via : []),
    ...(Array.isArray(incoming.syndicated_via) ? incoming.syndicated_via : []),
    other.domain
  ]
    .filter(Boolean)
    .filter((domain, index, arr) => arr.indexOf(domain) === index && domain !== keep.domain);

  const sourceGroups = [existing.source_group, incoming.source_group]
    .filter(Boolean)
    .filter((group, index, arr) => arr.indexOf(group) === index);

  return {
    ...keep,
    score: Math.max(existing.score || 0, incoming.score || 0),
    source_group: sourceGroups.join(", ") || keep.source_group,
    syndicated_via: syndicatedVia
  };
}

function dedupeSources(items) {
  const deduped = [];

  for (const item of items || []) {
    if (!item.url) continue;

    const existingIndex = deduped.findIndex(existing =>
      existing.url === item.url || isSyndicatedOrNearDuplicate(existing, item)
    );

    if (existingIndex >= 0) {
      deduped[existingIndex] = mergeDuplicateSource(deduped[existingIndex], item);
    } else {
      deduped.push(item);
    }
  }

  return deduped;
}

async function tavilySearch({ apiKey, query, startDate, endDate, includeDomains = null, maxResults = 5, searchDepth = "basic" }) {
  const body = {
    query,
    topic: "news",
    search_depth: searchDepth,
    max_results: maxResults,
    include_raw_content: true,
    start_date: startDate,
    end_date: endDate
  };

  if (includeDomains && includeDomains.length > 0) {
    body.include_domains = includeDomains;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data.detail === "string"
        ? data.detail
        : typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.detail || data.error || data);

    throw new Error(message || "Tavily search failed.");
  }

  return data.results || [];
}

async function fetchYahooSeries(pair, rangeDays = 30) {
  const safeRangeDays = [30, 90].includes(Number(rangeDays)) ? Number(rangeDays) : 30;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=${safeRangeDays}d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed for ${pair}.`);
  }

  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const prices = result?.indicators?.quote?.[0]?.close || [];

  return timestamps
    .map((ts, i) => {
      const rate = prices[i];
      if (typeof rate !== "number") return null;

      return {
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        rate
      };
    })
    .filter(Boolean);
}

function summarizeFxSeries({ base, pair, series, source }) {
  if (!series.length) {
    throw new Error(`No usable FX points returned for ${pair}.`);
  }

  const roundedSeries = series.map(item => ({
    date: item.date,
    rate: Number(item.rate.toFixed(4))
  }));

  const latest = roundedSeries[roundedSeries.length - 1];
  const highest = roundedSeries.reduce((max, item) => item.rate > max.rate ? item : max, roundedSeries[0]);
  const lowest = roundedSeries.reduce((min, item) => item.rate < min.rate ? item : min, roundedSeries[0]);

  return {
    skip: false,
    base,
    quote: "THB",
    pair,
    series: roundedSeries,
    latest_rate: latest.rate.toFixed(4),
    highest_rate: highest.rate.toFixed(4),
    highest_date: highest.date,
    lowest_rate: lowest.rate.toFixed(4),
    lowest_date: lowest.date,
    source,
    retrieved_at: new Date().toISOString()
  };
}

async function fetchYahooFxRate(baseCurrency, rangeDays = 30) {
  if (baseCurrency === "THB") {
    return {
      skip: true,
      base: "THB"
    };
  }

  if (baseCurrency === "CNY") {
    const [usdThb, usdCny] = await Promise.all([
      fetchYahooSeries("USDTHB=X", rangeDays),
      fetchYahooSeries("USDCNY=X", rangeDays)
    ]);

    const usdCnyByDate = new Map(usdCny.map(item => [item.date, item.rate]));

    const derivedSeries = usdThb
      .map(item => {
        const cnyRate = usdCnyByDate.get(item.date);
        if (!cnyRate) return null;

        return {
          date: item.date,
          rate: item.rate / cnyRate
        };
      })
      .filter(Boolean);

    return summarizeFxSeries({
      base: "CNY",
      pair: "CNYTHB (derived)",
      series: derivedSeries,
      source: "Yahoo Finance prototype: USDTHB ÷ USDCNY"
    });
  }

  const pair = `${baseCurrency}THB=X`;
  const series = await fetchYahooSeries(pair, rangeDays);

  return summarizeFxSeries({
    base: baseCurrency,
    pair,
    series,
    source: "Yahoo Finance (prototype)"
  });
}

async function fetchFxRates(currencies, rangeDays = 30) {
  const uniqueCurrencies = [...new Set(currencies)];

  return Promise.all(
    uniqueCurrencies.map(currency =>
      fetchYahooFxRate(currency, rangeDays).catch(error => ({
        skip: false,
        base: currency,
        quote: "THB",
        error: error.message || "FX lookup failed."
      }))
    )
  );
}

async function analyzeFxRates({ env, fxList, sector = "", subsector = "", industry = "", tradeRoles = [], countries = [], tradeFlow = null, fxTenor = 30 }) {
  const usableFx = fxList.filter(fx => !fx.skip && !fx.error && Array.isArray(fx.series) && fx.series.length > 0);

  if (usableFx.length === 0) return fxList;

  const compactFx = usableFx.map(fx => ({
    pair: fx.pair,
    base: fx.base,
    quote: fx.quote,
    latest_rate: fx.latest_rate,
    highest_rate: fx.highest_rate,
    highest_date: fx.highest_date,
    lowest_rate: fx.lowest_rate,
    lowest_date: fx.lowest_date,
    series: fx.series
  }));

  const countryText = countries.map(country => country.label || country.name || country.code).filter(Boolean).join(", ");
  const prompt = `
You are writing short FX movement notes for a Thailand-based relationship manager.

Client context:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}\nExposure countries / markets: ${countryText}`}

Use only the provided ${fxTenor}-day FX data below. For each pair, write two concise sentences.
Sentence 1: observed FX movement, latest level versus the ${fxTenor}-day range, and whether the base currency strengthened or weakened against THB.
Sentence 2: what this could mean for the Thailand-based client in the given import/export context.
Do not mention news or Tavily sources. Do not give investment advice. Keep each analysis under 45 words.

Return JSON only in this shape:
{
  "analyses": [
    { "pair": "USDTHB=X", "analysis": "..." }
  ]
}

FX data:
${JSON.stringify(compactFx, null, 2)}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_FAST_MODEL,
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) return fxList;

    const text = extractOutputText(data);
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return fxList;

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const analysisByPair = new Map(
      (parsed.analyses || [])
        .filter(item => item.pair && item.analysis)
        .map(item => [String(item.pair), String(item.analysis).trim()])
    );

    return fxList.map(fx => ({
      ...fx,
      analysis: analysisByPair.get(fx.pair) || fx.analysis || ""
    }));
  } catch (_) {
    return fxList;
  }
}


function parseJsonObject(text) {
  try {
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (_) {
    return null;
  }
}

function isThailandRelatedSource(source) {
  const haystack = [
    source.title,
    source.domain,
    source.source,
    source.summary,
    source.raw_content
  ].join(" ").toLowerCase();

  return /\b(thailand|thai|bangkok|bot\.or\.th|bank of thailand)\b/.test(haystack);
}


function getSelectedCountryNames(countries) {
  return (Array.isArray(countries) ? countries : [])
    .flatMap(country => [country.name, country.label, country.code])
    .filter(Boolean)
    .map(value => String(value).toLowerCase());
}

function calculateCountryRelevanceScore(source, countries = []) {
  const haystack = [source.title, source.summary, source.raw_content, source.domain, source.source]
    .join(" ")
    .toLowerCase();
  const selected = getSelectedCountryNames(countries);
  let score = 0;
  const matches = [];

  if (/\b(thailand|thai|bangkok)\b/.test(haystack)) {
    score += 5;
    matches.push("Thailand");
  }

  for (const value of selected) {
    if (!value || value.length < 2) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "i");
    if (re.test(haystack)) {
      score += 4;
      matches.push(value.toUpperCase() === value ? value : value.replace(/\b\w/g, c => c.toUpperCase()));
    }
  }

  if (/\b(asean|southeast asia|south-east asia)\b/.test(haystack)) {
    score += 2;
    matches.push("ASEAN");
  }

  if (/\b(eu|europe|china|chinese)\b/.test(haystack) && score === 0) {
    score -= 2;
  }

  return {
    score: Math.max(-2, Math.min(score, 12)),
    matches: [...new Set(matches)].slice(0, 4)
  };
}

function getSourceAuthorityScore(source) {
  const domain = String(source.domain || source.source || "").toLowerCase();
  if (/reuters|bloomberg|ft\.com|nikkei|spglobal|fastmarkets|argusmedia|worldsteel|steelbb|steelorbis|official|gov|customs|commerce/.test(domain)) return 5;
  if (/bangkokpost|nationthailand|thaipbs|prachachat|kaohoon|set\.or\.th|bot\.or\.th/.test(domain)) return 4;
  if (/marinelink|hellenicshipping|freightwaves|supplychaindive/.test(domain)) return 3;
  if (/openpr|einnews|globenewswire|prnewswire|manilatimes|kipost/.test(domain)) return 1;
  return 2;
}

function getRecencyScore(source) {
  const published = Date.parse(source.published_at || "");
  if (!Number.isFinite(published)) return 1;
  const days = (Date.now() - published) / (1000 * 60 * 60 * 24);
  if (days <= 7) return 5;
  if (days <= 30) return 4;
  if (days <= 60) return 3;
  if (days <= 90) return 2;
  return 1;
}

function evidenceScoreFromSource(source, countries = [], termProfile = {}) {
  const country = calculateCountryRelevanceScore(source, countries).score;
  const authority = getSourceAuthorityScore(source);
  const recency = getRecencyScore(source);
  const relevance = source.relevance_level === "HIGH" ? 5 : source.relevance_level === "MEDIUM" ? 3 : 1;
  const industry = calculateIndustryRelevanceScore(source, termProfile).score;
  return Math.round((country * 0.28 + authority * 0.20 + recency * 0.12 + relevance * 0.20 + Math.max(0, industry) * 0.20) * 20);
}

function sourcePriority(source, countries = [], termProfile = {}) {
  const levelScore = source.relevance_level === "HIGH" ? 100 : source.relevance_level === "MEDIUM" ? 50 : 0;
  const countryScore = calculateCountryRelevanceScore(source, countries).score * 8;
  const authorityScore = getSourceAuthorityScore(source) * 5;
  const recencyScore = getRecencyScore(source) * 2;
  const groupScore = String(source.source_group || "").includes("thai") ? 10 : 0;
  const tavilyScore = Math.min(Number(source.score || 0) * 10, 10);
  const industryScore = calculateIndustryRelevanceScore(source, termProfile).score * 5;
  return levelScore + countryScore + authorityScore + recencyScore + groupScore + tavilyScore + industryScore;
}

async function assessSourceRelevance({ env, sources, sector, subsector, industry, isicCode, tradeRoles, countries, tradeFlow = null, timeframe, plannedQueries }) {
  if (!sources.length) {
    return {
      hasRelevantUpdates: false,
      noRelevantUpdateMessage: `No relevant news updates were found in the selected ${timeframe}-day period for this client profile.`,
      sources: []
    };
  }

  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");
  const termProfile = getIndustryTermProfile({ isicCode, industry });

  const compactSources = sources.map(source => {
    const text = source.raw_content || source.summary || "";
    const trimmedText = text.length > 1200 ? text.slice(0, 1200) + "…" : text;

    return {
      number: source.source_number,
      title: source.title,
      publisher: source.domain || source.source || "Unknown",
      published: source.published_at || "Unknown",
      source_group: source.source_group,
      countryRelevance: calculateCountryRelevanceScore(source, countries),
      authorityScore: getSourceAuthorityScore(source),
      recencyScore: getRecencyScore(source),
      industryRelevance: calculateIndustryRelevanceScore(source, termProfile),
      snippet: trimmedText
    };
  });

  const prompt = `
You are a source selection reviewer for a Thailand-based bank relationship manager.

Customer profile:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Client base: Thailand
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}\nExposure countries / markets: ${countryText}`}
- Timeframe: last ${timeframe} days
- Core industry terms: ${(termProfile.high || []).slice(0, 12).join(", ")}
- Medium industry terms: ${(termProfile.medium || []).slice(0, 8).join(", ")}
- Weak-adjacent / exclusion terms: ${(termProfile.low || []).slice(0, 10).join(", ")}
- Tavily queries used: ${plannedQueries.map(plan => `${plan.label}: ${plan.query}`).join(" | ")}

Task:
Review the candidate news sources and classify their usefulness for a Thailand-based bank RM.
Prioritise sources in this order:
1. Direct Thailand + selected-market news connected to the industry, Thai company flows, Thai supply chains, Thai import/export activity, or Thai macro/trade policy.
2. Selected-country news, especially United States / Thailand flows when those are selected, only when it clearly affects Thailand-based sourcing, export demand, buyer/supplier conditions, logistics, pricing, or trade risk.
3. Regional ASEAN news that has a clear Thailand-client implication.
4. Broader global industry news only when it is unavoidable context and clearly affects Thai client demand, pricing, supply chain, logistics, trade policy, working capital, payment risk, or counterparty risk.

A useful source must have a clear client implication. It is not enough that the article mentions a selected country, exporter/importer, or broad sector keyword.
Industry criticality rule: Prefer articles that involve the core industry terms. Downrank or omit articles that mainly match weak-adjacent/exclusion terms without also matching core terms. For example, a sugar article should not become an animal-feed theme unless it explicitly mentions feed, molasses for feed, feed grain substitution, livestock feed costs, or another core feed linkage.
Interpret purchase/sales strictly from the Thailand-based client's perspective. Purchase markets are supplier/cost-side exposures; sales markets are buyer/revenue-side exposures. Do not mix the two unless the source supports a crosswind or hedge implication.
Country-cross results, such as China-Indonesia, US-Indonesia, EU-China, or other non-selected market stories, should be LOW unless they have a clear Thailand or selected-market implication for the client. EU/China/global stories should normally be MEDIUM at most and should not displace Thailand/selected-market sources.
Do not include sources merely to fill a quota. If relevance is weak or indirect, classify it as LOW and omit it.

Return JSON only in this exact shape:
{
  "hasRelevantUpdates": true,
  "noRelevantUpdateMessage": "",
  "sources": [
    {
      "number": 1,
      "relevanceLevel": "HIGH",
      "justification": "One sentence explaining why this source is relevant for this client profile."
    }
  ]
}

Relevance levels:
- HIGH: Thailand-related and directly relevant to the client industry, Thai import/export role, or Thai exposure to selected markets.
- MEDIUM: useful global industry context, or selected-market context with a clear and explainable implication for Thai client flows, demand, pricing, supply chain, or risk.
- LOW: weak keyword match, unrelated country export/import story, country-pair story without Thai/global industry implication, unrelated company news, old/background content, or no clear client implication.

Rules:
- Return HIGH and MEDIUM sources only; omit LOW sources completely.
- Never include a source because relevant updates are limited. Do not use fallback language such as "limited news", "broader context because", or "may be relevant".
- Keep all HIGH sources.
- Include MEDIUM sources only when the article has a clear, specific client implication.
- Prefer fewer strong sources over more weak sources.
- Justification must be one concise sentence, maximum 28 words, written as "Relevant because..." or equivalent.
- Set hasRelevantUpdates to false if all sources are LOW or if remaining HIGH/MEDIUM sources are too weak to support a client-ready conversation.
- The noRelevantUpdateMessage must be one concise sentence suitable for display to the user.

Candidate sources:
${JSON.stringify(compactSources, null, 2)}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_FAST_MODEL,
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error("Source relevance review failed.");

    const parsed = parseJsonObject(extractOutputText(data));
    if (!parsed) throw new Error("Source relevance review returned invalid JSON.");

    const sourceReviews = Array.isArray(parsed.sources) ? parsed.sources : [];
    const reviewsByNumber = new Map(
      sourceReviews
        .filter(item => Number.isFinite(Number(item.number)))
        .map(item => {
          const level = String(item.relevanceLevel || item.relevance_level || (item.relevant ? "HIGH" : "LOW")).toUpperCase();
          return [Number(item.number), {
            relevanceLevel: ["HIGH", "MEDIUM", "LOW"].includes(level) ? level : "LOW",
            justification: String(item.justification || "").trim()
          }];
        })
    );

    const reviewedSources = sources
      .map(source => {
        const review = reviewsByNumber.get(source.source_number);
        const relevanceLevel = review?.relevanceLevel || "LOW";
        return {
          ...source,
          relevance_level: relevanceLevel,
          relevance_justification: review?.justification || "Relevant as broader context for the client's industry, markets, or trade finance discussion.",
          relevant: relevanceLevel === "HIGH" || relevanceLevel === "MEDIUM"
        };
      })
      .filter(source => source.relevant);

    const highSources = reviewedSources
      .filter(source => source.relevance_level === "HIGH")
      .sort((a, b) => sourcePriority(b, countries, termProfile) - sourcePriority(a, countries, termProfile));
    const mediumSources = reviewedSources
      .filter(source => source.relevance_level === "MEDIUM")
      .sort((a, b) => sourcePriority(b, countries, termProfile) - sourcePriority(a, countries, termProfile));
    const selectedSources = [...highSources, ...mediumSources]
      .sort((a, b) => sourcePriority(b, countries, termProfile) - sourcePriority(a, countries, termProfile))
      .slice(0, 10)
      .map(source => {
        const countryRel = calculateCountryRelevanceScore(source, countries);
        const industryRel = calculateIndustryRelevanceScore(source, termProfile);
        const evidenceScore = Math.max(0, Math.min(100, evidenceScoreFromSource(source, countries, termProfile)));
        return {
          ...source,
          country_relevance_score: countryRel.score,
          country_relevance_matches: countryRel.matches,
          industry_relevance_score: industryRel.score,
          industry_high_matches: industryRel.highMatches,
          industry_medium_matches: industryRel.mediumMatches,
          industry_weak_adjacency_matches: industryRel.weakAdjacencyMatches,
          authority_score: getSourceAuthorityScore(source),
          recency_score: getRecencyScore(source),
          evidence_score: evidenceScore
        };
      });

    const hasRelevantUpdates = Boolean(parsed.hasRelevantUpdates) && selectedSources.length > 0;

    return {
      hasRelevantUpdates,
      noRelevantUpdateMessage: String(parsed.noRelevantUpdateMessage || `No relevant news updates were found in the selected ${timeframe}-day period for this client profile.`).trim(),
      sources: selectedSources
    };
  } catch (_) {
    return {
      hasRelevantUpdates: false,
      noRelevantUpdateMessage: `No significant relevant news updates were found in the selected ${timeframe}-day period for this client profile.`,
      sources: []
    };
  }
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  if (Array.isArray(data.output)) {
    let text = "";

    for (const item of data.output) {
      if (!item.content) continue;

      for (const contentItem of item.content) {
        if (contentItem.type === "output_text" && contentItem.text) {
          text += contentItem.text;
        }
      }
    }

    if (text) return text;
  }

  return "";
}


function extractSourceRefs(text) {
  const refs = new Set();
  const regex = /\[(\d+)\]/g;
  let match;

  while ((match = regex.exec(String(text || ""))) !== null) {
    refs.add(Number(match[1]));
  }

  return Array.from(refs).filter(Number.isFinite).sort((a, b) => a - b);
}

function normalizeNoNewsText(timeframe) {
  return `No significant or relevant market developments identified for this industry and client context in the selected ${timeframe}-day period.`;
}

function formatNewsThemesFromJson(parsed) {
  const themes = Array.isArray(parsed.themes) ? parsed.themes : [];

  return themes.map((theme, index) => {
    const title = String(theme.title || `Theme ${index + 1}`).replace(/^Theme\s*\d+\s*:\s*/i, "").trim();
    const paragraph = String(theme.paragraph || theme.explanation || "").trim();
    const bullets = Array.isArray(theme.supportingInformation || theme.supporting_information || theme.bullets)
      ? (theme.supportingInformation || theme.supporting_information || theme.bullets)
      : [];

    const bulletText = bullets
      .map(item => String(item || "").trim())
      .filter(Boolean)
      .map(item => `- ${item}`)
      .join("\n");

    return [
      `Theme ${index + 1}: ${title}`,
      paragraph,
      bulletText ? "Conversation notes:" : "",
      bulletText
    ].filter(Boolean).join("\n");
  }).filter(Boolean).join("\n\n");
}

function remapSourceNumbersInText(text, numberMap) {
  return String(text || "").replace(/\[(\d+)\]/g, (full, rawNumber) => {
    const mapped = numberMap.get(Number(rawNumber));
    return mapped ? `[${mapped}]` : full;
  });
}

function alignSourcesToAnalysis({ sources, newsSection, timeframe }) {
  if (!newsSection || newsSection.status === "NO_NEWS") {
    return {
      newsSection: {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      },
      sources: []
    };
  }

  const usedNumbers = extractSourceRefs(newsSection.content);
  if (usedNumbers.length === 0) {
    return {
      newsSection: {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      },
      sources: []
    };
  }

  const usedSet = new Set(usedNumbers);
  const usedSources = sources.filter(source => usedSet.has(source.source_number));

  if (usedSources.length === 0) {
    return {
      newsSection: {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      },
      sources: []
    };
  }

  const numberMap = new Map();
  const renumberedSources = usedSources.map((source, index) => {
    const newNumber = index + 1;
    numberMap.set(source.source_number, newNumber);
    return {
      ...source,
      source_number: newNumber
    };
  });

  return {
    newsSection: {
      ...newsSection,
      content: remapSourceNumbersInText(newsSection.content, numberMap)
    },
    sources: renumberedSources
  };
}

async function analyzeNewsDevelopments({ env, sources, sector, subsector, industry, isicCode = "", tradeRoles, countries, tradeFlow = null, timeframe, plannedQueries, defaultPrompt }) {
  if (!sources.length) {
    return {
      status: "NO_NEWS",
      content: normalizeNoNewsText(timeframe)
    };
  }

  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");
  const termProfile = getIndustryTermProfile({ isicCode, industry });

  const articleContext = sources.map(source => {
    const text = source.raw_content || source.summary || "";
    const trimmedText = text.length > 2500 ? text.slice(0, 2500) + "…" : text;

    return `
[${source.source_number}]
Title: ${source.title}
URL: ${source.url}
Publisher: ${source.domain || source.source || "Unknown"}
Published: ${source.published_at || "Unknown"}
Source type: ${source.source_group}
${Array.isArray(source.syndicated_via) && source.syndicated_via.length ? `Same/similar story also seen via: ${source.syndicated_via.join(", ")}` : ""}
Relevance reviewer note: ${source.relevance_justification || ""}
Content:
${trimmedText}
`.trim();
  }).join("\n\n");

  const prompt = `
You are a careful market analyst supporting a Thailand-based relationship manager.

The user's custom focus/context is:
${defaultPrompt}

Customer profile:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Client base: Thailand
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}
Countries / markets relevant to the client: ${countryText}`}
- Timeframe for news search: last ${timeframe} days
- Search mode: Single adaptive directional search
- Tavily queries used: ${plannedQueries.map(plan => `${plan.label}: ${plan.query}`).join(" | ")}

Task:
Create a concise, source-grounded customer conversation brief from the provided news sources.

Analysis standard:
- The output should help an RM sound informed and commercially aware, not force every item into a product pitch.
- Separate purchase-side cost/supplier implications from sales-side revenue/demand implications when the sources support that distinction.
- Treat purchase countries as supplier/source markets and sales countries as buyer/revenue markets. Do not cross-combine countries randomly.
- Prefer direct Thailand, selected purchase-market, selected sales-market, or selected-currency relevance.
- Broader sector news may be used only when the bridge to this client profile is clear. If the article is not specific to the selected ISIC activity, say so plainly, e.g. "While this is broader fruit-sector news rather than durian-specific...".

Grounding rules:
- Use ONLY the provided sources.
- Do NOT add unstated facts, general industry knowledge, background assumptions, or evergreen commentary as if sourced.
- Do NOT imply that an article specifically discusses the client's product, market, currency, or trade flow unless the source explicitly does.
- You may draw cautious implications, but clearly distinguish direct evidence from inferred relevance.
- Do not cite a source unless it directly supports the statement being made.
- Every theme must cite at least one source number from the provided sources.
- Every bullet must include a source reference like [1], [2].
- If the sources do not contain meaningful, recent developments relevant to this Thailand-based client context, return JSON with "status": "NO_NEWS" and an empty themes array.
- If there is at least one useful news-based theme, return JSON with "status": "OK". Do NOT include the string NO_NEWS anywhere in titles, paragraphs, or bullets.

Relevance discipline:
- Do not force weakly related articles into high-confidence themes.
- Do not use numeric scores, signal strength labels, or evidence grades.
- Do not use prefixes such as "Primary Market Signal" or "Secondary Global Context".
- Prefer fewer, stronger themes over many isolated source summaries.
- If a development is only useful as a light conversation opener, frame it as a small-talk / awareness point rather than a risk or sales opportunity.
- Not every theme needs a risk, opportunity, or RM angle. Only include those when genuinely supported.
- Avoid recommendations such as financing a specific expansion, acquisition, or project unless the source clearly supports it for the selected client profile.
- Do NOT assume a named company in an article is the bank's client or the user's client. Frame it as a sector signal, competitor signal, buyer/supplier signal, or market development.
- Do NOT repeat the standalone FX rate commentary. Mention FX only when a source directly supports an implication, or when selected purchase/sales currencies create an obvious directional crosswind that is clearly presented as an inference.

Writing style:
- Use practical, banker-friendly titles. Avoid generic titles such as "Supply Chain Risk" or "Market Update".
- Keep each paragraph short and calibrated.
- When relevance is indirect, use cautious wording such as "may", "could", "worth monitoring", or "conversation opener".
- Avoid overly promotional language.

Return JSON only in this exact shape:
{
  "status": "OK",
  "themes": [
    {
      "title": "Specific practical title without scoring or signal prefixes",
      "paragraph": "One short paragraph explaining the development and its calibrated relevance to the Thailand-based client, with source reference(s).",
      "supportingInformation": [
        "Conversation opener: source-grounded point the RM can raise without forcing a sale [1]",
        "Watch point: optional source-grounded risk, operational issue, or follow-up question only if supported [2]"
      ],
      "sourceNumbers": [1, 2]
    }
  ]
}

If not relevant, return exactly this JSON:
{
  "status": "NO_NEWS",
  "themes": []
}

Provided sources:
${articleContext}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_ANALYSIS_MODEL || OPENAI_ANALYSIS_MODEL,
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI news analysis request failed.");
    }

    const rawText = (extractOutputText(data) || "").trim();
    const parsed = parseJsonObject(rawText);

    if (!parsed) {
      const cleanedText = rawText.replace(/\bNO_NEWS\b/g, "").trim();
      const sourceRefs = extractSourceRefs(cleanedText);
      if (!cleanedText || sourceRefs.length === 0) {
        return {
          status: "NO_NEWS",
          content: normalizeNoNewsText(timeframe)
        };
      }
      return {
        status: "OK",
        content: cleanedText
      };
    }

    const status = String(parsed.status || "").toUpperCase();
    const themes = Array.isArray(parsed.themes) ? parsed.themes : [];

    if (status === "NO_NEWS" || themes.length === 0) {
      return {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      };
    }

    const content = formatNewsThemesFromJson(parsed).replace(/\bNO_NEWS\b/g, "").trim();
    const sourceRefs = extractSourceRefs(content);

    if (!content || sourceRefs.length === 0) {
      return {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      };
    }

    return {
      status: "OK",
      content
    };
  } catch (error) {
    throw error;
  }
}

async function generateGeneralContext({ env, sector, subsector, industry, isicCode = "", tradeRoles, countries }) {
  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");
  const termProfile = getIndustryTermProfile({ isicCode, industry });

  const prompt = `
You are advising a Thailand-based relationship manager in trade finance.

Generate 2–3 industry-specific context points for this client profile.

Client context:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Client base: Thailand
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}\nExposure countries / markets: ${countryText}`}

Return ONLY valid JSON in this exact structure:
{
  "points": [
    {
      "title": "Specific insight-driven title",
      "explanation": "3–4 sentences explaining the structural issue and why it matters for this client profile.",
      "rm_considerations": [
        "Practical RM point 1",
        "Practical RM point 2"
      ]
    }
  ]
}

Strict requirements:
- Produce 2–3 points only.
- Each title must be specific, insight-driven, and tied to a real business issue.
- Do NOT use generic titles such as "Industry Context", "Market Overview", "Key Consideration", "Business Context", or "Trade Finance Context".
- Do NOT repeat titles.
- Good title examples:
  - "FX Mismatch in Export Pricing Contracts"
  - "Working Capital Pressure from Extended Payment Cycles"
  - "Supplier Concentration Risk in Regional Manufacturing"
  - "Inventory Financing Pressure from Seasonal Demand Cycles"
  - "Payment Risk from Cross-Border Counterparties"
- Each explanation must be 3–4 concise sentences.
- Each rm_considerations array must contain 2–3 practical bullets for the relationship manager.
- RM bullets should focus on what to ask, watch, or discuss with the client, such as financing needs, FX exposure, payment risk, working capital pressure, inventory cycle, supplier concentration, or counterparty risk.
- Do NOT reference specific news, source numbers, articles, or dates.
- Do NOT claim something is currently happening.
- Focus on structural industry patterns, not recent developments.
`.trim();

  const fallbackTitleByIndex = [
    "Trade Flow and Counterparty Exposure",
    "Working Capital and Cash Conversion Pressure",
    "FX and Margin Sensitivity"
  ];

  function isGenericTitle(title) {
    return !title || /^(industry context|market overview|key consideration|business context|trade finance context|context|industry-specific context)$/i.test(String(title).trim());
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_FAST_MODEL,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "industry_context_rm_considerations",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                points: {
                  type: "array",
                  minItems: 2,
                  maxItems: 3,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      explanation: { type: "string" },
                      rm_considerations: {
                        type: "array",
                        minItems: 2,
                        maxItems: 3,
                        items: { type: "string" }
                      }
                    },
                    required: ["title", "explanation", "rm_considerations"]
                  }
                }
              },
              required: ["points"]
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) return { points: [] };

    const parsed = parseJsonObject(extractOutputText(data));
    const rawPoints = Array.isArray(parsed?.points) ? parsed.points : [];

    const seenTitles = new Set();
    const points = rawPoints
      .slice(0, 3)
      .map((point, index) => {
        let title = String(point.title || "").trim();

        if (isGenericTitle(title) || seenTitles.has(title.toLowerCase())) {
          title = fallbackTitleByIndex[index] || `RM Consideration ${index + 1}`;
        }

        seenTitles.add(title.toLowerCase());

        return {
          title,
          explanation: String(point.explanation || "").trim(),
          rm_considerations: Array.isArray(point.rm_considerations)
            ? point.rm_considerations.map(item => String(item).trim()).filter(Boolean).slice(0, 3)
            : []
        };
      })
      .filter(point => point.title && point.explanation);

    return { points };
  } catch (_) {
    return { points: [] };
  }
}


export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const sector = (body.sector || "").trim();
    const subsector = (body.subsector || "").trim();
    let industry = (body.industry || "").trim();
    const timeframe = (body.timeframe || "30").trim();
    const fxTenor = [30, 90].includes(Number(body.fxTenor)) ? Number(body.fxTenor) : 30;
    const isicCode = (body.isicCode || "").trim();
    if (isicCode && industry && !industry.includes(isicCode)) industry = `${isicCode} - ${industry}`;
    const legacyCurrencies = Array.isArray(body.currencies) ? body.currencies.map(c => String(c).toUpperCase()) : [];
    const legacyCountries = Array.isArray(body.countries) ? body.countries : [];
    const tradeFlow = normalizeTradeFlow(body.tradeFlow || {}, legacyCountries, legacyCurrencies);
    const tradeRoles = deriveTradeRolesFromFlow(tradeFlow, body.tradeRoles || []);
    const currencies = getAllTradeFlowCurrencies(tradeFlow, legacyCurrencies);
    const countries = getAllTradeFlowCountries(tradeFlow);
    const defaultPrompt = (body.defaultPrompt || "").trim();

    if (!sector) return Response.json({ error: "Please select a sector." }, { status: 400 });
    if (!subsector) return Response.json({ error: "Please select a subsector." }, { status: 400 });
    if (!industry) return Response.json({ error: "Please enter the client's industry." }, { status: 400 });
    if (!tradeFlow.purchase.domestic && !tradeFlow.purchase.international) return Response.json({ error: "Please select domestic and/or international for Purchase from." }, { status: 400 });
    if (!tradeFlow.sales.domestic && !tradeFlow.sales.international) return Response.json({ error: "Please select domestic and/or international for Sales to." }, { status: 400 });
    if (tradeFlow.purchase.international && tradeFlow.purchase.countries.length === 0) return Response.json({ error: "Please select at least one international purchase market." }, { status: 400 });
    if (tradeFlow.sales.international && tradeFlow.sales.countries.length === 0) return Response.json({ error: "Please select at least one international sales market." }, { status: 400 });
    if (tradeFlow.purchase.currencies.length === 0) return Response.json({ error: "Please select at least one purchase currency." }, { status: 400 });
    if (tradeFlow.sales.currencies.length === 0) return Response.json({ error: "Please select at least one sales currency." }, { status: 400 });
    if (currencies.length === 0) return Response.json({ error: "Please select at least one currency." }, { status: 400 });
    const unsupported = currencies.filter(currency => !ALLOWED_CURRENCIES.includes(currency));
    if (unsupported.length > 0) {
      return Response.json({ error: `Unsupported currency selected: ${unsupported.join(", ")}` }, { status: 400 });
    }

    if (!env.TAVILY_API_KEY) {
      return Response.json({ error: "Missing TAVILY_API_KEY secret in Cloudflare." }, { status: 500 });
    }

    if (!env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY secret in Cloudflare." }, { status: 500 });
    }

    const { start_date, end_date } = getDateRange(timeframe);
    const searchKeywords = getSearchKeywords({ sector, subsector, industry, isicCode });
    const plannedQueries = await planTavilyQueries({
      env,
      sector,
      subsector,
      industry,
      isicCode,
      tradeFlow,
      timeframe
    });

    const searchDepth = "advanced";

    const [tavilyBatches, rawFxResults] = await Promise.all([
      Promise.all(plannedQueries.map(plan =>
        tavilySearch({
          apiKey: env.TAVILY_API_KEY,
          query: plan.query,
          startDate: start_date,
          endDate: end_date,
          includeDomains: null,
          maxResults: plan.maxResults || 5,
          searchDepth
        }).then(results => normalizeTavilyResults(results, plan.label))
      )),
      fetchFxRates(currencies, fxTenor)
    ]);

    const fxResults = await analyzeFxRates({ env, fxList: rawFxResults, sector, subsector, industry, tradeRoles, countries, tradeFlow, fxTenor });

    const primaryCandidateSources = prepareCandidateSources({
      sources: tavilyBatches.flat()
    });

    let effectiveQueries = [...plannedQueries];
    let sourceAssessment = await assessSourceRelevance({
      env,
      sources: primaryCandidateSources,
      sector,
      subsector,
      industry,
      isicCode,
      tradeRoles,
      countries,
      tradeFlow,
      timeframe,
      plannedQueries: effectiveQueries
    });

    let candidateSources = primaryCandidateSources;
    let fallbackTriggered = false;

    // Controlled fallback: only broaden the search when the strict filter leaves 0–2 usable sources.
    // This avoids asking users to manually refresh while keeping Tavily usage under control.
    if (sourceAssessment.sources.length < 3) {
      const recoveryQueries = buildRecoveryQueries({
        sector,
        subsector,
        industry,
        isicCode,
        tradeFlow
      });

      const existingQueryText = new Set(effectiveQueries.map(plan => cleanQueryText(plan.query).toLowerCase()));
      const newRecoveryQueries = recoveryQueries.filter(plan => !existingQueryText.has(cleanQueryText(plan.query).toLowerCase()));

      if (newRecoveryQueries.length > 0) {
        fallbackTriggered = true;
        const fallbackBatches = await Promise.all(newRecoveryQueries.map(plan =>
          tavilySearch({
            apiKey: env.TAVILY_API_KEY,
            query: plan.query,
            startDate: start_date,
            endDate: end_date,
            includeDomains: null,
            maxResults: plan.maxResults || 5,
            searchDepth: "basic"
          }).then(results => normalizeTavilyResults(results, plan.label))
        ));

        effectiveQueries = [...effectiveQueries, ...newRecoveryQueries];
        candidateSources = prepareCandidateSources({
          sources: [...tavilyBatches.flat(), ...fallbackBatches.flat()]
        });

        sourceAssessment = await assessSourceRelevance({
          env,
          sources: candidateSources,
          sector,
          subsector,
          industry,
          isicCode,
          tradeRoles,
          countries,
          tradeFlow,
          timeframe,
          plannedQueries: effectiveQueries
        });
      }
    }

    const mergedSources = sourceAssessment.sources.map((source, index) => ({
      ...source,
      source_number: index + 1
    }));

    // DEACTIVATED 2026-05: Industry Context & RM Considerations is hidden in the UI.
    // Keep generateGeneralContext() above for future reuse, but do not call it now.
    // const generalContext = await generateGeneralContext({
    //   env,
    //   sector,
    //   subsector,
    //   industry,
    //   tradeRoles,
    //   countries
    // });
    const generalContext = { points: [] };

    if (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0) {
      const noNews = {
        status: "NO_NEWS",
        content: sourceAssessment.noRelevantUpdateMessage || `No significant or relevant market developments identified for this industry and client context in the selected ${timeframe}-day period.`
      };

      return Response.json({
        analysis: noNews.content,
        news: noNews,
        context: generalContext,
        no_relevant_updates: true,
        fx: fxResults,
        search_keywords: searchKeywords,
        search_queries: effectiveQueries,
        fallback_triggered: fallbackTriggered,
        search_mode: "adaptive_directional",
        sources: []
      });
    }

    const rawNewsSection = await analyzeNewsDevelopments({
      env,
      sources: mergedSources,
      sector,
      subsector,
      industry,
      isicCode,
      tradeRoles,
      countries,
      tradeFlow,
      timeframe,
      plannedQueries: effectiveQueries,
      defaultPrompt
    });

    const aligned = alignSourcesToAnalysis({
      sources: mergedSources,
      newsSection: rawNewsSection,
      timeframe
    });

    return Response.json({
      analysis: aligned.newsSection.content,
      news: aligned.newsSection,
      context: generalContext,
      no_relevant_updates: aligned.newsSection.status === "NO_NEWS",
      fx: fxResults,
      search_keywords: searchKeywords,
      search_queries: effectiveQueries,
      fallback_triggered: fallbackTriggered,
      search_mode: "adaptive_directional",
      sources: aligned.newsSection.status === "NO_NEWS" ? [] : aligned.sources.map(source => ({
        number: source.source_number,
        title: source.title,
        url: source.url,
        source: source.source,
        domain: source.domain,
        published_at: source.published_at,
        source_group: source.source_group,
        syndicated_via: Array.isArray(source.syndicated_via) ? source.syndicated_via : [],
        justification: source.relevance_justification || ""
      }))
    });
  } catch (error) {
    return Response.json({
      error:
        typeof error.message === "string"
          ? error.message
          : JSON.stringify(error.message || error)
    }, { status: 500 });
  }
}
