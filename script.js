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
