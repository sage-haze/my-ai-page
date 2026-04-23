const keywordPacks = {
  banking: {
    primary_keywords: ["bank", "banking", "commercial banking", "retail banking"],
    secondary_keywords: ["deposit", "deposits", "loan", "loan growth", "net interest margin"],
    regulatory_keywords: ["Basel III", "AML", "KYC", "capital requirements", "compliance"],
    company_keywords: ["DBS", "OCBC", "UOB", "HSBC"],
    risk_keywords: ["credit risk", "liquidity risk", "cybersecurity", "operational resilience"],
    exclude_keywords: ["river bank", "blood bank"]
  },
  insurance: {
    primary_keywords: ["insurance", "insurer", "insurers", "life insurance", "general insurance"],
    secondary_keywords: ["premium", "premiums", "claim", "claims", "underwriting"],
    regulatory_keywords: ["solvency", "capital adequacy", "conduct rules"],
    company_keywords: ["AIA", "Prudential", "Great Eastern"],
    risk_keywords: ["catastrophe risk", "fraud", "reinsurance"],
    exclude_keywords: []
  },
  healthcare: {
    primary_keywords: ["healthcare", "hospital", "hospitals", "medical services"],
    secondary_keywords: ["patient care", "health system", "clinical operations"],
    regulatory_keywords: ["FDA", "health regulation", "reimbursement"],
    company_keywords: ["Pfizer", "UnitedHealth", "SingHealth"],
    risk_keywords: ["drug shortages", "cyberattack", "staffing shortage"],
    exclude_keywords: []
  },
  semiconductors: {
    primary_keywords: ["semiconductor", "semiconductors", "chip", "chips", "chipmaking"],
    secondary_keywords: ["foundry", "wafer", "advanced packaging"],
    regulatory_keywords: ["export controls", "industrial policy", "subsidies"],
    company_keywords: ["TSMC", "Intel", "Samsung", "NVIDIA"],
    risk_keywords: ["supply chain", "capacity constraints", "geopolitical risk"],
    exclude_keywords: []
  },
  telecommunications: {
    primary_keywords: ["telecommunications", "telecom", "telecoms", "mobile network"],
    secondary_keywords: ["5G", "broadband", "spectrum"],
    regulatory_keywords: ["spectrum allocation", "telecom regulation", "net neutrality"],
    company_keywords: ["Singtel", "StarHub", "M1"],
    risk_keywords: ["outages", "infrastructure risk", "cybersecurity"],
    exclude_keywords: []
  },
  cybersecurity: {
    primary_keywords: ["cybersecurity", "cyber attack", "cyber defense", "breach", "breaches"],
    secondary_keywords: ["ransomware", "zero-day", "threat intelligence"],
    regulatory_keywords: ["cyber regulation", "data protection", "incident reporting"],
    company_keywords: ["CrowdStrike", "Palo Alto Networks", "Microsoft"],
    risk_keywords: ["breach", "vulnerability", "supply chain attack"],
    exclude_keywords: []
  },
  energy: {
    primary_keywords: ["energy", "power sector", "electricity market", "utility", "utilities"],
    secondary_keywords: ["renewables", "oil and gas", "grid"],
    regulatory_keywords: ["energy policy", "emissions regulation", "carbon pricing"],
    company_keywords: ["Shell", "ExxonMobil", "BP"],
    risk_keywords: ["price volatility", "supply disruption", "grid instability"],
    exclude_keywords: []
  },
  retail: {
    primary_keywords: ["retail", "retailer", "retailers", "consumer spending", "retail sales"],
    secondary_keywords: ["e-commerce", "store traffic", "inventory"],
    regulatory_keywords: ["consumer protection", "pricing regulation", "competition rules"],
    company_keywords: ["Amazon", "Walmart", "Target"],
    risk_keywords: ["margin pressure", "supply chain delays", "weak demand"],
    exclude_keywords: []
  }
};

function daysAgo(days) {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

const MOCK_ARTICLES = [
  {
    title: "Singapore banks tighten compliance controls after new supervisory guidance",
    summary: "Major banks in Singapore are updating internal processes after fresh supervisory expectations on compliance and operational resilience.",
    url: "https://example.com/article-1",
    source: "Approved Finance News",
    published: daysAgo(12)
  },
  {
    title: "Regional lenders invest in AI tooling for risk review and monitoring",
    summary: "Banks across Southeast Asia are increasing spending on AI systems that support monitoring, document review, and internal controls.",
    url: "https://example.com/article-2",
    source: "Approved Banking Journal",
    published: daysAgo(26)
  },
  {
    title: "Chipmakers prepare for tighter export-control enforcement",
    summary: "Semiconductor firms are reassessing supply chains and customer exposure amid discussion of stricter export-control implementation.",
    url: "https://example.com/article-3",
    source: "Approved Tech Policy Daily",
    published: daysAgo(41)
  },
  {
    title: "Insurers respond to higher catastrophe losses with pricing changes",
    summary: "Insurance groups are re-evaluating underwriting and premium strategies after a period of elevated catastrophe-related claims.",
    url: "https://example.com/article-4",
    source: "Approved Insurance Brief",
    published: daysAgo(70)
  },
  {
    title: "Telecom operators step up cybersecurity spending after recent outages",
    summary: "Telecommunications providers are reviewing infrastructure resilience and security investments after several high-profile incidents.",
    url: "https://example.com/article-5",
    source: "Approved Telecom Review",
    published: daysAgo(18)
  },
  {
    title: "Healthcare systems face rising cybersecurity scrutiny after incident reports",
    summary: "Healthcare organizations are reviewing vendor exposure and reporting processes as cyber incidents continue to draw regulatory attention.",
    url: "https://example.com/article-6",
    source: "Approved Healthcare Monitor",
    published: daysAgo(33)
  },
  {
    title: "Retailers report cautious consumer demand and heavier discounting",
    summary: "Retail companies are focusing on inventory discipline and promotions amid uneven consumer demand.",
    url: "https://example.com/article-7",
    source: "Approved Retail Watch",
    published: daysAgo(22)
  },
  {
    title: "Energy firms evaluate grid resilience and supply risks ahead of peak season",
    summary: "Utilities and energy operators are assessing capacity, grid reliability, and procurement strategies.",
    url: "https://example.com/article-8",
    source: "Approved Energy Bulletin",
    published: daysAgo(95)
  }
];

function getCutoffTimestamp(timeframeDays) {
  const days = Number(timeframeDays || 30);
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, " ");
}

function termMatches(haystack, term) {
  const cleanHaystack = normalizeText(haystack);
  const cleanTerm = normalizeText(term).trim();

  if (!cleanTerm) return false;

  if (cleanHaystack.includes(cleanTerm)) return true;

  // very light singular/plural fallback
  if (cleanTerm.endsWith("s") && cleanHaystack.includes(cleanTerm.slice(0, -1))) return true;
  if (cleanHaystack.includes(cleanTerm + "s")) return true;

  return false;
}

function scoreArticle(article, pack) {
  const haystack = `${article.title} ${article.summary}`;

  let score = 0;

  const addScore = (terms, points) => {
    for (const term of terms) {
      if (termMatches(haystack, term)) {
        score += points;
      }
    }
  };

  const hasExcludedTerm = (pack.exclude_keywords || []).some(term =>
    termMatches(haystack, term)
  );

  if (hasExcludedTerm) {
    return -999;
  }

  addScore(pack.primary_keywords || [], 5);
  addScore(pack.secondary_keywords || [], 3);
  addScore(pack.regulatory_keywords || [], 4);
  addScore(pack.company_keywords || [], 2);
  addScore(pack.risk_keywords || [], 3);

  return score;
}

function getApprovedArticlesForIndustry(industry, timeframeDays) {
  const pack = keywordPacks[industry];
  if (!pack) return [];

  const cutoff = getCutoffTimestamp(timeframeDays);

  return MOCK_ARTICLES
    .filter(article => article.published >= cutoff)
    .map(article => ({
      ...article,
      score: scoreArticle(article, pack)
    }))
    .filter(article => article.score > 0)
    .sort((a, b) => b.score - a.score || b.published - a.published)
    .slice(0, 6);
}

function buildNewsAnalysisPrompt({ industry, timeframe, situation, request, articles }) {
  const formattedArticles = articles.map((article, index) => {
    const publishedDate = new Date(article.published).toISOString().slice(0, 10);

    return `
Article ${index + 1}
Title: ${article.title}
Source: ${article.source}
Published: ${publishedDate}
URL: ${article.url}
Summary: ${article.summary}
`.trim();
  }).join("\n\n");

  return `
You are a research assistant.

The user wants analysis based only on approved-source articles already retrieved by the system.

Industry: ${industry}
Timeframe: last ${timeframe} days

User's situation:
${situation}

User's request:
${request}

Approved-source articles:
${formattedArticles}

Instructions:
- Use only the approved-source articles above
- Do not invent or assume other sources
- If the article set is limited, say so clearly
- Prioritize developments most relevant to the user's situation
- Highlight practical implications, not just summaries
- Mention publication recency where relevant

Please produce:
1. A short summary of the most relevant developments
2. 3 to 5 key insights applicable to the user's situation
3. Risks and opportunities
4. A short conclusion
5. A short source list at the end using the article titles and URLs provided
`.trim();
}

function buildGeneralPrompt({ prompt, tone, length, format, audience }) {
  return `
You are a helpful assistant.

Please answer using these settings:
- Tone: ${tone}
- Length: ${length}
- Format: ${format}
- Audience: ${audience}

User request:
${prompt}
`.trim();
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const mode = body.mode || "general";
    const prompt = (body.prompt || "").trim();

    if (!prompt) {
      return new Response("Please type a message first.", { status: 400 });
    }

    let finalPrompt = "";

    if (mode === "approved_news") {
      const industry = body.industry || "";
      const timeframe = body.timeframe || "30";
      const situation = (body.situation || "").trim();

      if (!industry) {
        return new Response("Please select an industry.", { status: 400 });
      }

      if (!situation) {
        return new Response("Please describe your situation.", { status: 400 });
      }

      const approvedArticles = getApprovedArticlesForIndustry(industry, timeframe);

      if (approvedArticles.length === 0) {
        return new Response(
          "No approved-source articles matched this industry and timeframe yet. Try a longer timeframe or a different industry.",
          { status: 400 }
        );
      }

      finalPrompt = buildNewsAnalysisPrompt({
        industry,
        timeframe,
        situation,
        request: prompt,
        articles: approvedArticles
      });
    } else {
      const tone = body.tone || "friendly";
      const length = body.length || "medium";
      const format = body.format || "paragraph";
      const audience = body.audience || "general audience";

      finalPrompt = buildGeneralPrompt({
        prompt,
        tone,
        length,
        format,
        audience
      });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: finalPrompt,
        stream: true
      })
    });

    if (!openaiResponse.ok || !openaiResponse.body) {
      const text = await openaiResponse.text();
      return new Response(text || "OpenAI request failed.", { status: 500 });
    }

    return new Response(openaiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    return new Response("Server error.", { status: 500 });
  }
}
