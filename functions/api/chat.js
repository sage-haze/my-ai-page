export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const prompt = (body.prompt || "").trim();

    if (!prompt) {
      return new Response("Please type a message first.", { status: 400 });
    }

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
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
