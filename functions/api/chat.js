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
const MAX_RETAINED_ARTICLE_CHARS = 18000;
const TAVILY_CONCURRENCY = 2;

const ALLOWED_CURRENCIES = ["THB", "USD", "JPY", "EUR", "CNY"];

const DEFAULT_OPENAI_BASIC_MODEL = "gpt-5.6-luna";
const DEFAULT_OPENAI_BASIC_REASONING_EFFORT = "none";
const OPENAI_ANALYSIS_MODEL = "gpt-4.1";

function getOpenAIBasicModel(env = {}) {
  const configured = String(env?.OPENAI_BASIC_MODEL || "").trim();
  return configured || DEFAULT_OPENAI_BASIC_MODEL;
}

function getOpenAIBasicReasoningEffort(env = {}) {
  const allowed = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);
  const configured = String(env?.OPENAI_BASIC_REASONING_EFFORT || DEFAULT_OPENAI_BASIC_REASONING_EFFORT).trim().toLowerCase();
  return allowed.has(configured) ? configured : DEFAULT_OPENAI_BASIC_REASONING_EFFORT;
}

function buildOpenAIBasicRequest(env, input, extra = {}) {
  const model = getOpenAIBasicModel(env);
  const body = { model, input, ...extra };
  // GPT-5 family models support explicit reasoning effort. The basic research stages are
  // classification/extraction tasks, so default to no extra reasoning for lower latency.
  // This can be overridden in Cloudflare with OPENAI_BASIC_REASONING_EFFORT.
  if (/^gpt-5(?:\.|$)/i.test(model)) {
    body.reasoning = { effort: getOpenAIBasicReasoningEffort(env) };
  }
  return body;
}

function buildAtomicFactJsonSchema() {
  const factSchema = {
    type: "object",
    properties: {
      fact: { type: "string" },
      geography: { type: "string" },
      geographyScope: {
        type: "string",
        enum: ["COUNTRY", "REGION", "GLOBAL", "MULTI_COUNTRY", "UNSPECIFIED"]
      },
      countryExamples: {
        type: "array",
        items: { type: "string" }
      },
      productOrTopic: { type: "string" },
      period: { type: "string" },
      recencyRank: {
        type: "string",
        enum: ["LATEST_UPDATE", "LATEST_PERIOD", "RECENT_PERIOD", "OLDER_BACKGROUND", "UNSPECIFIED"]
      },
      factType: {
        type: "string",
        enum: [
          "CURRENT_EVENT",
          "CURRENT_MARKET_UPDATE",
          "CURRENT_REGULATORY_UPDATE",
          "CURRENT_COMPANY_EVENT",
          "FORECAST_REVISION",
          "BACKGROUND_REFERENCE"
        ]
      },
      tradeMeasureDestination: { type: "string" },
      affectedOriginCountries: {
        type: "array",
        items: { type: "string" }
      },
      originCoverage: {
        type: "string",
        enum: ["NAMED_ORIGINS_ONLY", "ALL_ORIGINS", "NOT_STATED", "NOT_APPLICABLE"]
      },
      scopeNote: { type: "string" }
    },
    required: [
      "fact",
      "geography",
      "geographyScope",
      "countryExamples",
      "productOrTopic",
      "period",
      "recencyRank",
      "factType",
      "tradeMeasureDestination",
      "affectedOriginCountries",
      "originCoverage",
      "scopeNote"
    ],
    additionalProperties: false
  };

  return {
    type: "object",
    properties: {
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sourceNumber: { type: "integer" },
            facts: {
              type: "array",
              items: factSchema
            }
          },
          required: ["sourceNumber", "facts"],
          additionalProperties: false
        }
      }
    },
    required: ["sources"],
    additionalProperties: false
  };
}

function buildSourceReviewJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      hasRelevantUpdates: { type: "boolean" },
      noRelevantUpdateMessage: { type: "string" },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            number: { type: "integer" },
            relevanceLevel: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
            contentType: {
              type: "string",
              enum: [
                "CURRENT_DEVELOPMENT",
                "ANALYSIS_WITH_CURRENT_UPDATE",
                "STATIC_REFERENCE",
                "DIRECTORY_PROFILE",
                "EVERGREEN_FORECAST",
                "PROMOTIONAL_OTHER"
              ]
            },
            currentDevelopment: { type: "boolean" },
            justification: { type: "string" }
          },
          required: ["number", "relevanceLevel", "contentType", "currentDevelopment", "justification"]
        }
      }
    },
    required: ["hasRelevantUpdates", "noRelevantUpdateMessage", "sources"]
  };
}

function getOpenAIRefusalText(data) {
  if (!Array.isArray(data?.output)) return "";
  for (const item of data.output) {
    if (!Array.isArray(item?.content)) continue;
    for (const contentItem of item.content) {
      if (contentItem?.type === "refusal" && contentItem.refusal) {
        return String(contentItem.refusal).trim();
      }
    }
  }
  return "";
}

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
  // Keep the Worker lightweight: derive a focused term profile from the exact selected
  // ISIC activity instead of importing the full ~900 KB catalogue into every isolate.
  // The OpenAI relevance gate remains the main semantic filter; these terms are only
  // used for search/scoring support.
  const cleanIndustry = String(industry || "")
    .replace(/^\d+\s*[-–—:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleanIndustry) return { description: "", high: [], medium: [], low: [] };

  const generic = new Set([
    "manufacture", "manufacturing", "activities", "activity", "services", "service",
    "production", "processing", "growing", "wholesale", "retail", "repair", "installation",
    "other", "except", "including", "related", "operation", "operations", "products", "product"
  ]);
  const words = cleanIndustry
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(word => !["and", "the", "for", "with", "from", "of", "in", "on", "by", "to", "or"].includes(word));
  const specificWords = words.filter(word => !generic.has(word));

  const phrases = [];
  for (let size = Math.min(4, specificWords.length); size >= 2; size -= 1) {
    for (let i = 0; i <= specificWords.length - size; i += 1) {
      phrases.push(specificWords.slice(i, i + size).join(" "));
    }
  }

  const high = uniqueArray([
    cleanIndustry.toLowerCase(),
    specificWords.join(" "),
    ...phrases,
    ...specificWords.filter(word => word.length >= 6)
  ]).filter(term => term.length >= 4).slice(0, 18);

  return {
    description: cleanIndustry,
    high,
    medium: [],
    low: []
  };
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
      body: JSON.stringify(buildOpenAIBasicRequest(env, plannerPrompt, { text: { format: { type: "json_object" } } }))
    });

    const data = await response.json();
    if (!response.ok) return fallbackQueries;

    const planned = parseQueryPlan(extractOutputText(data));
    return planned && planned.length >= 2 ? planned.slice(0, targetCount) : fallbackQueries;
  } catch (_) {
    return fallbackQueries;
  }
}

function safeDomainFromUrl(url = "") {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function compactArticleContent(text = "", maxChars = MAX_RETAINED_ARTICLE_CHARS) {
  const clean = String(text || "").replace(/\u0000/g, "").trim();
  if (clean.length <= maxChars) return clean;

  // Keep evidence from the beginning, middle and end. This prevents a long article's
  // regional/current sections from disappearing while substantially reducing Worker memory.
  const separator = "\n[…]\n";
  const usable = Math.max(3000, maxChars - separator.length * 2);
  const firstLen = Math.floor(usable * 0.40);
  const middleLen = Math.floor(usable * 0.30);
  const endLen = usable - firstLen - middleLen;
  const middleStart = Math.max(firstLen, Math.floor((clean.length - middleLen) / 2));
  return `${clean.slice(0, firstLen)}${separator}${clean.slice(middleStart, middleStart + middleLen)}${separator}${clean.slice(-endLen)}`;
}

function normalizeTavilyResults(results, sourceGroup) {
  return (results || [])
    .filter(item => item && item.url)
    .map(item => ({
      title: item.title || item.url || "Untitled source",
      url: String(item.url || ""),
      source: item.source || "",
      domain: safeDomainFromUrl(item.url),
      published_at: item.published_date || item.published_at || "",
      summary: compactArticleContent(item.content || "", 4000),
      raw_content: compactArticleContent(item.raw_content || ""),
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

async function mapWithConcurrency(items, limit, mapper) {
  const source = Array.isArray(items) ? items : [];
  const results = new Array(source.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= source.length) return;
      try {
        results[index] = { status: "fulfilled", value: await mapper(source[index], index) };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), source.length || 1) }, () => worker()));
  return results;
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
      body: JSON.stringify(buildOpenAIBasicRequest(env, prompt, { text: { format: { type: "json_object" } } }))
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
      sources: [],
      audit: {
        model: getOpenAIBasicModel(env),
        candidateCount: 0,
        reviews: []
      }
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
Trade-measure directionality gate: for anti-dumping, countervailing, safeguard, tariff, quota, import-control, customs or other trade-remedy measures, match BOTH destination and origin to the client's actual directional flow. For this Thailand-based client, an import measure in a stated sales market is directly relevant only when Thai-origin goods are explicitly in scope or the measure applies to all origins. If the measure names specific origins and Thailand is not among them, classify it LOW. Do not treat an affected origin (for example China) as relevant merely because that country appears elsewhere in the client's purchase or sales markets; the named origin must match the actual flow affected by the measure.
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
- Return one review object for EVERY candidate source, including LOW sources. This is required for auditability.
- LOW sources will be rejected by the application after review; do not omit them from the JSON.
- HIGH or MEDIUM requires currentDevelopment=true and contentType CURRENT_DEVELOPMENT or ANALYSIS_WITH_CURRENT_UPDATE. Static/reference/directory/evergreen-forecast content cannot pass.
- Reject a source when its client relevance depends on phrases such as "if the client sells to...", "if the client sources...", "if this is part of the client's input mix...", or any other unstated client relationship.
- For a destination-country trade remedy that names affected origin countries, reject it when the client's origin is not in scope. Example: a Japan investigation of steel from South Korea, China and Taiwan is LOW for a Thailand-origin exporter to Japan unless the article explicitly includes Thailand or applies the measure more broadly.
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
      body: JSON.stringify(buildOpenAIBasicRequest(env, prompt, {
        text: {
          format: {
            type: "json_schema",
            name: "source_relevance_review",
            strict: true,
            schema: buildSourceReviewJsonSchema()
          }
        }
      }))
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Source relevance review failed (HTTP ${response.status}).`);

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

    const allReviewedSources = sources
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
      });

    const reviewedSources = allReviewedSources.filter(source => source.relevant);

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

    // The per-source reviews are the authoritative decision. A contradictory or omitted
    // top-level hasRelevantUpdates flag should not erase retained HIGH/MEDIUM sources.
    const hasRelevantUpdates = selectedSources.length > 0;

    const noRelevantUpdateMessage = String(parsed.noRelevantUpdateMessage || `No relevant news updates were found in the selected ${timeframe}-day period for this client profile.`).trim();
    return {
      hasRelevantUpdates,
      noRelevantUpdateMessage,
      sources: selectedSources,
      audit: {
        model: getOpenAIBasicModel(env),
        candidateCount: sources.length,
        modelHasRelevantUpdates: Boolean(parsed.hasRelevantUpdates),
        noRelevantUpdateMessage,
        reviews: allReviewedSources.map(source => {
          const countryRel = calculateCountryRelevanceScore(source, countries);
          const industryRel = calculateIndustryRelevanceScore(source, termProfile);
          return {
            number: source.source_number,
            title: source.title,
            url: source.url,
            domain: source.domain || source.source || "",
            publishedAt: source.published_at || "",
            sourceGroup: source.source_group || "",
            tavilyScore: Number(source.score || 0),
            extractedWordCount: countArticleWords(source.raw_content || ""),
            authorityScore: getSourceAuthorityScore(source),
            recencyScore: getRecencyScore(source),
            countryRelevance: countryRel,
            industryRelevance: industryRel,
            relevanceLevel: source.relevance_level,
            contentType: source.content_type,
            currentDevelopment: source.current_development,
            kept: source.relevant && selectedSources.some(selected => selected.source_number === source.source_number),
            justification: source.relevance_justification || ""
          };
        })
      }
    };
  } catch (error) {
    // A review/API/JSON failure is a pipeline error, not evidence that there is no news.
    // Propagate it so the participant sees an error and the audit run is marked ERROR.
    const detail = String(error?.message || error || "Source relevance review failed.");
    throw new Error(`Source relevance review failed: ${detail}`);
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

const CLIENT_UNDERSTANDING_TAXONOMY = {
  "Client business model and operating activities": [
    "Purchase activities",
    "Sales activities",
    "Inventory / goods handling",
    "Delivery / logistics",
    "Payments",
    "Collections",
    "Reconciliation",
    "Investments / operating activities"
  ],
  "Relationships with suppliers / buyers": [
    "Business risks (affecting revenue)",
    "Operational risks (affecting production)",
    "Operating markets",
    "Transaction volume of payments and collections",
    "Dynamics of bargaining power",
    "Supplier / buyer dependency",
    "Trust / relationship",
    "Trading / payment terms",
    "Part of a larger group"
  ],
  "Working capital and financial management": [
    "Payment timing",
    "Collection timing",
    "Currency needs",
    "Exchange-rate exposure",
    "Buyer payment risk",
    "Cash available for payments",
    "Documentation involved",
    "Inventory days",
    "Debtor days",
    "Creditor days",
    "Financing gap",
    "Pre-shipment working capital",
    "Post-shipment working capital"
  ],
  "Other business areas to consider": [
    "Bank / account restrictions",
    "Payment mode preferences",
    "Collection mode preferences",
    "Payment currency preferences",
    "Collection currency preferences",
    "Facility decision-making autonomy",
    "Group / management influence"
  ]
};

function normalizeUnderstandingArea(area = "") {
  const clean = String(area || "").trim().toLowerCase();
  const aliases = {
    "client business model and operating activities": "Client business model and operating activities",
    "business model and operating activities": "Client business model and operating activities",
    "business model & operating activities": "Client business model and operating activities",
    "business model & operations": "Client business model and operating activities",
    "relationships with suppliers / buyers": "Relationships with suppliers / buyers",
    "relationships with suppliers and buyers": "Relationships with suppliers / buyers",
    "supplier / buyer relationships": "Relationships with suppliers / buyers",
    "supplier/buyer relationships": "Relationships with suppliers / buyers",
    "working capital and financial management": "Working capital and financial management",
    "working capital & financial management": "Working capital and financial management",
    "other business areas to consider": "Other business areas to consider",
    "other business areas": "Other business areas to consider"
  };
  return aliases[clean] || "";
}

function normalizeUnderstandingActivity(area, activity = "") {
  const canonicalArea = normalizeUnderstandingArea(area);
  if (!canonicalArea) return "";
  const allowed = CLIENT_UNDERSTANDING_TAXONOMY[canonicalArea] || [];
  const clean = String(activity || "").trim().toLowerCase();
  return allowed.find(item => item.toLowerCase() === clean) || "";
}

function normalizeClientUnderstanding(value = []) {
  if (!Array.isArray(value)) return [];
  const seenAreas = new Set();
  const normalized = [];

  value.forEach((item, index) => {
    const area = normalizeUnderstandingArea(item?.area || item?.level1 || item?.category || "");
    if (!area || seenAreas.has(area)) return;
    const activities = (Array.isArray(item?.activities) ? item.activities : [])
      .map(activity => normalizeUnderstandingActivity(area, typeof activity === "string" ? activity : activity?.name))
      .filter(Boolean);
    const uniqueActivities = [...new Set(activities)].slice(0, 4);
    if (!uniqueActivities.length) return;
    normalized.push({
      area,
      priority: String(item?.priority || (index === 0 ? "PRIMARY" : "SECONDARY")).toUpperCase() === "SECONDARY" ? "SECONDARY" : "PRIMARY",
      activities: uniqueActivities
    });
    seenAreas.add(area);
  });

  if (normalized.length) normalized[0].priority = "PRIMARY";
  if (normalized.length > 1) normalized[1].priority = "SECONDARY";
  return normalized.slice(0, 2);
}

function normalizeCardTags(tags = [], fallbackText = "", clientUnderstanding = []) {
  const fromUnderstanding = normalizeClientUnderstanding(clientUnderstanding).map(item => item.area);
  if (fromUnderstanding.length) return fromUnderstanding;

  const normalized = (Array.isArray(tags) ? tags : String(tags || "").split(/[|]+/))
    .map(normalizeUnderstandingArea)
    .filter(Boolean);
  return [...new Set(normalized)].slice(0, 2);
}

function formatNewsThemesFromJson(parsed) {
  const cards = Array.isArray(parsed.cards) ? parsed.cards : (Array.isArray(parsed.themes) ? parsed.themes : []);

  return cards.map((card, index) => {
    const title = String(card.title || `Card ${index + 1}`).replace(/^(Theme|Card)\s*\d+\s*:\s*/i, "").trim();
    const context = String(card.context || card.commentOnContext || card.comment_on_context || card.whatIsHappening || card.what_is_happening || card.observe || "").trim();
    const relevance = String(card.relevance || card.linkToClient || card.link_to_client || card.whyRelevant || card.why_relevant || card.relate || "").trim();
    const clientUnderstanding = normalizeClientUnderstanding(card.clientUnderstanding || card.client_understanding || []);
    const tags = normalizeCardTags(card.tags || card.tag || [], `${title} ${context} ${relevance}`, clientUnderstanding);
    const sourceNumbers = Array.isArray(card.sourceNumbers) ? card.sourceNumbers : extractSourceRefs(`${context} ${relevance}`);
    const cleanSourceNumbers = [...new Set(sourceNumbers.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);

    return [
      `Card ${index + 1}: ${stripInlineSourceRefs(title)}`,
      tags.length ? `Tags: ${tags.join(" | ")}` : "",
      clientUnderstanding.length ? `Client understanding: ${JSON.stringify(clientUnderstanding)}` : "",
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
- For anti-dumping, countervailing, safeguard, tariff, quota, import-control, customs or other trade-remedy facts, explicitly capture the destination market and the origin countries in scope. Do not omit named origins because they are essential to applicability.
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

Use these originCoverage values only:
NAMED_ORIGINS_ONLY, ALL_ORIGINS, NOT_STATED, NOT_APPLICABLE.
For a trade-remedy/import-control fact, use NAMED_ORIGINS_ONLY when the measure names particular origin countries, ALL_ORIGINS only when the source clearly says it applies irrespective of origin, and NOT_STATED when the source does not make origin coverage clear. For non-trade-measure facts use NOT_APPLICABLE.

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
          "tradeMeasureDestination": "",
          "affectedOriginCountries": [],
          "originCoverage": "NOT_APPLICABLE",
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
    body: JSON.stringify(buildOpenAIBasicRequest(env, prompt, {
      text: {
        format: {
          type: "json_schema",
          name: "atomic_news_facts",
          strict: true,
          schema: buildAtomicFactJsonSchema()
        }
      }
    }))
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Atomic news fact extraction failed.");
  }

  if (data?.status === "incomplete") {
    const reason = String(data?.incomplete_details?.reason || "unknown reason");
    throw new Error(`Atomic news fact extraction was incomplete (${reason}).`);
  }

  const refusal = getOpenAIRefusalText(data);
  if (refusal) {
    throw new Error(`Atomic news fact extraction was refused by the model: ${refusal}`);
  }

  const outputText = extractOutputText(data);
  const parsed = parseJsonObject(outputText);
  if (!parsed || !Array.isArray(parsed.sources)) {
    const preview = outputText.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(`Atomic news fact extraction returned an unexpected structured response${preview ? `: ${preview}` : "."}`);
  }

  const validSourceNumbers = new Set(sources.map(source => Number(source.source_number)));
  const allowedScopes = new Set(["COUNTRY", "REGION", "GLOBAL", "MULTI_COUNTRY", "UNSPECIFIED"]);
  const allowedRecency = new Set(["LATEST_UPDATE", "LATEST_PERIOD", "RECENT_PERIOD", "OLDER_BACKGROUND", "UNSPECIFIED"]);
  const allowedFactTypes = new Set(["CURRENT_EVENT", "CURRENT_MARKET_UPDATE", "CURRENT_REGULATORY_UPDATE", "CURRENT_COMPANY_EVENT", "FORECAST_REVISION"]);
  const allowedOriginCoverage = new Set(["NAMED_ORIGINS_ONLY", "ALL_ORIGINS", "NOT_STATED", "NOT_APPLICABLE"]);
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
        tradeMeasureDestination: String(fact?.tradeMeasureDestination || "").trim(),
        affectedOriginCountries: Array.isArray(fact?.affectedOriginCountries)
          ? fact.affectedOriginCountries.map(value => String(value || "").trim()).filter(Boolean).slice(0, 12)
          : [],
        originCoverage: allowedOriginCoverage.has(String(fact?.originCoverage || "NOT_APPLICABLE").toUpperCase())
          ? String(fact?.originCoverage || "NOT_APPLICABLE").toUpperCase()
          : "NOT_APPLICABLE",
        scopeNote: String(fact?.scopeNote || "").trim()
      });
    });
  }

  return output;
}

function normalizeCountryMatchKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countryNameSet(countries = []) {
  return new Set(normalizeCountryList(countries)
    .flatMap(country => [country.name, country.label, country.code])
    .map(normalizeCountryMatchKey)
    .filter(Boolean));
}

function listIntersectsCountrySet(values = [], countrySet = new Set()) {
  return (Array.isArray(values) ? values : [])
    .map(normalizeCountryMatchKey)
    .filter(Boolean)
    .some(value => countrySet.has(value));
}

function filterAtomicFactsForDirectionalTradeMeasures(facts = [], tradeFlow = null) {
  if (!tradeFlow) return facts;

  const salesMarkets = countryNameSet(tradeFlow?.sales?.countries || []);
  const purchaseMarkets = countryNameSet(tradeFlow?.purchase?.countries || []);
  const thailandKeys = new Set(["thailand", "th", "tha"]);

  return (Array.isArray(facts) ? facts : []).filter(fact => {
    const coverage = String(fact?.originCoverage || "NOT_APPLICABLE").toUpperCase();
    if (coverage === "NOT_APPLICABLE") return true;

    const destination = normalizeCountryMatchKey(fact?.tradeMeasureDestination || "");
    if (!destination) return true; // Let the final evidence model handle unclear scope conservatively.

    const destinationIsThailand = thailandKeys.has(destination);
    const destinationIsSalesMarket = salesMarkets.has(destination);

    // A trade measure in a country outside the client's directional footprint is not a direct-flow signal.
    if (!destinationIsThailand && !destinationIsSalesMarket) return false;

    if (coverage === "ALL_ORIGINS") {
      if (destinationIsSalesMarket && tradeFlow?.sales?.international) return true;
      if (destinationIsThailand && tradeFlow?.purchase?.international) return true;
      return false;
    }

    if (coverage === "NAMED_ORIGINS_ONLY") {
      const origins = Array.isArray(fact?.affectedOriginCountries) ? fact.affectedOriginCountries : [];

      // For exports from this Thailand-based client into a selected sales market, Thailand must be named.
      if (destinationIsSalesMarket) {
        return origins.map(normalizeCountryMatchKey).some(origin => thailandKeys.has(origin));
      }

      // For an import measure in Thailand, one of the client's stated international purchase origins must be named.
      if (destinationIsThailand) {
        if (!tradeFlow?.purchase?.international || !purchaseMarkets.size) return false;
        return listIntersectsCountrySet(origins, purchaseMarkets);
      }
    }

    // NOT_STATED remains eligible for model review, but cannot be treated as a direct match without evidence.
    return true;
  });
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

    const clientUnderstanding = normalizeClientUnderstanding(card?.clientUnderstanding || card?.client_understanding || []);
    if (!clientUnderstanding.length) return false;

    card.factIds = factIds;
    card.clientFactIds = clientFactIds;
    card.sourceNumbers = [...sourceNumbers];
    card.clientUnderstanding = clientUnderstanding;
    card.tags = clientUnderstanding.map(item => item.area);
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
      tradeMeasureDestination: fact.tradeMeasureDestination || "",
      affectedOriginCountries: fact.affectedOriginCountries || [],
      originCoverage: fact.originCoverage || "NOT_APPLICABLE",
      scopeNote: fact.scopeNote
    };
  });

  const prompt = `
You are a client-understanding coach supporting a junior Thailand-based relationship manager.

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
Create evidence-grounded Client Signals from the provided atomic source facts. Rank them from most useful to least useful for a junior transaction banker. Keep the existing Comment on context and Link to client structure. Then classify each retained signal against the workshop's Client Understanding framework so the banker can see which parts of their client understanding may be worth revisiting. Do not generate questions, invitations, recommendations, or a conversation flow.
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
- TRADE-MEASURE FLOW GATE: anti-dumping, countervailing, safeguard, tariff, quota, import-control, customs and similar measures must match the client's actual directional flow, not merely a country somewhere in the profile. For international sales from this Thailand-based client, a measure in the destination market is usable only when Thai-origin goods are explicitly covered or the measure applies to all origins. If named origins exclude Thailand, OMIT THE CARD. Never remap a named origin such as China to a separate client exposure to China when the measure concerns China-origin goods entering another market.
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
- Link to client: usually two short, natural sentences (roughly 30-55 words in total) that read as a smooth continuation of Comment on context. The first sentence should connect the development to ONE known client fact or existing market. The second may explain what aspect of the client's existing business makes it worth watching or lightly clarify the evidence scope. Do not narrate validation logic, mechanically restate the profile, or add a hypothetical operating/financial consequence.
- Geography matching is strict: a COUNTRY fact can support only that country; a REGION fact may be used as broader regional context for a client country in that region, but the wording must stay regional; a countryExample inside a regional fact must never be presented as evidence for another country.
- A MULTI_COUNTRY fact may be used only for the countries explicitly covered. A GLOBAL fact may be used only when the article itself genuinely states a global development. UNSPECIFIED geography should normally be omitted.
- If a source has China evidence under an Asia heading but no genuine Asia-wide statement, do not use it as evidence for Japan. If a Europe fact uses Germany as its numeric example, you may describe broader European conditions for a France-exposed client only when the atomic fact itself is REGION-scoped; explicitly avoid implying a France-specific move.
- Prefer LATEST_UPDATE and LATEST_PERIOD facts. Do not lead with an older quarter when a newer relevant fact from the same source exists, unless the older fact is uniquely relevant to the client's exact footprint.
- The evidence sentence and client-link sentence must not silently change geography, product/topic, or time period.
- ONE-HOP LINK RULE: Link to client may make only one inference beyond the sourced fact: connect the fact to a known client attribute or stated purchase/sales market. Stop there.
- Do not add second-order consequences in Link to client, even conditionally. Phrases such as "if orders change", "if buyers change terms", "could affect receivables", "may influence working capital", or similar scenario chains belong later in client discovery only after the client raises them.
- Write Link to client as though it is the next sentence in the same conversation, not as an explanation of why the article passed a relevance test. The banker should be able to read Comment on context and Link to client aloud without sounding like a system prompt.
- Prefer natural bridges grounded in known facts, for example: "For a Thai steel-sheet producer, the higher power tariff is directly relevant to the domestic production-cost environment. The increase applies across the wider steel sector, so it is best treated as an industry cost watchpoint."; "With the client already selling into China, this is a useful read on the demand environment in one of its existing export markets. It is broader steel-market context rather than a direct read on the client's own orders."; "For the client's domestic business in Thailand, this gives a current read on the local steel-demand backdrop. It is market context rather than a company-specific order signal." Use these only as style examples; do not copy facts that are not in the client profile.
- Avoid mechanical or rubric-like wording such as "The client is Thailand-based", "the selected activity is", "the client has stated sales to", "the fact is about", "the source covers", "this is useful context", "this is a sales-side signal", or "this provides context for one of the client's stated markets". Also avoid portfolio jargon such as "sales mix" or "sales exposure"; prefer natural banking language such as "already selling into China", "an existing export market", "the client's domestic business", or "its existing sales in Japan". Express the same idea naturally instead.
- Do not start every Link to client with the same formula. Vary the bridge naturally while staying factual and concise.
- If a scope caveat is needed, make it a light second clause or second sentence rather than the main message. For example, "This is more of a broader steel-market watchpoint than a direct read on sheet orders." Do not refer to the source or the model's reasoning process in the caveat.
- If the source itself directly reports a concrete operating consequence and that consequence maps literally to a known client fact, you may preserve it. Otherwise stop after the factual client connection.
- When the article is broader than the client's exact product/activity but still passes because the geography and industry connection are strong, preserve that scope naturally and treat it as a watchpoint rather than a direct indicator of the client's orders or performance.
- Do not generate a question or next step in this first stage
- CLIENT UNDERSTANDING CLASSIFICATION: classify each retained signal using the fixed workshop taxonomy below. Classification happens only AFTER a signal has passed the news relevance gates; never use a training label to rescue a weak or speculative article.
- Use exactly ONE primary Level 1 area. Add a second Level 1 area only when there is a clear first-order connection from the sourced fact and known client facts. Never add a second area merely because it could eventually be affected.
- Under each selected Level 1 area, choose 1-4 Level 2 activities from the fixed list. These identify what aspect of existing client understanding may be worth revisiting; they are NOT claims that the client is affected.
- Do not jump to Working capital and financial management simply because any business change could eventually affect cash. Select it only when the sourced development and known client facts create a direct first-order reason to revisit payment/collection timing, liquidity, currency needs, cash-conversion drivers, or financing gap.
- Do not infer unknown buyers, suppliers, inputs, production processes, trading terms, payment terms, bargaining power, financing arrangements, management preferences, or group policies when choosing Level 2 activities.
- Prefer the narrowest useful Level 2 activities. If the evidence only supports a broad market watchpoint, Operating markets or Business risks (affecting revenue) may be enough; do not add downstream financial consequences.
- The purpose is pedagogical: show the participant which workshop area to revisit, while preserving the distinction between known client facts and information still to be understood.

Fixed Client Understanding taxonomy:
1) Client business model and operating activities
   - Purchase activities
   - Sales activities
   - Inventory / goods handling
   - Delivery / logistics
   - Payments
   - Collections
   - Reconciliation
   - Investments / operating activities
2) Relationships with suppliers / buyers
   - Business risks (affecting revenue)
   - Operational risks (affecting production)
   - Operating markets
   - Transaction volume of payments and collections
   - Dynamics of bargaining power
   - Supplier / buyer dependency
   - Trust / relationship
   - Trading / payment terms
   - Part of a larger group
3) Working capital and financial management
   - Payment timing
   - Collection timing
   - Currency needs
   - Exchange-rate exposure
   - Buyer payment risk
   - Cash available for payments
   - Documentation involved
   - Inventory days
   - Debtor days
   - Creditor days
   - Financing gap
   - Pre-shipment working capital
   - Post-shipment working capital
4) Other business areas to consider
   - Bank / account restrictions
   - Payment mode preferences
   - Collection mode preferences
   - Payment currency preferences
   - Collection currency preferences
   - Facility decision-making autonomy
   - Group / management influence
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
      "tags": ["Relationships with suppliers / buyers"],
      "clientUnderstanding": [
        {
          "area": "Relationships with suppliers / buyers",
          "priority": "PRIMARY",
          "activities": ["Operating markets", "Business risks (affecting revenue)"]
        }
      ],
      "context": "One concise, evidence-grounded statement of what is happening",
      "relevance": "Usually two short, natural sentences linking the sourced development to one known client fact or existing market, with a light scope clarification where useful",
      "factIds": ["S1F1"],
      "clientFactIds": ["K2", "K9"],
      "sourceNumbers": [1]
    }
  ]
}

Allowed tags are ONLY the four Level 1 Client Understanding areas listed above. The tags must match the areas used in clientUnderstanding. Use one primary tag and at most one secondary tag.

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
      // Invalid model output is a generation failure, not a genuine NO_NEWS decision.
      const preview = rawText.replace(/\s+/g, " ").slice(0, 240);
      throw new Error(`Final signal generation returned invalid JSON${preview ? `: ${preview}` : "."}`);
    }

    const status = String(parsed.status || "").toUpperCase();
    const rawCards = Array.isArray(parsed.cards) ? parsed.cards : (Array.isArray(parsed.themes) ? parsed.themes : []);

    // Only an explicit model NO_NEWS decision is treated as genuine no-news at this stage.
    if (status === "NO_NEWS") {
      return {
        status: "NO_NEWS",
        content: normalizeNoNewsText(timeframe),
        audit: {
          model: env.OPENAI_ANALYSIS_MODEL || OPENAI_ANALYSIS_MODEL,
          modelStatus: status,
          rawCardCount: rawCards.length,
          validatedCards: []
        }
      };
    }

    if (status !== "OK") {
      throw new Error(`Final signal generation returned unexpected status: ${status || "UNSPECIFIED"}.`);
    }
    if (rawCards.length === 0) {
      throw new Error("Final signal generation returned status OK but no cards.");
    }

    const cards = validateCardsAgainstAtomicFacts(rawCards, atomicFacts, knownClientFacts);
    if (cards.length === 0) {
      throw new Error(`Final signal generation produced ${rawCards.length} card(s), but all failed evidence/client-link validation.`);
    }

    const content = formatNewsThemesFromJson({ ...parsed, cards }).replace(/\bNO_NEWS\b/g, "").trim();
    const sourceRefs = extractSourceRefs(content);

    if (!content || sourceRefs.length === 0) {
      throw new Error("Validated signal cards did not retain usable source references.");
    }

    return {
      status: "OK",
      content,
      audit: {
        model: env.OPENAI_ANALYSIS_MODEL || OPENAI_ANALYSIS_MODEL,
        modelStatus: status || "OK",
        rawCardCount: rawCards.length,
        validatedCards: cards,
        sourceRefs
      }
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
      body: JSON.stringify(buildOpenAIBasicRequest(env, prompt, {
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
      }))
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



class ResearchRequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ResearchRequestError";
    this.status = status;
  }
}

function createResearchRunId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const token = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `SIG-${date}-${token}`;
}

function auditSourceSnapshot(source) {
  return {
    title: source?.title || "",
    url: source?.url || "",
    domain: source?.domain || source?.source || "",
    publishedAt: source?.published_at || "",
    sourceGroup: source?.source_group || "",
    tavilyScore: Number(source?.score || 0),
    extractedWordCount: countArticleWords(source?.raw_content || ""),
    summarySnippet: String(source?.summary || "").replace(/\s+/g, " ").trim().slice(0, 1200),
    rawContentSnippet: String(source?.raw_content || "").replace(/\s+/g, " ").trim().slice(0, 1600)
  };
}

function auditInputSnapshot(params) {
  return {
    sector: params.sector,
    subsector: params.subsector,
    industry: params.industry,
    isicCode: params.isicCode,
    timeframe: params.timeframe,
    fxTenor: params.fxTenor,
    tradeFlow: params.tradeFlow,
    tradeRoles: params.tradeRoles,
    countries: params.countries,
    currencies: params.currencies,
    signalThreads: params.signalThreads,
    conversationGoal: params.conversationGoal
  };
}

function normaliseResearchRequest(body, env) {
  const sector = (body.sector || "").trim();
  const subsector = (body.subsector || "").trim();
  let industry = (body.industry || "").trim();
  const timeframe = String(body.timeframe || "30").trim();
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

  if (!sector) throw new ResearchRequestError("Please select a sector.");
  if (!subsector) throw new ResearchRequestError("Please select a subsector.");
  if (!industry) throw new ResearchRequestError("Please enter the client's industry.");
  if (!tradeFlow.purchase.domestic && !tradeFlow.purchase.international) throw new ResearchRequestError("Please select domestic and/or international for Purchase from.");
  if (!tradeFlow.sales.domestic && !tradeFlow.sales.international) throw new ResearchRequestError("Please select domestic and/or international for Sales to.");
  if (tradeFlow.purchase.international && tradeFlow.purchase.countries.length === 0) throw new ResearchRequestError("Please select at least one international purchase market.");
  if (tradeFlow.sales.international && tradeFlow.sales.countries.length === 0) throw new ResearchRequestError("Please select at least one international sales market.");
  if (tradeFlow.purchase.currencies.length === 0) throw new ResearchRequestError("Please select at least one purchase currency.");
  if (tradeFlow.sales.currencies.length === 0) throw new ResearchRequestError("Please select at least one sales currency.");
  if (currencies.length === 0) throw new ResearchRequestError("Please select at least one currency.");
  const unsupported = currencies.filter(currency => !ALLOWED_CURRENCIES.includes(currency));
  if (unsupported.length > 0) throw new ResearchRequestError(`Unsupported currency selected: ${unsupported.join(", ")}`);
  if (!env.TAVILY_API_KEY) throw new ResearchRequestError("Missing TAVILY_API_KEY secret in Cloudflare.", 500);
  if (!env.OPENAI_API_KEY) throw new ResearchRequestError("Missing OPENAI_API_KEY secret in Cloudflare.", 500);

  return { sector, subsector, industry, timeframe, fxTenor, isicCode, tradeFlow, tradeRoles, currencies, countries, defaultPrompt, conversationGoal, clientProfile, signalThreads };
}

async function insertAuditRun(env, runId, params, audit) {
  if (!env.AUDIT_DB) return false;
  const inputJson = JSON.stringify(auditInputSnapshot(params));
  await env.AUDIT_DB.prepare(`
    INSERT INTO research_runs
      (run_id, started_at, status, isic_code, industry, sector, subsector, timeframe_days, input_json)
    VALUES (?, ?, 'RUNNING', ?, ?, ?, ?, ?, ?)
  `).bind(
    runId,
    audit.startedAt,
    params.isicCode || "",
    params.industry || "",
    params.sector || "",
    params.subsector || "",
    Number(params.timeframe || 0) || null,
    inputJson
  ).run();
  return true;
}

function serializeAuditForD1(audit) {
  const encoder = new TextEncoder();
  let json = JSON.stringify(audit);
  if (encoder.encode(json).length < 1800000) return json;

  // D1 has a 2 MB maximum row/string size. Preserve the decisions and scores first,
  // and trim retrieval excerpts only if an unusually large run approaches that ceiling.
  const compact = JSON.parse(json);
  for (const query of compact?.tavily?.queries || []) {
    for (const result of query.results || []) {
      if (result.rawContentSnippet) result.rawContentSnippet = String(result.rawContentSnippet).slice(0, 400);
      if (result.summarySnippet) result.summarySnippet = String(result.summarySnippet).slice(0, 400);
    }
  }
  for (const candidate of compact?.candidateSelection?.candidates || []) {
    if (candidate.rawContentSnippet) candidate.rawContentSnippet = String(candidate.rawContentSnippet).slice(0, 300);
    if (candidate.summarySnippet) candidate.summarySnippet = String(candidate.summarySnippet).slice(0, 300);
  }
  compact.storageNote = "Retrieval excerpts were shortened to keep this audit run within the D1 row-size limit; ratings, decisions, facts and final outputs were retained.";
  json = JSON.stringify(compact);
  return json;
}

async function finishAuditRun(env, runId, { status, audit, result = null, error = "" }) {
  if (!env.AUDIT_DB) return false;
  const completedAt = new Date().toISOString();
  const auditJson = serializeAuditForD1(audit);
  const resultJson = result ? JSON.stringify(result) : null;
  await env.AUDIT_DB.prepare(`
    UPDATE research_runs
       SET completed_at = ?, status = ?, audit_json = ?, result_json = ?, total_ms = ?, error_text = ?
     WHERE run_id = ?
  `).bind(
    completedAt,
    status,
    auditJson,
    resultJson,
    Number(audit.totalMs || 0),
    error ? String(error).slice(0, 4000) : null,
    runId
  ).run();
  return true;
}

async function executeResearch({ env, params, audit, emit }) {
  const { sector, subsector, industry, timeframe, fxTenor, isicCode, tradeFlow, tradeRoles, currencies, countries, defaultPrompt, conversationGoal, clientProfile, signalThreads } = params;

  const stage = async (name, runningMessage, completedMessage, fn, detailBuilder = null) => {
    const started = Date.now();
    await emit({ type: "stage", stage: name, status: "running", message: runningMessage });

    // Keep the streamed response active during long upstream OpenAI/Tavily calls.
    // This also gives the participant a useful elapsed-time indicator rather than a frozen step.
    const heartbeat = setInterval(() => {
      emit({
        type: "heartbeat",
        stage: name,
        status: "running",
        elapsedMs: Date.now() - started,
        message: runningMessage
      }).catch(() => {});
    }, 10000);

    try {
      const value = await fn();
      const durationMs = Date.now() - started;
      audit.timings[name] = durationMs;
      const detail = typeof detailBuilder === "function" ? detailBuilder(value) : undefined;
      await emit({ type: "stage", stage: name, status: "complete", message: completedMessage, durationMs, ...(detail || {}) });
      return value;
    } catch (error) {
      const durationMs = Date.now() - started;
      audit.timings[name] = durationMs;
      await emit({ type: "stage", stage: name, status: "error", message: String(error?.message || error || "Stage failed"), durationMs });
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  };

  const { start_date, end_date } = getDateRange(timeframe);
  const searchKeywords = getSearchKeywords({ sector, subsector, industry, isicCode });

  const plannedQueries = await stage(
    "search_plan",
    "Preparing targeted news searches…",
    "Search plan ready",
    () => planTavilyQueries({ env, sector, subsector, industry, isicCode, tradeFlow, timeframe }),
    queries => ({ detail: `${queries.length} targeted searches` })
  );
  audit.searchPlan = { model: getOpenAIBasicModel(env), queries: plannedQueries };

  const searchDepth = "advanced";
  const tavilyOutcome = await stage(
    "tavily_search",
    "Searching recent news…",
    "Recent news search complete",
    () => mapWithConcurrency(plannedQueries, TAVILY_CONCURRENCY, async plan => {
      const results = await tavilySearch({
        apiKey: env.TAVILY_API_KEY,
        query: plan.query,
        startDate: start_date,
        endDate: end_date,
        includeDomains: null,
        excludeDomains: EXCLUDED_NEWS_DOMAINS,
        maxResults: plan.maxResults || MAX_TAVILY_RESULTS_PER_QUERY,
        searchDepth
      });
      return normalizeTavilyResults(results, plan.label);
    }),
    outcomes => {
      const successful = outcomes.filter(item => item?.status === "fulfilled");
      const returned = successful.reduce((sum, item) => sum + (item.value?.length || 0), 0);
      const failed = outcomes.length - successful.length;
      return { detail: `${returned} articles returned${failed ? ` · ${failed} search${failed === 1 ? "" : "es"} unavailable` : ""}` };
    }
  );

  const tavilyBatches = tavilyOutcome.map(item => item?.status === "fulfilled" ? item.value : []);
  const tavilyErrors = tavilyOutcome.map((item, index) => item?.status === "rejected" ? {
    label: plannedQueries[index]?.label || `query_${index + 1}`,
    query: plannedQueries[index]?.query || "",
    error: String(item.reason?.message || item.reason || "Tavily search failed")
  } : null).filter(Boolean);

  if (tavilyBatches.every(batch => batch.length === 0) && tavilyErrors.length) {
    throw new Error(`All Tavily searches failed. ${tavilyErrors.map(item => `${item.label}: ${item.error}`).join(" | ")}`);
  }

  const flatTavily = tavilyBatches.flat();
  audit.tavily = {
    dateRange: { startDate: start_date, endDate: end_date },
    searchDepth,
    concurrency: TAVILY_CONCURRENCY,
    preferredDomains: PREFERRED_NEWS_DOMAINS,
    excludedDomains: EXCLUDED_NEWS_DOMAINS,
    errors: tavilyErrors,
    queries: plannedQueries.map((plan, index) => ({ ...plan, results: (tavilyBatches[index] || []).map(auditSourceSnapshot), error: tavilyErrors.find(item => item.label === plan.label)?.error || "" }))
  };

  const fxResults = [];
  const primaryCandidateSources = await stage(
    "candidate_selection",
    "Preparing the article shortlist…",
    "Article shortlist ready",
    () => Promise.resolve(prepareCandidateSources({ sources: flatTavily })),
    candidates => ({ detail: `${candidates.length} articles shortlisted for review` })
  );
  audit.candidateSelection = {
    retrievedCount: flatTavily.length,
    candidateCount: primaryCandidateSources.length,
    note: "Candidate pool after domain exclusion, thin-content filtering, deduplication and per-query balancing.",
    candidates: primaryCandidateSources.map(auditSourceSnapshot)
  };
  const effectiveQueries = [...plannedQueries];

  const sourceAssessment = await stage(
    "source_review",
    "Reviewing potential articles for this client…",
    "Article relevance review complete",
    () => assessSourceRelevance({ env, sources: primaryCandidateSources, sector, subsector, industry, isicCode, tradeRoles, countries, tradeFlow, timeframe, plannedQueries: effectiveQueries }),
    assessment => ({ detail: `${assessment.sources.length} articles retained` })
  );
  audit.sourceReview = sourceAssessment.audit || { candidateCount: primaryCandidateSources.length, reviews: [] };

  const fallbackTriggered = false;
  const mergedSources = sourceAssessment.sources.map((source, index) => ({ ...source, source_number: index + 1 }));

  const extractedAtomicFacts = (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0)
    ? []
    : await stage(
        "fact_extraction",
        "Checking the retained articles for precise facts, dates and geography…",
        "Evidence extraction complete",
        () => extractAtomicNewsFacts({ env, sources: mergedSources }),
        facts => ({ detail: `${facts.length} current facts extracted` })
      );

  if (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0) {
    audit.timings.fact_extraction = 0;
    await emit({ type: "stage", stage: "fact_extraction", status: "skipped", message: "No retained articles required fact extraction" });
  }

  audit.atomicFacts = { extracted: extractedAtomicFacts };

  const flowStarted = Date.now();
  await emit({ type: "stage", stage: "trade_flow_check", status: "running", message: "Checking facts against the client’s actual purchase and sales flows…" });
  const atomicFacts = filterAtomicFactsForDirectionalTradeMeasures(extractedAtomicFacts, tradeFlow);
  const retainedFactIds = new Set(atomicFacts.map(fact => fact.factId));
  const rejectedByTradeFlow = extractedAtomicFacts.filter(fact => !retainedFactIds.has(fact.factId));
  audit.timings.trade_flow_check = Date.now() - flowStarted;
  audit.atomicFacts.retainedAfterTradeFlowCheck = atomicFacts;
  audit.atomicFacts.rejectedByTradeFlowCheck = rejectedByTradeFlow.map(fact => ({ ...fact, rejectionReason: "Directional trade-measure scope did not match the client's actual flow." }));
  await emit({ type: "stage", stage: "trade_flow_check", status: "complete", message: "Client-flow check complete", durationMs: audit.timings.trade_flow_check, detail: rejectedByTradeFlow.length ? `${rejectedByTradeFlow.length} fact(s) removed` : "No flow conflicts found" });

  const generalContext = { points: [] };

  if (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0 || atomicFacts.length === 0) {
    await emit({ type: "stage", stage: "signal_generation", status: "skipped", message: "No sufficiently relevant evidence remained to build a signal" });
    const noNewsReason = (!sourceAssessment.hasRelevantUpdates || mergedSources.length === 0)
      ? "Source relevance review retained no HIGH/MEDIUM current-development sources."
      : (extractedAtomicFacts.length === 0
        ? "Retained sources produced no current atomic facts after fact/date/geography extraction."
        : "All extracted facts were removed by the directional trade-flow applicability check.");
    const noNews = { status: "NO_NEWS", content: normalizeNoNewsText(timeframe) };
    const result = {
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
    };
    audit.finalSelection = { status: "NO_NEWS", reason: noNewsReason };
    return result;
  }

  const rawNewsSection = await stage(
    "signal_generation",
    "Building the strongest Client Signals…",
    "Client Signals ready",
    () => analyzeNewsDevelopments({ env, sources: mergedSources, atomicFacts, sector, subsector, industry, isicCode, tradeRoles, countries, tradeFlow, timeframe, plannedQueries: effectiveQueries, defaultPrompt, conversationGoal, clientProfile, signalThreads }),
    news => ({ detail: news.status === "NO_NEWS" ? "No final signal passed" : "Final signals generated" })
  );
  audit.finalSelection = rawNewsSection.audit || { status: rawNewsSection.status };

  const aligned = alignSourcesToAnalysis({ sources: mergedSources, newsSection: rawNewsSection, timeframe });
  const publicNewsSection = { status: aligned.newsSection.status, content: aligned.newsSection.content };
  const result = {
    analysis: publicNewsSection.content,
    news: publicNewsSection,
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
  };
  audit.finalSelection.publicResult = { status: result.news?.status || "", sourceCount: result.sources.length, content: result.news?.content || "" };
  return result;
}

async function runResearchWithAudit({ context, body, emit }) {
  const { env } = context;
  const runId = createResearchRunId();
  const startedMs = Date.now();
  const audit = {
    schemaVersion: 1,
    runId,
    startedAt: new Date(startedMs).toISOString(),
    models: {
      searchPlanner: getOpenAIBasicModel(env),
      sourceReview: getOpenAIBasicModel(env),
      factExtraction: getOpenAIBasicModel(env),
      basicReasoningEffort: getOpenAIBasicReasoningEffort(env),
      finalSignals: env.OPENAI_ANALYSIS_MODEL || OPENAI_ANALYSIS_MODEL
    },
    timings: {}
  };
  let auditRowCreated = false;

  try {
    const params = normaliseResearchRequest(body, env);
    audit.input = auditInputSnapshot(params);
    let auditStartError = "";
    try {
      auditRowCreated = await insertAuditRun(env, runId, params, audit);
    } catch (auditError) {
      auditStartError = String(auditError?.message || auditError || "Audit insert failed");
      auditRowCreated = false;
    }
    audit.storage = { d1Configured: Boolean(env.AUDIT_DB), rowCreated: auditRowCreated, ...(auditStartError ? { startError: auditStartError } : {}) };
    await emit({ type: "run", status: "started", runId, auditEnabled: auditRowCreated, message: "Research started" });

    const result = await executeResearch({ env, params, audit, emit });
    audit.totalMs = Date.now() - startedMs;
    audit.completedAt = new Date().toISOString();
    audit.status = "COMPLETED";

    if (auditRowCreated) {
      const saveTask = finishAuditRun(env, runId, { status: "COMPLETED", audit, result }).catch(auditError => {
        console.error("Audit save failed", runId, auditError);
      });
      if (typeof context.waitUntil === "function") {
        context.waitUntil(saveTask);
        await emit({ type: "audit", status: "saving", runId });
      } else {
        await saveTask;
        await emit({ type: "audit", status: "saved", runId });
      }
    } else {
      await emit({ type: "audit", status: env.AUDIT_DB ? "save_failed" : "disabled", runId });
    }
    return { runId, result, status: 200 };
  } catch (error) {
    audit.totalMs = Date.now() - startedMs;
    audit.completedAt = new Date().toISOString();
    audit.status = "ERROR";
    audit.error = String(error?.message || error || "Research failed");
    if (auditRowCreated) {
      const saveTask = finishAuditRun(env, runId, { status: "ERROR", audit, error: audit.error }).catch(auditError => {
        console.error("Audit error-state save failed", runId, auditError);
      });
      if (typeof context.waitUntil === "function") context.waitUntil(saveTask);
      else await saveTask;
    }
    const status = error instanceof ResearchRequestError ? error.status : 500;
    await emit({ type: "error", runId, statusCode: status, error: audit.error });
    return { runId, result: { error: audit.error, run_id: runId }, status };
  }
}

function makeNdjsonStreamResponse(context, body) {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let closed = false;
  const emit = async event => {
    if (closed) return;
    try {
      await writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch (_) {
      closed = true;
    }
  };

  const producer = (async () => {
    try {
      const outcome = await runResearchWithAudit({ context, body, emit });
      if (!closed && outcome.status < 400) {
        await emit({ type: "result", runId: outcome.runId, data: outcome.result });
        await emit({ type: "done", runId: outcome.runId, status: "complete" });
      }
    } catch (error) {
      await emit({ type: "error", error: String(error?.message || error || "Unexpected research stream failure") });
    } finally {
      if (!closed) {
        closed = true;
        try { await writer.close(); } catch (_) {}
      }
    }
  })();

  // The response body itself keeps the invocation alive while the participant is connected.
  // waitUntil also ensures the producer is not treated as a floating promise if the platform
  // transitions the request lifecycle while the stream is still being consumed.
  if (typeof context.waitUntil === "function") {
    context.waitUntil(producer.catch(() => {}));
  }

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const url = new URL(context.request.url);
  const wantsStream = url.searchParams.get("stream") === "1" || String(context.request.headers.get("accept") || "").includes("application/x-ndjson");
  if (wantsStream) return makeNdjsonStreamResponse(context, body);

  const outcome = await runResearchWithAudit({ context, body, emit: async () => {} });
  return Response.json(outcome.result, { status: outcome.status });
}
