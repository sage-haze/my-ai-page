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

Create one detailed but practical CLEAR conversation card for each selected Client Signal. Use only the selected signal content below. Do not search the web and do not add new market facts.

Client profile:
- Sector: ${String(profile.sector || "")}
- Subsector: ${String(profile.subsector || "")}
- Specific industry: ${String(profile.industry || "")}
- Purchase flow: ${String(profile.purchaseFlow || "")}
- Sales flow: ${String(profile.salesFlow || "")}

CLEAR structure:
- Comment on context: summarise the underlying article or development with enough detail for the banker to understand what changed, why it matters in the market, and which facts are most useful. Use 2 to 3 concise sentences.
- Link to client: preserve and strengthen the specific client relevance already present in the selected signal. Explain plausible links to the client's purchase flows, sales flows, supplier or buyer dynamics, documents, payment timing, FX, cash conversion cycle, or working capital. Use 2 to 3 concise sentences and do not assert that the client is affected.
- Explore lightly: begin from the idea that the banker should only ask if the client seems interested. Provide 2 to 3 gentle, open-ended questions. Each item must include the question, why the banker might ask it, and what different answers may indicate. Keep the explanation practical and brief so the banker can choose the question they feel comfortable using.
- Allow room: start from "Listen for where the client places the emphasis". Provide 2 to 4 concise listening cues. Each cue must explain what that emphasis may indicate and one sensible way the banker could follow the client's lead. Do not simply list risks.
- Reaffirm support: provide 2 to 3 conditional examples showing how support could look in action. Each example should start with the client signal or concern that would justify the response, then offer a proportionate next step. Do not prescribe the same close regardless of how the conversation develops.

Rules:
- Use calm, plain English
- Do not forecast
- Do not invent facts
- Do not imply the client has a problem
- Do not weaken or generalise a strong relevance link from the selected signal
- Do not infer invoice, settlement, or proceeds currency from a country or market. Name a specific currency only when it is explicitly present in the selected signal and supported by the client profile; otherwise use neutral wording such as sales proceeds, payment timing, FX exposure, or receivable timing
- Avoid ambiguous contrasts such as “rather than”, “instead of”, “without assuming”, “despite”, and “although” unless directly necessary and supported
- Questions must not force disclosure of loss, cash stress, late payment, or credit weakness
- Reaffirm support must reflect what the client actually raises before suggesting a review, specialist, or product conversation
- Preserve each signal’s sourceNumbers exactly

Return JSON only:
{
  "cards": [
    {
      "title": "Signal title",
      "tags": ["Trade"],
      "commentOnContext": "Two or three concise sentences",
      "linkToClient": "Two or three concise sentences",
      "exploreLightly": [
        "Question? — Why ask: brief reason. What to listen for: what a yes, no, or qualified answer may indicate"
      ],
      "allowRoom": [
        "Client emphasis — What it may indicate; how the banker can follow the client's lead"
      ],
      "reaffirmSupport": [
        "If the client highlights X: reflect it back and offer Y"
      ],
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
                      exploreLightly: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
                      allowRoom: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
                      reaffirmSupport: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
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
