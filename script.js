const button = document.getElementById("send");
const updateFxButton = document.getElementById("updateFx");

const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const deepSearchBox = document.getElementById("deepSearch");

const countrySearch = document.getElementById("countrySearch");
const countryDropdown = document.getElementById("countryDropdown");
const selectedCountriesBox = document.getElementById("selectedCountries");

const defaultPromptBox = document.getElementById("defaultPrompt");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");

let selectedCountries = [];

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

function renderFx(fxList) {
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

  const summaryRows = nonThb.map(fx => `
    <tr>
      <td>${fx.pair}</td>
      <td>${fx.latest_rate}</td>
      <td>${fx.highest_rate}</td>
      <td>${fx.highest_date}</td>
      <td>${fx.lowest_rate}</td>
      <td>${fx.lowest_date}</td>
    </tr>
  `).join("");

  const summaryTable = nonThb.length > 0 ? `
    <table class="fx-summary-table">
      <thead>
        <tr>
          <th>Pair</th>
          <th>Latest</th>
          <th>7D High</th>
          <th>High Date</th>
          <th>7D Low</th>
          <th>Low Date</th>
        </tr>
      </thead>
      <tbody>${summaryRows}</tbody>
    </table>
  ` : "";

  const detailBlocks = nonThb.map(fx => {
    const rows = fx.series.map(item => `
      <tr>
        <td>${item.date}</td>
        <td>${item.rate}</td>
      </tr>
    `).join("");

    return `
      <div class="fx-block">
        <div class="fx-title">${fx.pair}</div>
        <table class="fx-detail-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>${fx.base} → THB</th>
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

function renderSources(sources) {
  if (!sources || sources.length === 0) {
    sourcesOutput.textContent = "No sources found.";
    return;
  }

  sourcesOutput.innerHTML = sources.map((source, index) => {
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
        <div class="source-link">${source.url}</div>
      </div>
    `;
  }).join("");
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

async function updateFxOnly() {
  const currencies = getSelectedCurrencies();

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
      body: JSON.stringify({ currencies })
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
  const industry = industryBox.value.trim();
  const timeframe = timeframeBox.value;
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

  if (!industry) {
    analysisOutput.textContent = "Please enter the client's industry.";
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

  if (!defaultPrompt) {
    analysisOutput.textContent = "Please enter a prompt.";
    return;
  }

  button.disabled = true;
  fxOutput.innerHTML = `<span class="loading">Checking FX...</span>`;
  analysisOutput.innerHTML = `<span class="loading">Researching news...</span>`;
  sourcesOutput.innerHTML = `<span class="loading">Loading sources...</span>`;

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
        tradeRoles,
        deepSearch,
        timeframe,
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
      return;
    }

    renderFx(data.fx || []);
    renderSources(data.sources || []);
    renderAnalysis(data.analysis || "No analysis returned.");
  } catch (error) {
    analysisOutput.innerHTML = `<span class="error">Network error.</span>`;
    fxOutput.textContent = "";
    sourcesOutput.textContent = "";
  } finally {
    button.disabled = false;
  }
});

populateSectors();
populateSubsectors();
renderCountryDropdown();

sectorBox.addEventListener("change", populateSubsectors);
updateFxButton.addEventListener("click", updateFxOnly);
