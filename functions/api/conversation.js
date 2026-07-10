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

Create one concise, practical CLEAR conversation card for each selected Client Signal. Use only the selected signal content below. Do not search the web and do not add new market facts.

Client profile:
- Sector: ${String(profile.sector || "")}
- Subsector: ${String(profile.subsector || "")}
- Specific industry: ${String(profile.industry || "")}
- Purchase flow: ${String(profile.purchaseFlow || "")}
- Sales flow: ${String(profile.salesFlow || "")}

CLEAR structure:
- Comment on context — Begin with a simple observation: summarise the development in 2 concise sentences. Include the most useful facts and enough market context for the banker to understand the signal.
- Link to client — Relate it gently to the client’s business: preserve and strengthen the selected signal's client relevance. Use 2 concise sentences. State direct effects confidently only when supported; present second-order effects conditionally using phrases such as "if orders take longer to confirm" or "if buyers change terms".
- Explore lightly — Invite the client to share their perspective: provide exactly 2 broad, gentle invitations the banker can choose from. Start with the client’s view before asking about a specific operational detail. For each invitation, add one short reason for asking and one short, neutral phrase describing what to listen for. Each supporting phrase should be no more than 18 words.
- Allow room — Listen to what feels relevant to them: provide 2 or 3 compact listening cues. Each cue should name the client's possible emphasis, say briefly what it may indicate, and give one short way to follow the client's lead. Do not repeat "Listen for where the client places the emphasis" in every item.
- Reaffirm support — Reflect and offer a helpful next step: provide exactly 2 conditional examples. Each should show how the banker can reflect what the client raised and then offer a proportionate next step. Keep each example to one short sentence and avoid a compulsory product pitch.

Rules:
- Use calm, plain English
- Do not forecast
- Do not invent facts
- Do not imply the client has a problem
- Do not weaken or generalise a strong relevance link from the selected signal
- Do not infer invoice, settlement, or proceeds currency from a country or market. Name a specific currency only when it is explicitly present in the selected signal and supported by the client profile; otherwise use neutral wording such as sales proceeds, payment timing, FX exposure, or receivable timing
- Avoid ambiguous contrasts such as “rather than”, “instead of”, “without assuming”, “despite”, and “although” unless directly necessary and supported
- Explore lightly should feel like an invitation, not an interview or diagnostic checklist
- Prefer openings such as “How are you seeing…”, “What, if anything, has changed…”, or “Does any of this feel relevant…”
- Do not combine several operational questions into one sentence
- The client should be able to answer comfortably with “not really” or “no change” without feeling challenged
- Questions must not force disclosure of loss, cash stress, late payment, or credit weakness
- Reaffirm support must reflect what the client actually raises before suggesting a review, specialist, or product conversation
- Preserve each signal’s sourceNumbers exactly

Return JSON only:
{
  "cards": [
    {
      "title": "Signal title",
      "tags": ["Trade"],
      "commentOnContext": "Two concise sentences",
      "linkToClient": "Two concise sentences",
      "exploreLightly": [
        {
          "question": "How are you seeing this development, if at all, in your business?",
          "whyAsk": "To invite the client’s perspective without assuming an impact",
          "listenFor": "The area they choose to emphasise"
        }
      ],
      "allowRoom": [
        {
          "focus": "Competition or pricing",
          "meaning": "May indicate pressure in buyer negotiations",
          "followLead": "Stay with the buyers, products, or markets the client identifies"
        }
      ],
      "reaffirmSupport": [
        {
          "when": "If the client raises payment-timing pressure",
          "response": "Reflect the concern and offer to review the relevant order-to-cash steps"
        }
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
                      exploreLightly: {
                        type: "array",
                        minItems: 2,
                        maxItems: 2,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            question: { type: "string" },
                            whyAsk: { type: "string" },
                            listenFor: { type: "string" }
                          },
                          required: ["question", "whyAsk", "listenFor"]
                        }
                      },
                      allowRoom: {
                        type: "array",
                        minItems: 2,
                        maxItems: 3,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            focus: { type: "string" },
                            meaning: { type: "string" },
                            followLead: { type: "string" }
                          },
                          required: ["focus", "meaning", "followLead"]
                        }
                      },
                      reaffirmSupport: {
                        type: "array",
                        minItems: 2,
                        maxItems: 2,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          properties: {
                            when: { type: "string" },
                            response: { type: "string" }
                          },
                          required: ["when", "response"]
                        }
                      },
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
