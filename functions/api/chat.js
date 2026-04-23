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
  return text.toLowerCase().replace(/[^\w\s-]/g, " ");
}

function termMatches(haystack, term) {
  const cleanHaystack = normalizeText(haystack);
  const cleanTerm = normalizeText(term).trim();

  if (!cleanTerm) return false;
  if (cleanHaystack.includes(cleanTerm)) return true;
  if (cleanTerm.endsWith("s") && cleanHaystack.includes(cleanTerm.slice(0, -1))) return true;
  if (cleanHaystack.includes(cleanTerm + "s")) return true;

  return false;
}

function scoreArticle(article, pack) {
  const haystack = `${article.title} ${article.summary}`;
  let score = 0;

  for (const term of pack.primary_keywords || []) {
    if (termMatches(haystack, term)) score += 5;
  }
  for (const term of pack.secondary_keywords || []) {
    if (termMatches(haystack, term)) score += 3;
  }
  for (const term of pack.regulatory_keywords || []) {
    if (termMatches(haystack, term)) score += 4;
  }
  for (const term of pack.company_keywords || []) {
    if (termMatches(haystack, term)) score += 2;
  }
  for (const term of pack.risk_keywords || []) {
    if (termMatches(haystack, term)) score += 3;
  }

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
    .filter(article => article.score > 0);
}

export async function onRequestPost(context) {
  const { request } = context;
  const body = await request.json();

  const industry = body.industry || "";
  const timeframe = body.timeframe || "";
  const situation = body.situation || "";
  const prompt = body.prompt || "";
  const mode = body.mode || "";

  const approvedArticles = getApprovedArticlesForIndustry(industry, timeframe);

  return new Response(
    JSON.stringify({
      mode,
      industry,
      timeframe,
      situation,
      prompt,
      matchedCount: approvedArticles.length,
      matchedTitles: approvedArticles.map(a => a.title)
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}
