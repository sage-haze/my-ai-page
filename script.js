const button = document.getElementById("send");
const updateFxButton = document.getElementById("updateFx");

const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const fxTenorBox = document.getElementById("fxTenor");
const deepSearchBox = document.getElementById("deepSearch");

const countrySearch = document.getElementById("countrySearch");
const countryDropdown = document.getElementById("countryDropdown");
const selectedCountriesBox = document.getElementById("selectedCountries");

const defaultPromptBox = document.getElementById("defaultPrompt");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");
const fxContextOutput = document.getElementById("fxContextOutput");
const contextOutput = document.getElementById("contextOutput");
const isicDropdown = document.getElementById("isicDropdown");
const selectedIsicBox = document.getElementById("selectedIsic");

let selectedCountries = [];
let selectedIsic = null;


function normaliseSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreIsicMatch(entry, query) {
  const text = normaliseSearchText(`${entry.code} ${entry.description}`);
  const q = normaliseSearchText(query);

  if (!q) return 0;
  if (text === q) return 1000;
  if (text.includes(q)) return 500 + q.length;

  const terms = q.split(" ").filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (text.includes(term)) score += 80;
    else if (term.length > 3 && text.split(" ").some(word => word.startsWith(term.slice(0, 4)))) score += 30;
  }
  return score;
}

function renderIsicDropdown() {
  if (!isicDropdown || typeof ISIC_DATA === "undefined") return;

  const query = industryBox.value.trim();
  if (!query) {
    isicDropdown.classList.add("hidden");
    isicDropdown.innerHTML = "";
    return;
  }

  const matches = ISIC_DATA
    .map(entry => ({ ...entry, score: scoreIsicMatch(entry, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.description.localeCompare(b.description))
    .slice(0, 12);

  if (matches.length === 0) {
    isicDropdown.classList.remove("hidden");
    isicDropdown.innerHTML = `<div class="isic-empty">No close ISIC activity found. Try a broader term.</div>`;
    return;
  }

  isicDropdown.classList.remove("hidden");
  isicDropdown.innerHTML = matches.map(entry => `
    <button type="button" class="isic-option" data-code="${entry.code}">
      <strong>${entry.code}</strong>
      <span>${entry.description}</span>
    </button>
  `).join("");

  isicDropdown.querySelectorAll(".isic-option").forEach(option => {
    option.addEventListener("click", function () {
      const entry = ISIC_DATA.find(item => item.code === option.dataset.code);
      if (!entry) return;
      selectedIsic = entry;
      industryBox.value = `${entry.code} - ${entry.description}`;
      selectedIsicBox.textContent = `Selected: ${entry.code} - ${entry.description}`;
      isicDropdown.classList.add("hidden");
    });
  });
}

function countryLabel(country) {
  return `${country.name} (${country.code})`;
}

function getSelectedCurrencies() {
  return Array
    .from(document.querySelectorAll('input[name="currency"]:checked'))
    .map(input => input.value);
}

function getSelectedTradeRoles() {
  return Array
    .from(document.querySelectorAll('input[name="tradeRole"]:checked'))
    .map(input => input.value);
}

function populateSectors() {
  Object.keys(SECTOR_DATA).forEach(sector => {
    const option = document.createElement("option");
    option.value = sector;
    option.textContent = sector;
    sectorBox.appendChild(option);
  });
}

function populateSubsectors() {
  const sector = sectorBox.value;
  subsectorBox.innerHTML = "";

  if (!sector) {
    subsectorBox.disabled = true;
    subsectorBox.innerHTML = `<option value="">Select a sector first</option>`;
    return;
  }

  subsectorBox.disabled = false;
  subsectorBox.innerHTML = `<option value="">Select a subsector</option>`;

  SECTOR_DATA[sector].forEach(subsector => {
    const option = document.createElement("option");
    option.value = subsector;
    option.textContent = subsector;
    subsectorBox.appendChild(option);
  });
}

function renderCountryDropdown() {
  const search = (countrySearch.value || "").toLowerCase().trim();

  const filtered = COUNTRIES
    .map(([name, code]) => ({ name, code }))
    .filter(country => countryLabel(country).toLowerCase().includes(search));

  countryDropdown.innerHTML = filtered.map(country => {
    const checked = selectedCountries.some(c => c.code === country.code) ? "checked" : "";

    return `
      <label class="country-option">
        <input type="checkbox" value="${country.code}" ${checked}>
        ${countryLabel(country)}
      </label>
    `;
  }).join("");

  countryDropdown.querySelectorAll("input").forEach(box => {
    box.addEventListener("change", function () {
      const country = COUNTRIES
        .map(([name, code]) => ({ name, code }))
        .find(c => c.code === box.value);

      if (box.checked) {
        if (!selectedCountries.some(c => c.code === country.code)) {
          selectedCountries.push(country);
        }
      } else {
        selectedCountries = selectedCountries.filter(c => c.code !== country.code);
      }

      renderSelectedCountries();
      countrySearch.value = "";
      countryDropdown.classList.add("hidden");
      renderCountryDropdown();
    });
  });
}

function renderSelectedCountries() {
  if (selectedCountries.length === 0) {
    selectedCountriesBox.innerHTML = "";
    return;
  }

  selectedCountriesBox.innerHTML = selectedCountries.map(country => `
    <span class="country-chip">
      ${countryLabel(country)}
      <button type="button" data-code="${country.code}">×</button>
    </span>
  `).join("");

  selectedCountriesBox.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", function () {
      selectedCountries = selectedCountries.filter(c => c.code !== btn.dataset.code);
      renderSelectedCountries();
      renderCountryDropdown();
    });
  });
}

function formatDisplayDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit"
  });
}

function formatDisplayRate(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value || "";
  }

  return number.toFixed(4);
}

function cleanFxPair(pair, base) {
  const rawPair = pair || `${base || ""}THB`;
  return String(rawPair).replace("=X", "");
}

function renderFxContext(text) {
  if (!fxContextOutput) return;

  if (!text) {
    fxContextOutput.textContent = "FX commentary in context of the latest news will appear here.";
    return;
  }

  fxContextOutput.innerHTML = `<p>${text}</p>`;
}

function renderFx(fxList) {
  const tenor = fxTenorBox?.value || "30";
  if (!fxList || fxList.length === 0) {
    fxOutput.textContent = "No FX data returned.";
    return;
  }

  const nonThb = fxList.filter(fx => !fx.skip && !fx.error);
  const errors = fxList.filter(fx => fx.error);

  if (nonThb.length === 0 && errors.length === 0) {
    fxOutput.textContent = "No non-THB FX selected.";
    return;
  }

  const summaryRows = nonThb.map(fx => {
    const pair = cleanFxPair(fx.pair, fx.base);
    const highDate = formatDisplayDate(fx.highest_date || fx.high_date);
    const lowDate = formatDisplayDate(fx.lowest_date || fx.low_date);

    return `
      <tr>
        <td>${pair}</td>
        <td>${formatDisplayRate(fx.latest_rate)}</td>
        <td>${formatDisplayRate(fx.highest_rate)}${highDate ? ` (${highDate})` : ""}</td>
        <td>${formatDisplayRate(fx.lowest_rate)}${lowDate ? ` (${lowDate})` : ""}</td>
      </tr>
    `;
  }).join("");

  const summaryTable = nonThb.length > 0 ? `
    <table class="fx-summary-table">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Latest</th>
          <th>${tenor}D High</th>
          <th>${tenor}D Low</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  ` : "";

  const detailBlocks = nonThb.map(fx => {
    const pair = cleanFxPair(fx.pair, fx.base);
    const rows = (fx.series || []).map(item => `
      <tr>
        <td>${formatDisplayDate(item.date)}</td>
        <td>${formatDisplayRate(item.rate)}</td>
      </tr>
    `).join("");

    return `
      <div class="fx-block">
        <div class="fx-title">${pair}</div>
        <table class="fx-detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>${fx.base || pair.replace("THB", "")} → THB</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${fx.analysis ? `<div class="fx-analysis">${fx.analysis}</div>` : ""}
      </div>
    `;
  }).join("");

  const errorBlocks = errors.map(fx => `
    <div class="fx-block">
      <span class="error">${fx.base}THB: ${fx.error}</span>
    </div>
  `).join("");

  fxOutput.innerHTML = `
    ${summaryTable}
    <div class="fx-grid">
      ${detailBlocks}
      ${errorBlocks}
    </div>
  `;
}

function renderSources(sources, noRelevantUpdates = false, fallbackTriggered = false) {
  if (!sources || sources.length === 0) {
    sourcesOutput.innerHTML = noRelevantUpdates
      ? `<div class="empty-state">No relevant sources were included for this period.</div>`
      : "No sources found.";
    return;
  }

  const fallbackNote = fallbackTriggered
    ? `<div class="source-note">Broader fallback search was used because the first pass found fewer than 3 relevant sources.</div>`
    : "";

  const sourceCards = sources.map((source, index) => {
    const number = source.number || index + 1;

    return `
      <div class="source-item">
        <a
          class="source-title"
          href="${source.url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          [${number}] ${source.title || source.url}
        </a>
        <div class="source-meta">
          ${source.domain || source.source || "Unknown source"} • ${source.published_at || "Unknown date"}
        </div>
        ${source.justification ? `<div class="source-justification"><strong>Why is it relevant:</strong> ${source.justification}</div>` : ""}
      </div>
    `;
  }).join("");

  sourcesOutput.innerHTML = fallbackNote + sourceCards;
}

function renderAnalysis(text) {
  if (!text) {
    analysisOutput.textContent = "No analysis returned.";
    return;
  }

  const themeBlocks = text
    .split(/(?=Theme\s+\d+\s*:)/i)
    .map(block => block.trim())
    .filter(Boolean);

  if (themeBlocks.length === 0) {
    analysisOutput.textContent = text;
    return;
  }

  analysisOutput.innerHTML = themeBlocks.map(block => {
    const lines = block
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const heading = lines[0] || "Theme";
    const bodyLines = lines.slice(1);

    const bulletLines = bodyLines.filter(line => line.startsWith("-"));
    const paragraphLines = bodyLines.filter(line =>
      !line.startsWith("-") &&
      !line.toLowerCase().startsWith("supporting information")
    );

    const paragraph = paragraphLines.join(" ");

    const bullets = bulletLines.map(line => {
      const clean = line.replace(/^-+\s*/, "");
      return `<li>${clean}</li>`;
    }).join("");

    return `
      <div class="theme-card">
        <h3>${heading}</h3>
        ${paragraph ? `<p>${paragraph}</p>` : ""}
        ${bullets ? `<ul>${bullets}</ul>` : ""}
      </div>
    `;
  }).join("");
}


function normaliseContextPoints(context) {
  if (!context) return [];

  if (Array.isArray(context.points)) {
    return context.points;
  }

  if (Array.isArray(context)) {
    return context;
  }

  if (typeof context === "string") {
    return context
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => ({
        title: "Industry context",
        explanation: line.replace(/^\d+[.)]\s*/, ""),
        rm_considerations: []
      }));
  }

  return [];
}

function renderContext(context) {
  if (!contextOutput) return;

  const points = normaliseContextPoints(context);

  if (points.length === 0) {
    contextOutput.textContent = "No industry context returned.";
    return;
  }

  contextOutput.innerHTML = points.map(point => {
    const title = point.title || "Industry context";
    const explanation = point.explanation || point.text || "";
    const considerations = point.rm_considerations || point.rmConsiderations || point.considerations || [];

    return `
      <div class="context-point-card">
        <h3>${title}</h3>
        ${explanation ? `<p>${explanation}</p>` : ""}
        ${considerations.length ? `
          <ul>
            ${considerations.map(item => `<li>${item}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    `;
  }).join("");
}

async function updateFxOnly() {
  const currencies = getSelectedCurrencies();
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const industry = selectedIsic ? selectedIsic.description : industryBox.value.trim();
  const isicCode = selectedIsic?.code || "";
  const fxTenor = fxTenorBox?.value || "30";
  const tradeRoles = getSelectedTradeRoles();
  const countries = selectedCountries.map(country => ({
    name: country.name,
    code: country.code,
    label: countryLabel(country)
  }));

  if (currencies.length === 0) {
    fxOutput.textContent = "Please select at least one currency.";
    return;
  }

  updateFxButton.disabled = true;
  fxOutput.innerHTML = `<span class="loading">Updating FX...</span>`;

  try {
    const response = await fetch("/api/fx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currencies,
        sector,
        subsector,
        industry,
        isicCode,
        fxTenor,
        tradeRoles,
        countries
      })
    });

    const data = await response.json();

    if (!response.ok) {
      fxOutput.innerHTML = `<span class="error">${data.error || "FX update failed."}</span>`;
      return;
    }

    renderFx(data.fx || []);
  } catch (error) {
    fxOutput.innerHTML = `<span class="error">FX network error.</span>`;
  } finally {
    updateFxButton.disabled = false;
  }
}

industryBox.addEventListener("input", function () {
  selectedIsic = null;
  selectedIsicBox.textContent = "Select one suggested ISIC activity. Free-text entries are not accepted as final input.";
  renderIsicDropdown();
});

industryBox.addEventListener("focus", renderIsicDropdown);

document.addEventListener("click", function (event) {
  if (!event.target.closest(".isic-picker")) {
    isicDropdown?.classList.add("hidden");
  }
});

countrySearch.addEventListener("focus", function () {
  countryDropdown.classList.remove("hidden");
  renderCountryDropdown();
});

countrySearch.addEventListener("input", function () {
  countryDropdown.classList.remove("hidden");
  renderCountryDropdown();
});

document.addEventListener("click", function (event) {
  if (!event.target.closest(".country-picker")) {
    countryDropdown.classList.add("hidden");
  }
});

button.addEventListener("click", async function () {
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const industry = selectedIsic ? selectedIsic.description : industryBox.value.trim();
  const isicCode = selectedIsic?.code || "";
  const timeframe = timeframeBox.value;
  const fxTenor = fxTenorBox?.value || "30";
  const currencies = getSelectedCurrencies();
  const tradeRoles = getSelectedTradeRoles();
  const deepSearch = deepSearchBox.checked;

  const countries = selectedCountries.map(country => ({
    name: country.name,
    code: country.code,
    label: countryLabel(country)
  }));

  const defaultPrompt = defaultPromptBox.value.trim();

  if (!sector) {
    analysisOutput.textContent = "Please select a sector.";
    return;
  }

  if (!subsector) {
    analysisOutput.textContent = "Please select a subsector.";
    return;
  }

  if (!selectedIsic) {
    analysisOutput.textContent = "Please select one ISIC activity from the suggestions.";
    return;
  }

  if (tradeRoles.length === 0) {
    analysisOutput.textContent = "Please select whether the client is an importer, exporter, or both.";
    return;
  }

  if (currencies.length === 0) {
    analysisOutput.textContent = "Please select at least one currency.";
    return;
  }

  if (countries.length === 0) {
    analysisOutput.textContent = "Please select at least one country / market.";
    return;
  }

  button.disabled = true;
  fxOutput.innerHTML = `<span class="loading">Checking FX...</span>`;
  analysisOutput.innerHTML = `<span class="loading">Researching news...</span>`;
  if (fxContextOutput) fxContextOutput.innerHTML = `<span class="loading">Preparing FX context...</span>`;
  sourcesOutput.innerHTML = `<span class="loading">Loading sources...</span>`;
  if (contextOutput) contextOutput.textContent = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sector,
        subsector,
        industry,
        isicCode,
        tradeRoles,
        deepSearch,
        timeframe,
        fxTenor,
        currencies,
        countries,
        defaultPrompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      analysisOutput.innerHTML = `<span class="error">${data.error || "Request failed."}</span>`;
      fxOutput.textContent = "";
      sourcesOutput.textContent = "";
      if (contextOutput) contextOutput.textContent = "";
      return;
    }

    renderFx(data.fx || []);
    renderFxContext(data.fx_context || data.fxContext || "");
    renderSources(data.sources || [], Boolean(data.no_relevant_updates), Boolean(data.fallback_triggered));
    renderAnalysis(data.news?.content || data.analysis || "No analysis returned.");
    // Industry Context & RM Considerations is currently deactivated in the UI.
    // renderContext(data.context || "");
  } catch (error) {
    analysisOutput.innerHTML = `<span class="error">Network error.</span>`;
    fxOutput.textContent = "";
    sourcesOutput.textContent = "";
    if (contextOutput) contextOutput.textContent = "";
  } finally {
    button.disabled = false;
  }
});

populateSectors();
populateSubsectors();
renderCountryDropdown();

sectorBox.addEventListener("change", populateSubsectors);
updateFxButton.addEventListener("click", updateFxOnly);
