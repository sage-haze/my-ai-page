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

  fxOutput.innerHTML = `
    <div class="fx-rate">1 ${fx.base} = ${fx.rate} THB</div>
    <div class="fx-meta">
      Pair: ${fx.pair}<br>
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
