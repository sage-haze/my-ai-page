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
    "Thai commercial bank",
    "Thailand banking",
    "Bank of Thailand",
    "BOT regulation",
    "digital banking",
    "loan growth",
    "credit risk",
    "NPL",
    "capital adequacy",
    "compliance"
  ],
  "Restricted bank": [
    "restricted bank Thailand",
    "Bank of Thailand",
    "banking license",
    "banking regulation",
    "financial supervision"
  ],
  "Branches of foreign bank": [
    "foreign bank branch Thailand",
    "cross-border banking",
    "Bank of Thailand",
    "foreign bank regulation",
    "capital requirements"
  ],
  "Foreign bank": [
    "foreign bank Thailand",
    "international banking",
    "cross-border finance",
    "Bank of Thailand",
    "foreign bank regulation"
  ],
  "Retail bank": [
    "retail banking",
    "consumer banking",
    "digital banking",
    "deposits",
    "personal loans",
    "mortgages"
  ],
  "Insurance, reinsurance and pension funding, except compulsory social security": [
    "insurance Thailand",
    "reinsurance",
    "insurance regulation",
    "premiums",
    "claims",
    "solvency",
    "risk management"
  ],
  "Reinsurance (life)": [
    "life reinsurance",
    "insurance risk",
    "actuarial risk",
    "life insurance",
    "capital adequacy"
  ],
  "Reinsurance (non-life)": [
    "non-life reinsurance",
    "property casualty insurance",
    "catastrophe risk",
    "claims",
    "underwriting"
  ],
  "Securities company": [
    "securities company",
    "brokerage",
    "capital markets",
    "stock exchange",
    "securities regulation"
  ],
  "Asset management": [
    "asset management",
    "fund management",
    "investment management",
    "mutual funds",
    "portfolio management"
  ],
  "Manufacture of computer, electronic and optical products": [
    "electronics manufacturing",
    "semiconductors",
    "supply chain",
    "exports",
    "Thailand electronics",
    "chip components"
  ],
  "Manufacture of motor vehicles, trailers and semi-trailers": [
    "automotive manufacturing",
    "electric vehicles",
    "EV supply chain",
    "auto parts",
    "vehicle production"
  ],
  "Manufacture of chemicals and chemical products": [
    "chemical manufacturing",
    "petrochemicals",
    "industrial chemicals",
    "chemical exports",
    "feedstock prices"
  ],
  "Manufacture of food products": [
    "food manufacturing",
    "food processing",
    "agri-food",
    "food exports",
    "commodity prices"
  ],
  "Real estate development for condominium and flat for sale": [
    "condominium market",
    "Thailand property",
    "real estate development",
    "housing demand",
    "property regulation"
  ],
  "Real estate development for residential housing": [
    "residential real estate",
    "housing market",
    "property development",
    "mortgage demand",
    "Thailand housing"
  ],
  "Office building business for sale and rent": [
    "office real estate",
    "office leasing",
    "commercial property",
    "occupancy rates",
    "workplace demand"
  ],
  "Shopping center business and department store for sale and rent": [
    "shopping mall",
    "retail property",
    "department store",
    "consumer spending",
    "foot traffic"
  ],
  "Construction of private residential housing": [
    "residential construction",
    "housing construction",
    "construction costs",
    "building permits",
    "Thailand property"
  ],
  "Construction of private condominium": [
    "condominium construction",
    "property development",
    "residential construction",
    "construction costs",
    "housing demand"
  ],
  "Civil engineering": [
    "infrastructure",
    "civil engineering",
    "public works",
    "transport infrastructure",
    "construction contracts"
  ],
  "Computer programming, consultancy and related activities": [
    "software services",
    "IT consulting",
    "digital transformation",
    "cloud services",
    "cybersecurity",
    "AI adoption"
  ],
  "Telecommunications": [
    "telecom",
    "5G",
    "mobile network",
    "spectrum",
    "broadband",
    "network infrastructure"
  ],
  "Electricity, gas, steam and air conditioning supply": [
    "electricity market",
    "power generation",
    "energy prices",
    "grid reliability",
    "renewable energy",
    "utilities"
  ],
  "Water collection, treatment and supply": [
    "water supply",
    "water infrastructure",
    "utilities",
    "water treatment",
    "drought risk"
  ],
  "Food and beverage service activities": [
    "restaurants",
    "food service",
    "consumer spending",
    "tourism",
    "operating costs",
    "food inflation"
  ],
  "Accommodation": [
    "hotel industry",
    "tourism",
    "hospitality",
    "occupancy rates",
    "travel demand"
  ],
  "Air transport": [
    "aviation",
    "airlines",
    "air cargo",
    "passenger traffic",
    "airport operations"
  ],
  "Warehousing and support activities for transportation": [
    "logistics",
    "warehousing",
    "supply chain",
    "freight",
    "transport infrastructure"
  ],
  "Human health activities": [
    "healthcare",
    "hospitals",
    "medical services",
    "health regulation",
    "patient care"
  ],
  "Education": [
    "education sector",
    "schools",
    "universities",
    "edtech",
    "education policy"
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

async function tavilySearch({ apiKey, query, startDate, endDate, includeDomains = null, maxResults = 5 }) {
  const body = {
    query,
    topic: "news",
    search_depth: "advanced",
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
    throw new Error(data.detail || data.error || "Tavily search failed.");
  }

  return data.results || [];
}

function buildQuery({ sector, subsector, topic }) {
  const keywords = getSearchKeywords({ sector, subsector });

  return uniqueArray([
    topic,
    subsector,
    sector,
    "Thailand",
    "latest news",
    ...keywords
  ]).join(" ");
}

function buildArticleContext(sources) {
  return sources.map((source, index) => {
    const text = source.raw_content || source.summary || "";
    const trimmedText = text.length > 2500 ? text.slice(0, 2500) + "…" : text;

    return `
Source ${index + 1}
Title: ${source.title}
URL: ${source.url}
Publisher: ${source.domain || source.source || "Unknown"}
Published: ${source.published_at || "Unknown"}
Source type: ${source.source_group}
Content:
${trimmedText}
`.trim();
  }).join("\n\n");
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

async function fetchYahooFxRate(baseCurrency) {
  if (baseCurrency === "THB") {
    return {
      skip: true,
      base: "THB"
    };
  }

  const pair = `${baseCurrency}THB=X`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=7d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error("Yahoo Finance FX request failed.");
  }

  const result = data?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const prices = result?.indicators?.quote?.[0]?.close || [];

  if (!timestamps.length || !prices.length) {
    throw new Error("No FX time series data returned.");
  }

  const series = timestamps
    .map((ts, i) => {
      const rate = prices[i];
      if (typeof rate !== "number") return null;

      return {
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        rate: Number(rate.toFixed(4))
      };
    })
    .filter(Boolean);

  if (series.length === 0) {
    throw new Error("No usable FX points returned.");
  }

  const latest = series[series.length - 1];
  const highest = series.reduce((max, item) => item.rate > max.rate ? item : max, series[0]);
  const lowest = series.reduce((min, item) => item.rate < min.rate ? item : min, series[0]);

  return {
    skip: false,
    base: baseCurrency,
    quote: "THB",
    pair,
    series,
    latest_rate: latest.rate.toFixed(4),
    highest_rate: highest.rate.toFixed(4),
    highest_date: highest.date,
    lowest_rate: lowest.rate.toFixed(4),
    lowest_date: lowest.date,
    source: "Yahoo Finance (prototype)",
    retrieved_at: new Date().toISOString()
  };
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

function buildFxInstruction(fxList) {
  const usableFx = fxList.filter(fx => !fx.skip && !fx.error);

  if (usableFx.length === 0) {
    return "No non-THB FX conversion data is available or needed.";
  }

  return usableFx.map(fx =>
    `${fx.pair}: latest ${fx.latest_rate}, 7-day high ${fx.highest_rate} on ${fx.highest_date}, 7-day low ${fx.lowest_rate} on ${fx.lowest_date}.`
  ).join("\n");
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const sector = (body.sector || "").trim();
    const subsector = (body.subsector || "").trim();
    const timeframe = (body.timeframe || "30").trim();
    const currencies = Array.isArray(body.currencies)
      ? body.currencies.map(c => String(c).toUpperCase())
      : [];
    const topic = (body.topic || "").trim();
    const situation = (body.situation || "").trim();
    const prompt = (body.prompt || "").trim();

    if (!sector) return Response.json({ error: "Please select a sector." }, { status: 400 });
    if (!subsector) return Response.json({ error: "Please select a subsector." }, { status: 400 });
    if (currencies.length === 0) return Response.json({ error: "Please select at least one currency." }, { status: 400 });
    if (!topic) return Response.json({ error: "Please enter a topic / company / issue." }, { status: 400 });
    if (!situation) return Response.json({ error: "Please describe your situation." }, { status: 400 });
    if (!prompt) return Response.json({ error: "Please describe what you want the analysis to focus on." }, { status: 400 });

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
    const query = buildQuery({ sector, subsector, topic });

    const [approvedResults, broadResults, fxResults] = await Promise.all([
      tavilySearch({
        apiKey: env.TAVILY_API_KEY,
        query,
        startDate: start_date,
        endDate: end_date,
        includeDomains: DEFAULT_APPROVED_DOMAINS,
        maxResults: 5
      }),
      tavilySearch({
        apiKey: env.TAVILY_API_KEY,
        query,
        startDate: start_date,
        endDate: end_date,
        includeDomains: null,
        maxResults: 8
      }),
      fetchFxRates(currencies)
    ]);

    const approvedSources = normalizeTavilyResults(approvedResults, "approved");
    const broadSources = normalizeTavilyResults(broadResults, "broad");

    const mergedSources = dedupeSources([...approvedSources, ...broadSources])
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);

    if (mergedSources.length === 0) {
      return Response.json({
        error: "No recent sources were found for that topic and timeframe."
      }, { status: 400 });
    }

    const articleContext = buildArticleContext(mergedSources);
    const fxInstruction = buildFxInstruction(fxResults);

    const analysisPrompt = `
You are a research assistant.

Analyze the news sources provided below for the user's situation.

Sector: ${sector}
Subsector: ${subsector}
Timeframe: last ${timeframe} days
Topic: ${topic}
Search keywords used: ${searchKeywords.join(", ")}
Selected currencies: ${currencies.join(", ")}

User's situation:
${situation}

Requested focus:
${prompt}

Additional FX context:
${fxInstruction}

Instructions:
- Use only the provided news sources below for the news analysis
- Do not invent additional sources
- If evidence is mixed or incomplete, say so clearly
- Prioritize practical implications for the user's situation
- Separate signal from noise
- Mention source recency where relevant
- Do not repeat long source lists inside the analysis; the UI shows sources separately
- If FX movements are relevant, mention them briefly and carefully as supporting context

Please write:
1. A short summary of the main developments
2. 3 to 5 key insights for the user's situation
3. Risks
4. Opportunities
5. A short bottom-line conclusion

Provided sources:
${articleContext}
`.trim();

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: analysisPrompt
      })
    });

    const openaiData = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return Response.json({
        error: openaiData.error?.message || "OpenAI request failed."
      }, { status: 500 });
    }

    return Response.json({
      analysis: extractOutputText(openaiData) || "No analysis returned.",
      fx: fxResults,
      search_keywords: searchKeywords,
      sources: mergedSources.map(source => ({
        title: source.title,
        url: source.url,
        source: source.source,
        domain: source.domain,
        published_at: source.published_at,
        source_group: source.source_group
      }))
    });
  } catch (error) {
    return Response.json({
      error: error.message || "Server error."
    }, { status: 500 });
  }
}
