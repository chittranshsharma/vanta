import { Link2, Link2Off, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { accessStateFor, listConnectors, requestConnector, revokeConnector, type ConnectorAccountPublic } from "../lib/connectors";
import { PROVIDERS, type ProviderSpec } from "../../shared/connectors/providers";

type Load = { key: string; rows: ConnectorAccountPublic[]; error: string | null };

function describeLoadError(error: string): { title: string; detail: string } {
  if (/connector_accounts_public|does not exist|42P01/i.test(error)) {
    return {
      title: "Connector tables are not applied yet",
      detail: "Migration 014 is authored in the repository but pending live apply. Until an operator applies it, no connection can be requested or listed."
    };
  }
  return { title: "Could not read connectors", detail: error };
}

/**
 * Source connectors (Upgrade F UI). Every card shows the access state the
 * rest of the product will see (available / stale / unknown) and why.
 * Requesting a connection only records consent intent; the OAuth flow is
 * not registered in this build and the UI says so instead of pretending.
 */
export function ConnectorsPanel({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${workspaceId}:${reloadToken}`;
  const [load, setLoad] = useState<Load | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const current = load?.key === key ? load : null;

  useEffect(() => {
    let mounted = true;
    listConnectors(workspaceId).then((r) => {
      if (mounted) setLoad({ key, rows: r.data ?? [], error: r.error });
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId, key]);

  const act = async (label: string, fn: () => Promise<{ error: string | null }>) => {
    setBusy(label);
    setActionError(null);
    const r = await fn();
    setBusy(null);
    if (r.error) setActionError(r.error);
    else setReloadToken((t) => t + 1);
  };

  const rows = current?.rows ?? [];

  return (
    <section className="vp-panel" aria-labelledby="connectors-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Authorized sources</p>
          <h2 id="connectors-heading" className="vp-title">Source connectors</h2>
          <p className="vp-subtitle">
            Only accounts you own and explicitly authorize. A connection that has not synced yields <em>unknown</em>, never an estimate.
          </p>
        </div>
        <button type="button" className="ghost-button-sm" onClick={() => setReloadToken((t) => t + 1)} disabled={!current}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </header>

      <p className="vp-note warn">
        Authorization flows are not registered for any provider in this build. Requesting a connection records consent intent for an admin and nothing else. No data is fetched.
      </p>

      {!current && (
        <div className="brand-brain-loading" role="status" aria-live="polite">Loading connectors…</div>
      )}
      {current?.error && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">{describeLoadError(current.error).title}</p>
            <p>{describeLoadError(current.error).detail}</p>
          </div>
          <button className="ghost-button" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
        </section>
      )}
      {actionError && <p className="error-text" role="alert">{actionError}</p>}

      {current && (
        <div className="vp-grid">
          {PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              spec={p}
              rows={rows}
              isAdmin={isAdmin}
              busy={busy}
              tablesReady={!current.error}
              onRequest={() => act(p.id, () => requestConnector(workspaceId, p.id, p.analyticsScopes))}
              onRevoke={(id) => act(id, () => revokeConnector(id, workspaceId))}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProviderCard({ spec, rows, isAdmin, busy, tablesReady, onRequest, onRevoke }: {
  spec: ProviderSpec;
  rows: ConnectorAccountPublic[];
  isAdmin: boolean;
  busy: string | null;
  tablesReady: boolean;
  onRequest: () => void;
  onRevoke: (id: string) => void;
}) {
  const access = accessStateFor(rows, spec.id, spec.analyticsScopes);
  const live = rows.find((r) => r.provider === spec.id && r.status !== "revoked") ?? null;
  return (
    <article className={`vp-card vp-state-${access.state}`} aria-label={spec.label}>
      <div className="card-heading">
        <h3>{spec.label}</h3>
        <span className="pill">{access.state}</span>
      </div>
      <p className="vp-row-state">{access.state === "available" ? "Observed data available" : access.state === "stale" ? "Stale" : "Unknown"}</p>
      <p>{"reason" in access ? access.reason : `Last sync ${new Date(access.lastSyncAt).toLocaleString()}.`}</p>
      {"nextInput" in access && <p><strong>Next:</strong> {access.nextInput}</p>}
      <dl className="vp-kv">
        <dt>Unlocks</dt>
        <dd>{spec.unlocks.join("; ")}</dd>
        <dt>Never collects</dt>
        <dd>{spec.neverCollects.join("; ")}</dd>
        {live && (
          <>
            <dt>Status</dt>
            <dd>{live.status}{live.consent_granted_at ? ` (consent ${new Date(live.consent_granted_at).toLocaleDateString()})` : ""}</dd>
          </>
        )}
      </dl>
      <div className="vp-actions">
        {live ? (
          <button type="button" className="ghost-button-sm" disabled={!isAdmin || busy !== null} onClick={() => onRevoke(live.id)}>
            <Link2Off size={14} aria-hidden="true" /> {busy === live.id ? "Revoking…" : "Revoke"}
          </button>
        ) : (
          <button type="button" className="ghost-button-sm" disabled={!isAdmin || !tablesReady || busy !== null} onClick={onRequest}>
            <Link2 size={14} aria-hidden="true" /> {busy === spec.id ? "Requesting…" : "Request connection"}
          </button>
        )}
        {!isAdmin && <span className="vp-hint">Admin role required.</span>}
      </div>
    </article>
  );
}
