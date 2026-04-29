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

// ---------- DOM ----------
const button = document.getElementById("send");

const sectorBox = document.getElementById("sector");
const subsectorBox = document.getElementById("subsector");
const timeframeBox = document.getElementById("timeframe");

const countrySearch = document.getElementById("countrySearch");
const countryDropdown = document.getElementById("countryDropdown");
const selectedCountriesBox = document.getElementById("selectedCountries");

const defaultPromptBox = document.getElementById("defaultPrompt");

const analysisOutput = document.getElementById("analysisOutput");
const sourcesOutput = document.getElementById("sourcesOutput");
const fxOutput = document.getElementById("fxOutput");


// ---------- COUNTRY DATA (expand later if desired) ----------
const COUNTRIES = [
["Singapore","SG"],
["Malaysia","MY"],
["Thailand","TH"],
["Indonesia","ID"],
["Philippines","PH"],
["Vietnam","VN"],
["Japan","JP"],
["China","CN"],
["India","IN"],
["Hong Kong","HK"],
["Taiwan","TW"],
["South Korea","KR"],
["Australia","AU"],
["United States","US"],
["United Kingdom","GB"],
["Germany","DE"],
["France","FR"],
["Netherlands","NL"],
["Switzerland","CH"],
["United Arab Emirates","AE"],
["Saudi Arabia","SA"],
["Brazil","BR"],
["Mexico","MX"],
["Canada","CA"],
["South Africa","ZA"]
];

let selectedCountries = [];


// ---------- HELPERS ----------
function countryLabel(country){
  return `${country.name} (${country.code})`;
}

function getSelectedCurrencies(){
  return Array
    .from(document.querySelectorAll('input[name="currency"]:checked'))
    .map(i => i.value);
}


// ---------- SECTOR / SUBSECTOR ----------
function populateSectors(){
  Object.keys(SECTOR_DATA).forEach(sector=>{
    const option=document.createElement("option");
    option.value=sector;
    option.textContent=sector;
    sectorBox.appendChild(option);
  });
}

function populateSubsectors(){
  const sector=sectorBox.value;

  subsectorBox.innerHTML="";

  if(!sector){
    subsectorBox.disabled=true;
    subsectorBox.innerHTML=`<option value="">Select a sector first</option>`;
    return;
  }

  subsectorBox.disabled=false;

  subsectorBox.innerHTML=`
<option value="">Select a subsector</option>
`;

  SECTOR_DATA[sector].forEach(sub=>{
    const option=document.createElement("option");
    option.value=sub;
    option.textContent=sub;
    subsectorBox.appendChild(option);
  });
}


// ---------- COUNTRIES ----------
function renderCountryDropdown(){

  const search=(countrySearch.value || "").toLowerCase().trim();

  const filtered=COUNTRIES
    .map(([name,code])=>({name,code}))
    .filter(country=>{
      return countryLabel(country)
        .toLowerCase()
        .includes(search);
    });

  countryDropdown.innerHTML=filtered.map(country=>{

    const checked=
      selectedCountries.some(
        c=>c.code===country.code
      ) ? "checked":"";

    return `
<label class="country-option">
<input type="checkbox"
 value="${country.code}"
 ${checked}>
${countryLabel(country)}
</label>
`;

  }).join("");

  countryDropdown
    .querySelectorAll("input")
    .forEach(box=>{

      box.addEventListener("change",function(){

        const country=
          COUNTRIES
            .map(([name,code])=>({name,code}))
            .find(
              c=>c.code===box.value
            );

        if(box.checked){

          if(
            !selectedCountries.some(
             c=>c.code===country.code
            )
          ){
            selectedCountries.push(country);
          }

        } else {

          selectedCountries=
            selectedCountries.filter(
             c=>c.code!==country.code
            );
        }

        renderSelectedCountries();

        countrySearch.value="";
        countryDropdown.classList.add("hidden");

        renderCountryDropdown();

      });

    });

}


function renderSelectedCountries(){

  if(selectedCountries.length===0){
    selectedCountriesBox.innerHTML="";
    return;
  }

  selectedCountriesBox.innerHTML=
    selectedCountries
      .map(country=>`
<span class="country-chip">
${countryLabel(country)}
<button
type="button"
data-code="${country.code}">
×
</button>
</span>
`).join("");

 selectedCountriesBox
   .querySelectorAll("button")
   .forEach(btn=>{

      btn.addEventListener("click",function(){

        selectedCountries=
          selectedCountries.filter(
            c=>c.code!==btn.dataset.code
          );

        renderSelectedCountries();
        renderCountryDropdown();

      });

   });
}



// ---------- FX ----------
function renderFx(fxList){

 if(!fxList || fxList.length===0){
   fxOutput.textContent="No FX data returned.";
   return;
 }

 const nonThb=
   fxList.filter(
     fx=>!fx.skip && !fx.error
   );

 if(nonThb.length===0){
   fxOutput.textContent="No non-THB FX selected.";
   return;
 }

 const summaryRows=
 nonThb.map(fx=>`
<tr>
<td>${fx.pair}</td>
<td>${fx.latest_rate}</td>
<td>${fx.highest_rate}</td>
<td>${fx.highest_date}</td>
<td>${fx.lowest_rate}</td>
<td>${fx.lowest_date}</td>
</tr>
`).join("");

 const summaryTable=`
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
<tbody>
${summaryRows}
</tbody>
</table>
`;

 const detailBlocks=
 nonThb.map(fx=>{

   const rows=
   fx.series.map(item=>`
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

<tbody>
${rows}
</tbody>
</table>
</div>
`;

 }).join("");

 fxOutput.innerHTML=`
${summaryTable}

<div class="fx-grid">
${detailBlocks}
</div>
`;

}



// ---------- SOURCES ----------
function renderSources(sources){

 if(!sources || sources.length===0){
   sourcesOutput.textContent="No sources found.";
   return;
 }

 sourcesOutput.innerHTML=
 sources.map((source,i)=>`
<div class="source-item">

<a
class="source-title"
href="${source.url}"
target="_blank"
rel="noopener noreferrer">

[${i+1}] ${source.title}

</a>

<div class="source-meta">
${source.domain || source.source}
•
${source.published_at || "Unknown date"}
</div>

<div class="source-link">
${source.url}
</div>

</div>
`).join("");

}



// ---------- COUNTRY DROPDOWN UX ----------
countrySearch.addEventListener(
"focus",
function(){
 countryDropdown.classList.remove("hidden");
 renderCountryDropdown();
}
);

countrySearch.addEventListener(
"input",
function(){
 countryDropdown.classList.remove("hidden");
 renderCountryDropdown();
}
);

document.addEventListener(
"click",
function(e){

 if(
   !e.target.closest(".country-picker")
 ){
   countryDropdown.classList.add("hidden");
 }

}
);


// ---------- SUBMIT ----------
button.addEventListener(
"click",
async function(){

 const sector=sectorBox.value;
 const subsector=subsectorBox.value;
 const timeframe=timeframeBox.value;

 const currencies=getSelectedCurrencies();

 const countries=
 selectedCountries.map(c=>({
   name:c.name,
   code:c.code,
   label:countryLabel(c)
 }));

 const defaultPrompt=
 defaultPromptBox.value.trim();

 if(!sector){
   analysisOutput.textContent=
   "Please select a sector.";
   return;
 }

 if(!subsector){
   analysisOutput.textContent=
   "Please select a subsector.";
   return;
 }

 if(currencies.length===0){
   analysisOutput.textContent=
   "Please select at least one currency.";
   return;
 }

 if(countries.length===0){
   analysisOutput.textContent=
   "Please select at least one country.";
   return;
 }

 if(!defaultPrompt){
   analysisOutput.textContent=
   "Please enter a prompt.";
   return;
 }

 button.disabled=true;

 fxOutput.innerHTML=
 `<span class="loading">Checking FX...</span>`;

 analysisOutput.innerHTML=
 `<span class="loading">Researching news...</span>`;

 sourcesOutput.innerHTML=
 `<span class="loading">Loading sources...</span>`;

 try{

   const response=
   await fetch(
     "/api/chat",
     {
       method:"POST",
       headers:{
         "Content-Type":"application/json"
       },
       body:JSON.stringify({
         sector,
         subsector,
         timeframe,
         currencies,
         countries,
         defaultPrompt
       })
     }
   );

   const data=
     await response.json();

   if(!response.ok){

      analysisOutput.innerHTML=
      `<span class="error">
      ${data.error || "Request failed."}
      </span>`;

      fxOutput.textContent="";
      sourcesOutput.textContent="";
      return;
   }

   renderFx(data.fx || []);
   renderSources(data.sources || []);

   analysisOutput.textContent=
      data.analysis ||
      "No analysis returned.";

 }

 catch(error){

   analysisOutput.innerHTML=
   `<span class="error">
   Network error.
   </span>`;

   fxOutput.textContent="";
   sourcesOutput.textContent="";
 }

 finally{
   button.disabled=false;
 }

}
);


// ---------- INIT ----------
populateSectors();
populateSubsectors();
renderCountryDropdown();

sectorBox.addEventListener(
"change",
populateSubsectors
);
