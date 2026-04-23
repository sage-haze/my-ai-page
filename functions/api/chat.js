const APPROVED_DOMAIN_MAP = {
  banking: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "wsj.com",
    "mas.gov.sg",
    "bis.org"
  ],
  insurance: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "insurancebusinessmag.com",
    "iaisweb.org"
  ],
  healthcare: [
    "reuters.com",
    "statnews.com",
    "fiercehealthcare.com",
    "who.int",
    "fda.gov"
  ],
  semiconductors: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "digitimes.com",
    "tomshardware.com"
  ],
  telecommunications: [
    "reuters.com",
    "lightreading.com",
    "fierce-network.com",
    "telecoms.com"
  ],
  cybersecurity: [
    "reuters.com",
    "therecord.media",
    "bleepingcomputer.com",
    "securityweek.com",
    "cisa.gov"
  ],
  energy: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "spglobal.com",
    "iea.org"
  ],
  retail: [
    "reuters.com",
    "bloomberg.com",
    "ft.com",
    "retaildive.com",
    "chainstoreage.com"
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

function buildQuery({ industry, topic }) {
  return `${topic} ${industry} latest developments`;
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

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const industry = (body.industry || "").trim();
    const timeframe = (body.timeframe || "30").trim();
    const topic = (body.topic || "").trim();
    const situation = (body.situation || "").trim();
    const prompt = (body.prompt || "").trim();

    if (!industry) {
      return Response.json({ error: "Please select an industry." }, { status: 400 });
    }

    if (!topic) {
      return Response.json({ error: "Please enter a topic / company / issue." }, { status: 400 });
    }

    if (!situation) {
      return Response.json({ error: "Please describe your situation." }, { status: 400 });
    }

    if (!prompt) {
      return Response.json({ error: "Please describe what you want the analysis to focus on." }, { status: 400 });
    }

    if (!env.TAVILY_API_KEY) {
      return Response.json({ error: "Missing TAVILY_API_KEY secret in Cloudflare." }, { status: 500 });
    }

    if (!env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY secret in Cloudflare." }, { status: 500 });
    }

    const { start_date, end_date } = getDateRange(timeframe);
    const approvedDomains = APPROVED_DOMAIN_MAP[industry] || [];
    const query = buildQuery({ industry, topic });

    const approvedResults = await tavilySearch({
      apiKey: env.TAVILY_API_KEY,
      query,
      startDate: start_date,
      endDate: end_date,
      includeDomains: approvedDomains,
      maxResults: 5
    });

    const broadResults = await tavilySearch({
      apiKey: env.TAVILY_API_KEY,
      query,
      startDate: start_date,
      endDate: end_date,
      includeDomains: null,
      maxResults: 8
    });

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

    const analysisPrompt = `
You are a research assistant.

Analyze the news sources provided below for the user's situation.

Industry: ${industry}
Timeframe: last ${timeframe} days
Topic: ${topic}

User's situation:
${situation}

Requested focus:
${prompt}

Instructions:
- Use only the provided sources below
- Do not invent additional sources
- If evidence is mixed or incomplete, say so clearly
- Prioritize practical implications for the user's situation
- Separate signal from noise
- Mention source recency when relevant
- Do not repeat long source lists inside the analysis; the UI shows sources separately

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

    const analysis = extractOutputText(openaiData);

    return Response.json({
      analysis: analysis || "No analysis returned.",
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
