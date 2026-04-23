const button = document.getElementById("send");
const promptBox = document.getElementById("prompt");
const outputBox = document.getElementById("output");

const modeBox = document.getElementById("mode");
const generalFields = document.getElementById("general-fields");
const approvedNewsFields = document.getElementById("approved-news-fields");

const toneBox = document.getElementById("tone");
const lengthBox = document.getElementById("length");
const formatBox = document.getElementById("format");
const audienceBox = document.getElementById("audience");

const industryBox = document.getElementById("industry");
const timeframeBox = document.getElementById("timeframe");
const situationBox = document.getElementById("situation");

function updateModeUI() {
  const mode = modeBox.value;

  if (mode === "approved_news") {
    generalFields.classList.add("hidden");
    approvedNewsFields.classList.remove("hidden");
  } else {
    generalFields.classList.remove("hidden");
    approvedNewsFields.classList.add("hidden");
  }
}

modeBox.addEventListener("change", updateModeUI);
updateModeUI();

button.addEventListener("click", async function () {
  const mode = modeBox.value;
  const prompt = promptBox.value.trim();

  if (!prompt) {
    outputBox.textContent = "Please type a request first.";
    return;
  }

  const payload = {
    mode,
    prompt
  };

  if (mode === "general") {
    payload.tone = toneBox.value;
    payload.length = lengthBox.value;
    payload.format = formatBox.value;
    payload.audience = audienceBox.value;
  }

  if (mode === "approved_news") {
    payload.industry = industryBox.value;
    payload.timeframe = timeframeBox.value;
    payload.situation = situationBox.value.trim();

    if (!payload.industry) {
      outputBox.textContent = "Please select an industry.";
      return;
    }

    if (!payload.situation) {
      outputBox.textContent = "Please describe your situation.";
      return;
    }
  }

  button.disabled = true;
  outputBox.textContent = "Loading...";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    outputBox.textContent = text;
  } catch (error) {
    outputBox.textContent = "Network error. Please try again.";
  } finally {
    button.disabled = false;
  }
});
