export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const prompt = body.prompt || "";

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt
      })
    });

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      return new Response(
        JSON.stringify({
          reply: data.error?.message || "OpenAI request failed."
        }),
        {
          status: openaiResponse.status,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    let reply = data.output_text;

    if (!reply && Array.isArray(data.output)) {
      const firstItem = data.output[0];
      const firstContent = firstItem?.content?.[0];
      reply = firstContent?.text;
    }

    return new Response(
      JSON.stringify({
        reply: reply || "No reply returned."
      }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        reply: "Something went wrong on the server."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}
