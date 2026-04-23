const keywordPacks = {
  banking: {
    primary_keywords: ["bank", "banking", "commercial banking", "retail banking"],
    secondary_keywords: ["deposit", "deposits", "loan", "loan growth", "net interest margin"],
    regulatory_keywords: ["Basel III", "AML", "KYC", "capital requirements", "compliance"],
    company_keywords: ["DBS", "OCBC", "UOB", "HSBC"],
    risk_keywords: ["credit risk", "liquidity risk", "cybersecurity", "operational resilience"],
    exclude_keywords: ["river bank", "blood bank"]
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
  }
];

function getCutoffTimestamp(timeframeDays) {
  const days = Number(timeframeDays || 30);
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function normalizeText(text) {
  return String(text || "").toLowerCase();
}

function termMatches(haystack, term) {
  const cleanHaystack = normalizeText(haystack);
  const cleanTerm = normalizeText(term).trim();

  if (!cleanTerm) return false;

  return cleanHaystack.includes(cleanTerm);
}

function scoreArticle(article, pack) {
  const haystack = `${article.title} ${article.summary}`;
  let score = 0;
  const matchedTerms = [];

  for (const term of pack.primary_keywords || []) {
    if (termMatches(haystack, term)) {
      score += 5;
      matchedTerms.push({ term, points: 5, group: "primary" });
    }
  }

  for (const term of pack.secondary_keywords || []) {
    if (termMatches(haystack, term)) {
      score += 3;
      matchedTerms.push({ term, points: 3, group: "secondary" });
    }
  }

  for (const term of pack.regulatory_keywords || []) {
    if (termMatches(haystack, term)) {
      score += 4;
      matchedTerms.push({ term, points: 4, group: "regulatory" });
    }
  }

  for (const term of pack.company_keywords || []) {
    if (termMatches(haystack, term)) {
      score += 2;
      matchedTerms.push({ term, points: 2, group: "company" });
    }
  }

  for (const term of pack.risk_keywords || []) {
    if (termMatches(haystack, term)) {
      score += 3;
      matchedTerms.push({ term, points: 3, group: "risk" });
    }
  }

  return { score, matchedTerms, haystack };
}

export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json();

  const industry = body.industry || "";
  const timeframe = body.timeframe || "";
  const situation = body.situation || "";
  const prompt = body.prompt || "";
  const mode = body.mode || "";

  const pack = keywordPacks[industry];
  const cutoff = getCutoffTimestamp(timeframe);

  const articleDebug = MOCK_ARTICLES.map(article => {
    const scoring = scoreArticle(article, pack);
    return {
      title: article.title,
      published: new Date(article.published).toISOString(),
      passesDateFilter: article.published >= cutoff,
      score: scoring.score,
      matchedTerms: scoring.matchedTerms,
      haystack: scoring.haystack
    };
  });

  const approvedArticles = articleDebug.filter(
    article => article.passesDateFilter && article.score > 0
  );

  return new Response(
    JSON.stringify(
      {
        mode,
        industry,
        timeframe,
        situation,
        prompt,
        cutoffISO: new Date(cutoff).toISOString(),
        articleDebug,
        matchedCount: approvedArticles.length,
        matchedTitles: approvedArticles.map(a => a.title)
      },
      null,
      2
    ),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
