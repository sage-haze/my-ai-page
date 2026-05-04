async function runResearch() {
  const res = await fetch('/api/chat', { method: 'POST' });
  const data = await res.json();

  renderFx(data.fx);
  renderFxContext(data.fx_context);
  renderAnalysis(data.news?.content);
  renderContext(data.context);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatRate(num) {
  return Number(num).toFixed(4);
}

function cleanPair(pair) {
  return pair.replace('=X','');
}

function renderFx(fx) {
  if (!fx) return;
  const container = document.getElementById("fx");

  container.innerHTML = fx.map(f => `
    <div class="card">
      <h3>${cleanPair(f.pair)}</h3>
      <p>Latest: ${formatRate(f.latest_rate)}</p>
      <p>High: ${formatRate(f.highest_rate)} (${formatDate(f.high_date)})</p>
      <p>Low: ${formatRate(f.lowest_rate)} (${formatDate(f.low_date)})</p>
    </div>
  `).join("");
}

function renderFxContext(text) {
  if (!text) return;
  document.getElementById("fx-context").innerHTML = `
    <div class="card">
      <h2>FX Context</h2>
      <p>${text}</p>
    </div>
  `;
}

function renderAnalysis(text) {
  if (!text) return;
  document.getElementById("analysis").innerHTML = `
    <div class="card">
      <h2>Analysis</h2>
      <p>${text}</p>
    </div>
  `;
}

function renderContext(context) {
  if (!context || !context.points) return;

  document.getElementById("context").innerHTML = `
    <h2>Industry Context & RM Considerations</h2>
    ${context.points.map(p => `
      <div class="card">
        <h3>${p.title}</h3>
        <p>${p.explanation}</p>
        <ul>${p.rm_considerations.map(c => `<li>${c}</li>`).join("")}</ul>
      </div>
    `).join("")}
  `;
}
