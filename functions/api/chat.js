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

function getSearchKeywords({ sector, subsector }) {
  const manualKeywords = SUBSECTOR_KEYWORD_MAP[subsector] || [];
  const inferredSubsectorKeywords = inferKeywordsFromText(subsector);
  const inferredSectorKeywords = inferKeywordsFromText(sector);

  return uniqueArray([
    ...manualKeywords,
    ...inferredSubsectorKeywords,
    ...inferredSectorKeywords
  ]).slice(0, 20);
}

function cleanQueryText(text) {
  return String(text || "")
    .replace(/[^a-zA-Z0-9\s&+.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 350);
}

function roleText(tradeRoles) {
  if (tradeRoles.includes("importer") && tradeRoles.includes("exporter")) {
    return "Thailand importer exporter overseas suppliers buyers";
  }
  if (tradeRoles.includes("importer")) {
    return "Thailand importer overseas suppliers input costs";
  }
  if (tradeRoles.includes("exporter")) {
    return "Thailand exporter overseas buyers demand";
  }
  return "Thailand import export trade";
}

function exposureTextForRole(tradeRoles, countries) {
  const countryNames = countries.map(country => country.name).filter(Boolean).slice(0, 4);
  if (countryNames.length === 0) return "overseas markets";

  const markets = countryNames.join(" ");
  if (tradeRoles.includes("importer") && tradeRoles.includes("exporter")) {
    return `Thailand trade exposure ${markets} overseas suppliers buyers`;
  }
  if (tradeRoles.includes("importer")) {
    return `Thailand sourcing exposure ${markets} overseas suppliers`;
  }
  if (tradeRoles.includes("exporter")) {
    return `Thailand export market exposure ${markets} overseas buyers demand`;
  }
  return `Thailand market exposure ${markets}`;
}

function buildFallbackQueries({ sector, subsector, industry, tradeRoles, countries, deepSearch }) {
  const baseKeywords = getSearchKeywords({ sector, subsector }).slice(0, 4).join(" ");
  const thaiRoleLens = roleText(tradeRoles);
  const exposureLens = exposureTextForRole(tradeRoles, countries);

  const queries = [
    {
      label: "thai_client_context",
      query: cleanQueryText(`Thailand ${industry} ${thaiRoleLens} news`),
      maxResults: 5
    },
    {
      label: "global_industry_context",
      query: cleanQueryText(`${industry} global supply chain demand prices trade news`),
      maxResults: 5
    }
  ];

  if (deepSearch) {
    queries.push(
      {
        label: "thai_exposure_context",
        query: cleanQueryText(`${industry} ${exposureLens} trade flows news`),
        maxResults: 5
      },
      {
        label: "risk_finance_context",
        query: cleanQueryText(`${industry} ${baseKeywords} logistics tariffs payment risk working capital news`),
        maxResults: 5
      }
    );
  }

  return queries;
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
      .slice(0, 4);
  } catch (_) {
    return null;
  }
}

async function planTavilyQueries({ env, sector, subsector, industry, tradeRoles, countries, timeframe, deepSearch }) {
  const fallbackQueries = buildFallbackQueries({ sector, subsector, industry, tradeRoles, countries, deepSearch });
  const countryText = countries.map(country => country.label || `${country.name} (${country.code})`).join(", ");
  const targetCount = deepSearch ? 4 : 2;

  const plannerPrompt = `
Create ${targetCount} short Tavily news search queries for a Thailand-based bank RM.

Customer profile:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Client trade role: ${tradeRoles.join(", ")}
- Exposure countries / markets: ${countryText}
- Timeframe: last ${timeframe} days

Goal:
Generate a mix of Thailand-prioritised and broader industry searches. Selected countries are exposure markets for the Thai client, not countries to cross-combine with each other.

Rules:
- Return JSON only.
- Tavily is keyword search, not reasoning. Keep each query short and keyword-style.
- Use Industry as the main anchor.
- Use sector/subsector as context, not as the main anchor.
- Prioritise Thailand-related news first, then global industry news.
- Generate queries with DIFFERENT strictness levels:
  1. One Thailand/client-context query. This should include Thailand, the industry, and the Thai importer/exporter lens.
  2. One broader global industry query. This should NOT include Thailand and should usually NOT include the selected countries.
  3. In Deep Search only, add one Thailand exposure-market query and one risk/supply-chain/trade-finance query.
- Do NOT create country-pair or country-combination searches such as "China Indonesia", "US Indonesia", or "China exports Indonesia" unless Thailand is explicitly the subject of the trade flow.
- If exporter is selected, this means a Thai client exports to overseas buyers/markets. Search for Thai export-market demand, buyer demand, pricing, logistics, or trade restrictions that affect Thai exporters.
- If importer is selected, this means a Thai client imports from overseas suppliers/markets. Search for Thai sourcing, supplier costs, supply chain, logistics, or trade restrictions that affect Thai importers.
- Selected countries may appear in only ONE Thailand-centered exposure query; do not force them into every query.
- Avoid over-constraining every query with all countries, role words, sector, and Thailand at the same time.
- Avoid prompts, questions, and long sentences.
- Each query must be under 180 characters.
- Use maxResults 5 for each query.

JSON shape:
{
  "queries": [
    { "label": "strict_client_context", "query": "...", "maxResults": 5 },
    { "label": "broader_industry_context", "query": "...", "maxResults": 5 }
  ]
}`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: plannerPrompt
      })
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

function dedupeSources(items) {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    if (!item.url) continue;
    if (seen.has(item.url)) continue;

    seen.add(item.url);
    deduped.push(item);
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

async function fetchYahooSeries(pair) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=7d`;

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

async function fetchYahooFxRate(baseCurrency) {
  if (baseCurrency === "THB") {
    return {
      skip: true,
      base: "THB"
    };
  }

  if (baseCurrency === "CNY") {
    const [usdThb, usdCny] = await Promise.all([
      fetchYahooSeries("USDTHB=X"),
      fetchYahooSeries("USDCNY=X")
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
  const series = await fetchYahooSeries(pair);

  return summarizeFxSeries({
    base: baseCurrency,
    pair,
    series,
    source: "Yahoo Finance (prototype)"
  });
}

async function fetchFxRates(currencies) {
  const uniqueCurrencies = [...new Set(currencies)];

  return Promise.all(
    uniqueCurrencies.map(currency =>
      fetchYahooFxRate(currency).catch(error => ({
        skip: false,
        base: currency,
        quote: "THB",
        error: error.message || "FX lookup failed."
      }))
    )
  );
}

async function analyzeFxRates({ env, fxList, sector = "", subsector = "", industry = "", tradeRoles = [], countries = [] }) {
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
- Specific industry: ${industry}
- Client trade role: ${tradeRoles.join(", ")}
- Exposure countries / markets: ${countryText}

Use only the 7-day FX data below. For each pair, write two concise sentences.
Sentence 1: observed FX movement, latest level versus the 7-day range, and whether the base currency strengthened or weakened against THB.
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
        model: "gpt-4.1-mini",
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

function sourcePriority(source) {
  const levelScore = source.relevance_level === "HIGH" ? 100 : source.relevance_level === "MEDIUM" ? 50 : 0;
  const thaiScore = isThailandRelatedSource(source) ? 30 : 0;
  const groupScore = String(source.source_group || "").includes("thai") ? 10 : 0;
  const tavilyScore = Math.min(Number(source.score || 0) * 10, 10);
  return levelScore + thaiScore + groupScore + tavilyScore;
}

async function assessSourceRelevance({ env, sources, sector, subsector, industry, tradeRoles, countries, timeframe, plannedQueries }) {
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

  const compactSources = sources.map(source => {
    const text = source.raw_content || source.summary || "";
    const trimmedText = text.length > 1200 ? text.slice(0, 1200) + "…" : text;

    return {
      number: source.source_number,
      title: source.title,
      publisher: source.domain || source.source || "Unknown",
      published: source.published_at || "Unknown",
      source_group: source.source_group,
      snippet: trimmedText
    };
  });

  const prompt = `
You are a source selection reviewer for a Thailand-based bank relationship manager.

Customer profile:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Client trade role: ${tradeRoles.join(", ")}
- Client base: Thailand
- Exposure countries / markets: ${countryText}
- Timeframe: last ${timeframe} days
- Tavily queries used: ${plannedQueries.map(plan => `${plan.label}: ${plan.query}`).join(" | ")}

Task:
Review the candidate news sources and classify their usefulness for a Thailand-based bank RM.
Prioritise sources in this order:
1. Thailand-related news connected to the industry, Thai company flows, Thai supply chains, Thai import/export activity, or Thai macro/trade policy.
2. Global industry news that clearly affects demand, pricing, supply chain, logistics, trade policy, working capital, payment risk, or counterparty risk for a Thailand-based client.
3. Selected-country news only when it clearly affects Thailand-based sourcing, export demand, buyer/supplier conditions, logistics, pricing, or trade risk.

A useful source must have a clear client implication. It is not enough that the article mentions a selected country, exporter/importer, or broad sector keyword.
Interpret importer/exporter strictly from the Thailand-based client's perspective; for example, China/US/Indonesia should be treated as exposure markets/sources/destinations, not as exporters/importers themselves unless that directly affects Thai client flows.
Country-cross results, such as China-Indonesia, US-Indonesia, or China-US stories, should be LOW unless they have a clear Thailand or global industry implication for the client.
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
        model: "gpt-4.1-mini",
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
      .sort((a, b) => sourcePriority(b) - sourcePriority(a));
    const mediumSources = reviewedSources
      .filter(source => source.relevance_level === "MEDIUM")
      .sort((a, b) => sourcePriority(b) - sourcePriority(a));
    const selectedSources = [...highSources, ...mediumSources]
      .sort((a, b) => sourcePriority(b) - sourcePriority(a))
      .slice(0, 10);

    const hasRelevantUpdates = Boolean(parsed.hasRelevantUpdates) && selectedSources.length > 0;

    return {
      hasRelevantUpdates,
      noRelevantUpdateMessage: String(parsed.noRelevantUpdateMessage || `No relevant news updates were found in the selected ${timeframe}-day period for this client profile.`).trim(),
      sources: selectedSources
    };
  } catch (_) {
    const fallbackSources = sources
      .filter(source => isThailandRelatedSource(source) || String(source.source_group || "").includes("global"))
      .sort((a, b) => sourcePriority(b) - sourcePriority(a))
      .slice(0, 6)
      .map(source => ({
        ...source,
        relevant: true,
        relevance_level: isThailandRelatedSource(source) ? "HIGH" : "MEDIUM",
        relevance_justification: isThailandRelatedSource(source)
          ? "Relevant because it connects directly to Thailand and the client context."
          : "Relevant because it provides global industry context for the client's trade discussion."
      }));

    return {
      hasRelevantUpdates: fallbackSources.length > 0,
      noRelevantUpdateMessage: `No significant relevant news updates were found in the selected ${timeframe}-day period for this client profile.`,
      sources: fallbackSources
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


async function analyzeNewsDevelopments({ env, sources, sector, subsector, industry, tradeRoles, countries, timeframe, deepSearch, plannedQueries, defaultPrompt }) {
  if (!sources.length) {
    return {
      status: "NO_NEWS",
      content: `No significant or relevant market developments identified for this industry and client context in the selected ${timeframe}-day period.`
    };
  }

  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");

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
Relevance reviewer note: ${source.relevance_justification || ""}
Content:
${trimmedText}
`.trim();
  }).join("\n\n");

  const prompt = `
You are an analyst supporting a Thailand-based relationship manager.

The user prompt/context is:
${defaultPrompt}

Customer profile:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Client trade role: ${tradeRoles.join(", ")}
- Client base: Thailand
- Countries / markets relevant to the client: ${countryText}
- Timeframe for news search: last ${timeframe} days
- Search mode: ${deepSearch ? "Deep Search" : "Standard Search"}
- Tavily queries used: ${plannedQueries.map(plan => `${plan.label}: ${plan.query}`).join(" | ")}

Task:
Generate NEWS-BASED market developments only from the provided sources.

Strict rules:
- Use ONLY the provided sources.
- Do NOT add general industry knowledge, background assumptions, or evergreen commentary.
- Do NOT infer beyond what the sources directly support.
- Do NOT analyze FX rate movements; FX commentary is generated separately.
- If the sources do not contain meaningful, recent developments relevant to this Thailand-based client context, return exactly: NO_NEWS
- Be assertive. Do not create generic filler just to produce themes.
- Each theme must be tied to source references like [1], [2].
- Each theme should be relevant to trade finance, such as import/export flows, supply chain disruption, working capital, payment risk, guarantees, letters of credit, documentary collections, receivables, inventory financing, or counterparty risk.
- Treat selected countries as exposure markets/sourcing markets for the Thai client, not as countries to cross-combine with each other.

Output format if relevant:
Theme 1: [Short news-based heading]
[One short paragraph explaining why this current development matters to the Thailand-based client.]
Supporting information:
- [Specific source-backed point with source reference like [1]]
- [Specific source-backed point with source reference like [2]]

Theme 2: ...

Output format if not relevant:
NO_NEWS

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
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI news analysis request failed.");
    }

    const text = (extractOutputText(data) || "").trim();

    if (!text || text.toUpperCase() === "NO_NEWS") {
      return {
        status: "NO_NEWS",
        content: `No significant or relevant market developments identified for this industry and client context in the selected ${timeframe}-day period.`
      };
    }

    return {
      status: "OK",
      content: text
    };
  } catch (error) {
    throw error;
  }
}

async function generateGeneralContext({ env, sector, subsector, industry, tradeRoles, countries }) {
  const countryText = countries
    .map(country => country.label || `${country.name} (${country.code})`)
    .join(", ");

  const prompt = `
You are supporting a Thailand-based relationship manager.

Provide up to 3 broader industry context points for this client profile.

Client context:
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Client trade role: ${tradeRoles.join(", ")}
- Client base: Thailand
- Exposure countries / markets: ${countryText}

Rules:
- Do NOT reference specific news, source numbers, articles, or dates.
- Do NOT claim something is currently happening.
- Focus on structural patterns relevant to the client, such as trade flows, FX exposure, working capital, supply chain, payment risk, and counterparty risk.
- Keep each point practical for a bank RM conversation.
- Maximum 3 points.
- Each point should be 1–2 concise sentences.

Output format:
1. ...
2. ...
3. ...
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) return "";

    return (extractOutputText(data) || "").trim();
  } catch (_) {
    return "";
  }
}


export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const sector = (body.sector || "").trim();
    const subsector = (body.subsector || "").trim();
    const industry = (body.industry || "").trim();
    const timeframe = (body.timeframe || "30").trim();
    const tradeRoles = Array.isArray(body.tradeRoles)
      ? body.tradeRoles.map(role => String(role).toLowerCase()).filter(role => ["importer", "exporter"].includes(role))
      : [];
    const deepSearch = Boolean(body.deepSearch);
    const currencies = Array.isArray(body.currencies)
      ? body.currencies.map(c => String(c).toUpperCase())
      : [];
    const countries = Array.isArray(body.countries) ? body.countries : [];
    const defaultPrompt = (body.defaultPrompt || "").trim();

    if (!sector) return Response.json({ error: "Please select a sector." }, { status: 400 });
    if (!subsector) return Response.json({ error: "Please select a subsector." }, { status: 400 });
    if (!industry) return Response.json({ error: "Please enter the client's industry." }, { status: 400 });
    if (tradeRoles.length === 0) return Response.json({ error: "Please select whether the client is an importer, exporter, or both." }, { status: 400 });
    if (currencies.length === 0) return Response.json({ error: "Please select at least one currency." }, { status: 400 });
    if (countries.length === 0) return Response.json({ error: "Please select at least one country / market." }, { status: 400 });
    if (!defaultPrompt) return Response.json({ error: "Please enter a default prompt." }, { status: 400 });

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
    const searchKeywords = getSearchKeywords({ sector, subsector });
    const plannedQueries = await planTavilyQueries({
      env,
      sector,
      subsector,
      industry,
      tradeRoles,
      countries,
      timeframe,
      deepSearch
    });

    const searchDepth = deepSearch ? "advanced" : "basic";

    const [tavilyBatches, rawFxResults] = await Promise.all([
      Promise.all(plannedQueries.map(plan =>
        tavilySearch({
          apiKey: env.TAVILY_API_KEY,
          query: plan.query,
          startDate: start_date,
          endDate: end_date,
          includeDomains: null,
          maxResults: plan.maxResults || (deepSearch ? 4 : 5),
          searchDepth
        }).then(results => normalizeTavilyResults(results, plan.label))
      )),
      fetchFxRates(currencies)
    ]);

    const fxResults = await analyzeFxRates({ env, fxList: rawFxResults, sector, subsector, industry, tradeRoles, countries });

    const allCandidateSources = dedupeSources(tavilyBatches.flat())
      .sort((a, b) => {
        const aThai = isThailandRelatedSource(a) ? 1 : 0;
        const bThai = isThailandRelatedSource(b) ? 1 : 0;
        const aThaiGroup = String(a.source_group || "").includes("thai") ? 1 : 0;
        const bThaiGroup = String(b.source_group || "").includes("thai") ? 1 : 0;
        return bThai - aThai || bThaiGroup - aThaiGroup || (b.score || 0) - (a.score || 0);
      });

    // Keep the review pool balanced so selected-country/global searches do not crowd out Thailand-related sources.
    const candidateLimit = deepSearch ? 12 : 10;
    const perGroupLimit = deepSearch ? 4 : 5;
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

    const candidateSources = balancedCandidates
      .map((source, index) => ({
        ...source,
        source_number: index + 1
      }));

    const sourceAssessment = await assessSourceRelevance({
      env,
      sources: candidateSources,
      sector,
      subsector,
      industry,
      tradeRoles,
      countries,
      timeframe,
      plannedQueries
    });

    const mergedSources = sourceAssessment.sources.map((source, index) => ({
      ...source,
      source_number: index + 1
    }));

    const generalContext = await generateGeneralContext({
      env,
      sector,
      subsector,
      industry,
      tradeRoles,
      countries
    });

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
        search_queries: plannedQueries,
        search_mode: deepSearch ? "deep" : "standard",
        sources: []
      });
    }

    const newsSection = await analyzeNewsDevelopments({
      env,
      sources: mergedSources,
      sector,
      subsector,
      industry,
      tradeRoles,
      countries,
      timeframe,
      deepSearch,
      plannedQueries,
      defaultPrompt
    });

    return Response.json({
      analysis: newsSection.content,
      news: newsSection,
      context: generalContext,
      no_relevant_updates: newsSection.status === "NO_NEWS",
      fx: fxResults,
      search_keywords: searchKeywords,
      search_queries: plannedQueries,
      search_mode: deepSearch ? "deep" : "standard",
      sources: newsSection.status === "NO_NEWS" ? [] : mergedSources.map(source => ({
        number: source.source_number,
        title: source.title,
        url: source.url,
        source: source.source,
        domain: source.domain,
        published_at: source.published_at,
        source_group: source.source_group,
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
