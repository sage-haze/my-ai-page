function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.AUDIT_DB) {
    return jsonResponse({
      configured: false,
      error: "AUDIT_DB is not configured. Add a D1 binding named AUDIT_DB and redeploy."
    }, 503);
  }

  const url = new URL(request.url);
  const runId = String(url.searchParams.get("runId") || "").trim();

  try {
    if (runId) {
      const row = await env.AUDIT_DB.prepare(`
        SELECT run_id, started_at, completed_at, status, isic_code, industry, sector, subsector,
               timeframe_days, input_json, audit_json, result_json, total_ms, error_text
          FROM research_runs
         WHERE run_id = ?
         LIMIT 1
      `).bind(runId).first();

      if (!row) return jsonResponse({ configured: true, error: "Run not found." }, 404);

      return jsonResponse({
        configured: true,
        run: {
          runId: row.run_id,
          startedAt: row.started_at,
          completedAt: row.completed_at,
          status: row.status,
          isicCode: row.isic_code,
          industry: row.industry,
          sector: row.sector,
          subsector: row.subsector,
          timeframeDays: row.timeframe_days,
          totalMs: row.total_ms,
          error: row.error_text,
          input: parseJson(row.input_json, {}),
          audit: parseJson(row.audit_json, {}),
          result: parseJson(row.result_json, null)
        }
      });
    }

    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 30)));
    const status = String(url.searchParams.get("status") || "").trim().toUpperCase();
    const isicCode = String(url.searchParams.get("isicCode") || "").trim();

    let sql = `
      SELECT run_id, started_at, completed_at, status, isic_code, industry, sector, subsector,
             timeframe_days, total_ms, error_text
        FROM research_runs
    `;
    const clauses = [];
    const bindings = [];
    if (status) { clauses.push("status = ?"); bindings.push(status); }
    if (isicCode) { clauses.push("isic_code = ?"); bindings.push(isicCode); }
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    sql += " ORDER BY started_at DESC LIMIT ?";
    bindings.push(limit);

    const query = env.AUDIT_DB.prepare(sql).bind(...bindings);
    const result = await query.all();
    const runs = (result.results || []).map(row => ({
      runId: row.run_id,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      status: row.status,
      isicCode: row.isic_code,
      industry: row.industry,
      sector: row.sector,
      subsector: row.subsector,
      timeframeDays: row.timeframe_days,
      totalMs: row.total_ms,
      error: row.error_text
    }));

    return jsonResponse({ configured: true, runs });
  } catch (error) {
    return jsonResponse({
      configured: true,
      error: String(error?.message || error || "Audit query failed.")
    }, 500);
  }
}
