# Research stream stability changes

This build makes the research stream more resilient on Cloudflare Workers:

- Tavily searches run with a concurrency of 2 rather than buffering all four large raw-content responses at once.
- A single failed Tavily query no longer aborts the whole run; successful searches continue and failures are recorded in the audit.
- Article content is compacted immediately while retaining beginning, middle and end evidence.
- The full backend ISIC term catalogue is no longer imported into the Worker; a focused term profile is derived from the selected ISIC activity to reduce isolate memory.
- Candidate preparation is now a visible/audited stage, making it easier to locate future failures.
- NDJSON output uses a Cloudflare-friendly TransformStream producer.

No Cloudflare environment-variable changes are required.
