/**
 * Handler: campaign_csv_normalize.
 *
 * Step 1 of the Upgrade B pipeline from the worker's side: the Node worker
 * does not parse CSVs itself; it forwards the job to the Python analysis
 * service (services/analysis-worker) over HTTP and records the typed result.
 * Until that service is deployed the handler fails permanently with a clear
 * message rather than pretending to have normalized anything.
 */

import type { JobHandler } from "../loop.js";

export const campaignCsvNormalizeHandler: JobHandler = async (job, signal) => {
  const baseUrl = process.env.ANALYSIS_SERVICE_URL;
  const token = process.env.ANALYSIS_SERVICE_TOKEN;
  if (!baseUrl || !token) {
    return { ok: false, failure: { kind: "permanent", message: "analysis service not configured", code: "analysis_unconfigured" } };
  }

  const controller = new AbortController();
  const remaining = Math.max(1000, signal.deadlineMs - Date.now());
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const res = await fetch(`${baseUrl}/jobs/campaign-csv-normalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ job_id: job.id, workspace_id: job.workspace_id, correlation_id: job.correlation_id, payload: job.payload }),
      signal: controller.signal,
    });
    if (res.status === 422) {
      await res.text().catch(() => "");
      return { ok: false, failure: { kind: "permanent", message: "analysis service rejected input", code: "validation" } };
    }
    if (!res.ok) {
      return { ok: false, failure: { kind: res.status >= 500 ? "transient" : "permanent", message: `analysis service http ${res.status}`, code: `http_${res.status}` } };
    }
    const result = (await res.json()) as Record<string, unknown>;
    return { ok: true, result };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, failure: { kind: "transient", message: aborted ? "analysis service timeout" : "analysis service unreachable", code: aborted ? "timeout" : "network" } };
  } finally {
    clearTimeout(timer);
  }
};
