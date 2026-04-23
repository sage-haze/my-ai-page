export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const mode = body.mode || "general";
    const prompt = (body.prompt || "").trim();

    if (!prompt) {
      return new Response("Please type a message first.", { status: 400 });
    }

    let finalPrompt = "";
    let tools = [];

    if (mode === "news") {
      const topic = (body.topic || "").trim();
      const situation = (body.situation || "").trim();
      const timeWindow = body.timeWindow || "past 30 days";
      const region = body.region || "global";

      if (!topic) {
        return new Response("Please enter a news topic.", { status: 400 });
      }

      if (!situation) {
        return new Response("Please describe your situation.", { status: 400 });
      }

      finalPrompt = `
You are a research assistant.

Search the web for recent news related to: ${topic}

Focus on:
- region: ${region}
- time window: ${timeWindow}

User's situation:
${situation}

Additional user request:
${prompt}

Please produce:
1. A short summary of the most relevant recent news
2. 3 to 5 key developments
3. Insights specifically applicable to the user's situation
4. Risks and opportunities for the user's situation
5. A short conclusion with practical takeaways

Use recent and credible web sources where possible.
`.trim();

      tools = [{ type: "web_search_preview" }];
    } else {
      const tone = body.tone || "friendly";
      const length = body.length || "medium";
      const format = body.format || "paragraph";
      const audience = body.audience || "general audience";

      finalPrompt = `
You are a helpful assistant.

Please answer using these settings:
- Tone: ${tone}
- Length: ${length}
- Format: ${format}
- Audience: ${audience}

User request:
${prompt}
`.trim();
    }

    const requestBody = {
      model: "gpt-4.1-mini",
      input: finalPrompt,
      stream: true
    };

    if (tools.length > 0) {
      requestBody.tools = tools;
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!openaiResponse.ok || !openaiResponse.body) {
      const text = await openaiResponse.text();
      return new Response(text || "OpenAI request failed.", { status: 500 });
    }

    return new Response(openaiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    return new Response("Server error.", { status: 500 });
  }
}
