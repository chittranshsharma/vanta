import { ListChecks, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { approveJob, cancelJob, listJobs, type JobRow } from "../lib/jobs";
import { isMissingTableError } from "../lib/experiments";

const TERMINAL = new Set(["succeeded", "failed", "dead", "cancelled"]);

/**
 * Background jobs (Upgrade C UI). Lists durable jobs with their state,
 * attempts, and last error; members cancel, admins approve. Claiming and
 * completing have no browser path by design.
 */
export function JobsPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${workspaceId}:${reloadToken}`;
  const [load, setLoad] = useState<{ key: string; rows: JobRow[]; error: string | null } | null>(null);
  const current = load?.key === key ? load : null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listJobs(workspaceId).then((r) => {
      if (mounted) setLoad({ key, rows: r.data ?? [], error: r.error });
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId, key]);

  const act = async (id: string, fn: () => Promise<{ error: string | null }>) => {
    setBusy(id);
    setActionError(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setActionError(r.error);
    else setReloadToken((t) => t + 1);
  };

  return (
    <section className="vp-panel" aria-labelledby="jobs-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Background work</p>
          <h2 id="jobs-heading" className="vp-title">Jobs</h2>
          <p className="vp-subtitle">Durable job records with attempts and errors. Source refreshes wait for admin approval before any worker may claim them.</p>
        </div>
        <button type="button" className="ghost-button-sm" onClick={() => setReloadToken((t) => t + 1)} disabled={!current}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>
      {!current && <div className="brand-brain-loading" role="status" aria-live="polite">Loading jobs…</div>}
      {current?.error && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">{isMissingTableError(current.error) ? "Jobs table is not applied yet" : "Could not load jobs"}</p>
            <p>{isMissingTableError(current.error) ? "Migration 011 is authored but pending live apply. No job can be queued until an operator applies it and a worker is deployed." : current.error}</p>
          </div>
          <button className="ghost-button" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
        </section>
      )}
      {actionError && <p className="error-text" role="alert">{actionError}</p>}
      {current && !current.error && current.rows.length === 0 && (
        <div className="vp-empty">
          <span className="vp-row-state"><ListChecks size={15} aria-hidden="true" /> Empty</span>
          <h3>No jobs have been queued.</h3>
          <p>Jobs are created by product actions (CSV normalization, media probes, feed refreshes). No worker is deployed in this build, so a queued job would wait indefinitely and say so.</p>
        </div>
      )}
      {current && current.rows.length > 0 && (
        <ul className="vp-list">
          {current.rows.map((j) => (
            <li key={j.id} className={`vp-row vp-state-${j.status === "succeeded" ? "configured" : j.status === "failed" || j.status === "dead" ? "missing" : "unknown"}`}>
              <span className="vp-row-state">{j.status.replace("_", " ")}</span>
              <div className="vp-row-body">
                <strong>{j.job_type.replace(/_/g, " ")}</strong>
                <dl className="vp-kv">
                  <dt>Attempts</dt><dd>{j.attempts} of {j.max_attempts}</dd>
                  <dt>Created</dt><dd>{new Date(j.created_at).toLocaleString()}</dd>
                  {j.last_error && <><dt>Last error</dt><dd>{String(j.last_error.code ?? j.last_error.message ?? "see step log")}</dd></>}
                  <dt>Correlation</dt><dd><code>{j.correlation_id}</code></dd>
                </dl>
                <div className="vp-actions">
                  {j.status === "awaiting_approval" && (
                    <button type="button" className="ghost-button-sm" disabled={!isAdmin || busy === j.id} onClick={() => act(j.id, () => approveJob(j.id, workspaceId))}>Approve</button>
                  )}
                  {!TERMINAL.has(j.status) && (
                    <button type="button" className="ghost-button-sm" disabled={busy === j.id} onClick={() => act(j.id, () => cancelJob(j.id, workspaceId))}>Cancel</button>
                  )}
                </div>
              </div>
              <span className="pill">{j.requires_approval ? "approval gated" : "auto"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
