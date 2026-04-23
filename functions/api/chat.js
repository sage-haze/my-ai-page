export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const prompt = (body.prompt || "").trim();
    const tone = body.tone || "friendly";
    const length = body.length || "medium";
    const format = body.format || "paragraph";
    const audience = body.audience || "general audience";

    if (!prompt) {
      return new Response("Please type a message first.", { status: 400 });
    }

    const finalPrompt = `
You are a helpful assistant.

Please answer using these settings:
- Tone: ${tone}
- Length: ${length}
- Format: ${format}
- Audience: ${audience}

User request:
${prompt}
`.trim();

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: finalPrompt,
        stream: true
      })
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
