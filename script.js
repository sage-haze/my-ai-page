const SECTOR_DATA = {
  "Agriculture, forestry and fishing": [
    "Crop and animal production, hunting and related service activities",
    "Forestry and logging",
    "Fishing and aquaculture"
  ],
  "Mining and quarrying": [
    "Mining of coal and lignite",
    "Extraction of crude petroleum and natural gas",
    "Mining of metal ores",
    "Other mining and quarrying",
    "Mining support service activities"
  ],
  "Manufacturing": [
    "Manufacture of food products",
    "Manufacture of beverages",
    "Manufacture of tobacco products",
    "Manufacture of textiles",
    "Manufacture of wearing apparel",
    "Manufacture of leather and related products",
    "Manufacture of wood and of products of wood and cork, except furniture; manufacture of articles of straw and plaiting materials",
    "Manufacture of paper and paper products",
    "Printing and reproduction of recorded media",
    "Manufacture of coke and refined petroleum products",
    "Manufacture of chemicals and chemical products",
    "Manufacture of basic pharmaceutical products and pharmaceutical preparations",
    "Manufacture of rubber and plastics products",
    "Manufacture of other non-metallic mineral products",
    "Manufacture of basic metals",
    "Manufacture of fabricated metal products, except machinery and equipment",
    "Manufacture of computer, electronic and optical products",
    "Manufacture of electrical equipment",
    "Manufacture of machinery and equipment, not elsewhere classified",
    "Manufacture of motor vehicles, trailers and semi-trailers",
    "Manufacture of other transport equipment",
    "Manufacture of furniture",
    "Other manufacturing",
    "Repair and installation of machinery and equipment"
  ],
  "Electricity, gas, steam and air conditioning supply": [
    "Electricity, gas, steam and air conditioning supply"
  ],
  "Water supply; sewerage, waste management and remediation activities": [
    "Water collection, treatment and supply",
    "Sewerage",
    "Waste collection, treatment and disposal activities; materials recovery",
    "Remediation activities and other waste management services"
  ],
  "Construction": [
    "Construction of buildings",
    "Construction of private residential housing",
    "Construction of private condominium",
    "Construction of private apartment and service apartment",
    "Construction of government residential housing and condominium",
    "Construction of private commercial building",
    "Construction of private office building",
    "Construction of private shopping center and department store",
    "Construction of private hotel and resort",
    "Construction of private factory",
    "Civil engineering",
    "Specialized construction activities"
  ],
  "Wholesale and retail trade; repair of motor vehicles and motorcycles": [
    "Wholesale and retail trade and repair of motor vehicles and motorcycles",
    "Wholesale trade, except of motor vehicles and motorcycles",
    "Retail trade, except of motor vehicles and motorcycles"
  ],
  "Transportation and storage": [
    "Land transport and transport via pipelines",
    "Water transport",
    "Air transport",
    "Warehousing and support activities for transportation",
    "Postal and courier activities"
  ],
  "Accommodation and food service activities": [
    "Accommodation",
    "Food and beverage service activities"
  ],
  "Information and communication": [
    "Publishing activities",
    "Motion picture, video and television programme production, sound recording and music publishing activities",
    "Programming and broadcasting activities",
    "Telecommunications",
    "Computer programming, consultancy and related activities",
    "Information service activities"
  ],
  "Financial and insurance activities": [
    "Financial service activities, except insurance and pension funding",
    "Thai commercial bank",
    "Restricted bank",
    "Branches of foreign bank",
    "International banking facilities of foreign bank",
    "Representative office of foreign bank",
    "Foreign bank",
    "Retail bank",
    "Subsidiary of foreign bank",
    "Other commercial bank",
    "Agricultural cooperative including the agricultural co-operative federation",
    "Thrift and credit cooperatives including the federation of savings and credit cooperatives",
    "Factoring activities",
    "Writing of swaps, options and other hedging instruments",
    "Others distribution of funds activities",
    "Insurance, reinsurance and pension funding, except compulsory social security",
    "Reinsurance (life)",
    "Reinsurance (non-life)",
    "Activities auxiliary to financial service and insurance activities",
    "Securities company",
    "Securities brokers and traders",
    "Underwriters",
    "Others securities brokerage activities",
    "Authorized company",
    "Authorized person",
    "International money transfer",
    "Other activities of bureaux de change",
    "Asset management",
    "Other of other activities auxiliary to financial service activities, not elsewhere classified",
    "Mutual fund management",
    "Others investment fund management, including hedge fund"
  ],
  "Real estate activities": [
    "Real estate activities",
    "Real estate development for residential housing",
    "Real estate development for condominium and flat for sale",
    "Land development for residential housing",
    "Real estate development for commercial building",
    "Land development for agriculture",
    "Land development for industry",
    "Real estate development for apartment and service apartment for rent",
    "Office building business for sale and rent",
    "Shopping center business and department store for sale and rent",
    "Land development for cemetery",
    "Golf course business",
    "Other of other real estate activities with own or leased property"
  ],
  "Professional, scientific and technical activities": [
    "Legal and accounting activities",
    "Activities of head offices; management consultancy activities",
    "Architectural and engineering activities; technical testing and analysis",
    "Scientific research and development",
    "Advertising and market research",
    "Other professional, scientific and technical activities",
    "Veterinary activities"
  ],
  "Administrative and support service activities": [
    "Rental and leasing activities",
    "Employment activities",
    "Travel agency, tour operator, reservation service and related activities",
    "Security and investigation activities",
    "Services to buildings and landscape activities",
    "Office administrative, office support and other business support activities"
  ],
  "Public administration and defence; compulsory social security": [
    "Public administration and defence; compulsory social security"
  ],
  "Education": [
    "Education"
  ],
  "Human health and social work activities": [
    "Human health activities",
    "Residential care activities",
    "Social work activities without accommodation"
  ],
  "Arts, entertainment and recreation": [
    "Creative, arts and entertainment activities",
    "Libraries, archives, museums and other cultural activities",
    "Gambling and betting activities",
    "Sports activities and amusement and recreation activities"
  ],
  "Other service activities": [
    "Activities of membership organizations",
    "Repair of computers and personal and household goods",
    "Other personal service activities"
  ],
  "Activities of households as employers; undifferentiated goods- and services-producing activities of households for own use": [
    "Activities of households as employers of domestic personnel",
    "Undifferentiated goods- and services-producing activities of private households for own use"
  ],
  "Activities of extraterritorial organizations and bodies": [
    "Activities of extraterritorial organizations and bodies"
  ]
};

const button = document.getElementById("send");
const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const timeframeBox = document.getElementById("timeframe");
const topicBox = document.getElementById("topic");
const promptBox = document.getElementById("prompt");

const contextNoChange = document.getElementById("contextNoChange");
const contextOthers = document.getElementById("contextOthers");
const contextOtherText = document.getElementById("contextOtherText");

const trajectoryDomesticPurchase = document.getElementById("trajectoryDomesticPurchase");
const trajectoryDomesticSales = document.getElementById("trajectoryDomesticSales");
const trajectoryImport = document.getElementById("trajectoryImport");
const trajectoryExport = document.getElementById("trajectoryExport");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");

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
    subsectorBox.innerHTML = '<option value="">Select a sector first</option>';
    return;
  }

  subsectorBox.disabled = false;
  subsectorBox.innerHTML = '<option value="">Select a subsector</option>';

  SECTOR_DATA[sector].forEach(subsector => {
    const option = document.createElement("option");
    option.value = subsector;
    option.textContent = subsector;
    subsectorBox.appendChild(option);
  });
}

function getSelectedCurrencies() {
  return Array.from(document.querySelectorAll('input[name="currency"]:checked'))
    .map(input => input.value);
}

function getSelectedBusinessContext() {
  return Array.from(document.querySelectorAll('input[name="businessContext"]:checked'))
    .map(input => input.value);
}

function updateBusinessContextRules(changedInput) {
  const allContextInputs = Array.from(document.querySelectorAll('input[name="businessContext"]'));
  const nonNoChangeInputs = allContextInputs.filter(input => input !== contextNoChange);

  if (changedInput === contextNoChange && contextNoChange.checked) {
    nonNoChangeInputs.forEach(input => {
      input.checked = false;
    });
  }

  if (changedInput !== contextNoChange && changedInput.checked) {
    contextNoChange.checked = false;
  }

  const anyChecked = allContextInputs.some(input => input.checked);
  if (!anyChecked) {
    contextNoChange.checked = true;
  }

  contextOtherText.disabled = !contextOthers.checked;
  if (!contextOthers.checked) {
    contextOtherText.value = "";
  }
}

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

function renderFx(fxList) {
  if (!fxList || fxList.length === 0) {
    fxOutput.textContent = "No FX information returned.";
    return;
  }

  const nonThbFx = fxList.filter(fx => !fx.skip && !fx.error);
  const errors = fxList.filter(fx => fx.error);
  const hasThb = fxList.some(fx => fx.skip);

  if (nonThbFx.length === 0 && errors.length === 0 && hasThb) {
    fxOutput.innerHTML = `<div class="fx-meta">THB selected. No FX conversion needed.</div>`;
    return;
  }

  const summaryRows = nonThbFx.map(fx => `
    <tr>
      <td>${fx.pair}</td>
      <td>${fx.latest_rate}</td>
      <td>${fx.highest_rate}</td>
      <td>${fx.highest_date}</td>
      <td>${fx.lowest_rate}</td>
      <td>${fx.lowest_date}</td>
    </tr>
  `).join("");

  const summaryTable = nonThbFx.length > 0 ? `
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

  const detailBlocks = nonThbFx.map(fx => {
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
              <th>Rate (${fx.base} → THB)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const errorBlocks = errors.map(fx => `
    <div class="fx-block">
      <span class="error">${fx.base}THB: ${fx.error}</span>
    </div>
  `).join("");

  const thbNote = hasThb ? `<div class="fx-meta">THB selected. No FX conversion needed for THB.</div>` : "";

  fxOutput.innerHTML = `
    ${thbNote}
    ${summaryTable}
    <div class="fx-grid">
      ${detailBlocks}
      ${errorBlocks}
    </div>
  `;
}

populateSectors();
sectorBox.addEventListener("change", populateSubsectors);

document.querySelectorAll('input[name="businessContext"]').forEach(input => {
  input.addEventListener("change", function () {
    updateBusinessContextRules(input);
  });
});

button.addEventListener("click", async function () {
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const timeframe = timeframeBox.value;
  const currencies = getSelectedCurrencies();
  const topic = topicBox.value.trim();
  const prompt = promptBox.value.trim();
  const businessContext = getSelectedBusinessContext();
  const businessContextOther = contextOtherText.value.trim();

  const trajectory = {
    domesticPurchase: trajectoryDomesticPurchase.value,
    domesticSales: trajectoryDomesticSales.value,
    import: trajectoryImport.value,
    export: trajectoryExport.value
  };

  if (!sector) {
    analysisOutput.textContent = "Please select a sector.";
    return;
  }

  if (!subsector) {
    analysisOutput.textContent = "Please select a subsector.";
    return;
  }

  if (currencies.length === 0) {
    analysisOutput.textContent = "Please select at least one currency.";
    return;
  }

  if (businessContext.length === 0) {
    analysisOutput.textContent = "Please select at least one business context option.";
    return;
  }

  if (businessContext.includes("Others") && !businessContextOther) {
    analysisOutput.textContent = "Please describe the 'Others' business context.";
    return;
  }

  if (!topic) {
    analysisOutput.textContent = "Please enter a topic / company / issue.";
    return;
  }

  if (!prompt) {
    analysisOutput.textContent = "Please describe what you want the analysis to focus on.";
    return;
  }

  button.disabled = true;
  fxOutput.innerHTML = '<span class="loading">Checking FX rates...</span>';
  analysisOutput.innerHTML = '<span class="loading">Researching recent news...</span>';
  sourcesOutput.innerHTML = '<span class="loading">Gathering sources...</span>';

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sector,
        subsector,
        timeframe,
        currencies,
        topic,
        businessContext,
        businessContextOther,
        trajectory,
        prompt
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
    analysisOutput.textContent = data.analysis || "No analysis returned.";
    renderSources(data.sources || []);
  } catch (error) {
    analysisOutput.innerHTML = '<span class="error">Network error. Please try again.</span>';
    fxOutput.textContent = "";
    sourcesOutput.textContent = "";
  } finally {
    button.disabled = false;
  }
});
