const button = document.getElementById("send");
const updateFxButton = document.getElementById("updateFx");

const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const fxTenorBox = document.getElementById("fxTenor");
const conversationGoalBox = document.getElementById("conversationGoal");
const purchaseDomesticBox = document.getElementById("purchaseDomestic");
const purchaseInternationalBox = document.getElementById("purchaseInternational");
const salesDomesticBox = document.getElementById("salesDomestic");
const salesInternationalBox = document.getElementById("salesInternational");
const purchaseCountryField = document.getElementById("purchaseCountryField");
const salesCountryField = document.getElementById("salesCountryField");
const purchaseCountrySearch = document.getElementById("purchaseCountrySearch");
const purchaseCountryDropdown = document.getElementById("purchaseCountryDropdown");
const selectedPurchaseCountriesBox = document.getElementById("selectedPurchaseCountries");
const salesCountrySearch = document.getElementById("salesCountrySearch");
const salesCountryDropdown = document.getElementById("salesCountryDropdown");
const selectedSalesCountriesBox = document.getElementById("selectedSalesCountries");

const defaultPromptBox = document.getElementById("defaultPrompt");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");
const contextOutput = document.getElementById("contextOutput");
const isicDropdown = document.getElementById("isicDropdown");
const selectedIsicBox = document.getElementById("selectedIsic");

let selectedPurchaseCountries = [];
let selectedSalesCountries = [];
let selectedIsic = null;
let fxCharts = {};

const BUSINESS_RELEVANCE_TERMS = [
  "agriculture", "crop", "growing", "farming", "forestry", "fishing", "aquaculture",
  "mining", "quarrying", "extraction",
  "manufacture", "manufacturing", "processing", "production", "factory",
  "wholesale", "retail", "trade", "trading", "distribution", "export", "import",
  "transport", "storage", "logistics", "warehousing",
  "construction", "installation", "repair", "maintenance",
  "food", "beverage", "textile", "chemical", "metal", "machinery", "equipment",
  "financial", "insurance", "professional", "technical", "information", "communication"
];

const SERVICE_CONTEXT_TERMS = [
  "education", "school", "student", "students", "academic", "tutoring", "training",
  "accommodation", "hotel", "restaurant", "tourism", "travel",
  "health", "hospital", "medical", "social", "welfare",
  "religious", "membership", "association", "public", "government", "administration",
  "personal", "beauty", "wellness", "recreation", "entertainment", "sport"
];

const COMMERCIAL_FALLBACK_SECTORS = [
  "agriculture, forestry and fishing",
  "mining and quarrying",
  "manufacturing",
  "wholesale and retail trade; repair of motor vehicles and motorcycles",
  "transportation and storage",
  "construction"
];

const LOW_CONFIDENCE_MAX_RESULTS = 6;

const GENERIC_QUERY_TERMS = new Set([
  "business", "company", "industry", "activity", "activities", "service", "services",
  "product", "products", "goods", "general", "other", "misc", "miscellaneous"
]);

const BUSINESS_CONCEPT_GROUPS = [
  {
    terms: ["fruit", "fruits", "vegetable", "vegetables", "crop", "crops", "grain", "grains", "bean", "beans", "nut", "nuts", "orchard", "plantation", "fresh produce", "banana", "mango", "durian", "pineapple", "papaya", "coconut"],
    anchors: ["growing", "crop", "agriculture", "food", "wholesale", "retail"]
  },
  {
    terms: ["metal", "metals", "mineral", "minerals", "ore", "ores", "steel", "iron", "copper", "aluminium", "aluminum", "zinc", "tin", "nickel", "gold", "silver", "platinum", "precious metal", "gem", "gems", "gemstone", "gemstones", "jewel", "jewels", "jewellery", "jewelry", "precious stone", "precious stones", "semi precious stone", "semi precious stones", "diamond", "ruby", "sapphire", "emerald"],
    anchors: ["mining", "quarrying", "metal", "ore", "manufacture", "wholesale", "jewellery", "jewelry", "precious", "stone"]
  },
  {
    terms: ["machine", "machinery", "equipment", "parts", "component", "components", "electronics", "electrical", "semiconductor", "automotive", "vehicle"],
    anchors: ["manufacture", "machinery", "equipment", "electrical", "motor", "repair", "wholesale"]
  },
  {
    terms: ["textile", "textiles", "garment", "garments", "apparel", "fabric", "clothing", "fashion", "cotton", "yarn"],
    anchors: ["manufacture", "textile", "wearing", "apparel", "wholesale", "retail"]
  },
  {
    terms: ["food", "beverage", "drink", "processed food", "ingredient", "feed", "animal feed", "seafood", "meat", "dairy"],
    anchors: ["food", "beverage", "manufacture", "processing", "wholesale", "retail", "fishing", "animal"]
  },
  {
    terms: ["freight", "shipping", "logistics", "warehouse", "warehousing", "transport", "distribution", "cargo", "cold chain"],
    anchors: ["transport", "storage", "warehousing", "logistics", "support", "cargo"]
  }
];


function normaliseSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueWords(value) {
  return [...new Set(normaliseSearchText(value).split(" ").filter(word => word.length > 1))];
}

function bigrams(value) {
  const text = normaliseSearchText(value).replace(/\s+/g, " ");
  if (text.length < 2) return text ? [text] : [];
  const grams = [];
  for (let i = 0; i < text.length - 1; i += 1) grams.push(text.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a, b) {
  const aGrams = bigrams(a);
  const bGrams = bigrams(b);
  if (!aGrams.length || !bGrams.length) return 0;

  const counts = new Map();
  aGrams.forEach(gram => counts.set(gram, (counts.get(gram) || 0) + 1));

  let overlap = 0;
  bGrams.forEach(gram => {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      counts.set(gram, count - 1);
    }
  });

  return (2 * overlap) / (aGrams.length + bGrams.length);
}

function wordSimilarity(term, word) {
  if (!term || !word) return 0;
  if (word === term) return 1;
  if (word.startsWith(term) || term.startsWith(word)) return 0.88;
  if (word.includes(term) || term.includes(word)) return 0.72;
  return diceCoefficient(term, word);
}

function hasAnyWord(text, words) {
  const haystack = ` ${normaliseSearchText(text)} `;
  return words.some(word => haystack.includes(` ${normaliseSearchText(word)} `));
}

function getBusinessRelevance(entry) {
  const combined = `${entry.sector || ""} ${entry.subsector || ""} ${entry.description || ""}`;
  const words = uniqueWords(combined);
  let relevance = 0;

  BUSINESS_RELEVANCE_TERMS.forEach(term => {
    if (words.includes(term)) relevance += 1;
  });

  const sectorText = normaliseSearchText(entry.sector || "");
  if (COMMERCIAL_FALLBACK_SECTORS.includes(sectorText)) relevance += 2;

  return Math.min(relevance, 6);
}

function getServiceContextPenalty(entry, queryWords) {
  const combined = `${entry.sector || ""} ${entry.subsector || ""} ${entry.description || ""}`;
  const entryLooksServiceHeavy = hasAnyWord(combined, SERVICE_CONTEXT_TERMS);
  if (!entryLooksServiceHeavy) return 0;

  const queryClearlyServiceRelated = queryWords.some(term =>
    SERVICE_CONTEXT_TERMS.some(serviceTerm => wordSimilarity(term, serviceTerm) >= 0.9)
  );

  // Do not punish service-sector matches when the user clearly searched for that context.
  if (queryClearlyServiceRelated) return 0;

  return 45;
}

function getConceptScore(entry, queryWords) {
  if (!queryWords.length) return 0;

  const combined = normaliseSearchText(`${entry.sector || ""} ${entry.subsector || ""} ${entry.description || ""}`);
  const entryWords = uniqueWords(combined);
  let conceptScore = 0;

  BUSINESS_CONCEPT_GROUPS.forEach(group => {
    const queryMatchesGroup = queryWords.some(term =>
      group.terms.some(groupTerm => wordSimilarity(term, groupTerm) >= 0.88)
    );
    if (!queryMatchesGroup) return;

    const anchorHits = group.anchors.filter(anchor =>
      entryWords.some(word => wordSimilarity(anchor, word) >= 0.92) || combined.includes(normaliseSearchText(anchor))
    ).length;

    if (anchorHits > 0) conceptScore += Math.min(90, 35 + anchorHits * 15);
  });

  return conceptScore;
}

function diversifyCommercialFallback(scored) {
  const picks = [];
  const usedSectors = new Set();
  const usedCodes = new Set();

  COMMERCIAL_FALLBACK_SECTORS.forEach(sectorName => {
    const match = scored.find(entry =>
      !usedCodes.has(entry.code) &&
      normaliseSearchText(entry.sector || "") === sectorName &&
      entry.businessScore >= 18 &&
      entry.penaltyScore === 0
    );
    if (match) {
      picks.push(match);
      usedCodes.add(match.code);
      usedSectors.add(normaliseSearchText(match.sector || ""));
    }
  });

  scored.forEach(entry => {
    if (picks.length >= LOW_CONFIDENCE_MAX_RESULTS) return;
    if (usedCodes.has(entry.code) || entry.businessScore < 18 || entry.penaltyScore > 0) return;
    picks.push(entry);
    usedCodes.add(entry.code);
  });

  return picks.slice(0, LOW_CONFIDENCE_MAX_RESULTS);
}

function scoreIsicMatch(entry, query) {
  const q = normaliseSearchText(query);
  const entryText = normaliseSearchText(`${entry.code} ${entry.description}`);
  const fullEntryText = normaliseSearchText(`${entry.code} ${entry.description} ${entry.sector || ""} ${entry.subsector || ""}`);
  const entryWords = uniqueWords(fullEntryText);

  const sector = sectorBox?.value || "";
  const subsector = subsectorBox?.value || "";
  const contextText = normaliseSearchText(`${sector} ${subsector}`);
  const contextWords = uniqueWords(contextText);
  const queryWords = uniqueWords(q).filter(term => term.length > 2);

  let score = 0;
  let queryScore = 0;
  let contextScore = 0;
  let businessScore = getBusinessRelevance(entry) * 6;
  let conceptScore = 0;
  let penaltyScore = 0;

  // Sector/subsector helps ranking, but should not fully determine the answer.
  contextWords.forEach(term => {
    const best = Math.max(0, ...entryWords.map(word => wordSimilarity(term, word)));
    if (best >= 0.9) contextScore += best * 16;
    else if (best >= 0.8) contextScore += best * 8;
  });

  if (!q) {
    score = contextScore + businessScore;
    return { score, queryScore: 0, contextScore, businessScore, penaltyScore };
  }

  if (entryText === q) queryScore += 1000;
  if (entry.code && normaliseSearchText(entry.code) === q) queryScore += 900;
  if (entryText.includes(q)) queryScore += 450 + q.length;
  else if (fullEntryText.includes(q)) queryScore += 280 + q.length;

  queryWords.forEach(term => {
    const best = Math.max(0, ...entryWords.map(word => wordSimilarity(term, word)));

    // Fuzzy matching should catch typos and related wording, but weak text overlap
    // should not be enough to push unrelated institutional categories to the top.
    if (best >= 0.97) queryScore += 140;
    else if (best >= 0.91) queryScore += 90;
    else if (term.length >= 7 && best >= 0.86) queryScore += 35;
  });

  const phraseSimilarity = diceCoefficient(q, fullEntryText);
  if (phraseSimilarity >= 0.48) queryScore += phraseSimilarity * 70;

  conceptScore = getConceptScore(entry, queryWords);
  penaltyScore = getServiceContextPenalty(entry, queryWords);

  // Business relevance is a tie-breaker and safety signal, not a hardcoded synonym map.
  // It helps broad product/service descriptions favour commercial activities over generic
  // education, accommodation, membership, or public-service categories when confidence is low.
  score = queryScore + conceptScore + contextScore + businessScore - penaltyScore;

  return { score, queryScore, conceptScore, contextScore, businessScore, penaltyScore };
}

function getIsicMatches(query) {
  const q = normaliseSearchText(query);
  const selectedSector = normaliseSearchText(sectorBox?.value || "");
  const hasSelectedSector = Boolean(selectedSector);

  const scored = ISIC_DATA
    .map(entry => ({ ...entry, ...scoreIsicMatch(entry, q) }))
    .sort((a, b) => b.score - a.score || a.description.localeCompare(b.description));

  // Empty input should not invent suggestions. Only show context-guided results when
  // the user has already selected a sector/subsector.
  if (!q) {
    if (!hasSelectedSector && !normaliseSearchText(subsectorBox?.value || "")) return [];
    return scored
      .filter(entry => entry.contextScore > 0)
      .slice(0, 10);
  }

  const queryWords = uniqueWords(q).filter(term => term.length > 2 && !GENERIC_QUERY_TERMS.has(term));

  // Strong lexical/code matches remain the most reliable and are shown first.
  const strongMatches = scored
    .filter(entry => entry.queryScore >= 90 && entry.score >= 70)
    .slice(0, 10);
  if (strongMatches.length >= 4) return strongMatches;

  // Medium matches must have evidence from the user's typed words. Commercial relevance
  // may boost ranking, but it should never be enough by itself to create suggestions.
  const acceptableMatches = scored
    .filter(entry => {
      const sectorFit = hasSelectedSector && normaliseSearchText(entry.sector || "") === selectedSector;
      const hasTypedEvidence = entry.queryScore >= 35 || entry.conceptScore >= 45;
      const hasMinimumConfidence = entry.score >= 55;
      return hasMinimumConfidence && hasTypedEvidence && (entry.penaltyScore === 0 || entry.queryScore >= 90 || sectorFit);
    })
    .slice(0, 8);
  if (acceptableMatches.length > 0) return acceptableMatches;

  // If the user selected a sector, use it as a fallback. Without a sector, avoid
  // returning random fuzzy guesses for unfamiliar words.
  const contextMatches = scored
    .filter(entry => entry.contextScore > 0 && entry.score >= 20)
    .slice(0, 8);
  if (contextMatches.length > 0) return contextMatches;

  // Last resort: only show very close word matches. Otherwise show no dropdown so the
  // user can keep their free-text industry description without being misled.
  const closeWordMatches = scored
    .filter(entry => entry.queryScore >= 70 && entry.score >= 70)
    .slice(0, LOW_CONFIDENCE_MAX_RESULTS);

  if (closeWordMatches.length > 0) return closeWordMatches;

  return [];
}
function autoFillSectorFromIsic(entry) {
  if (!entry?.sector || !entry?.subsector || !sectorBox || !subsectorBox) return;

  const sectorExists = Array.from(sectorBox.options).some(option => option.value === entry.sector);
  if (!sectorExists) return;

  sectorBox.value = entry.sector;
  populateSubsectors();

  const subsectorExists = Array.from(subsectorBox.options).some(option => option.value === entry.subsector);
  if (subsectorExists) {
    subsectorBox.value = entry.subsector;
  }

  sectorBox.classList.add("auto-filled");
  subsectorBox.classList.add("auto-filled");
}

function selectIsic(entry) {
  selectedIsic = entry;
  industryBox.value = `${entry.code} - ${entry.description}`;
  industryBox.classList.add("valid-selection");
  industryBox.setAttribute("aria-expanded", "false");
  autoFillSectorFromIsic(entry);

  const autoFillText = entry.sector && entry.subsector
    ? ` Auto-filled sector: ${entry.sector}; subsector: ${entry.subsector}. You can still override them if needed.`
    : "";

  selectedIsicBox.textContent = `Selected: ${entry.code} - ${entry.description}.${autoFillText}`;
  isicDropdown.classList.add("hidden");
  isicDropdown.innerHTML = "";
}

function renderIsicDropdown() {
  if (!isicDropdown || typeof ISIC_DATA === "undefined") return;

  const query = industryBox.value.trim();

  const matches = getIsicMatches(query);

  if (matches.length === 0) {
    isicDropdown.classList.add("hidden");
    industryBox.setAttribute("aria-expanded", "false");
    isicDropdown.innerHTML = "";
    return;
  }

  const hasStrongQueryMatch = matches.some(entry => entry.queryScore >= 35);
  const heading = query
    ? (hasStrongQueryMatch ? "Closest ISIC matches" : "Related ISIC suggestions")
    : "Suggested ISIC activities";

  isicDropdown.classList.remove("hidden");
  industryBox.setAttribute("aria-expanded", "true");
  isicDropdown.innerHTML = `
    <div class="isic-dropdown-heading">${heading}</div>
    ${matches.map(entry => `
      <button type="button" class="isic-option" data-code="${entry.code}" role="option">
        <strong>${entry.code}</strong>
        <span>${entry.description}</span>
      </button>
    `).join("")}
  `;

  isicDropdown.querySelectorAll(".isic-option").forEach(option => {
    option.addEventListener("mousedown", function (event) {
      event.preventDefault();
      const entry = ISIC_DATA.find(item => item.code === option.dataset.code);
      if (!entry) return;
      selectIsic(entry);
    });
  });
}

function countryLabel(country) {
  return `${country.name} (${country.code})`;
}

function getSelectedCurrencies(scope) {
  const selector = scope ? `input[name="${scope}Currency"]:checked` : 'input[name$="Currency"]:checked';
  return Array.from(document.querySelectorAll(selector)).map(input => input.value);
}

function uniqueByCode(countries) {
  const seen = new Set();
  return (countries || []).filter(country => {
    if (!country?.code || seen.has(country.code)) return false;
    seen.add(country.code);
    return true;
  });
}

function getTradeFlow() {
  return {
    purchase: {
      domestic: Boolean(purchaseDomesticBox?.checked),
      international: Boolean(purchaseInternationalBox?.checked),
      countries: selectedPurchaseCountries.map(country => ({ name: country.name, code: country.code, label: countryLabel(country) })),
      currencies: getSelectedCurrencies("purchase")
    },
    sales: {
      domestic: Boolean(salesDomesticBox?.checked),
      international: Boolean(salesInternationalBox?.checked),
      countries: selectedSalesCountries.map(country => ({ name: country.name, code: country.code, label: countryLabel(country) })),
      currencies: getSelectedCurrencies("sales")
    }
  };
}

function getSelectedTradeRolesFromFlow(tradeFlow) {
  const roles = [];
  if (tradeFlow?.purchase?.international) roles.push("importer");
  if (tradeFlow?.sales?.international) roles.push("exporter");
  return roles.length ? roles : ["domestic"];
}

function getAllTradeFlowCountries(tradeFlow) {
  return uniqueByCode([...(tradeFlow?.purchase?.countries || []), ...(tradeFlow?.sales?.countries || [])]);
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

function getCountryOptions(search, selected) {
  const term = (search || "").toLowerCase().trim();
  return COUNTRIES
    .map(([name, code]) => ({ name, code }))
    .filter(country => country.code !== "TH" && country.name.toLowerCase() !== "thailand")
    .filter(country => countryLabel(country).toLowerCase().includes(term))
    .map(country => ({ ...country, checked: selected.some(c => c.code === country.code) }));
}

function renderCountryDropdownFor(side) {
  const isPurchase = side === "purchase";
  const searchBox = isPurchase ? purchaseCountrySearch : salesCountrySearch;
  const dropdown = isPurchase ? purchaseCountryDropdown : salesCountryDropdown;
  const selected = isPurchase ? selectedPurchaseCountries : selectedSalesCountries;
  if (!searchBox || !dropdown) return;

  const filtered = getCountryOptions(searchBox.value, selected);
  dropdown.innerHTML = filtered.map(country => `
    <label class="country-option">
      <input type="checkbox" value="${country.code}" ${country.checked ? "checked" : ""}>
      ${countryLabel(country)}
    </label>
  `).join("");

  dropdown.querySelectorAll("input").forEach(box => {
    box.addEventListener("change", function () {
      const country = COUNTRIES.map(([name, code]) => ({ name, code })).find(c => c.code === box.value);
      if (!country) return;
      if (isPurchase) {
        selectedPurchaseCountries = box.checked
          ? uniqueByCode([...selectedPurchaseCountries, country])
          : selectedPurchaseCountries.filter(c => c.code !== country.code);
      } else {
        selectedSalesCountries = box.checked
          ? uniqueByCode([...selectedSalesCountries, country])
          : selectedSalesCountries.filter(c => c.code !== country.code);
      }
      renderSelectedCountriesFor(side);
      searchBox.value = "";
      dropdown.classList.add("hidden");
      renderCountryDropdownFor(side);
    });
  });
}

function renderSelectedCountriesFor(side) {
  const isPurchase = side === "purchase";
  const selected = isPurchase ? selectedPurchaseCountries : selectedSalesCountries;
  const box = isPurchase ? selectedPurchaseCountriesBox : selectedSalesCountriesBox;
  if (!box) return;

  if (selected.length === 0) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = selected.map(country => `
    <span class="country-chip">
      ${countryLabel(country)}
      <button type="button" data-code="${country.code}">×</button>
    </span>
  `).join("");

  box.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", function () {
      if (isPurchase) selectedPurchaseCountries = selectedPurchaseCountries.filter(c => c.code !== btn.dataset.code);
      else selectedSalesCountries = selectedSalesCountries.filter(c => c.code !== btn.dataset.code);
      renderSelectedCountriesFor(side);
      renderCountryDropdownFor(side);
    });
  });
}

function updateTradeFlowVisibility() {
  purchaseCountryField?.classList.toggle("hidden", !purchaseInternationalBox?.checked);
  salesCountryField?.classList.toggle("hidden", !salesInternationalBox?.checked);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  const existingCard = document.getElementById("fxContextCard");
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    existingCard?.remove();
    return;
  }

  const fxCard = fxOutput?.closest(".result-card");
  const card = existingCard || document.createElement("div");
  card.id = "fxContextCard";
  card.className = "result-card";
  card.innerHTML = `
    <h2>FX Context</h2>
    <div id="fxContextOutput"><p>${escapeHtml(cleanText)}</p></div>
  `;

  if (!existingCard && fxCard) {
    fxCard.insertAdjacentElement("afterend", card);
  }
}

function getFxSeries(fx) {
  return (fx.series || [])
    .map(item => ({
      date: item.date,
      rate: Number(item.rate)
    }))
    .filter(item => item.date && Number.isFinite(item.rate))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getRateChange(series) {
  if (!series || series.length < 2) return null;
  const first = series[0].rate;
  const last = series[series.length - 1].rate;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / first) * 100;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function buildFxTableRows(series, columns = 3) {
  if (!series || series.length === 0) {
    return `<tr><td colspan="${columns * 2}">No daily data available.</td></tr>`;
  }

  const newestFirst = [...series].reverse();
  const rowsPerColumn = Math.ceil(newestFirst.length / columns);
  const chunks = Array.from({ length: columns }, (_, index) =>
    newestFirst.slice(index * rowsPerColumn, (index + 1) * rowsPerColumn)
  );

  return Array.from({ length: rowsPerColumn }, (_, rowIndex) => {
    const cells = chunks.map(chunk => {
      const item = chunk[rowIndex];
      if (!item) return `<td></td><td></td>`;
      return `<td>${formatDisplayDate(item.date)}</td><td>${formatDisplayRate(item.rate)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
}

function renderFxCharts(chartConfigs) {
  Object.values(fxCharts).forEach(chart => chart?.destroy?.());
  fxCharts = {};

  if (!window.Chart) {
    document.querySelectorAll(".fx-chart-status").forEach(el => {
      el.textContent = "Chart library could not load. Daily table is still available below.";
    });
    return;
  }

  chartConfigs.forEach(config => {
    const canvas = document.getElementById(config.canvasId);
    if (!canvas || config.series.length === 0) return;

    const rates = config.series.map(item => item.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const padding = Math.max((max - min) * 0.12, Math.abs(max || 1) * 0.001);

    fxCharts[config.canvasId] = new Chart(canvas, {
      type: "line",
      data: {
        labels: config.series.map(item => item.date),
        datasets: [{
          label: config.pair,
          data: rates,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => formatDisplayDate(items?.[0]?.label),
              label: item => `${config.pair}: ${formatDisplayRate(item.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: ctx => config.majorTicks.has(ctx.tick?.value) ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.05)",
              lineWidth: ctx => config.majorTicks.has(ctx.tick?.value) ? 1.2 : 0.5
            },
            ticks: {
              autoSkip: false,
              maxRotation: 0,
              callback: value => config.tickLabels[value] || ""
            }
          },
          y: {
            min: min - padding,
            max: max + padding,
            grid: { drawBorder: false },
            ticks: {
              callback: value => Number(value).toFixed(4)
            }
          }
        }
      }
    });
  });
}

function getFxChartAxis(series, tenor) {
  const tickLabels = {};
  const majorTicks = new Set();
  let previousKey = "";

  series.forEach((item, index) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return;

    if (String(tenor) === "90") {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (key !== previousKey || index === 0) {
        tickLabels[index] = date.toLocaleDateString("en-US", { month: "short" });
        majorTicks.add(index);
        previousKey = key;
      }
    } else {
      const day = date.getDay();
      const weekKey = `${date.getFullYear()}-${Math.ceil((date.getDate() + 6) / 7)}-${date.getMonth()}`;
      if ((day === 1 && weekKey !== previousKey) || index === 0 || index === series.length - 1) {
        tickLabels[index] = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        majorTicks.add(index);
        previousKey = weekKey;
      }
    }
  });

  return { tickLabels, majorTicks };
}

function renderFxResearchDiagnostic(fxResearch) {
  if (!fxResearch) return "";

  const statusText = fxResearch.used
    ? "PDF read successfully"
    : fxResearch.found
      ? "PDF found but not used"
      : fxResearch.attempted
        ? "PDF not read"
        : "PDF not checked";

  const meta = [
    fxResearch.bucket_binding ? `Binding: ${fxResearch.bucket_binding}` : "",
    fxResearch.filename ? `File: ${fxResearch.filename}` : "",
    fxResearch.size_bytes ? `Size: ${Math.round(Number(fxResearch.size_bytes) / 1024)} KB` : ""
  ].filter(Boolean).join(" • ");

  const sections = Array.isArray(fxResearch.extracted_sections) ? fxResearch.extracted_sections : [];
  const sectionHtml = sections.length
    ? sections.map(section => `
        <div class="fx-research-section">
          <strong>${escapeHtml(section.currency || "Currency")}</strong>
          <pre>${escapeHtml(section.text || "No extracted text returned.")}</pre>
        </div>
      `).join("")
    : `<div class="fx-research-empty">No extracted currency section was returned.</div>`;

  return `
    <details class="fx-research-toggle">
      <summary>${escapeHtml(statusText)}${meta ? ` <span>${escapeHtml(meta)}</span>` : ""}</summary>
      <div class="fx-research-body">
        <p>${escapeHtml(fxResearch.extraction_summary || fxResearch.message || "No PDF status message returned.")}</p>
        ${sectionHtml}
      </div>
    </details>
  `;
}

function renderFx(fxList, fxResearch = null) {
  const tenor = fxTenorBox?.value || "30";
  Object.values(fxCharts).forEach(chart => chart?.destroy?.());
  fxCharts = {};

  if (!fxList || fxList.length === 0) {
    fxOutput.innerHTML = `${renderFxResearchDiagnostic(fxResearch)}<div>No FX data returned.</div>`;
    return;
  }

  const nonThb = fxList.filter(fx => !fx.skip && !fx.error);
  const errors = fxList.filter(fx => fx.error);

  if (nonThb.length === 0 && errors.length === 0) {
    fxOutput.innerHTML = `${renderFxResearchDiagnostic(fxResearch)}<div>No non-THB FX selected.</div>`;
    return;
  }

  const chartConfigs = [];

  const fxCards = nonThb.map((fx, index) => {
    const pair = cleanFxPair(fx.pair, fx.base);
    const series = getFxSeries(fx);
    const latest = series.length ? series[series.length - 1].rate : fx.latest_rate;
    const highDate = formatDisplayDate(fx.highest_date || fx.high_date);
    const lowDate = formatDisplayDate(fx.lowest_date || fx.low_date);
    const change = getRateChange(series);
    const canvasId = `fxChart${index}`;
    const axis = getFxChartAxis(series, tenor);

    if (series.length > 1) {
      chartConfigs.push({ canvasId, pair, series, ...axis });
    }

    const tableHeaders = Array.from({ length: 3 }, () => `<th>Date</th><th>Rate</th>`).join("");

    return `
      <section class="fx-card-row">
        <div class="fx-card-topline">
          <div>
            <div class="fx-title">${pair}</div>
            <div class="fx-subtitle">${tenor}-day trend against THB</div>
          </div>
          <div class="fx-latest">
            <span>Latest</span>
            <strong>${formatDisplayRate(latest)}</strong>
          </div>
        </div>

        <div class="fx-stat-grid">
          <div class="fx-stat"><span>${tenor}D change</span><strong>${formatPercent(change)}</strong></div>
          <div class="fx-stat"><span>${tenor}D high</span><strong>${formatDisplayRate(fx.highest_rate)}</strong><em>${highDate}</em></div>
          <div class="fx-stat"><span>${tenor}D low</span><strong>${formatDisplayRate(fx.lowest_rate)}</strong><em>${lowDate}</em></div>
          <div class="fx-stat"><span>Data points</span><strong>${series.length || "—"}</strong></div>
        </div>

        <div class="fx-chart-wrap">
          ${series.length > 1 ? `<canvas id="${canvasId}" aria-label="${pair} FX trend chart"></canvas>` : `<div class="fx-chart-status">Not enough daily data to plot a chart.</div>`}
        </div>

        ${fx.analysis ? `<div class="fx-analysis">${escapeHtml(fx.analysis)}</div>` : ""}

        <details class="fx-table-toggle">
          <summary>Show daily FX table</summary>
          <table class="fx-detail-table fx-bloomberg-table">
            <thead><tr>${tableHeaders}</tr></thead>
            <tbody>${buildFxTableRows(series, 3)}</tbody>
          </table>
        </details>
      </section>
    `;
  }).join("");

  const errorBlocks = errors.map(fx => `
    <div class="fx-block">
      <span class="error">${escapeHtml(fx.base)}THB: ${escapeHtml(fx.error)}</span>
    </div>
  `).join("");

  fxOutput.innerHTML = `
    <div class="fx-card-stack">
      ${renderFxResearchDiagnostic(fxResearch)}
      ${fxCards}
      ${errorBlocks}
    </div>
  `;

  requestAnimationFrame(() => renderFxCharts(chartConfigs));
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
        ${Array.isArray(source.syndicated_via) && source.syndicated_via.length ? `<div class="source-syndication">Similar syndicated coverage hidden from source list: ${source.syndicated_via.join(", ")}</div>` : ""}
        ${source.justification ? `<div class="source-justification"><strong>Why is it relevant:</strong> ${source.justification}</div>` : ""}
      </div>
    `;
  }).join("");

  sourcesOutput.innerHTML = fallbackNote + sourceCards;
}

function parseConversationCardBlock(block) {
  const lines = String(block || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const heading = lines.shift() || "Card";
  const sections = [];
  const sectionPattern = /^(Plain-English context|Plain English context|Client relevance lens|Gentle observation|Soft invitation|If client engages|Bank relevance|Handoff cue)\s*:\s*(.*)$/i;
  let current = null;

  lines.forEach(line => {
    const match = line.match(sectionPattern);
    if (match) {
      current = {
        label: match[1].replace("Plain English", "Plain-English"),
        text: match[2] || ""
      };
      sections.push(current);
    } else if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else {
      sections.push({ label: "Context", text: line });
    }
  });

  return { heading, sections };
}

function renderConversationCards(text) {
  const cardBlocks = String(text || "")
    .split(/(?=Card\s+\d+\s*:)/i)
    .map(block => block.trim())
    .filter(Boolean);

  if (cardBlocks.length === 0) return false;

  analysisOutput.innerHTML = cardBlocks.map(block => {
    const { heading, sections } = parseConversationCardBlock(block);
    const sectionHtml = sections.map(section => `
      <div class="conversation-section">
        <div class="conversation-label">${escapeHtml(section.label)}</div>
        <div>${escapeHtml(section.text)}</div>
      </div>
    `).join("");

    return `
      <div class="theme-card conversation-card">
        <h3>${escapeHtml(heading)}</h3>
        ${sectionHtml}
      </div>
    `;
  }).join("");

  return true;
}

function renderAnalysis(text) {
  if (!text) {
    analysisOutput.textContent = "No analysis returned.";
    return;
  }

  if (renderConversationCards(text)) return;

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
    const metaLines = bodyLines.filter(line =>
      /^signal strength:/i.test(line) ||
      /^evidence score:/i.test(line) ||
      /^evidence basis:/i.test(line) ||
      line.includes(" | Evidence score:")
    );
    const paragraphLines = bodyLines.filter(line =>
      !line.startsWith("-") &&
      !line.toLowerCase().startsWith("supporting information") &&
      !(/^signal strength:/i.test(line) || /^evidence score:/i.test(line) || /^evidence basis:/i.test(line) || line.includes(" | Evidence score:"))
    );

    const meta = metaLines.join(" ");
    const paragraph = paragraphLines.join(" ");

    const bullets = bulletLines.map(line => {
      const clean = line.replace(/^-+\s*/, "");
      return `<li>${escapeHtml(clean)}</li>`;
    }).join("");

    return `
      <div class="theme-card">
        <h3>${escapeHtml(heading)}</h3>
        ${meta ? `<div class="theme-meta">${escapeHtml(meta)}</div>` : ""}
        ${paragraph ? `<p>${escapeHtml(paragraph)}</p>` : ""}
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


function getSignalThreads() {
  const checked = Array.from(document.querySelectorAll('input[name="signalThread"]:checked'))
    .map(input => input.value)
    .filter(Boolean);

  return checked.length
    ? checked
    : ["sector_news", "fx_rates", "geopolitics", "trade_supply_chain"];
}

async function updateFxOnly() {
  const tradeFlow = getTradeFlow();
  const currencies = [...new Set([...(tradeFlow.purchase.currencies || []), ...(tradeFlow.sales.currencies || [])])];
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const industry = selectedIsic ? selectedIsic.description : industryBox.value.trim();
  const isicCode = selectedIsic?.code || "";
  const fxTenor = fxTenorBox?.value || "30";
  const tradeRoles = getSelectedTradeRolesFromFlow(tradeFlow);
  const countries = getAllTradeFlowCountries(tradeFlow);

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
        countries,
        tradeFlow
      })
    });

    const data = await response.json();

    if (!response.ok) {
      fxOutput.innerHTML = `<span class="error">${data.error || "FX update failed."}</span>`;
      return;
    }

    renderFx(data.fx || [], data.fxResearch || null);
  } catch (error) {
    fxOutput.innerHTML = `<span class="error">FX network error.</span>`;
  } finally {
    updateFxButton.disabled = false;
  }
}

industryBox.addEventListener("input", function () {
  selectedIsic = null;
  industryBox.classList.remove("valid-selection");
  selectedIsicBox.textContent = "Select one suggested ISIC activity. Free-text entries are not accepted as final input.";
  renderIsicDropdown();
});

industryBox.addEventListener("focus", renderIsicDropdown);
industryBox.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    isicDropdown.classList.add("hidden");
    industryBox.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("click", function (event) {
  if (!event.target.closest(".isic-picker")) {
    isicDropdown?.classList.add("hidden");
    industryBox?.setAttribute("aria-expanded", "false");
  }
});

[purchaseInternationalBox, salesInternationalBox].forEach(box => {
  box?.addEventListener("change", updateTradeFlowVisibility);
});

function attachCountryPicker(side, searchBox, dropdown) {
  searchBox?.addEventListener("focus", function () {
    dropdown.classList.remove("hidden");
    renderCountryDropdownFor(side);
  });
  searchBox?.addEventListener("input", function () {
    dropdown.classList.remove("hidden");
    renderCountryDropdownFor(side);
  });
}

attachCountryPicker("purchase", purchaseCountrySearch, purchaseCountryDropdown);
attachCountryPicker("sales", salesCountrySearch, salesCountryDropdown);

document.addEventListener("click", function (event) {
  if (!event.target.closest('.country-picker[data-picker="purchase"]')) {
    purchaseCountryDropdown?.classList.add("hidden");
  }
  if (!event.target.closest('.country-picker[data-picker="sales"]')) {
    salesCountryDropdown?.classList.add("hidden");
  }
});

button.addEventListener("click", async function () {
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const industry = selectedIsic ? selectedIsic.description : industryBox.value.trim();
  const isicCode = selectedIsic?.code || "";
  const timeframe = timeframeBox.value;
  const fxTenor = fxTenorBox?.value || "30";
  const conversationGoal = conversationGoalBox?.value || "general_check_in";
  const signalThreads = getSignalThreads();
  const tradeFlow = getTradeFlow();
  const currencies = [...new Set([...(tradeFlow.purchase.currencies || []), ...(tradeFlow.sales.currencies || [])])];
  const tradeRoles = getSelectedTradeRolesFromFlow(tradeFlow);
  const countries = getAllTradeFlowCountries(tradeFlow);

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

  if (!tradeFlow.purchase.domestic && !tradeFlow.purchase.international) {
    analysisOutput.textContent = "Please select domestic and/or international for Purchase from.";
    return;
  }

  if (!tradeFlow.sales.domestic && !tradeFlow.sales.international) {
    analysisOutput.textContent = "Please select domestic and/or international for Sales to.";
    return;
  }

  if (tradeFlow.purchase.international && tradeFlow.purchase.countries.length === 0) {
    analysisOutput.textContent = "Please select at least one international purchase market.";
    return;
  }

  if (tradeFlow.sales.international && tradeFlow.sales.countries.length === 0) {
    analysisOutput.textContent = "Please select at least one international sales market.";
    return;
  }

  if (tradeFlow.purchase.currencies.length === 0) {
    analysisOutput.textContent = "Please select at least one purchase currency.";
    return;
  }

  if (tradeFlow.sales.currencies.length === 0) {
    analysisOutput.textContent = "Please select at least one sales currency.";
    return;
  }

  button.disabled = true;
  analysisOutput.innerHTML = `<span class="loading">Researching news...</span>`;
  renderFxContext("");
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
        tradeFlow,
        timeframe,
        fxTenor,
        currencies,
        countries,
        defaultPrompt,
        conversationGoal,
        signalThreads
      })
    });

    const data = await response.json();

    if (!response.ok) {
      analysisOutput.innerHTML = `<span class="error">${data.error || "Request failed."}</span>`;
      sourcesOutput.textContent = "";
      if (contextOutput) contextOutput.textContent = "";
      return;
    }

    renderSources(data.sources || [], Boolean(data.no_relevant_updates), Boolean(data.fallback_triggered));
    renderAnalysis(data.news?.content || data.analysis || "No analysis returned.");
    // Industry Context & RM Considerations is currently deactivated in the UI.
    // renderContext(data.context || "");
  } catch (error) {
    analysisOutput.innerHTML = `<span class="error">Network error.</span>`;
    sourcesOutput.textContent = "";
    if (contextOutput) contextOutput.textContent = "";
  } finally {
    button.disabled = false;
  }
});

populateSectors();
populateSubsectors();
renderCountryDropdownFor("purchase");
renderCountryDropdownFor("sales");
updateTradeFlowVisibility();

sectorBox.addEventListener("change", function () {
  sectorBox.classList.remove("auto-filled");
  subsectorBox.classList.remove("auto-filled");
  populateSubsectors();
  if (document.activeElement === industryBox) renderIsicDropdown();
});
subsectorBox.addEventListener("change", function () {
  subsectorBox.classList.remove("auto-filled");
  if (document.activeElement === industryBox) renderIsicDropdown();
});
updateFxButton.addEventListener("click", updateFxOnly);
