const button = document.getElementById("send");
const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const currencyBox = document.getElementById("currency");
const topicBox = document.getElementById("topic");
const situationBox = document.getElementById("situation");
const promptBox = document.getElementById("prompt");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");

function renderSources(sources) {
  if (!sources || sources.length === 0) {
    sourcesOutput.textContent = "No sources found.";
    return;
  }

  sourcesOutput.innerHTML = sources.map(source => {
    const published = source.published_at || "Unknown date";
    const domain = source.domain || source.source || "Unknown source";
    const label = source.source_group === "approved" ? "Approved source" : "Broad web";

    return `
      <div class="source-item">
        <a class="source-title" href="${source.url}" target="_blank" rel="noopener noreferrer">
          ${source.title || source.url}
        </a>
        <div class="source-meta">${domain} • ${published} • ${label}</div>
        <div class="source-link">${source.url}</div>
      </div>
    `;
  }).join("");
}

function buildMiniChartPath(series, width, height, padding) {
  if (!series || series.length < 2) return "";

  const values = series.map(item => Number(item.rate));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return series.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / (series.length - 1);
    const y = height - padding - ((Number(item.rate) - min) / range) * (height - padding * 2);
    return `${index === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

function renderFx(fx) {
  if (!fx) {
    fxOutput.textContent = "No FX information returned.";
    return;
  }

  if (fx.skip) {
    fxOutput.innerHTML = `
      <div class="fx-rate">THB selected</div>
      <div class="fx-meta">No FX conversion needed.</div>
    `;
    return;
  }

  if (fx.error) {
    fxOutput.innerHTML = `<span class="error">${fx.error}</span>`;
    return;
  }

  if (!fx.series || fx.series.length === 0) {
    fxOutput.textContent = "No FX data available.";
    return;
  }

  const rows = fx.series.map(item => `
    <tr>
      <td>${item.date}</td>
      <td>${item.rate}</td>
    </tr>
  `).join("");

  const chartPath = buildMiniChartPath(fx.series, 320, 120, 12);

  fxOutput.innerHTML = `
    <div class="fx-rate">${fx.pair}</div>

    <div class="fx-stats">
      <div class="fx-stat-card">
        <div class="fx-stat-label">Latest</div>
        <div class="fx-stat-value">${fx.latest_rate}</div>
      </div>
      <div class="fx-stat-card">
        <div class="fx-stat-label">Highest</div>
        <div class="fx-stat-value">${fx.highest_rate}</div>
        <div class="fx-stat-sub">${fx.highest_date}</div>
      </div>
      <div class="fx-stat-card">
        <div class="fx-stat-label">Lowest</div>
        <div class="fx-stat-value">${fx.lowest_rate}</div>
        <div class="fx-stat-sub">${fx.lowest_date}</div>
      </div>
    </div>

    <div class="fx-chart-wrap">
      <svg class="fx-chart" viewBox="0 0 320 120" preserveAspectRatio="none" aria-label="FX trend chart">
        <path d="${chartPath}" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    </div>

    <table class="fx-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Rate (${fx.base} → THB)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="fx-meta">
      Source: ${fx.source}<br>
      Retrieved: ${fx.retrieved_at}
    </div>
  `;
}

button.addEventListener("click", async function () {
  const industry = industryBox.value;
  const timeframe = timeframeBox.value;
  const currency = currencyBox.value;
  const topic = topicBox.value.trim();
  const situation = situationBox.value.trim();
  const prompt = promptBox.value.trim();

  if (!industry) {
    analysisOutput.textContent = "Please select an industry.";
    return;
  }

  if (!topic) {
    analysisOutput.textContent = "Please enter a topic / company / issue.";
    return;
  }

  if (!situation) {
    analysisOutput.textContent = "Please describe your situation.";
    return;
  }

  if (!prompt) {
    analysisOutput.textContent = "Please describe what you want the analysis to focus on.";
    return;
  }

  button.disabled = true;
  analysisOutput.innerHTML = '<span class="loading">Researching recent news...</span>';
  sourcesOutput.innerHTML = '<span class="loading">Gathering sources...</span>';
  fxOutput.innerHTML = '<span class="loading">Checking FX rate...</span>';

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        industry,
        timeframe,
        currency,
        topic,
        situation,
        prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      analysisOutput.innerHTML = `<span class="error">${data.error || "Request failed."}</span>`;
      sourcesOutput.textContent = "";
      fxOutput.textContent = "";
      return;
    }

    analysisOutput.textContent = data.analysis || "No analysis returned.";
    renderSources(data.sources || []);
    renderFx(data.fx || null);
  } catch (error) {
    analysisOutput.innerHTML = '<span class="error">Network error. Please try again.</span>';
    sourcesOutput.textContent = "";
    fxOutput.textContent = "";
  } finally {
    button.disabled = false;
  }
});
