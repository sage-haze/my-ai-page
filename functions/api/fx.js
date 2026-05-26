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
  try {
    const bucket = getFxResearchBucket(env);
    if (!bucket) {
      console.warn("No R2 binding found for weekly-fx-research. Create a Pages R2 binding named FX_REPORTS or WEEKLY_FX_RESEARCH and point it to the weekly-fx-research bucket.");
      return null;
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

    if (!selectedKey || !/\.pdf$/i.test(selectedKey)) {
      return null;
    }

    const object = await bucket.get(selectedKey);
    if (!object) {
      return null;
    }

    const size = Number(object.size || 0);
    const maxBytes = Number(env.FX_RESEARCH_MAX_BYTES || 12000000);
    if (size > maxBytes) {
      console.warn(`FX research PDF ${selectedKey} skipped because it is ${size} bytes, above limit ${maxBytes}.`);
      return null;
    }

    const arrayBuffer = await object.arrayBuffer();
    return {
      key: selectedKey,
      filename: selectedKey.split("/").pop() || "weekly-fx-research.pdf",
      fileData: `data:application/pdf;base64,${arrayBufferToBase64(arrayBuffer)}`
    };
  } catch (error) {
    console.error("FX research PDF retrieval failed:", error);
    return null;
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

async function fetchYahooSeries(pair, rangeDays = 30) {
  const safeRangeDays = [30, 90].includes(Number(rangeDays))
    ? Number(rangeDays)
    : 30;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${pair}` +
    `?interval=1d&range=${safeRangeDays}d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed for ${pair}: ${rawText.slice(0, 120)}`
    );
  }

  let data;

  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(
      `Yahoo Finance returned invalid JSON for ${pair}.`
    );
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
      pair: "CNYTHB (derived)",
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

async function fetchFxRates(currencies, rangeDays = 30) {
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

async function analyzeFxRates({ env, fxList, sector = "", subsector = "", industry = "", tradeRoles = [], countries = [], tradeFlow = null, fxTenor = 30 }) {
  const usableFx = fxList.filter(fx => !fx.skip && !fx.error && Array.isArray(fx.series) && fx.series.length > 0);

  if (usableFx.length === 0 || !env.OPENAI_API_KEY) return fxList;

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
  const currencyList = usableFx.map(fx => fx.base).filter(Boolean);
  const internalFxResearchPdf = await getLatestFxResearchPdf(env);
  const internalFxResearchBlock = internalFxResearchPdf
    ? `\nInternal weekly FX research PDF attached from R2: ${internalFxResearchPdf.filename}\n`
    : "\nInternal weekly FX research PDF from R2: Not available for this request.\n";

  const prompt = `
You are writing short FX movement notes for a Thailand-based relationship manager.

Client context:
- Client base: Thailand
- Sector: ${sector}
- Subsector: ${subsector}
- Specific industry: ${industry}
- Directional trade flow:
${tradeFlow ? tradeFlowSummary(tradeFlow) : `Client trade role: ${tradeRoles.join(", ")}\nExposure countries / markets: ${countryText}`}

Use the provided ${fxTenor}-day FX data below plus the attached internal weekly FX research PDF if available.
For each pair, write two concise sentences.
Sentence 1: observed FX movement, latest level versus the ${fxTenor}-day range, and whether the base currency strengthened or weakened against THB.
Sentence 2: a calibrated implication for this Thailand-based client, using the directional purchase/sales currency context and the bank's internal FX view from the attached PDF where relevant.
If the attached internal research is not directly relevant to a selected currency, do not force it.
Do not mention Tavily sources. Do not give investment advice. Avoid pretending to know hedge ratios, exposure sizing, settlement timing, or net positions that were not provided. Keep each analysis under 60 words.

Return JSON only in this shape:
{
  "analyses": [
    { "pair": "USDTHB=X", "analysis": "..." }
  ]
}

${internalFxResearchBlock}
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
    const fxTenor = [30, 90].includes(Number(body.fxTenor)) ? Number(body.fxTenor) : 30;

    if (currencies.length === 0) {
      return Response.json({ error: "Please select at least one currency." }, { status: 400 });
    }

    const unsupported = currencies.filter(currency => !ALLOWED_CURRENCIES.includes(currency));
    if (unsupported.length > 0) {
      return Response.json({ error: `Unsupported currency selected: ${unsupported.join(", ")}` }, { status: 400 });
    }

    const rawFx = await fetchFxRates(currencies, fxTenor);
    const fx = await analyzeFxRates({ env, fxList: rawFx, sector, subsector, industry, tradeRoles, countries, tradeFlow, fxTenor });

    return Response.json({ fx });
  } catch (error) {
    return Response.json({
      error: error.message || "FX update failed."
    }, { status: 500 });
  }
}
