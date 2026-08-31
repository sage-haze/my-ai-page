import { INDUSTRY_TERMS } from "./industry-terms.js";

const PREFERRED_NEWS_DOMAINS = [
  "reuters.com",
  "bloomberg.com",
  "ft.com",
  "wsj.com",
  "nikkei.com",
  "spglobal.com"
];

// Sources that should never be used as news evidence.
// Keep this separate from preferred-source scoring so exclusions remain explicit and easy to maintain.
const EXCLUDED_NEWS_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
  "threads.net",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "reddit.com"
];

const MIN_RAW_ARTICLE_WORDS = 120;
const MAX_TAVILY_RESULTS_PER_QUERY = 10;
const MAX_FINAL_NEWS_SOURCES = 10;

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

const CLIENT_PROFILE_LABELS = {
  relationshipContext: {
    unknown: "not specified",
    first_meeting: "first meeting / prospect",
    regular_check_in: "regular relationship check-in",
    annual_review: "annual or periodic review",
    post_news_follow_up: "follow-up after recent market news",
    senior_meeting_prep: "preparing for senior client meeting"
  },
  cashPosition: {
    unknown: "unknown / not discussed",
    surplus_cash: "likely surplus cash",
    borrowing_need: "likely borrowing or funding need",
    mixed_or_seasonal: "mixed or seasonal cash cycle",
    cash_buffer_focus: "focused on cash buffers / resilience"
  }
};

function normalizeClientProfile(profile = {}) {
  return {
    relationshipContext: String(profile.relationshipContext || "unknown"),
    cashPosition: String(profile.cashPosition || "unknown")
  };
}

function clientProfileSummary(profile = {}) {
  const clean = normalizeClientProfile(profile);
  const label = (group, value) => CLIENT_PROFILE_LABELS[group]?.[value] || value || "not specified";
  return [
    `Relationship context: ${label("relationshipContext", clean.relationshipContext)}`,
    `Client cash position: ${label("cashPosition", clean.cashPosition)}`
  ].join("\n");
}

function buildKnownClientFacts({ sector, subsector, industry, isicCode = "", tradeFlow = null, tradeRoles = [], countries = [] }) {
  const facts = [];
  const add = (id, statement) => {
    if (statement) facts.push({ id, statement });
  };

  add("K1", "The client is based in Thailand.");
  add("K2", `The client's selected industry / ISIC activity is ${industry}${isicCode ? ` (${isicCode})` : ""}.`);
  if (sector) add("K3", `The client's selected sector is ${sector}.`);
  if (subsector) add("K4", `The client's selected subsector is ${subsector}.`);

  if (tradeFlow) {
    if (tradeFlow?.purchase?.domestic) add("K5", "The client purchases domestically in Thailand.");
    if (tradeFlow?.purchase?.international) {
      const markets = normalizeCountryList(tradeFlow.purchase.countries || []).map(c => c.name || c.label || c.code).filter(Boolean);
      if (markets.length) add("K6", `The client's stated international purchase markets are ${markets.join(", ")}.`);
    }
    const purchaseCurrencies = normalizeCurrencyList(tradeFlow?.purchase?.currencies || []);
    if (purchaseCurrencies.length) add("K7", `The client's selected purchase currencies are ${purchaseCurrencies.join(", ")}.`);

    if (tradeFlow?.sales?.domestic) add("K8", "The client sells domestically in Thailand.");
    if (tradeFlow?.sales?.international) {
      const markets = normalizeCountryList(tradeFlow.sales.countries || []).map(c => c.name || c.label || c.code).filter(Boolean);
      if (markets.length) add("K9", `The client's stated international sales markets are ${markets.join(", ")}.`);
    }
    const salesCurrencies = normalizeCurrencyList(tradeFlow?.sales?.currencies || []);
    if (salesCurrencies.length) add("K10", `The client's selected sales currencies are ${salesCurrencies.join(", ")}.`);
  } else {
    const cleanRoles = uniqueArray((tradeRoles || []).map(v => String(v || "").trim()).filter(Boolean));
    if (cleanRoles.length) add("K11", `The client's stated trade roles are ${cleanRoles.join(", ")}.`);
    const cleanCountries = normalizeCountryList(countries || []).map(c => c.name || c.label || c.code).filter(Boolean);
    if (cleanCountries.length) add("K12", `The client's stated relevant countries / markets are ${cleanCountries.join(", ")}.`);
  }

  return facts;
}

function containsUnsupportedClientRelationshipAssumption(text = "") {
  const value = String(text || "");
  const patterns = [
    /\bif (?:the )?client (?:sells?|supplies?|serves?|exports?) (?:to|into)\b/i,
    /\bif (?:the )?client (?:buys?|sources?|procures?|imports?) (?:from|this|these)\b/i,
    /\bif (?:the )?client (?:uses?|relies on|depends on)\b/i,
    /\bif [^.,;]{0,80} (?:is|are) part of (?:its|the client's) (?:input|inputs|raw material|raw materials|supply|supply mix)\b/i,
    /\bfor (?:any|its) [^.,;]{0,60}(?:buyers?|customers?|suppliers?|vendors?)\b/i
  ];
  return patterns.some(pattern => pattern.test(value));
}

function containsSpeculativeConsequenceLink(text = "") {
  const value = String(text || "");
  const patterns = [
    /\bif\b/i,
    /\b(?:could|may|might) (?:affect|change|influence|alter|drive|lead to|result in|translate into|mean)\b/i,
    /\bpotential(?:ly)? (?:affect|change|influence|alter|lead to|result in)\b/i
  ];
  return patterns.some(pattern => pattern.test(value));
}

function cardCountInstruction() {
  return "Generate up to 6 cards, ranked from most useful to least useful for the RM. The UI will show the strongest three by default and keep the rest behind Show more. Prefer fewer high-quality cards over filling space.";
}

function defaultSignalThreads() {
  return ["sector_news", "trade_supply_chain"];
}

function signalThreadText(signalThreads = []) {
  return (signalThreads && signalThreads.length ? signalThreads : defaultSignalThreads()).join(", ");
}

function formatKeepInMind(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value !== "object") return String(value || "").trim();

  const direct = value.keepInMind || value.keep_in_mind || value.whatCouldChange || value.what_could_change || value.possibleImplications || value.possible_implications || "";
  if (direct) return String(direct).trim();

  const baseline = value.baseline || value.baseCase || value.base_case || value.workingAssumption || value.working_assumption || "";
  const oneWay = value.ifUp || value.if_up || value.ifRises || value.if_rises || value.ifWorsens || value.if_worsens || value.ifMovesOneWay || value.if_moves_one_way || value.upside || value.riskScenario || value.risk_scenario || "";
  const otherWay = value.ifDown || value.if_down || value.ifFalls || value.if_falls || value.ifImproves || value.if_improves || value.ifMovesOtherWay || value.if_moves_other_way || value.downside || value.benefitScenario || value.benefit_scenario || "";
  const watch = value.watch || value.watchItems || value.watch_items || value.whatToWatch || value.what_to_watch || "";

  const implicationParts = [oneWay, otherWay].filter(Boolean);
  const implicationText = implicationParts.length ? implicationParts.join("; ") : "";
  return [
    baseline ? `Baseline: ${baseline}` : "",
    implicationText ? `What could change: ${implicationText}` : "",
    watch ? `Watch: ${watch}` : ""
  ].filter(Boolean).join(" ").trim();
}

function buildFallbackQueries({ sector, subsector, industry, isicCode, tradeFlow }) {
  const baseKeywords = getSearchKeywords({ sector, subsector, industry, isicCode }).slice(0, 4).join(" ");
  const purchaseMarkets = listCountries(tradeFlow?.purchase?.countries, 4);
  const salesMarkets = listCountries(tradeFlow?.sales?.countries, 4);
  const allMarkets = listCountries(getAllTradeFlowCountries(tradeFlow), 5);

  return [
    {
      label: "purchase_market_context",
      query: cleanQueryText(`Thailand ${industry} suppliers sourcing imports ${purchaseMarkets} ${baseKeywords} news`),
      maxResults: MAX_TAVILY_RESULTS_PER_QUERY
    },
    {
      label: "sales_market_context",
      query: cleanQueryText(`Thailand ${industry} buyers exports demand ${salesMarkets} ${baseKeywords} news`),
      maxResults: MAX_TAVILY_RESULTS_PER_QUERY
    },
    {
      label: "thailand_industry_context",
      query: cleanQueryText(`Thailand ${industry} industry production trade regulation ${baseKeywords} news`),
      maxResults: MAX_TAVILY_RESULTS_PER_QUERY
    },
    {
      label: "industry_selected_markets_context",
      query: cleanQueryText(`${industry} ${allMarkets} suppliers buyers trade industry ${baseKeywords} news`),
      maxResults: MAX_TAVILY_RESULTS_PER_QUERY
    }
  ].filter(item => item.query.length > 0);
}

function prepareCandidateSources({ sources }) {
  const allCandidateSources = dedupeSources(sources)
    .filter(source => !isExcludedNewsSource(source))
    .filter(source => hasSufficientArticleContent(source))
    .sort((a, b) => {
      const aThai = isThailandRelatedSource(a) ? 1 : 0;
      const bThai = isThailandRelatedSource(b) ? 1 : 0;
      const authorityDelta = getSourceAuthorityScore(b) - getSourceAuthorityScore(a);
      return bThai - aThai || authorityDelta || (b.score || 0) - (a.score || 0);
    });

  // Review a broader but still bounded pool so the RM can receive up to 10 strong articles after filtering.
  const candidateLimit = 24;
  const perGroupLimit = 8;
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
        maxResults: Math.min(MAX_TAVILY_RESULTS_PER_QUERY, Math.max(1, Number(item.maxResults || MAX_TAVILY_RESULTS_PER_QUERY)))
      }))
      .filter(item => item.query.length > 0)
      .slice(0, 4);
  } catch (_) {
    return null;
  }
}

async function planTavilyQueries({ env, sector, subsector, industry, isicCode, tradeFlow, timeframe }) {
  const fallbackQueries = buildFallbackQueries({ sector, subsector, industry, isicCode, tradeFlow });
  const targetCount = 4;

  const plannerPrompt = `
Create up to ${targetCount} short Tavily news search queries for a Thailand-based bank relationship manager.

Known client profile:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry / ISIC activity: ${industry}
- Purchase and sales profile:
${tradeFlowSummary(tradeFlow)}
- Timeframe: last ${timeframe} days
- Core industry terms: ${getSearchKeywords({ sector, subsector, industry, isicCode }).slice(0, 10).join(", ")}

Goal:
Find recent news that could plausibly change how this specific client buys, sells, produces, delivers, pays, collects, or manages supplier/buyer relationships.

Use these four search intents only:
1. purchase_market_context: supplier conditions, sourcing, imports, production inputs, logistics or regulation in the client's purchase markets.
2. sales_market_context: buyer demand, exports, sales conditions, regulation or distribution in the client's sales markets.
3. thailand_industry_context: Thailand-specific developments affecting the client's exact industry or operating activity.
4. industry_selected_markets_context: industry-specific developments across the selected purchase/sales markets that have a concrete business link to this client.

Rules:
- Return JSON only.
- Tavily is keyword search, not reasoning. Keep queries short and keyword-style.
- Anchor every query on the client's exact industry / ISIC activity. Use the most product/activity-specific wording available (for example the exact ISIC activity or its distinctive product terms), not merely the broader subsector.
- Do not substitute adjacent products or processes just because they sit in the same sector. A query for one steel product, food product, machinery type, chemical, etc. should not drift into a different product unless the relationship is a direct current input/output link.
- Use purchase countries mainly in purchase-side queries and sales countries mainly in sales-side queries.
- Currency selections are client context, not a reason to search generic FX news. Only use a currency code if it helps identify a concrete trade, invoicing, payment or market rule.
- Do NOT create generic FX, macro, commodity, geopolitical, election, rates or broad market queries.
- A geopolitical, commodity or policy event can still surface when it is directly tied to the client's industry and selected purchase/sales market.
- Search for CURRENT DEVELOPMENTS, not static reference material. Favor terms such as latest, update, orders, production, shipments, demand, prices, regulation, standards, disruption, capacity, plant, trade measure, or buyer/supplier change when relevant to the exact activity.
- Do not design queries around generic market-size reports, long-term CAGR forecasts, supplier directories, company profiles, "top companies" lists, or evergreen industry overviews.
- Do NOT force every country into every query.
- Do NOT create random country-pair searches unrelated to Thailand or the selected client flows.
- Avoid questions and long sentences.
- Each query must be under 180 characters.
- Use maxResults ${MAX_TAVILY_RESULTS_PER_QUERY} for each query.

JSON shape:
{
  "queries": [
    { "label": "purchase_market_context", "query": "...", "maxResults": ${MAX_TAVILY_RESULTS_PER_QUERY} },
    { "label": "sales_market_context", "query": "...", "maxResults": ${MAX_TAVILY_RESULTS_PER_QUERY} }
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
    return planned && planned.length >= 2 ? planned.slice(0, targetCount) : fallbackQueries;
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

function countArticleWords(text = "") {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function hasSufficientArticleContent(source) {
  const rawContent = String(source?.raw_content || "").trim();
  // An empty extraction is not proof that the page itself is thin (paywalls and script-heavy sites can block extraction),
  // so let the relevance reviewer decide those. Only reject pages Tavily successfully extracted and found to be very short.
  if (!rawContent) return true;
  return countArticleWords(rawContent) >= MIN_RAW_ARTICLE_WORDS;
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

async function tavilySearch({ apiKey, query, startDate, endDate, includeDomains = null, excludeDomains = EXCLUDED_NEWS_DOMAINS, maxResults = MAX_TAVILY_RESULTS_PER_QUERY, searchDepth = "basic" }) {
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

  if (excludeDomains && excludeDomains.length > 0) {
    body.exclude_domains = excludeDomains;
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
      pair: "CNYTHB",
      series: derivedSeries,
      source: "Yahoo Finance prototype: USDTHB ÷ USDCNY",
      derivation: "Cross rate derived as USDTHB ÷ USDCNY",
      market_context_note: "Movement reflects both Baht-side and Renminbi-side factors"
    });
  }

  const pair = `${baseCurrency}THB=X`;
  const series = await fetchYahooSeries(pair, rangeDays);

  const result = summarizeFxSeries({
    base: baseCurrency,
    pair,
    series,
    source: "Yahoo Finance (prototype)"
  });

  if (["EUR", "JPY"].includes(baseCurrency)) {
    result.market_context_note = `Movement reflects both Baht-side and ${baseCurrency === "JPY" ? "Yen" : "Euro"}-side factors`;
  }

  return result;
}

function expandFxCurrencies(currencies) {
  const requested = [...new Set((currencies || []).map(currency => String(currency).toUpperCase()))];
  const needsUsdReference = requested.some(currency => ["CNY", "EUR", "JPY"].includes(currency));

  if (needsUsdReference && !requested.includes("USD")) {
    return ["USD", ...requested];
  }

  return requested;
}

async function fetchFxRates(currencies, rangeDays = 30) {
  const expandedCurrencies = expandFxCurrencies(currencies);

  return Promise.all(
    expandedCurrencies.map(currency =>
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

function isExcludedNewsSource(source) {
  const domain = String(source?.domain || source?.source || "").toLowerCase().replace(/^www\./, "");
  return EXCLUDED_NEWS_DOMAINS.some(excluded => domain === excluded || domain.endsWith(`.${excluded}`));
}

function getSourceAuthorityScore(source) {
  const domain = String(source.domain || source.source || "").toLowerCase();
  if (PREFERRED_NEWS_DOMAINS.some(preferred => domain === preferred || domain.endsWith(`.${preferred}`))) return 5;
  if (/bangkokpost|nationthailand|thaipbs|prachachat|kaohoon|set\.or\.th/.test(domain)) return 4;
  if (/fastmarkets|argusmedia|worldsteel|steelbb|steelorbis|marinelink|hellenicshipping|freightwaves|supplychaindive/.test(domain)) return 3;
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
    const trimmedText = text.length > 1000 ? text.slice(0, 1000) + "…" : text;

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
      extractedWordCount: countArticleWords(source.raw_content || ""),
      snippet: trimmedText
    };
  });

  const prompt = `
You are an evidence selection reviewer for a Thailand-based bank relationship manager.

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
Review the candidate Tavily news articles and classify their usefulness for this specific Thailand-based client.
Prioritise sources in this order:
1. Direct Thailand news connected to the client's exact industry or operating activity.
2. Purchase-market news with a concrete supplier, sourcing, input, production, logistics, regulatory or delivery implication for the client.
3. Sales-market news with a concrete buyer, demand, distribution, regulatory, pricing or collection implication for the client.
4. Industry-specific news across selected markets only when the connection to how this client buys, sells, produces, delivers, pays or collects is clear.

A useful article must have a clear client connection. It is not enough that it mentions a selected country, a broad sector keyword, a currency, or a generic macro theme. At this screening stage, do not require a speculative banking consequence: an exact client market plus a genuinely relevant industry development can be a valid watchpoint even when the source does not prove an effect on this client's orders, cash flow, or working capital.
Current-news gate: the source must contain a concrete, dated or clearly current development within the selected timeframe. A static business directory, supplier listing, company profile, evergreen explainer, generic market-size page, or long-horizon CAGR/market forecast is LOW even if industry keywords match. A forecast is usable only when the CURRENT development is a newly issued/revised forecast or a current event that materially changes the outlook, and the source clearly dates that change.
Known-client-fact gate: relevance must be explainable using only facts explicitly supplied in the client profile above. Do NOT assume an unstated buyer segment, supplier type, raw material/input mix, production process, distribution channel, customer concentration, facility structure, or commercial relationship merely because it is plausible for the industry. If the article matters only if such an unstated relationship exists, classify it LOW.
Use this internal test: complete the sentence "This matters because we know the client ____." The blank must be fillable from the supplied profile, not from industry convention or imagination.
Industry criticality rule: Prefer articles that involve the core industry terms. Downrank or omit articles that mainly match weak-adjacent/exclusion terms without also matching core terms. For example, a sugar article should not become an animal-feed theme unless it explicitly mentions feed, molasses for feed, feed grain substitution, livestock feed costs, or another core feed linkage.
Exact-activity gate: being in the same broad sector is not enough. A story about an adjacent product, process, standard, plant type or customer segment should be LOW unless the source explicitly connects it to the client's exact ISIC activity/product OR it is a direct current upstream/downstream link that could change how this client buys, produces, sells or delivers.
If the only way to explain relevance is with phrases such as "adjacent market", "broader sector", "does not directly concern", "could spill over" or a similar speculative bridge, classify the article LOW.
Interpret purchase/sales strictly from the Thailand-based client's perspective. Purchase markets are supplier/cost-side exposures; sales markets are buyer/revenue-side exposures.
Client geography is a constraint, not an opportunity set. The selected purchase and sales markets describe the client's current stated footprint. A story about a different country is NOT relevant merely because it suggests a new supplier, buyer, export market, growth market, or commercial opportunity. Do not infer that the client should enter a new market, switch suppliers or buyers, change production, alter pricing, invest, acquire, or otherwise change corporate strategy.
You are screening news for a bank relationship manager. Relevance should come from a plausible connection to the client's EXISTING operations and banking needs: supplier/buyer relationships, payments, collections, trade structures, cash flow, working capital, liquidity, FX flows, operating resilience, or whether existing banking/facility arrangements may need discussion. Do not turn market news into corporate-strategy advice.
Treat selected currencies as client context only. Generic FX-rate or currency-market stories are LOW unless the article directly affects invoicing, payment, pricing, settlement or commercial conditions for this industry and selected market.
Generic macro, commodities, geopolitics, elections, interest rates or broad market stories are LOW unless the article directly connects the client's industry to a selected purchase/sales market and changes an operating or commercial condition.
Country-cross results unrelated to Thailand or the selected client flows should be LOW. Broader global industry stories should not displace more direct Thailand, purchase-market or sales-market sources.
Publisher preference: when two articles are similarly relevant, prefer higher-authority publishers (authorityScore 5 or 4). Do not exclude a specialist industry publication when it is more specific and useful for this client's industry.
Do not include sources merely to fill a quota. If relevance is weak or indirect, classify it as LOW and omit it.

Return JSON only in this exact shape:
{
  "hasRelevantUpdates": true,
  "noRelevantUpdateMessage": "",
  "sources": [
    {
      "number": 1,
      "relevanceLevel": "HIGH",
      "contentType": "CURRENT_DEVELOPMENT",
      "currentDevelopment": true,
      "justification": "One sentence explaining why this source is relevant using only known client facts."
    }
  ]
}

Use contentType values only:
- CURRENT_DEVELOPMENT: a concrete recent event/change.
- ANALYSIS_WITH_CURRENT_UPDATE: an analysis page that contains a concrete recent update within the timeframe.
- STATIC_REFERENCE: evergreen/static reference material.
- DIRECTORY_PROFILE: business directory, supplier listing, or company profile.
- EVERGREEN_FORECAST: generic market-size/CAGR/long-range forecast without a distinct current trigger.
- PROMOTIONAL_OTHER: promotional/SEO content without a clear current development.

Relevance levels:
- HIGH: Thailand-related and directly relevant to the client industry, Thai import/export role, or Thai exposure to selected markets.
- MEDIUM: useful exact-industry or selected-market context with a clear and specific implication for how the client buys, sells, produces, delivers, pays, collects, or manages supplier/buyer relationships. A same-sector but different-product story is not MEDIUM by itself.
- LOW: weak keyword match, adjacent-product/process story without an explicit direct link to the exact ISIC activity, unrelated country export/import story, country-pair story without a direct link to the client's stated footprint, new-market or expansion opportunity outside the stated footprint, unrelated company news, static reference/directory/evergreen forecast content, old/background content, or no clear client implication.

Rules:
- Return HIGH and MEDIUM sources only; omit LOW sources completely.
- HIGH or MEDIUM requires currentDevelopment=true and contentType CURRENT_DEVELOPMENT or ANALYSIS_WITH_CURRENT_UPDATE. Static/reference/directory/evergreen-forecast content cannot pass.
- Reject a source when its client relevance depends on phrases such as "if the client sells to...", "if the client sources...", "if this is part of the client's input mix...", or any other unstated client relationship.
- Never include a source because relevant updates are limited. Do not use fallback language such as "limited news", "broader context because", or "may be relevant".
- Keep all HIGH sources.
- Include MEDIUM sources only when the article has a clear, specific client implication.
- Prefer fewer strong sources over more weak sources.
- Justification must be one concise sentence, maximum 28 words, written as "Relevant because..." or equivalent.
- Set hasRelevantUpdates to false if all sources are LOW or if remaining HIGH/MEDIUM sources are too weak to support a client-ready conversation.
- The noRelevantUpdateMessage must be one concise sentence suitable for display to the user.

Candidate evidence sources:
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
          const contentType = String(item.contentType || item.content_type || "").toUpperCase();
          const currentDevelopment = item.currentDevelopment === true || item.current_development === true || ["CURRENT_DEVELOPMENT", "ANALYSIS_WITH_CURRENT_UPDATE"].includes(contentType);
          return [Number(item.number), {
            relevanceLevel: ["HIGH", "MEDIUM", "LOW"].includes(level) ? level : "LOW",
            contentType,
            currentDevelopment,
            justification: String(item.justification || "").trim()
          }];
        })
    );

    const reviewedSources = sources
      .map(source => {
        const review = reviewsByNumber.get(source.source_number);
        const relevanceLevel = review?.relevanceLevel || "LOW";
        const currentDevelopment = Boolean(review?.currentDevelopment);
        const contentType = review?.contentType || "";
        const newsworthyType = ["CURRENT_DEVELOPMENT", "ANALYSIS_WITH_CURRENT_UPDATE"].includes(contentType);
        return {
          ...source,
          relevance_level: relevanceLevel,
          content_type: contentType,
          current_development: currentDevelopment,
          relevance_justification: review?.justification || "",
          relevant: (relevanceLevel === "HIGH" || relevanceLevel === "MEDIUM") && currentDevelopment && newsworthyType
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
      .slice(0, MAX_FINAL_NEWS_SOURCES)
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

function stripInlineSourceRefs(text) {
  return String(text || "")
    .replace(/\s*\[(?:\d+)(?:\s*,\s*\d+)*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNoNewsText(timeframe) {
  return `No relevant recent news identified\nWe did not find a sufficiently relevant development for this client's industry and selected purchase/sales markets in the last ${timeframe} days.`;
}

function normalizeCardTags(tags = [], fallbackText = "") {
  const allowed = new Set(["FX", "Trade", "Working capital", "Payments", "Supply chain", "Liquidity", "Geopolitics", "Rates", "Commodities", "Sector"]);
  const map = {
    fx: "FX",
    currency: "FX",
    currencies: "FX",
    rates: "Rates",
    rate: "Rates",
    interest: "Rates",
    trade: "Trade",
    "trade finance": "Trade",
    workingcapital: "Working capital",
    "working capital": "Working capital",
    payments: "Payments",
    payment: "Payments",
    collections: "Payments",
    collection: "Payments",
    "supply chain": "Supply chain",
    supplychain: "Supply chain",
    logistics: "Supply chain",
    shipping: "Supply chain",
    liquidity: "Liquidity",
    cash: "Liquidity",
    geopolitical: "Geopolitics",
    geopolitics: "Geopolitics",
    policy: "Geopolitics",
    commodities: "Commodities",
    commodity: "Commodities",
    sector: "Sector",
    industry: "Sector",
    market: "Sector"
  };

  const cleanTags = (Array.isArray(tags) ? tags : String(tags || "").split(/[,|/]+/))
    .map(tag => map[String(tag || "").trim().toLowerCase()] || String(tag || "").trim())
    .filter(tag => allowed.has(tag));

  if (!cleanTags.length && fallbackText) {
    const text = String(fallbackText).toLowerCase();
    if (/\b(fx|currency|currencies|usd|eur|cny|jpy|thb|hedg)/i.test(text)) cleanTags.push("FX");
    if (/\b(rate|rates|interest|borrowing|funding cost|yield)\b/i.test(text)) cleanTags.push("Rates");
    if (/\b(trade|letter of credit|lc\b|guarantee|documentary|supplier payment|buyer risk)\b/i.test(text)) cleanTags.push("Trade");
    if (/\b(working capital|cash conversion|receivable|receivables|payable|payables|inventory|cash cycle)\b/i.test(text)) cleanTags.push("Working capital");
    if (/\b(payment|payments|collection|collections|settlement|reconciliation|fraud|routing)\b/i.test(text)) cleanTags.push("Payments");
    if (/\b(supply chain|supplier|shipping|logistics|port|freight|route|inventory buffer)\b/i.test(text)) cleanTags.push("Supply chain");
    if (/\b(liquidity|cash visibility|cash buffer|cash forecasting|deposit|surplus cash|trapped cash)\b/i.test(text)) cleanTags.push("Liquidity");
    if (/\b(geopolitic|sanction|tariff|policy|election|border|conflict|war|compliance)\b/i.test(text)) cleanTags.push("Geopolitics");
    if (/\b(commodity|commodities|oil|gas|energy|metal|food prices|input cost)\b/i.test(text)) cleanTags.push("Commodities");
  }

  const unique = [...new Set(cleanTags)];
  return (unique.length ? unique : ["Sector"]).slice(0, 3);
}

function formatNewsThemesFromJson(parsed) {
  const cards = Array.isArray(parsed.cards) ? parsed.cards : (Array.isArray(parsed.themes) ? parsed.themes : []);

  return cards.map((card, index) => {
    const title = String(card.title || `Card ${index + 1}`).replace(/^(Theme|Card)\s*\d+\s*:\s*/i, "").trim();
    const context = String(card.context || card.commentOnContext || card.comment_on_context || card.whatIsHappening || card.what_is_happening || card.observe || "").trim();
    const relevance = String(card.relevance || card.linkToClient || card.link_to_client || card.whyRelevant || card.why_relevant || card.relate || "").trim();
    const tags = normalizeCardTags(card.tags || card.tag || [], `${title} ${context} ${relevance}`);
    const sourceNumbers = Array.isArray(card.sourceNumbers) ? card.sourceNumbers : extractSourceRefs(`${context} ${relevance}`);
    const cleanSourceNumbers = [...new Set(sourceNumbers.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);

    return [
      `Card ${index + 1}: ${stripInlineSourceRefs(title)}`,
      `Tags: ${tags.join(", ")}`,
      cleanSourceNumbers.length ? `Sources: ${cleanSourceNumbers.map(number => `[${number}]`).join(" ")}` : "",
      context ? `Comment on context: ${stripInlineSourceRefs(context)}` : "",
      relevance ? `Link to client: ${stripInlineSourceRefs(relevance)}` : ""
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


function buildFactExtractionExcerpt(rawText, maxChars = 12000) {
  const text = String(rawText || "").trim();
  if (text.length <= maxChars) return text;

  // Long market pages often place the newest update near the top but keep regional sections deeper down.
  // Sample across the page so the extractor can see both the latest section and geographically distinct sections
  // without sending an unbounded amount of article text.
  const firstSize = Math.floor(maxChars * 0.58);
  const middleSize = Math.floor(maxChars * 0.25);
  const lastSize = maxChars - firstSize - middleSize;
  const middleStart = Math.max(firstSize, Math.floor((text.length - middleSize) / 2));
  const lastStart = Math.max(middleStart + middleSize, text.length - lastSize);

  return [
    text.slice(0, firstSize),
    "\n[... middle section of long article ...]\n",
    text.slice(middleStart, middleStart + middleSize),
    "\n[... later section of long article ...]\n",
    text.slice(lastStart)
  ].join("");
}

async function extractAtomicNewsFacts({ env, sources }) {
  if (!sources.length) return [];

  const sourceContext = sources.map(source => {
    const text = String(source.raw_content || source.summary || "").trim();
    const trimmedText = buildFactExtractionExcerpt(text);

    return `
[${source.source_number}]
Title: ${source.title}
Publisher: ${source.domain || source.source || "Unknown"}
Published: ${source.published_at || "Unknown"}
Content:
${trimmedText}
`.trim();
  }).join("\n\n");

  const prompt = `
You are a factual evidence extractor. Your task is deliberately client-agnostic: extract what each article actually says before anyone tries to connect it to a client.

For each source, extract up to 6 discrete, decision-useful factual developments. Keep separate facts separate when geography, product/topic, period, or direction differs.

Critical extraction rules:
- Preserve the geography exactly. Never turn a China fact into an Asia fact, a Germany fact into a Europe fact, or a Europe fact into a France fact.
- If the article makes a genuinely regional statement and then gives one country as an example, capture the regional statement as regional and list the example country separately in countryExamples.
- If the article only gives country-specific evidence, geography must remain that country even if the page has a broader regional heading.
- Preserve the stated period or date (for example "Q2 2026", "July 2026", "21 August 2026"). Do not merge different periods into one trend.
- Prefer the latest specific update and latest completed period. Older historical sections may be extracted only when they add a distinct factual development; mark them as OLDER_BACKGROUND.
- Extract CURRENT developments, not static background. Do not extract company-directory facts, supplier listings, generic company descriptions, market-size baselines, generic CAGR forecasts, or evergreen industry descriptions as standalone facts.
- A forecast fact is allowed only when the article clearly reports a newly issued/revised forecast or a current event that changed the forecast; state the current trigger, not merely the long-term CAGR.
- Preserve the exact product, activity, regulation, input, buyer segment, or market topic being discussed. Do not broaden an adjacent product into an industry-wide claim.
- Numeric changes may be included only when explicitly stated in the article.
- Do not infer causes, client implications, banking implications, or advice.
- Do not add general knowledge. If a page is too vague or promotional to support a clear factual development, return no facts for that source.
- Write each fact as a short standalone sentence that would still be accurate if quoted without the rest of the page.

Use these geographyScope values only:
COUNTRY, REGION, GLOBAL, MULTI_COUNTRY, UNSPECIFIED.

Use these recencyRank values only:
LATEST_UPDATE, LATEST_PERIOD, RECENT_PERIOD, OLDER_BACKGROUND, UNSPECIFIED.

Use these factType values only:
CURRENT_EVENT, CURRENT_MARKET_UPDATE, CURRENT_REGULATORY_UPDATE, CURRENT_COMPANY_EVENT, FORECAST_REVISION, BACKGROUND_REFERENCE.
Normally return only the first five. BACKGROUND_REFERENCE should be used only when inseparable from a current fact and will not be eligible to create a signal by itself.

Return JSON only in this exact shape:
{
  "sources": [
    {
      "sourceNumber": 1,
      "facts": [
        {
          "fact": "A concise source-supported factual statement.",
          "geography": "Europe",
          "geographyScope": "REGION",
          "countryExamples": ["Germany"],
          "productOrTopic": "cold-rolled coil",
          "period": "Q2 2026",
          "recencyRank": "LATEST_PERIOD",
          "factType": "CURRENT_MARKET_UPDATE",
          "scopeNote": "Regional statement; Germany is the numeric example."
        }
      ]
    }
  ]
}

Sources:
${sourceContext}
`.trim();

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
  if (!response.ok) {
    throw new Error(data.error?.message || "Atomic news fact extraction failed.");
  }

  const parsed = parseJsonObject(extractOutputText(data));
  if (!parsed || !Array.isArray(parsed.sources)) {
    throw new Error("Atomic news fact extraction returned invalid JSON.");
  }

  const validSourceNumbers = new Set(sources.map(source => Number(source.source_number)));
  const allowedScopes = new Set(["COUNTRY", "REGION", "GLOBAL", "MULTI_COUNTRY", "UNSPECIFIED"]);
  const allowedRecency = new Set(["LATEST_UPDATE", "LATEST_PERIOD", "RECENT_PERIOD", "OLDER_BACKGROUND", "UNSPECIFIED"]);
  const allowedFactTypes = new Set(["CURRENT_EVENT", "CURRENT_MARKET_UPDATE", "CURRENT_REGULATORY_UPDATE", "CURRENT_COMPANY_EVENT", "FORECAST_REVISION"]);
  const output = [];

  for (const sourceEntry of parsed.sources) {
    const sourceNumber = Number(sourceEntry?.sourceNumber);
    if (!validSourceNumbers.has(sourceNumber)) continue;

    const facts = Array.isArray(sourceEntry?.facts) ? sourceEntry.facts : [];
    facts.slice(0, 6).forEach((fact, index) => {
      const statement = String(fact?.fact || "").trim();
      if (!statement) return;

      const geographyScopeRaw = String(fact?.geographyScope || "UNSPECIFIED").toUpperCase();
      const recencyRankRaw = String(fact?.recencyRank || "UNSPECIFIED").toUpperCase();
      const factTypeRaw = String(fact?.factType || "BACKGROUND_REFERENCE").toUpperCase();
      if (!allowedFactTypes.has(factTypeRaw) || recencyRankRaw === "OLDER_BACKGROUND") return;
      output.push({
        factId: `S${sourceNumber}F${index + 1}`,
        sourceNumber,
        fact: statement,
        geography: String(fact?.geography || "Unspecified").trim() || "Unspecified",
        geographyScope: allowedScopes.has(geographyScopeRaw) ? geographyScopeRaw : "UNSPECIFIED",
        countryExamples: Array.isArray(fact?.countryExamples)
          ? fact.countryExamples.map(value => String(value || "").trim()).filter(Boolean).slice(0, 6)
          : [],
        productOrTopic: String(fact?.productOrTopic || "").trim(),
        period: String(fact?.period || "Unspecified").trim() || "Unspecified",
        recencyRank: allowedRecency.has(recencyRankRaw) ? recencyRankRaw : "UNSPECIFIED",
        factType: factTypeRaw,
        scopeNote: String(fact?.scopeNote || "").trim()
      });
    });
  }

  return output;
}

function validateCardsAgainstAtomicFacts(cards, atomicFacts, knownClientFacts = []) {
  const factMap = new Map(atomicFacts.map(fact => [String(fact.factId), fact]));
  const clientFactMap = new Map(knownClientFacts.map(fact => [String(fact.id), fact]));

  return (Array.isArray(cards) ? cards : []).filter(card => {
    const factIds = Array.isArray(card?.factIds)
      ? [...new Set(card.factIds.map(value => String(value || "").trim()).filter(Boolean))]
      : [];
    if (!factIds.length || factIds.some(id => !factMap.has(id))) return false;

    const sourceNumbers = new Set((Array.isArray(card?.sourceNumbers) ? card.sourceNumbers : [])
      .map(Number)
      .filter(Number.isFinite));
    const requiredSources = new Set(factIds.map(id => factMap.get(id)?.sourceNumber).filter(Number.isFinite));
    if (!requiredSources.size || [...requiredSources].some(number => !sourceNumbers.has(number))) return false;

    const clientFactIds = Array.isArray(card?.clientFactIds)
      ? [...new Set(card.clientFactIds.map(value => String(value || "").trim()).filter(Boolean))]
      : [];
    if (!clientFactIds.length || clientFactIds.some(id => !clientFactMap.has(id))) return false;

    const relevance = String(card?.relevance || card?.linkToClient || card?.link_to_client || "").trim();
    if (!relevance || containsUnsupportedClientRelationshipAssumption(relevance) || containsSpeculativeConsequenceLink(relevance)) return false;

    card.factIds = factIds;
    card.clientFactIds = clientFactIds;
    card.sourceNumbers = [...sourceNumbers];
    return true;
  });
}

async function analyzeNewsDevelopments({ env, sources, atomicFacts = [], sector, subsector, industry, isicCode = "", tradeRoles, countries, tradeFlow = null, timeframe, plannedQueries, defaultPrompt, conversationGoal = "general_check_in", clientProfile = {}, signalThreads = [] }) {
  if (!sources.length || !atomicFacts.length) {
    return {
      status: "NO_NEWS",
      content: normalizeNoNewsText(timeframe)
    };
  }

  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");
  const termProfile = getIndustryTermProfile({ isicCode, industry });
  const knownClientFacts = buildKnownClientFacts({ sector, subsector, industry, isicCode, tradeFlow, tradeRoles, countries });

  const sourceMetadata = new Map(sources.map(source => [Number(source.source_number), source]));
  const factContext = atomicFacts.map(fact => {
    const source = sourceMetadata.get(Number(fact.sourceNumber));
    return {
      factId: fact.factId,
      sourceNumber: fact.sourceNumber,
      sourceTitle: source?.title || "Unknown source",
      publisher: source?.domain || source?.source || "Unknown",
      published: source?.published_at || "Unknown",
      fact: fact.fact,
      geography: fact.geography,
      geographyScope: fact.geographyScope,
      countryExamples: fact.countryExamples,
      productOrTopic: fact.productOrTopic,
      period: fact.period,
      recencyRank: fact.recencyRank,
      factType: fact.factType,
      scopeNote: fact.scopeNote
    };
  });

  const prompt = `
You are a transaction banking conversation coach supporting a junior Thailand-based relationship manager.

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
- Enabled signal threads: ${signalThreadText(signalThreads)}
- Search mode: Conversation-card signal scan
- Search queries used: ${plannedQueries.map(plan => `${plan.label}: ${plan.query}`).join(" | ")}

Known client facts — CLOSED LIST:
${knownClientFacts.map(fact => `- ${fact.id}: ${fact.statement}`).join("\n")}
Anything not stated in this list is UNKNOWN. Do not fill gaps with typical industry practice.

Task:
Create evidence-grounded Client Signals from the provided atomic source facts. Rank them from most useful to least useful for a junior transaction banker. At this stage, generate signals only — do not generate questions, invitations, recommendations, or a full conversation flow.
${cardCountInstruction()}

Signal coverage:
- Focus on the client's exact industry, Thailand operations, selected purchase markets and selected sales markets
- Treat exact-industry fit as a gate, not a loose preference. Do not create a card from an adjacent product/process story unless the source explicitly links it to the client's exact ISIC activity or to a direct current input/output relationship
- If you would need to describe a story as an "adjacent market", "broader sector", "does not directly concern" or similar speculative bridge, omit the card
- KNOWN-FACT GATE: every Link to client must be supported by one or more IDs from the Known client facts closed list. Do not assume who the client's buyers are, who its suppliers are, what raw materials it uses, which production process it follows, which customer segment it serves, or which product is an input/output unless that relationship is explicitly in the known facts.
- Internal test before keeping a card: complete "This matters because we know the client ____." The blank must be a direct restatement of one or more known client facts. If you need "if the client sells to...", "if the client sources...", "if this is part of its input mix...", or a similar hypothetical business relationship, OMIT THE CARD.
- Being plausible for companies in this industry is not the same as being known about this client. Unknown relationships belong in later client discovery, not in news relevance.
- Prioritise developments that could change how the client buys, sells, produces, delivers, pays, collects, or manages supplier/buyer relationships
- Separate purchase-side supplier/cost/operating implications from sales-side buyer/demand/revenue implications when the evidence supports that distinction
- Treat purchase countries as supplier/source markets and sales countries as buyer/revenue markets; do not cross-combine countries randomly
- Client geography is a constraint, not an opportunity set. The selected countries describe the client's current stated footprint. Do not suggest or imply that the client should enter a new market because an article shows demand elsewhere
- Do not recommend changing suppliers or buyers, changing production, changing pricing, investing, acquiring, expanding, exiting a market, or any other corporate-strategy action
- You are supporting a bank relationship manager. First establish whether the development intersects the client's EXISTING industry and stated footprint. Do not force a cash-flow, payments, working-capital, liquidity, FX, or facility implication when the source does not directly establish that transmission.
- Treat selected currencies as context only. Do not create a signal from generic FX movement; only mention currency when the article itself supports a concrete trade, pricing, invoicing or payment link
- Do not create generic macro, commodity, geopolitical, rates or broad-market cards. Such developments are usable only when the source directly connects them to this client's industry and selected trade flow
- Translate only the supported commercial consequence into cash, trade, payments, working capital, liquidity, or operating resilience
- Do not add working-capital, receivable, liquidity or facility implications simply to make a card sound more banking-relevant. Mention them only when there is a specific supported transmission mechanism such as changed payment terms, order timing, inventory holding, shipment timing, acceptance/claims, input prepayment or collection timing.

Card standard:
- Each card has only two sections: Comment on context and Link to client
- Comment on context: one concise, plain-English statement of what the selected atomic facts show. Preserve the fact's geography and period in the sentence whenever they are stated; never write an unscoped global-sounding trend from a country- or region-scoped fact.
- Link to client: one or two concise sentences that read as a natural continuation of Comment on context. Connect the development to ONE known client fact, but do not narrate the validation logic or mechanically restate the client profile. Then, only if genuinely useful, add a light scope caveat. Do not add a hypothetical operating or financial consequence.
- Geography matching is strict: a COUNTRY fact can support only that country; a REGION fact may be used as broader regional context for a client country in that region, but the wording must stay regional; a countryExample inside a regional fact must never be presented as evidence for another country.
- A MULTI_COUNTRY fact may be used only for the countries explicitly covered. A GLOBAL fact may be used only when the article itself genuinely states a global development. UNSPECIFIED geography should normally be omitted.
- If a source has China evidence under an Asia heading but no genuine Asia-wide statement, do not use it as evidence for Japan. If a Europe fact uses Germany as its numeric example, you may describe broader European conditions for a France-exposed client only when the atomic fact itself is REGION-scoped; explicitly avoid implying a France-specific move.
- Prefer LATEST_UPDATE and LATEST_PERIOD facts. Do not lead with an older quarter when a newer relevant fact from the same source exists, unless the older fact is uniquely relevant to the client's exact footprint.
- The evidence sentence and client-link sentence must not silently change geography, product/topic, or time period.
- ONE-HOP LINK RULE: Link to client may make only one inference beyond the sourced fact: connect the fact to a known client attribute or stated purchase/sales market. Stop there.
- Do not add second-order consequences in Link to client, even conditionally. Phrases such as "if orders change", "if buyers change terms", "could affect receivables", "may influence working capital", or similar scenario chains belong later in client discovery only after the client raises them.
- Write Link to client as though it is the next sentence in the same conversation, not as an explanation of why the article passed a relevance test. The banker should be able to read Comment on context and Link to client aloud without sounding like a system prompt.
- Prefer natural bridges grounded in known facts, for example: "For a Thai steel-sheet producer, that puts energy costs firmly on the radar."; "With China already part of its sales mix, this is a useful read on the demand backdrop there."; "Given its domestic sales exposure, this is worth keeping in view as part of the local market picture." Use these only as style examples; do not copy facts that are not in the client profile.
- Avoid mechanical or rubric-like wording such as "The client is Thailand-based", "the selected activity is", "the client has stated sales to", "the fact is about", "the source covers", "this is useful context", "this is a sales-side signal", or "this provides context for one of the client's stated markets". Express the same idea naturally instead.
- Do not start every Link to client with the same formula. Vary the bridge naturally while staying factual and concise.
- If a scope caveat is needed, make it a light second clause or second sentence rather than the main message. For example, "This is more of a broader steel-market watchpoint than a direct read on sheet orders." Do not refer to the source or the model's reasoning process in the caveat.
- If the source itself directly reports a concrete operating consequence and that consequence maps literally to a known client fact, you may preserve it. Otherwise stop after the factual client connection.
- When the article is broader than the client's exact product/activity but still passes because the geography and industry connection are strong, preserve that scope naturally and treat it as a watchpoint rather than a direct indicator of the client's orders or performance.
- Do not generate a question or next step in this first stage
- Prefer a concrete commercial transmission channel over generic wording
- Avoid ambiguous contrasts or corrective phrases such as "rather than", "instead of", "not necessarily", "without assuming", "despite", or "although" unless the source itself clearly supports the contrast
- Never imply that the user or client made an assumption that was not stated

Grounding rules:
- Use ONLY the provided atomic facts. The raw article text is intentionally not provided at this stage.
- Every atomic fact is intended to represent a current development. Do not turn a background/reference fact, directory fact, generic market-size statistic, or evergreen CAGR forecast into a signal.
- A FORECAST_REVISION fact is usable only because the source reports a current issuance/revision/change; frame the current trigger, not the distant forecast as if it were today's operating condition.
- Every factual statement in a card must be traceable to one or more factIds supplied below.
- Do NOT add unstated facts, general industry knowledge, background assumptions, or evergreen commentary as if sourced.
- Do NOT imply that an article specifically discusses the client's product, market, currency, or trade flow unless the source explicitly does.
- You may draw only a one-hop relevance inference: source fact -> known client fact. Do not infer a chain of operational or financial effects from that connection.
- Do not cite a source unless it directly supports the statement being made.
- Every card must include at least one source number in the sourceNumbers array, at least one matching factId in the factIds array, and at least one clientFactId from the Known client facts closed list.
- Use only factIds that are provided below. sourceNumbers must include the source number corresponding to every cited factId.
- Use only clientFactIds from the Known client facts closed list. A clientFactId supports only what its statement literally says; it does not license additional assumptions about buyer/supplier type, input mix, production process, or customer segment.
- Do not put [1] or [2] inline inside the observe, relate, keepInMind, leaveSpace, lightlyExplore, or offerSupport text. Put source references only in sourceNumbers.
- If the sources do not contain meaningful evidence relevant to this Thailand-based client context, return JSON with "status": "NO_NEWS" and an empty cards array.
- If there is at least one useful news-based card, return JSON with "status": "OK". Do NOT include the string NO_NEWS anywhere in titles, paragraphs, or bullets.

Relevance discipline:
- Do not force weakly related articles into high-confidence cards.
- Do not use numeric scores, signal strength labels, or evidence grades.
- Do not use prefixes such as "Primary Market Signal" or "Secondary Global Context".
- Prefer fewer, stronger cards over many isolated source summaries.
- If a development is only useful as a light conversation opener, frame it as a small-talk / awareness point rather than a risk or sales opportunity.
- Not every card needs a risk, opportunity, or RM angle. Only include those when genuinely supported.
- Do not recommend financing a specific expansion, acquisition, project, market entry, supplier switch, buyer switch, investment, pricing change, or other corporate-strategy action. Those decisions belong to the client.
- If a development may affect the amount or timing of cash needs, you may say it could be useful to understand whether existing banking or facility arrangements still fit the operating cycle. Do NOT state that the client should increase, reduce, refinance, or take a specific credit facility.
- Do NOT assume a named company in an article is the bank's client or the user's client. Frame it as a sector signal, competitor signal, buyer/supplier signal, or market development.
- Do not infer invoice, settlement, or proceeds currency from a selected country or market.
- Do not name a specific currency in a country-specific Link to client sentence unless the source explicitly discusses that currency and the client profile explicitly maps it to the relevant transaction flow. Otherwise use neutral wording such as sales proceeds, payment timing, FX exposure, buyer terms, or receivable timing.
- Do NOT repeat standalone FX rate commentary. Mention currency only when a source directly supports a concrete implication for the selected purchase/sales flow.

Writing style:
- Use practical, banker-friendly titles. Avoid generic titles such as "Supply Chain Risk" or "Market Update".
- Keep each paragraph short and calibrated.
- Comment on context should state the development plainly; Link to client should feel like a smooth bridge from that observation, not a separate compliance explanation.
- Keep the strict known-fact and one-hop checks INTERNAL. Do not expose fact-validation language, client-profile labels, or source-screening logic to the banker.
- When relevance is indirect, use cautious wording such as "may", "worth keeping in view", "watchpoint", or "broader market backdrop" without inventing a consequence.
- Avoid overly promotional language.

Return JSON only in this exact shape:
{
  "status": "OK",
  "cards": [
    {
      "title": "Specific practical signal title",
      "tags": ["Trade", "Supply chain"],
      "context": "One concise, evidence-grounded statement of what is happening",
      "relevance": "One concise, cautious link to the selected client profile using only known client facts and a clear supported transmission channel",
      "factIds": ["S1F1"],
      "clientFactIds": ["K2", "K9"],
      "sourceNumbers": [1]
    }
  ]
}

Allowed tags: FX, Trade, Working capital, Payments, Supply chain, Liquidity, Geopolitics, Rates, Commodities, Sector. Use one to three tags per card. Prefer transaction-banking relevance tags over generic macro labels.

If not relevant, return exactly this JSON:
{
  "status": "NO_NEWS",
  "cards": []
}

Atomic source facts (these are the only factual claims you may use):
${JSON.stringify(factContext, null, 2)}
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
      // Do not fall back to free-form model text here: it would bypass atomic-fact validation.
      // A conservative no-news state is safer than displaying an unvalidated synthesis.
      return {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      };
    }

    const status = String(parsed.status || "").toUpperCase();
    const rawCards = Array.isArray(parsed.cards) ? parsed.cards : (Array.isArray(parsed.themes) ? parsed.themes : []);
    const cards = validateCardsAgainstAtomicFacts(rawCards, atomicFacts, knownClientFacts);

    if (status === "NO_NEWS" || cards.length === 0) {
      return {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
      };
    }

    const content = formatNewsThemesFromJson({ ...parsed, cards }).replace(/\bNO_NEWS\b/g, "").trim();
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
    const conversationGoal = (body.conversationGoal || "general_check_in").trim();
    const clientProfile = normalizeClientProfile(body.clientProfile || {});
    const signalThreads = Array.isArray(body.signalThreads) && body.signalThreads.length
      ? body.signalThreads.map(item => String(item))
      : defaultSignalThreads();

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
    const tavilyBatches = await Promise.all(plannedQueries.map(plan =>
      tavilySearch({
        apiKey: env.TAVILY_API_KEY,
        query: plan.query,
        startDate: start_date,
        endDate: end_date,
        includeDomains: null,
        excludeDomains: EXCLUDED_NEWS_DOMAINS,
        maxResults: plan.maxResults || MAX_TAVILY_RESULTS_PER_QUERY,
        searchDepth
      }).then(results => normalizeTavilyResults(results, plan.label))
    ));

    const fxResults = [];

    const primaryCandidateSources = prepareCandidateSources({
      sources: tavilyBatches.flat()
    });

    const effectiveQueries = [...plannedQueries];
    const sourceAssessment = await assessSourceRelevance({
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

    // Deliberately do not broaden or retry the news search when few/no sources survive.
    // A genuine "no relevant news" result is preferable to forcing weaker articles into the output.
    const fallbackTriggered = false;

    const mergedSources = sourceAssessment.sources.map((source, index) => ({
      ...source,
      source_number: index + 1
    }));

    const atomicFacts = (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0)
      ? []
      : await extractAtomicNewsFacts({ env, sources: mergedSources });

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

    if (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0 || atomicFacts.length === 0) {
      const noNews = {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe)
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
        search_mode: "conversation_card_signal_scan",
        sources: []
      });
    }

    const rawNewsSection = await analyzeNewsDevelopments({
      env,
      sources: mergedSources,
      atomicFacts,
      sector,
      subsector,
      industry,
      isicCode,
      tradeRoles,
      countries,
      tradeFlow,
      timeframe,
      plannedQueries: effectiveQueries,
      defaultPrompt,
      conversationGoal,
      clientProfile,
      signalThreads
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
      search_mode: "conversation_card_signal_scan",
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
