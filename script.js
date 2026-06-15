const button = document.getElementById("send");
const updateFxButton = document.getElementById("updateFx");

const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const fxTenorBox = document.getElementById("fxTenor");
const conversationGoalBox = document.getElementById("conversationGoal");
const relationshipContextBox = document.getElementById("relationshipContext");
const cashPositionBox = document.getElementById("cashPosition");
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
const FALLBACK_SUGGESTION_MAX_RESULTS = 8;

const GENERIC_QUERY_TERMS = new Set([
  "business", "company", "industry", "activity", "activities", "service", "services",
  "product", "products", "goods", "general", "other", "misc", "miscellaneous"
]);

const ROLE_FAMILIES = [
  {
    id: "agriculture",
    label: "Agriculture / farming",
    terms: ["farm", "farming", "farmer", "grower", "plantation", "crop", "livestock", "animal production", "forestry", "logging", "fishing", "aquaculture"],
    anchors: ["agriculture", "crop", "animal production", "hunting", "forestry", "logging", "fishing", "aquaculture", "growing", "farming"]
  },
  {
    id: "extraction",
    label: "Mining / extraction",
    terms: ["mine", "mining", "miner", "quarry", "quarrying", "extraction", "extract", "oil field", "gas field"],
    anchors: ["mining", "quarrying", "extraction", "coal", "lignite", "petroleum", "natural gas", "metal ores", "support service"]
  },
  {
    id: "manufacturing",
    label: "Manufacturing / processing",
    terms: ["manufacture", "manufacturer", "manufacturing", "factory", "producer", "production", "processing", "process", "maker", "assembly", "assembler", "fabrication", "fabricate", "plant"],
    anchors: ["manufacture", "manufacturing", "processing", "production", "fabricated", "assembly", "repair and installation"]
  },
  {
    id: "utilities",
    label: "Utilities / environmental services",
    terms: ["utility", "utilities", "power", "electricity", "gas", "steam", "water supply", "waste", "sewerage", "recycling", "remediation", "renewable"],
    anchors: ["electricity", "gas", "steam", "air conditioning", "water", "sewerage", "waste", "materials recovery", "remediation"]
  },
  {
    id: "construction_real_estate",
    label: "Construction / real estate",
    terms: ["construction", "contractor", "building", "civil engineering", "developer", "development", "property", "real estate", "condominium", "apartment", "housing", "office building", "shopping center", "factory construction"],
    anchors: ["construction", "building", "civil engineering", "specialized construction", "real estate", "development", "residential", "condominium", "apartment", "commercial building", "leased property"]
  },
  {
    id: "trade",
    label: "Wholesale / retail trade",
    terms: ["wholesale", "wholesaler", "retail", "retailer", "shop", "store", "dealer", "trader", "trading", "distributor", "distribution", "importer", "exporter", "supplier"],
    anchors: ["wholesale", "retail", "trade", "repair of motor vehicles", "dealer", "distribution"]
  },
  {
    id: "transport_storage",
    label: "Transport / logistics",
    terms: ["transport", "transportation", "logistics", "freight", "shipping", "cargo", "courier", "postal", "warehouse", "warehousing", "storage", "forwarder", "fleet", "air transport", "water transport", "land transport"],
    anchors: ["transport", "transportation", "storage", "warehousing", "support activities for transportation", "postal", "courier", "cargo", "pipelines", "air transport", "water transport", "land transport"]
  },
  {
    id: "hospitality_food_service",
    label: "Hospitality / food service",
    terms: ["hotel", "resort", "accommodation", "restaurant", "cafe", "catering", "food service", "hospitality", "tourism", "travel"],
    anchors: ["accommodation", "food and beverage service", "hotel", "restaurant", "catering", "travel agency", "tour operator", "reservation service"]
  },
  {
    id: "information_communication",
    label: "Information / communication",
    terms: ["software", "it", "technology", "telecom", "telecommunications", "data centre", "data center", "cloud", "hosting", "programming", "broadcasting", "publishing", "media", "film", "video"],
    anchors: ["information", "communication", "publishing", "motion picture", "television", "broadcasting", "telecommunications", "computer programming", "consultancy", "information service", "data processing", "hosting"]
  },
  {
    id: "financial_insurance",
    label: "Financial / insurance",
    terms: ["bank", "banking", "finance", "financial", "insurance", "insurer", "reinsurance", "pension", "securities", "broker", "asset management", "fund", "leasing", "factoring", "money transfer", "exchange"],
    anchors: ["financial", "insurance", "bank", "credit", "cooperative", "factoring", "swaps", "hedging", "securities", "broker", "asset management", "fund", "money transfer", "bureaux de change"]
  },
  {
    id: "professional_technical",
    label: "Professional / technical services",
    terms: ["legal", "law", "accounting", "audit", "consulting", "consultancy", "head office", "management", "engineering", "architectural", "testing", "research", "advertising", "market research", "veterinary"],
    anchors: ["professional", "scientific", "technical", "legal", "accounting", "head offices", "management consultancy", "architectural", "engineering", "technical testing", "research and development", "advertising", "market research", "veterinary"]
  },
  {
    id: "administrative_support",
    label: "Administrative / support services",
    terms: ["rental", "leasing", "employment", "staffing", "security", "investigation", "cleaning", "landscape", "office support", "business support", "facility", "facilities"],
    anchors: ["administrative", "support service", "rental", "leasing", "employment", "security", "investigation", "services to buildings", "landscape", "office administrative", "office support", "business support"]
  },
  {
    id: "public_education_health",
    label: "Public / education / health",
    terms: ["government", "public administration", "defence", "defense", "social security", "school", "education", "university", "training", "hospital", "clinic", "health", "medical", "care", "social work"],
    anchors: ["public administration", "defence", "social security", "education", "human health", "hospital", "medical", "residential care", "social work"]
  },
  {
    id: "arts_other_services",
    label: "Arts / recreation / other services",
    terms: ["art", "arts", "entertainment", "creative", "museum", "library", "archive", "sports", "recreation", "amusement", "gambling", "membership", "association", "personal service", "repair computers", "household goods", "domestic personnel", "embassy", "international organization"],
    anchors: ["arts", "entertainment", "recreation", "creative", "library", "archives", "museums", "gambling", "sports", "amusement", "membership", "personal service", "repair of computers", "household goods", "households", "extraterritorial"]
  }
];

const DOMAIN_FAMILIES = [
  {
    id: "fish_seafood",
    label: "Fishery / seafood",
    terms: ["seafood", "fish", "fishery", "fishing", "aquaculture", "crustacean", "crustaceans", "mollusc", "molluscs", "shrimp", "prawn"],
    anchors: ["fish", "fishing", "fishery", "aquaculture", "crustaceans", "molluscs", "shrimp", "prawn"]
  },
  {
    id: "agri_food",
    label: "Agriculture / food",
    terms: ["food", "beverage", "agriculture", "crop", "livestock", "forestry", "fishing", "aquaculture", "seafood", "meat", "dairy", "rice", "grain", "sugar", "fruit", "vegetable", "coffee", "feed", "tobacco"],
    anchors: ["food", "beverage", "tobacco", "agriculture", "crop", "animal", "forestry", "fishing", "aquaculture", "meat", "fish", "fruit", "vegetable", "dairy", "grain", "rice", "sugar", "coffee", "feed"]
  },
  {
    id: "textile_apparel",
    label: "Textiles / apparel / leather",
    terms: ["textile", "fabric", "garment", "apparel", "clothing", "fashion", "footwear", "leather", "yarn", "cotton"],
    anchors: ["textile", "wearing apparel", "apparel", "leather", "footwear", "fabric", "yarn", "clothing"]
  },
  {
    id: "wood_paper_printing",
    label: "Wood / paper / printing",
    terms: ["wood", "timber", "furniture wood", "cork", "paper", "pulp", "packaging paper", "printing", "recorded media"],
    anchors: ["wood", "cork", "straw", "plaiting", "paper", "printing", "recorded media"]
  },
  {
    id: "chemicals_energy_materials",
    label: "Chemicals / energy / materials",
    terms: ["chemical", "chemicals", "pharmaceutical", "pharma", "rubber", "plastic", "resin", "fertilizer", "paint", "petroleum", "oil", "gas", "fuel", "coke", "cement", "ceramic", "glass", "non metallic mineral", "metal", "steel", "aluminium", "aluminum"],
    anchors: ["chemical", "pharmaceutical", "rubber", "plastics", "coke", "refined petroleum", "petroleum", "natural gas", "non metallic mineral", "cement", "ceramic", "glass", "basic metals", "fabricated metal", "steel", "metal"]
  },
  {
    id: "automotive_transport_equipment",
    label: "Automotive / transport equipment",
    terms: ["auto", "automotive", "vehicle", "motor vehicle", "motorcycle", "trailer", "auto parts", "vehicle parts", "motor vehicle parts", "transport equipment"],
    anchors: ["motor vehicle", "motorcycle", "trailer", "transport equipment"]
  },
  {
    id: "machinery_electronics",
    label: "Machinery / electronics",
    terms: ["machinery", "machine", "equipment", "electronics", "electrical", "computer", "optical", "semiconductor", "component", "electronic parts", "electrical parts"],
    anchors: ["machinery", "equipment", "electronic", "electrical", "computer", "optical", "component"]
  },
  {
    id: "construction_property",
    label: "Construction / property",
    terms: ["construction", "building", "civil engineering", "infrastructure", "contractor", "property", "real estate", "housing", "residential", "condominium", "apartment", "office building", "shopping center", "commercial building", "land development", "factory"],
    anchors: ["construction", "building", "civil engineering", "real estate", "development", "housing", "residential", "condominium", "apartment", "commercial building", "office building", "shopping center", "land development", "factory"]
  },
  {
    id: "utilities_environment",
    label: "Utilities / waste / environment",
    terms: ["electricity", "power", "gas", "steam", "air conditioning", "water", "sewerage", "waste", "recycling", "materials recovery", "remediation", "environment"],
    anchors: ["electricity", "gas", "steam", "air conditioning", "water", "sewerage", "waste", "materials recovery", "remediation"]
  },
  {
    id: "trade_repair",
    label: "Trade / repair",
    terms: ["wholesale", "retail", "trade", "dealer", "distributor", "import", "export", "motor vehicle repair", "motorcycle repair", "repair"],
    anchors: ["wholesale", "retail", "trade", "repair", "motor vehicles", "motorcycles", "dealer"]
  },
  {
    id: "transport_logistics",
    label: "Transport / logistics",
    terms: ["transport", "logistics", "warehouse", "warehousing", "storage", "postal", "courier", "freight", "cargo", "shipping", "pipeline", "air transport", "water transport", "land transport"],
    anchors: ["transport", "storage", "warehousing", "postal", "courier", "freight", "cargo", "pipeline", "air transport", "water transport", "land transport"]
  },
  {
    id: "hospitality_tourism_foodservice",
    label: "Accommodation / food service / tourism",
    terms: ["accommodation", "hotel", "resort", "restaurant", "food service", "cafe", "catering", "tourism", "travel", "tour operator", "reservation"],
    anchors: ["accommodation", "hotel", "resort", "food and beverage service", "restaurant", "catering", "travel agency", "tour operator", "reservation"]
  },
  {
    id: "digital_media_telecom",
    label: "Digital / media / telecom",
    terms: ["publishing", "media", "film", "video", "television", "music", "broadcasting", "telecom", "telecommunications", "software", "computer programming", "it consulting", "information service", "data", "hosting", "cloud"],
    anchors: ["publishing", "motion picture", "video", "television", "music", "broadcasting", "telecommunications", "computer programming", "consultancy", "information service", "data", "hosting"]
  },
  {
    id: "financial_insurance",
    label: "Financial / insurance",
    terms: ["financial", "finance", "bank", "banking", "commercial bank", "cooperative", "credit", "factoring", "hedging", "securities", "broker", "underwriter", "money transfer", "bureaux de change", "asset management", "fund", "insurance", "reinsurance", "pension"],
    anchors: ["financial", "bank", "cooperative", "credit", "factoring", "hedging", "securities", "broker", "underwriter", "money transfer", "bureaux de change", "asset management", "fund", "insurance", "reinsurance", "pension"]
  },
  {
    id: "professional_business_support",
    label: "Professional / business support",
    terms: ["legal", "accounting", "head office", "management consultancy", "architecture", "engineering", "technical testing", "research", "advertising", "market research", "veterinary", "rental", "leasing", "employment", "security", "cleaning", "landscape", "office support", "business support"],
    anchors: ["legal", "accounting", "head offices", "management consultancy", "architectural", "engineering", "technical testing", "research and development", "advertising", "market research", "veterinary", "rental", "leasing", "employment", "security", "investigation", "services to buildings", "landscape", "office administrative", "business support"]
  },
  {
    id: "public_education_health_social",
    label: "Public / education / health / social",
    terms: ["public administration", "government", "defence", "defense", "social security", "education", "school", "university", "training", "health", "healthcare", "hospital", "clinic", "medical", "residential care", "social work", "welfare"],
    anchors: ["public administration", "defence", "social security", "education", "human health", "health", "hospital", "medical", "residential care", "social work"]
  },
  {
    id: "arts_recreation_other",
    label: "Arts / recreation / other services",
    terms: ["creative", "arts", "entertainment", "library", "archive", "museum", "cultural", "gambling", "betting", "sports", "amusement", "recreation", "membership", "association", "personal service", "household", "domestic personnel", "international organization", "extraterritorial"],
    anchors: ["creative", "arts", "entertainment", "libraries", "archives", "museums", "cultural", "gambling", "betting", "sports", "amusement", "recreation", "membership", "personal service", "household", "domestic", "extraterritorial"]
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
  const words = normaliseSearchText(value).split(" ").filter(word => word.length > 1);
  const expanded = [];
  words.forEach(word => {
    expanded.push(word);
    if (word.length > 4 && word.endsWith("ies")) expanded.push(`${word.slice(0, -3)}y`);
    else if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) expanded.push(word.slice(0, -1));
  });
  return [...new Set(expanded)];
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
  if (term.length < 5 || word.length < 5) return 0;
  if (Math.abs(term.length - word.length) > 4) return 0;
  if (term[0] !== word[0]) return 0;
  return diceCoefficient(term, word);
}

function hasAnyWord(text, words) {
  const haystack = ` ${normaliseSearchText(text)} `;
  return words.some(word => haystack.includes(` ${normaliseSearchText(word)} `));
}


function getPreparedIsicEntry(entry) {
  if (!entry) return { entryText: "", fullEntryText: "", entryWords: [] };
  if (!entry.__searchIndex) {
    const entryText = normaliseSearchText(`${entry.code} ${entry.description}`);
    const fullEntryText = normaliseSearchText(`${entry.code} ${entry.description} ${entry.sector || ""} ${entry.subsector || ""}`);
    const detailText = normaliseSearchText(`${entry.description || ""} ${entry.subsector || ""}`);
    entry.__searchIndex = {
      entryText,
      fullEntryText,
      entryWords: uniqueWords(fullEntryText),
      detailText,
      detailWords: uniqueWords(detailText),
      businessRelevance: null
    };
  }
  return entry.__searchIndex;
}

function getBusinessRelevance(entry) {
  const prepared = getPreparedIsicEntry(entry);
  if (prepared.businessRelevance !== null) return prepared.businessRelevance;

  let relevance = 0;
  BUSINESS_RELEVANCE_TERMS.forEach(term => {
    if (prepared.entryWords.includes(term)) relevance += 1;
  });

  const sectorText = normaliseSearchText(entry.sector || "");
  if (COMMERCIAL_FALLBACK_SECTORS.includes(sectorText)) relevance += 2;

  prepared.businessRelevance = Math.min(relevance, 6);
  return prepared.businessRelevance;
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

function phraseOrWordMatches(term, queryText, queryWords, threshold = 0.88) {
  const cleaned = normaliseSearchText(term);
  if (!cleaned) return false;
  if (cleaned.includes(" ")) return queryText.includes(cleaned);
  if (queryWords.includes(cleaned)) return true;
  // Keep family detection deliberately conservative. Fuzzy matching still exists in the
  // normal ISIC text score, but role/domain families should not fire from weak overlap.
  return queryWords.some(word => word.length >= 5 && cleaned.length >= 5 && wordSimilarity(word, cleaned) >= threshold);
}

function getFamilyMatch(family, queryText, queryWords) {
  const matchedTerms = family.terms.filter(term => phraseOrWordMatches(term, queryText, queryWords));
  return {
    matched: matchedTerms.length > 0,
    terms: matchedTerms
  };
}


function queryHasDomainSignal(queryText, queryWords) {
  return DOMAIN_FAMILIES.some(family => getFamilyMatch(family, queryText, queryWords).matched);
}

function countAnchorHits(family, entryText, entryWords) {
  const hits = [];
  family.anchors.forEach(anchor => {
    const cleaned = normaliseSearchText(anchor);
    if (!cleaned) return;
    let matched = cleaned.includes(" ")
      ? entryText.includes(cleaned)
      : entryWords.includes(cleaned);
    if (matched && (entryText.includes(`except of ${cleaned}`) || entryText.includes(`except ${cleaned}`))) {
      matched = false;
    }
    if (matched) hits.push(anchor);
  });
  return [...new Set(hits)];
}

function getRoleDomainScores(entry, queryText, queryWords, preparedEntry = null) {
  if (!queryWords.length) {
    return { roleScore: 0, domainScore: 0, signalScore: 0, matchedRoles: [], matchedDomains: [] };
  }

  const prepared = preparedEntry || getPreparedIsicEntry(entry);
  const entryText = prepared.detailText || prepared.fullEntryText;
  const entryWords = prepared.detailWords || prepared.entryWords;
  let roleScore = 0;
  let domainScore = 0;
  const matchedRoles = [];
  const matchedDomains = [];

  ROLE_FAMILIES.forEach(family => {
    const queryMatch = getFamilyMatch(family, queryText, queryWords);
    if (!queryMatch.matched) return;
    const anchorHits = countAnchorHits(family, entryText, entryWords);
    if (!anchorHits.length) return;

    roleScore += Math.min(95, 38 + anchorHits.length * 14 + queryMatch.terms.length * 8);
    matchedRoles.push(family.label);
  });

  DOMAIN_FAMILIES.forEach(family => {
    const queryMatch = getFamilyMatch(family, queryText, queryWords);
    if (!queryMatch.matched) return;
    const anchorHits = countAnchorHits(family, entryText, entryWords);
    if (!anchorHits.length) return;

    const exactQueryAnchorHits = queryMatch.terms.filter(term => {
      const cleaned = normaliseSearchText(term);
      return cleaned && entryText.includes(cleaned);
    }).length;
    domainScore += Math.min(130, 45 + anchorHits.length * 12 + queryMatch.terms.length * 8 + exactQueryAnchorHits * 45);
    matchedDomains.push(family.label);
  });

  return {
    roleScore,
    domainScore,
    signalScore: roleScore + domainScore,
    matchedRoles: [...new Set(matchedRoles)],
    matchedDomains: [...new Set(matchedDomains)]
  };
}

function getConceptScore(entry, queryWords, queryText = "") {
  // Backward-compatible wrapper: conceptScore now means general business role/object signal,
  // not a small hand-tuned keyword list. This keeps matching inclusive across the available
  // sector/subsector taxonomy while avoiding overfitting to a few stress-test words.
  return getRoleDomainScores(entry, queryText || queryWords.join(" "), queryWords).signalScore;
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


function queryMatchesRole(roleId, queryText, queryWords) {
  const family = ROLE_FAMILIES.find(item => item.id === roleId);
  return family ? getFamilyMatch(family, queryText, queryWords).matched : false;
}

function descriptionHasAny(entry, terms) {
  const text = normaliseSearchText(entry?.description || "");
  return terms.some(term => {
    const cleaned = normaliseSearchText(term);
    return cleaned.includes(" ") ? text.includes(cleaned) : uniqueWords(text).includes(cleaned);
  });
}

function scoreIsicMatch(entry, query) {
  const q = normaliseSearchText(query);
  const prepared = getPreparedIsicEntry(entry);
  const entryText = prepared.entryText;
  const fullEntryText = prepared.fullEntryText;
  const entryWords = prepared.entryWords;

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
  let roleScore = 0;
  let domainScore = 0;
  let matchedRoles = [];
  let matchedDomains = [];
  let penaltyScore = 0;

  // Sector/subsector helps ranking, but should not fully determine the answer.
  contextWords.forEach(term => {
    const best = Math.max(0, ...entryWords.map(word => wordSimilarity(term, word)));
    if (best >= 0.9) contextScore += best * 16;
    else if (best >= 0.8) contextScore += best * 8;
  });

  if (!q) {
    score = contextScore + businessScore;
    return { score, queryScore: 0, conceptScore: 0, roleScore: 0, domainScore: 0, contextScore, businessScore, penaltyScore, matchedRoles: [], matchedDomains: [] };
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

  const roleDomain = getRoleDomainScores(entry, q, queryWords, prepared);
  roleScore = roleDomain.roleScore;
  domainScore = roleDomain.domainScore;
  conceptScore = roleDomain.signalScore;
  matchedRoles = roleDomain.matchedRoles;
  matchedDomains = roleDomain.matchedDomains;
  penaltyScore = getServiceContextPenalty(entry, queryWords);

  // If the query clearly contains an object/domain signal, avoid elevating entries
  // that only match a generic role word such as manufacture, distributor or operator.
  if (queryHasDomainSignal(q, queryWords) && domainScore === 0 && queryWords.length > 1) {
    penaltyScore += 85;
  }

  if (queryMatchesRole("trade", q, queryWords)) {
    const descriptionLooksTrade = descriptionHasAny(entry, ["wholesale", "retail", "trade", "dealer", "distribution"]);
    const descriptionLooksRepair = descriptionHasAny(entry, ["maintenance", "repair"]);
    if (!descriptionLooksTrade && descriptionLooksRepair) penaltyScore += 70;
  }

  if (queryMatchesRole("manufacturing", q, queryWords)) {
    const descriptionLooksManufacturing = descriptionHasAny(entry, ["manufacture", "manufacturing", "processing", "production", "assembly"]);
    const descriptionLooksNonManufacturing = descriptionHasAny(entry, ["wholesale", "retail", "maintenance", "repair", "rental", "leasing"]);
    if (!descriptionLooksManufacturing && descriptionLooksNonManufacturing) penaltyScore += 55;
  }

  // Business relevance is a tie-breaker and safety signal, not a hardcoded synonym map.
  // It helps broad product/service descriptions favour commercial activities over generic
  // education, accommodation, membership, or public-service categories when confidence is low.
  score = queryScore + conceptScore + contextScore + businessScore - penaltyScore;

  return { score, queryScore, conceptScore, roleScore, domainScore, contextScore, businessScore, penaltyScore, matchedRoles, matchedDomains };
}


function getFallbackIsicSuggestions(q, scored) {
  const selectedSector = normaliseSearchText(sectorBox?.value || "");
  const selectedSubsector = normaliseSearchText(subsectorBox?.value || "");
  const queryWords = uniqueWords(q).filter(term => term.length > 2 && !GENERIC_QUERY_TERMS.has(term));

  function mark(entries, reason) {
    const seen = new Set();
    return entries
      .filter(entry => entry && entry.code && !seen.has(entry.code) && seen.add(entry.code))
      .slice(0, FALLBACK_SUGGESTION_MAX_RESULTS)
      .map(entry => ({
        ...entry,
        fallbackSuggestion: true,
        fallbackReason: reason
      }));
  }

  // Best fallback: if the user has already selected sector/subsector, always offer
  // activities inside that context. This matters because ISIC selection is compulsory.
  if (selectedSubsector) {
    const inSubsector = scored.filter(entry => normaliseSearchText(entry.subsector || "") === selectedSubsector);
    if (inSubsector.length) return mark(inSubsector, "Suggested from selected subsector");
  }

  if (selectedSector) {
    const inSector = scored.filter(entry => normaliseSearchText(entry.sector || "") === selectedSector);
    if (inSector.length) return mark(inSector, "Suggested from selected sector");
  }

  // If there is a weak but visible role/domain signal, show those rather than nothing.
  const weakSignalMatches = scored.filter(entry =>
    (entry.roleScore > 0 || entry.domainScore > 0 || entry.conceptScore > 0) &&
    (entry.penaltyScore || 0) < 90
  );
  if (weakSignalMatches.length) return mark(weakSignalMatches, "Low-confidence related suggestion");

  // Last fallback: show broad starting points across the available sector taxonomy.
  // This avoids a dead-end compulsory field while making the low-confidence nature clear.
  const sectorOrder = typeof SECTOR_DATA !== "undefined" ? Object.keys(SECTOR_DATA) : [];
  const representatives = [];
  sectorOrder.forEach(sectorName => {
    const representative = ISIC_DATA.find(entry => entry.sector === sectorName);
    if (representative) representatives.push(representative);
  });

  return mark(representatives.length ? representatives : scored, q ? "Broad fallback suggestions" : "Suggested starting points");
}

function getIsicMatches(query) {
  const q = normaliseSearchText(query);
  const selectedSector = normaliseSearchText(sectorBox?.value || "");
  const hasSelectedSector = Boolean(selectedSector);

  const scored = ISIC_DATA
    .map(entry => ({ ...entry, ...scoreIsicMatch(entry, q) }))
    .sort((a, b) => b.score - a.score || a.description.localeCompare(b.description));

  // ISIC selection is compulsory, so never leave the user with a dead-end dropdown.
  // Empty input uses selected sector/subsector context where possible, then broad starting points.
  if (!q) {
    const contextMatches = scored
      .filter(entry => entry.contextScore > 0)
      .slice(0, FALLBACK_SUGGESTION_MAX_RESULTS);
    if (contextMatches.length) return contextMatches;
    return getFallbackIsicSuggestions(q, scored);
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

  return getFallbackIsicSuggestions(q, scored);
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


function getIsicMatchMeta(entry) {
  const reasons = [];
  if (entry.matchedRoles?.length) reasons.push(entry.matchedRoles.slice(0, 1).join(", "));
  if (entry.matchedDomains?.length) reasons.push(entry.matchedDomains.slice(0, 1).join(", "));
  if (entry.fallbackSuggestion && entry.fallbackReason) reasons.push(entry.fallbackReason);
  if (!reasons.length && entry.subsector) reasons.push(entry.subsector);
  if (!reasons.length && entry.sector) reasons.push(entry.sector);

  const context = [entry.sector, entry.subsector].filter(Boolean).join(" • ");
  const reasonText = reasons.length ? `${entry.fallbackSuggestion ? "Suggested" : "Matched"}: ${reasons.join(" + ")}` : "";
  return [reasonText, context].filter(Boolean).join(" | ");
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

  const hasFallbackSuggestions = matches.every(entry => entry.fallbackSuggestion);
  const hasStrongQueryMatch = matches.some(entry => entry.queryScore >= 35);
  const heading = hasFallbackSuggestions
    ? (query ? "Suggested ISIC activities to choose from" : "Suggested ISIC activities")
    : (query ? (hasStrongQueryMatch ? "Closest ISIC matches" : "Related ISIC suggestions") : "Suggested ISIC activities");

  isicDropdown.classList.remove("hidden");
  industryBox.setAttribute("aria-expanded", "true");
  isicDropdown.innerHTML = `
    <div class="isic-dropdown-heading">${heading}</div>
    ${matches.map(entry => `
      <button type="button" class="isic-option" data-code="${entry.code}" role="option">
        <strong>${entry.code}</strong>
        <span>
          <span class="isic-description">${entry.description}</span>
          <small>${getIsicMatchMeta(entry)}</small>
        </span>
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

function normaliseConversationLabel(label) {
  const clean = String(label || "").trim().toLowerCase();
  const labelMap = {
    "plain-english context": "Why this may matter",
    "plain english context": "Why this may matter",
    "background cue": "Why this may matter",
    "why this may matter": "Why this may matter",
    "client relevance lens": "Why this may matter",
    "transaction banking angle": "Why this may matter",
    "gentle observation": "Useful observation to offer",
    "useful observation": "Useful observation to offer",
    "useful observation to offer": "Useful observation to offer",
    "soft invitation": "Leave space",
    "leave space": "Leave space",
    "if client engages": "If they pick up on it",
    "if they pick up on it": "If they pick up on it",
    "bank relevance": "Bank angle / handoff",
    "bank angle": "Bank angle / handoff",
    "bank angle / handoff": "Bank angle / handoff",
    "handoff cue": "Bank angle / handoff"
  };
  return labelMap[clean] || label || "Context";
}

function conversationSectionClass(label) {
  const normalised = normaliseConversationLabel(label).toLowerCase();
  if (normalised === "why this may matter") return "conversation-section background-cue";
  if (normalised === "useful observation to offer") return "conversation-section hero-observation";
  if (normalised === "leave space") return "conversation-section soft-invitation";
  if (normalised === "if they pick up on it") return "conversation-section follow-up-path";
  if (normalised === "bank angle / handoff") return "conversation-section bank-handoff";
  return "conversation-section";
}

function mergeAdjacentConversationSections(sections) {
  const merged = [];
  sections.forEach(section => {
    const label = normaliseConversationLabel(section.label);
    const text = String(section.text || "").trim();
    if (!text) return;
    const last = merged[merged.length - 1];
    if (last && last.label === label) {
      last.text = `${last.text} ${text}`.trim();
    } else {
      merged.push({ label, text });
    }
  });
  return merged;
}

function parseConversationCardBlock(block) {
  const lines = String(block || "")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const heading = lines.shift() || "Card";
  const sections = [];
  const sectionPattern = /^(Why this may matter|Background cue|Plain-English context|Plain English context|Client relevance lens|Transaction banking angle|Useful observation(?: to offer)?|Gentle observation|Leave space|Soft invitation|If they pick up on it|If client engages|Bank angle(?: \/ handoff)?|Bank relevance|Handoff cue)\s*:\s*(.*)$/i;
  let current = null;

  lines.forEach(line => {
    const match = line.match(sectionPattern);
    if (match) {
      current = {
        label: normaliseConversationLabel(match[1]),
        text: match[2] || ""
      };
      sections.push(current);
    } else if (current) {
      current.text = `${current.text} ${line}`.trim();
    } else {
      sections.push({ label: "Why this may matter", text: line });
    }
  });

  return { heading, sections: mergeAdjacentConversationSections(sections) };
}

function renderConversationCards(text) {
  const cardBlocks = String(text || "")
    .split(/(?=Card\s+\d+\s*:)/i)
    .map(block => block.trim())
    .filter(Boolean);

  if (cardBlocks.length === 0) return false;

  analysisOutput.innerHTML = cardBlocks.map(block => {
    const { heading, sections } = parseConversationCardBlock(block);
    const cleanHeading = heading.replace(/^(Card\s+\d+\s*:\s*)/i, "").trim() || heading;
    const sectionHtml = sections.map(section => `
      <div class="${conversationSectionClass(section.label)}">
        <div class="conversation-label">${escapeHtml(section.label)}</div>
        <div class="conversation-text">${escapeHtml(section.text)}</div>
      </div>
    `).join("");

    return `
      <div class="theme-card conversation-card">
        <h3>${escapeHtml(cleanHeading)}</h3>
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

let isicSearchTimer = null;
industryBox.addEventListener("input", function () {
  selectedIsic = null;
  industryBox.classList.remove("valid-selection");
  selectedIsicBox.textContent = "Select one suggested ISIC activity. Free-text entries are not accepted as final input.";
  window.clearTimeout(isicSearchTimer);
  isicSearchTimer = window.setTimeout(renderIsicDropdown, 160);
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

function getClientProfile() {
  return {
    relationshipContext: relationshipContextBox?.value || "unknown",
    cashPosition: cashPositionBox?.value || "unknown"
  };
}

button.addEventListener("click", async function () {
  const sector = sectorBox.value;
  const subsector = subsectorBox.value;
  const industry = selectedIsic ? selectedIsic.description : industryBox.value.trim();
  const isicCode = selectedIsic?.code || "";
  const timeframe = timeframeBox.value;
  const fxTenor = fxTenorBox?.value || "30";
  const conversationGoal = conversationGoalBox?.value || "general_check_in";
  const clientProfile = getClientProfile();
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
        clientProfile,
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
