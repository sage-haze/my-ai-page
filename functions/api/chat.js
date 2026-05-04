export async function onRequestPost(context) {
  return new Response(JSON.stringify({
    fx: [{
      pair: "USDTHB=X",
      latest_rate: 34.1,
      highest_rate: 34.5,
      lowest_rate: 33.8,
      high_date: "2026-05-02",
      low_date: "2026-04-29"
    }],
    fx_context: "Recent trade tensions and export demand shifts may increase volatility in USDTHB, affecting margins for exporters.",
    news: { content: "Theme 1: Example analysis..." },
    context: {
      points: [{
        title: "Supply Chain Pressure",
        explanation: "Industry faces rising costs.",
        rm_considerations: ["Watch FX exposure", "Assess financing needs"]
      }]
    }
  }), { headers: { "Content-Type": "application/json" }});
}
