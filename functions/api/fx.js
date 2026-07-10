const ALLOWED_CURRENCIES = ["THB", "USD", "JPY", "EUR", "CNY"];


function normalizeCurrencyList(currencies = []) {
  return [...new Set((Array.isArray(currencies) ? currencies : [])
    .map(currency => String(currency || "").toUpperCase().trim())
    .filter(currency => ALLOWED_CURRENCIES.includes(currency)))];
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

function normalizeTradeFlow(raw = {}, fallbackCountries = [], fallbackCurrencies = []) {
  const fallbackCurrencyList = normalizeCurrencyList(fallbackCurrencies);
  return {
    purchase: {
      domestic: Boolean(raw?.purchase?.domestic),
      international: Boolean(raw?.purchase?.international),
      countries: normalizeCountryList(raw?.purchase?.countries || []),
      currencies: normalizeCurrencyList(raw?.purchase?.currencies || fallbackCurrencyList)
    },
    sales: {
      domestic: Boolean(raw?.sales?.domestic),
      international: Boolean(raw?.sales?.international),
      countries: normalizeCountryList(raw?.sales?.countries || []),
      currencies: normalizeCurrencyList(raw?.sales?.currencies || fallbackCurrencyList)
    },
    legacyCountries: normalizeCountryList(fallbackCountries)
  };
}



function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function getFxResearchBucket(env) {
  return env?.FX_REPORTS || env?.WEEKLY_FX_RESEARCH || env?.weeklyFxResearch || null;
}

async function getLatestFxResearchPdf(env) {
  const status = {
    attempted: true,
    found: false,
    used: false,
    bucket_binding: "",
    key: "",
    filename: "",
    size_bytes: 0,
    message: "PDF not checked yet."
  };

  try {
    const bucket = getFxResearchBucket(env);
    status.bucket_binding = env?.FX_REPORTS
      ? "FX_REPORTS"
      : env?.WEEKLY_FX_RESEARCH
        ? "WEEKLY_FX_RESEARCH"
        : env?.weeklyFxResearch
          ? "weeklyFxResearch"
          : "";

    if (!bucket) {
      status.message = "No R2 binding found. Create a Pages R2 binding named FX_REPORTS or WEEKLY_FX_RESEARCH and point it to the weekly-fx-research bucket.";
      console.warn(status.message);
      return { pdf: null, status };
    }

    let selectedKey = String(env.FX_RESEARCH_OBJECT_KEY || "").trim();

    if (!selectedKey) {
      const prefix = String(env.FX_RESEARCH_PREFIX || "").trim();
      const listed = await bucket.list({ prefix, limit: 100 });
      const pdfObjects = (listed?.objects || [])
        .filter(item => /\.pdf$/i.test(item.key || ""))
        .sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));

      selectedKey = pdfObjects[0]?.key || "";
    }

    if (!selectedKey) {
      status.message = "Connected to R2, but no PDF was found in the configured prefix.";
      return { pdf: null, status };
    }

    if (!/\.pdf$/i.test(selectedKey)) {
      status.key = selectedKey;
      status.message = "Configured FX research object is not a PDF.";
      return { pdf: null, status };
    }

    const object = await bucket.get(selectedKey);
    if (!object) {
      status.key = selectedKey;
      status.message = "PDF key was selected, but the object could not be read from R2.";
      return { pdf: null, status };
    }

    const size = Number(object.size || 0);
    const maxBytes = Number(env.FX_RESEARCH_MAX_BYTES || 12000000);
    status.found = true;
    status.key = selectedKey;
    status.filename = selectedKey.split("/").pop() || "weekly-fx-research.pdf";
    status.size_bytes = size;

    if (size > maxBytes) {
      status.message = `PDF found but skipped because it is ${size} bytes, above limit ${maxBytes}.`;
      console.warn(`FX research PDF ${selectedKey} skipped because it is ${size} bytes, above limit ${maxBytes}.`);
      return { pdf: null, status };
    }

    const arrayBuffer = await object.arrayBuffer();
    status.used = true;
    status.message = "PDF found in R2 and sent to OpenAI for currency-section extraction.";
    return {
      pdf: {
        key: selectedKey,
        filename: status.filename,
        fileData: `data:application/pdf;base64,${arrayBufferToBase64(arrayBuffer)}`
      },
      status
    };
  } catch (error) {
    console.error("FX research PDF retrieval failed:", error);
    status.message = `FX research PDF retrieval failed: ${error.message || "Unknown error"}`;
    return { pdf: null, status };
  }
}

function tradeFlowSummary(tradeFlow) {
  const list = countries => normalizeCountryList(countries).map(country => country.name || country.label || country.code).filter(Boolean).join(", ");
  return [
    `Purchase from: ${tradeFlow?.purchase?.domestic ? "Thailand domestic" : ""}${tradeFlow?.purchase?.domestic && tradeFlow?.purchase?.international ? "; " : ""}${tradeFlow?.purchase?.international ? list(tradeFlow.purchase.countries) || "international suppliers" : ""}`.trim(),
    `Purchase currencies: ${(tradeFlow?.purchase?.currencies || []).join(", ") || "not specified"}`,
    `Sales to: ${tradeFlow?.sales?.domestic ? "Thailand domestic" : ""}${tradeFlow?.sales?.domestic && tradeFlow?.sales?.international ? "; " : ""}${tradeFlow?.sales?.international ? list(tradeFlow.sales.countries) || "international buyers" : ""}`.trim(),
    `Sales currencies: ${(tradeFlow?.sales?.currencies || []).join(", ") || "not specified"}`
  ].join("\n");
}

async function fetchYahooSeries(pair, rangeDays = 90) {
  const safeRangeDays = 90;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=${safeRangeDays}d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed for ${pair}: ${rawText.slice(0, 120)}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (_) {
    throw new Error(`Yahoo Finance returned invalid JSON for ${pair}: ${rawText.slice(0, 120)}`);
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

async function fetchYahooFxRate(baseCurrency, rangeDays = 90) {
  if (baseCurrency === "THB") {
    return { skip: true, base: "THB" };
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

async function fetchFxRates(currencies, rangeDays = 90) {
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


function calculateFxMetrics(fx, fxTenor = 90) {
  const series = Array.isArray(fx?.series) ? fx.series : [];
  if (series.length === 0) return null;

  const rates = series
    .map(item => Number(item.rate))
    .filter(rate => Number.isFinite(rate));

  if (rates.length === 0) return null;

  const first = rates[0];
  const last = rates[rates.length - 1];
  const high = Math.max(...rates);
  const low = Math.min(...rates);
  const changePct = first ? ((last - first) / first) * 100 : 0;
  const rangePct = low ? ((high - low) / low) * 100 : 0;
  const firstDate = series[0]?.date || "";
  const lastDate = series[series.length - 1]?.date || "";

  const midpoint = (high + low) / 2;
  const latestPosition = high === low
    ? "flat range"
    : last >= midpoint
      ? "upper half of the observed range"
      : "lower half of the observed range";

  let direction = "broadly rangebound";
  if (Math.abs(changePct) >= 0.15) {
    direction = changePct > 0
      ? `${fx.base || "base currency"} strengthened against THB`
      : `${fx.base || "base currency"} weakened against THB`;
  }

  return {
    tenor_days: Number(fxTenor) || 90,
    first_date: firstDate,
    last_date: lastDate,
    first_rate: Number(first.toFixed(4)),
    latest_rate: Number(last.toFixed(4)),
    high_rate: Number(high.toFixed(4)),
    low_rate: Number(low.toFixed(4)),
    change_pct: Number(changePct.toFixed(2)),
    observed_range_pct: Number(rangePct.toFixed(2)),
    latest_position_in_range: latestPosition,
    objective_direction: direction,
    data_points: rates.length
  };
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

async function analyzeFxRates({ env, fxList, sector = "", subsector = "", industry = "", tradeRoles = [], countries = [], tradeFlow = null, fxTenor = 90 }) {
  const usableFx = fxList.filter(fx => !fx.skip && !fx.error && Array.isArray(fx.series) && fx.series.length > 0);

  if (usableFx.length === 0) {
    return { fx: fxList, fxResearch: { attempted: false, found: false, used: false, message: "No usable non-THB FX series, so PDF research was not checked." } };
  }

  if (!env.OPENAI_API_KEY) {
    return { fx: fxList, fxResearch: { attempted: false, found: false, used: false, message: "OPENAI_API_KEY is not configured, so PDF research was not checked." } };
  }

  const compactFx = usableFx.map(fx => ({
    pair: fx.pair,
    base: fx.base,
    quote: fx.quote,
    latest_rate: fx.latest_rate,
    highest_rate: fx.highest_rate,
    highest_date: fx.highest_date,
    lowest_rate: fx.lowest_rate,
    lowest_date: fx.lowest_date,
    metrics: calculateFxMetrics(fx, fxTenor),
    recent_series: fx.series
  }));

  const countryText = countries.map(country => country.label || country.name || country.code).filter(Boolean).join(", ");
  const currencyList = usableFx.map(fx => fx.base).filter(Boolean);
  const internalFxResearchResult = await getLatestFxResearchPdf(env);
  const internalFxResearchPdf = internalFxResearchResult?.pdf || null;
  const fxResearchStatus = internalFxResearchResult?.status || {
    attempted: true,
    found: false,
    used: false,
    bucket_binding: "",
    key: "",
    filename: "",
    size_bytes: 0,
    message: "FX research PDF status was not available."
  };
  const internalFxResearchBlock = internalFxResearchPdf
    ? `\nInternal weekly FX research PDF attached from R2: ${internalFxResearchPdf.filename}\n`
    : "\nInternal weekly FX research PDF from R2: Not available for this request.\n";

  const prompt = `
You are preparing concise FX context for junior Thailand-based commercial relationship managers.

Client context:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}
Exposure countries / markets: ${countryText}`}

You have two evidence sources:
1. Structured 90-day FX market statistics from Yahoo Finance.
2. Internal weekly FX analysis from the attached PDF, if available.

For EACH selected FX pair, produce two short bullet lists in plain English.

RECENT DRIVERS
- Heading meaning: "What has influenced the rate recently".
- Focus mainly on the past month.
- Give no more than 3 bullets.
- Explain the most relevant supported drivers behind the observed movement.
- Use the price series to describe what happened, but do not treat price movement alone as proof of causation.
- Use internal analysis only when it directly supports a driver.
- If causation is uncertain, say so briefly rather than inventing an explanation.
- Avoid trading jargon, technical indicators, support/resistance language, or detailed market terminology.

NEAR-TERM WATCH
- Heading meaning: "What could move the rate next".
- Give no more than 3 bullets.
- Focus on upcoming policy decisions, macro releases, political or trade developments, and other uncertainties supported by internal analysis.
- Do not make a precise forecast or imply certainty.

Client discipline:
- Keep the bullets useful for a junior banker speaking with a client.
- Do not assume the client has a currency mismatch, hedge need, margin problem, or financing requirement.
- Do not recommend hedge ratios, products, or market timing.
- Do not mention the PDF or its filename. Refer to it only as internal analysis when needed.

Return JSON only in this shape:
{
  "analyses": [
    {
      "pair": "USDTHB=X",
      "recent_drivers": [
        "Plain-English bullet 1",
        "Plain-English bullet 2"
      ],
      "near_term_watch": [
        "Plain-English bullet 1",
        "Plain-English bullet 2"
      ]
    }
  ],
  "research_extraction": {
    "status": "used | not_relevant | not_available",
    "summary": "One short sentence explaining whether internal analysis was used.",
    "sections": [
      { "currency": "USD", "text": "Relevant extracted internal analysis for this currency. If not found, say not found." }
    ]
  }
}

For research_extraction.sections, include one entry for each selected currency in this list: ${currencyList.join(", ")}. This is a temporary diagnostic view for testing, so include enough extracted text to verify that the correct section was read, but keep each currency under 900 characters.

${internalFxResearchBlock}
FX market statistics and recent series:
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
        model: env.OPENAI_FX_MODEL || env.OPENAI_ANALYSIS_MODEL || "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              ...(internalFxResearchPdf ? [{
                type: "input_file",
                filename: internalFxResearchPdf.filename,
                file_data: internalFxResearchPdf.fileData
              }] : [])
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        fx: fxList,
        fxResearch: {
          ...fxResearchStatus,
          openai_status: "failed",
          message: `${fxResearchStatus.message} OpenAI FX analysis failed.`
        }
      };
    }

    const text = extractOutputText(data);
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      return {
        fx: fxList,
        fxResearch: {
          ...fxResearchStatus,
          openai_status: "no_json",
          message: `${fxResearchStatus.message} OpenAI did not return parseable JSON.`
        }
      };
    }

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    const analysisByPair = new Map(
      (parsed.analyses || [])
        .filter(item => item.pair)
        .map(item => {
          const recentDrivers = Array.isArray(item.recent_drivers)
            ? item.recent_drivers.map(value => String(value || "").trim()).filter(Boolean).slice(0, 3)
            : [];
          const nearTermWatch = Array.isArray(item.near_term_watch)
            ? item.near_term_watch.map(value => String(value || "").trim()).filter(Boolean).slice(0, 3)
            : [];
          const legacyAnalysis = String(item.analysis || "").trim();
          const analysis = recentDrivers.length || nearTermWatch.length
            ? { recent_drivers: recentDrivers, near_term_watch: nearTermWatch }
            : legacyAnalysis;
          return [String(item.pair), analysis];
        })
        .filter(([, analysis]) => analysis && (typeof analysis === "string" ? analysis : analysis.recent_drivers.length || analysis.near_term_watch.length))
    );

    const researchExtraction = parsed.research_extraction || {};
    return {
      fx: fxList.map(fx => ({
        ...fx,
        analysis: analysisByPair.get(fx.pair) || fx.analysis || ""
      })),
      fxResearch: {
        ...fxResearchStatus,
        openai_status: "ok",
        extraction_status: researchExtraction.status || (internalFxResearchPdf ? "used" : "not_available"),
        extraction_summary: researchExtraction.summary || "",
        extracted_sections: Array.isArray(researchExtraction.sections) ? researchExtraction.sections : []
      }
    };
  } catch (error) {
    return {
      fx: fxList,
      fxResearch: {
        ...fxResearchStatus,
        openai_status: "error",
        message: `${fxResearchStatus.message} FX research extraction failed: ${error.message || "Unknown error"}`
      }
    };
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const legacyCurrencies = Array.isArray(body.currencies) ? body.currencies.map(c => String(c).toUpperCase()) : [];
    const legacyCountries = Array.isArray(body.countries) ? body.countries : [];
    const tradeFlow = normalizeTradeFlow(body.tradeFlow || {}, legacyCountries, legacyCurrencies);
    const currencies = [...new Set([...tradeFlow.purchase.currencies, ...tradeFlow.sales.currencies, ...normalizeCurrencyList(legacyCurrencies)])];
    const sector = (body.sector || "").trim();
    const subsector = (body.subsector || "").trim();
    const industry = (body.industry || "").trim();
    const tradeRoles = Array.isArray(body.tradeRoles)
      ? body.tradeRoles.map(role => String(role).toLowerCase()).filter(role => ["importer", "exporter"].includes(role))
      : [];
    const countries = normalizeCountryList([...tradeFlow.purchase.countries, ...tradeFlow.sales.countries, ...tradeFlow.legacyCountries]);
    const fxTenor = 90;

    if (currencies.length === 0) {
      return Response.json({ error: "Please select at least one currency." }, { status: 400 });
    }

    const unsupported = currencies.filter(currency => !ALLOWED_CURRENCIES.includes(currency));
    if (unsupported.length > 0) {
      return Response.json({ error: `Unsupported currency selected: ${unsupported.join(", ")}` }, { status: 400 });
    }

    const rawFx = await fetchFxRates(currencies, fxTenor);
    const analyzed = await analyzeFxRates({ env, fxList: rawFx, sector, subsector, industry, tradeRoles, countries, tradeFlow, fxTenor });

    return Response.json({ fx: analyzed.fx || rawFx, fxResearch: analyzed.fxResearch || null });
  } catch (error) {
    return Response.json({
      error: error.message || "FX update failed."
    }, { status: 500 });
  }
}
