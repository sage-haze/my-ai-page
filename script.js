const button = document.getElementById("send");
const promptBox = document.getElementById("prompt");
const outputBox = document.getElementById("output");

const toneBox = document.getElementById("tone");
const lengthBox = document.getElementById("length");
const formatBox = document.getElementById("format");
const audienceBox = document.getElementById("audience");

button.addEventListener("click", async function () {
  const prompt = promptBox.value.trim();
  const tone = toneBox.value;
  const length = lengthBox.value;
  const format = formatBox.value;
  const audience = audienceBox.value;

  if (!prompt) {
    outputBox.textContent = "Please type a request first.";
    return;
  }

  button.disabled = true;
  outputBox.textContent = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt,
        tone,
        length,
        format,
        audience
      })
    });

    if (!response.ok || !response.body) {
      outputBox.textContent = "Request failed.";
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n");
      buffer = parts.pop();

      for (const line of parts) {
        if (!line.startsWith("data: ")) continue;

        const data = line.slice(6).trim();

        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);

          if (json.type === "response.output_text.delta") {
            outputBox.textContent += json.delta;
          }
        } catch (e) {
        }
      }
    }
  } catch (error) {
    outputBox.textContent = "Network error. Please try again.";
  } finally {
    button.disabled = false;
  }
});
