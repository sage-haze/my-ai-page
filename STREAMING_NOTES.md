# Streaming resilience notes

This build keeps the existing NDJSON research progress stream, with three resilience changes:

- Long stages emit a small heartbeat every 10 seconds so the browser/proxy connection does not sit idle while OpenAI is processing.
- The participant-facing result is returned before the final D1 audit update. The D1 update is scheduled with Cloudflare `waitUntil()`, so audit persistence does not hold up the page.
- For GPT-5-family basic models, routine research calls default to reasoning effort `none` for lower latency. You may override this with the optional Cloudflare variable `OPENAI_BASIC_REASONING_EFFORT` (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`).

Existing model variables remain:

- `OPENAI_BASIC_MODEL` for search planning, source review and atomic fact extraction.
- `OPENAI_ANALYSIS_MODEL` for final Client Signal synthesis.

No new Cloudflare variable is required for this build.
