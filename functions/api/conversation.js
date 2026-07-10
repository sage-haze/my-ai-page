function extractOutputText(data) {
  if (data?.output_text) return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap(item => Array.isArray(item?.content) ? item.content : [])
    .filter(item => item?.type === "output_text" && item?.text)
    .map(item => item.text)
    .join("");
}

function parseJsonObject(text) {
  try {
    const start = String(text || "").indexOf("{");
    const end = String(text || "").lastIndexOf("}");
    if (start < 0 || end < start) return null;
    return JSON.parse(String(text).slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function cleanSignal(signal, index) {
  return {
    title: String(signal?.title || `Signal ${index + 1}`).trim(),
    context: String(signal?.context || "").trim(),
    relevance: String(signal?.relevance || "").trim(),
    tags: Array.isArray(signal?.tags) ? signal.tags.map(String).slice(0, 3) : [],
    sourceNumbers: Array.isArray(signal?.sourceNumbers)
      ? [...new Set(signal.sourceNumbers.map(Number).filter(Number.isFinite))].slice(0, 6)
      : []
  };
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.OPENAI_API_KEY) {
      return Response.json({ error: "Missing OPENAI_API_KEY secret in Cloudflare." }, { status: 500 });
    }

    const body = await request.json();
    const signals = (Array.isArray(body.signals) ? body.signals : []).map(cleanSignal).filter(item => item.title);
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};

    if (!signals.length) {
      return Response.json({ error: "Please select at least one Client Signal." }, { status: 400 });
    }

    const prompt = `
You are a transaction banking conversation coach supporting a junior relationship manager at a Thailand-based bank.

Create one concise CLEAR conversation card for each selected Client Signal. Use only the selected signal content below. Do not search the web and do not add new market facts.

Client profile:
- Sector: ${String(profile.sector || "")}
- Subsector: ${String(profile.subsector || "")}
- Specific industry: ${String(profile.industry || "")}
- Purchase flow: ${String(profile.purchaseFlow || "")}
- Sales flow: ${String(profile.salesFlow || "")}

CLEAR structure:
- Comment on context: a simple observation grounded in the selected signal
- Link to client: relate it gently to the client’s business without asserting that the client is affected
- Explore lightly: one optional, non-invasive path for the banker if the client shows interest
- Allow room: a low-pressure line that leaves space for the client to decide what is relevant
- Reaffirm support: reflect a useful next step or offer support, including specialist handoff only where appropriate

Rules:
- Keep every section to one sentence
- Use calm, plain English
- Do not forecast
- Do not invent facts
- Do not imply the client has a problem
- Avoid ambiguous contrasts such as “rather than”, “instead of”, “without assuming”, “despite”, and “although” unless directly necessary
- Explore lightly must ask about patterns or processes, not force disclosure of loss, cash stress, late payment, or credit weakness
- Preserve each signal’s sourceNumbers exactly

Return JSON only:
{
  "cards": [
    {
      "title": "Signal title",
      "tags": ["Trade"],
      "commentOnContext": "...",
      "linkToClient": "...",
      "exploreLightly": "...",
      "allowRoom": "...",
      "reaffirmSupport": "...",
      "sourceNumbers": [1]
    }
  ]
}

Selected signals:
${JSON.stringify(signals, null, 2)}
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: env.OPENAI_ANALYSIS_MODEL || "gpt-4.1",
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "clear_conversation_cards",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                cards: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      title: { type: "string" },
                      tags: { type: "array", items: { type: "string" }, maxItems: 3 },
                      commentOnContext: { type: "string" },
                      linkToClient: { type: "string" },
                      exploreLightly: { type: "string" },
                      allowRoom: { type: "string" },
                      reaffirmSupport: { type: "string" },
                      sourceNumbers: { type: "array", items: { type: "integer" }, maxItems: 6 }
                    },
                    required: ["title", "tags", "commentOnContext", "linkToClient", "exploreLightly", "allowRoom", "reaffirmSupport", "sourceNumbers"]
                  }
                }
              },
              required: ["cards"]
            }
          }
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return Response.json({ error: data?.error?.message || "Conversation generation failed." }, { status: 500 });
    }

    const parsed = parseJsonObject(extractOutputText(data));
    if (!parsed || !Array.isArray(parsed.cards)) {
      return Response.json({ error: "Conversation generation returned an unexpected format." }, { status: 500 });
    }

    return Response.json({ cards: parsed.cards });
  } catch (error) {
    return Response.json({ error: error?.message || "Conversation generation failed." }, { status: 500 });
  }
}
