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

CLIENT-UNDERSTANDING REASONING — COMPLETE THIS BEFORE WRITING CLEAR
For each signal, work from the news to the part of the client's business that could potentially be affected.
Use this sequence:
1. Identify the external development shown by the selected signal.
2. Identify the likely transmission into the client's operating reality.
3. Select ONE primary client-understanding area and, only when useful, ONE secondary area.
4. Identify the specific part of the business within those areas that may be affected.
5. Use that focus consistently in Link to client, Explore lightly, Allow room, and Reaffirm support.

The four client-understanding areas are:
A. Business model and operating activities
- sourcing and purchasing
- receiving goods, inventory and warehousing
- production or service capacity
- delivery and logistics
- invoicing
- making payments
- collecting proceeds
- reconciliation and administration
- investment, expansion and operating continuity

B. Supplier and buyer relationships
- concentration and dependency
- bargaining power and availability of alternatives
- trust and relationship maturity
- supplier or buyer reliability
- order sizes and minimum quantities
- deposits, prepayment and commercial terms
- payment and collection terms
- trade methods and documentation responsibilities

C. Working capital and financial management
- timing of payments and collections
- inventory, debtor and creditor cycles
- seasonal or lumpy cash requirements
- pre-shipment and post-shipment needs
- liquidity buffers and cash visibility
- funding sources
- payment and collection currencies
- natural offsets, currency mismatch and conversion timing

D. Business decisions, policies and developments
- ownership and group structure
- decision-making authority and treasury autonomy
- management preferences and risk appetite
- approved banks, currencies, payment or collection methods
- new factories, products or markets
- changes in suppliers, buyers, ownership or management
- geopolitical, regulatory or natural-disaster triggers

Selection rules:
- Choose the area because it is the clearest business transmission from the signal, not merely because a keyword appears.
- Prefer one coherent route over a list of loosely related implications.
- Use the client profile to make the route relevant, but never invent operating details that are not provided.
- Treat all client effects as possibilities unless directly established by the selected signal and profile.
- Do not jump directly from news to a banking product.
- The selected area defines the territory of the conversation. Explore lightly lets the client choose the path within it.

CLEAR structure:
- Comment on context — Begin with a simple observation: summarise the development in 2 concise sentences. Include the most useful facts and enough market context for the banker to understand the signal.
- Link to client — Relate it gently to the client’s business in 2 concise sentences. Sentence 1 should name the broad part of the business that could be affected. Sentence 2 should explain the possible change in timing, cost, volume, reliability, complexity, commercial terms, cash flow, or decision-making. Use conditional language and do not claim the client is affected.
- Explore lightly — Invite the client to share their perspective: provide exactly 2 broad, gentle invitations the banker can choose from. Both invitations must stay within the client-understanding area established in Link to client. One should invite the client to identify where, if anywhere, the development is showing up. The other should invite the client to describe whether anything has changed in that part of the business. For each invitation, add one short reason for asking and one short, neutral phrase describing what to listen for. Each supporting phrase should be no more than 18 words.
- Allow room — Listen to what feels relevant to them: provide 2 or 3 compact listening cues drawn from plausible paths within the selected client-understanding area. Each cue should name the client's possible emphasis, say briefly what it may indicate, and give one short way to follow the client's lead. Do not introduce an unrelated topic.
- Reaffirm support — Reflect and offer a helpful next step: provide exactly 2 conditional examples tied to the paths in Allow room. Each should first reflect what the client raised and then offer a proportionate next step. Keep each example to one short sentence and avoid a compulsory product pitch.

Rules:
- Use calm, plain English
- Do not forecast
- Do not invent facts
- Do not imply the client has a problem
- Do not turn Link to client into a list of transaction-banking products
- Do not infer invoice, settlement, or proceeds currency from a country or market. Name a specific currency only when it is explicitly present in the selected signal and supported by the client profile; otherwise use neutral wording such as sales proceeds, payment timing, FX exposure, or receivable timing
- Avoid ambiguous contrasts such as “rather than”, “instead of”, “without assuming”, “despite”, and “although” unless directly necessary and supported
- Explore lightly should feel like an invitation, not an interview or diagnostic checklist
- Prefer openings such as “How are you seeing…”, “What, if anything, has changed…”, “Where, if anywhere, are you noticing…”, or “Does any of this feel relevant…”
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
      "clientUnderstanding": {
        "primaryArea": "Business model and operating activities",
        "secondaryArea": "Supplier and buyer relationships",
        "affectedPart": "Purchasing lead times, inventory planning and supplier payment timing",
        "conversationDirection": "Understand where the changed timing is being felt across the operating cycle"
      },
      "commentOnContext": "Two concise sentences",
      "linkToClient": "Two concise sentences",
      "exploreLightly": [
        {
          "question": "Where, if anywhere, are you noticing this across your purchasing or inventory cycle?",
          "whyAsk": "To let the client identify the relevant stage",
          "listenFor": "The operating step they choose to emphasise"
        },
        {
          "question": "What, if anything, has changed in how those activities are being managed?",
          "whyAsk": "To understand whether existing arrangements have shifted",
          "listenFor": "Changes in timing, terms, volume or responsibility"
        }
      ],
      "allowRoom": [
        {
          "focus": "Longer purchasing lead times",
          "meaning": "May affect when orders and cash commitments are made",
          "followLead": "Stay with the stage and counterparties the client identifies"
        }
      ],
      "reaffirmSupport": [
        {
          "when": "If the client raises a change in purchasing timing",
          "response": "Reflect the timing change and offer to review how it flows through payments and liquidity planning"
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
                      clientUnderstanding: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          primaryArea: {
                            type: "string",
                            enum: [
                              "Business model and operating activities",
                              "Supplier and buyer relationships",
                              "Working capital and financial management",
                              "Business decisions, policies and developments"
                            ]
                          },
                          secondaryArea: {
                            type: "string",
                            enum: [
                              "None",
                              "Business model and operating activities",
                              "Supplier and buyer relationships",
                              "Working capital and financial management",
                              "Business decisions, policies and developments"
                            ]
                          },
                          affectedPart: { type: "string" },
                          conversationDirection: { type: "string" }
                        },
                        required: ["primaryArea", "secondaryArea", "affectedPart", "conversationDirection"]
                      },
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
                    required: ["title", "tags", "clientUnderstanding", "commentOnContext", "linkToClient", "exploreLightly", "allowRoom", "reaffirmSupport", "sourceNumbers"]
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
