async function testJsonFetch(url, options = {}) {
  const started = Date.now();
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    return {
      ok: response.ok,
      status: response.status,
      ms: Date.now() - started,
      sample: summarizePayload(data || text)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: error?.message || String(error)
    };
  }
}

function summarizePayload(payload) {
  if (payload === null || payload === undefined) return "No payload";
  if (typeof payload === "string") return payload.slice(0, 180);
  if (Array.isArray(payload)) return `Array(${payload.length})`;
  if (payload?.chart?.result) return `chart.result: ${payload.chart.result.length}`;
  return Object.keys(payload).slice(0, 8).join(", ") || "Object";
}

async function checkTavily(env) {
  return {
    configured: Boolean(env.TAVILY_API_KEY),
    ok: Boolean(env.TAVILY_API_KEY),
    message: env.TAVILY_API_KEY ? "Configured" : "Missing TAVILY_API_KEY"
  };
}

async function checkOpenAI(env) {
  const basicModel = String(env.OPENAI_BASIC_MODEL || "").trim() || "gpt-5.6-luna";
  const analysisModel = String(env.OPENAI_ANALYSIS_MODEL || "").trim() || "gpt-4.1";
  const basicReasoningEffort = String(env.OPENAI_BASIC_REASONING_EFFORT || "").trim().toLowerCase() || "none";
  return {
    configured: Boolean(env.OPENAI_API_KEY),
    ok: Boolean(env.OPENAI_API_KEY),
    message: env.OPENAI_API_KEY ? "Configured" : "Missing OPENAI_API_KEY",
    models: {
      basic: {
        model: basicModel,
        reasoningEffort: basicReasoningEffort,
        configuredBy: env.OPENAI_BASIC_MODEL ? "OPENAI_BASIC_MODEL" : "code default",
        reasoningConfiguredBy: env.OPENAI_BASIC_REASONING_EFFORT ? "OPENAI_BASIC_REASONING_EFFORT" : "code default"
      },
      analysis: {
        model: analysisModel,
        configuredBy: env.OPENAI_ANALYSIS_MODEL ? "OPENAI_ANALYSIS_MODEL" : "code default"
      }
    }
  };
}

async function checkYahooFinance() {
  const result = await testJsonFetch(
    "https://query1.finance.yahoo.com/v8/finance/chart/USDTHB=X?interval=1d&range=5d",
    { headers: { "User-Agent": "conversation-builder/1.0" } }
  );
  return {
    configured: true,
    ...result,
    message: result.ok ? "Available for FX data" : "Yahoo Finance FX endpoint check failed"
  };
}

export async function onRequestGet(context) {
  const { env } = context;
  const [openai, tavily, yahooFinance] = await Promise.all([
    checkOpenAI(env),
    checkTavily(env),
    checkYahooFinance()
  ]);
  const auditDatabase = {
    configured: Boolean(env.AUDIT_DB),
    ok: Boolean(env.AUDIT_DB),
    message: env.AUDIT_DB ? "D1 binding AUDIT_DB configured" : "Optional AUDIT_DB binding not configured"
  };

  return Response.json({
    checked_at: new Date().toISOString(),
    sources: {
      openai,
      tavily,
      yahoo_finance: yahooFinance,
      audit_database: auditDatabase
    }
  });
}
