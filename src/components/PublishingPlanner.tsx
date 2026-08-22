import { CalendarRange, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { accessStateFor, listConnectors, type ConnectorAccountPublic } from "../lib/connectors";
import { analyticsProviders } from "../../shared/connectors/providers";
import { suggestTestWindows } from "../../shared/connectors/access";
import { describeWindow, toWindowObservations } from "../../shared/publishing/history";
import { listPostObservations, type PostObservationRow } from "../lib/postHistory";
import { fetchMetricDefinitions, fetchSourcesForWorkspace, type MetricDefinitionRow, type SourceRegistryRow } from "../lib/sourceRegistry";
import { isMissingTableError } from "../lib/experiments";
import { HistoryImportModal } from "./HistoryImportModal";

const MIN_OBSERVATIONS = 30;

interface Loaded {
  key: string;
  connectors: ConnectorAccountPublic[];
  history: PostObservationRow[];
  historyError: string | null;
  metrics: MetricDefinitionRow[];
  sources: SourceRegistryRow[];
}

/**
 * Publishing intelligence. Candidate test windows come only from the
 * workspace's own observed posting history; rows from unverified sources
 * are excluded from the derivation and counted separately. With too little
 * history the panel says exactly what is missing instead of naming a time.
 */
export function PublishingPlanner({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${workspaceId}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = loaded?.key === key ? loaded : null;
  const [importOpen, setImportOpen] = useState(false);
  const [importedNote, setImportedNote] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [conns, history, metrics, sources] = await Promise.all([
        listConnectors(workspaceId),
        listPostObservations(workspaceId),
        fetchMetricDefinitions(workspaceId),
        fetchSourcesForWorkspace(workspaceId)
      ]);
      if (!mounted) return;
      setLoaded({ key, connectors: conns.data ?? [], history: history.data ?? [], historyError: history.error, metrics, sources });
    })();
    return () => {
      mounted = false;
    };
  }, [workspaceId, key]);

  const providers = current ? analyticsProviders().map((p) => ({ spec: p, access: accessStateFor(current.connectors, p.id, p.analyticsScopes) })) : [];
  const connectorAvailable = providers.some((p) => p.access.state === "available");
  const { observations, excludedUnverified } = toWindowObservations(current?.history ?? []);
  const suggestion = suggestTestWindows(observations, MIN_OBSERVATIONS);
  const historyReady = Boolean(current && !current.historyError);

  return (
    <section className="vp-panel" aria-labelledby="publishing-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Publishing intelligence</p>
          <h2 id="publishing-heading" className="vp-title">Test-window planning</h2>
          <p className="vp-subtitle">
            Candidate windows are derived from your own observed posting history and are run as experiments. There is no universal best time, and Vanta will not invent one.
          </p>
        </div>
        <button type="button" className="ghost-button-sm" onClick={() => setImportOpen(true)} disabled={!historyReady || (current?.sources.length ?? 0) === 0}>
          <Upload size={14} aria-hidden="true" /> Import posting history
        </button>
      </header>

      {!current && <div className="brand-brain-loading" role="status" aria-live="polite">Checking authorized sources and history…</div>}

      {current?.historyError && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">{isMissingTableError(current.historyError) ? "Posting history table is not applied yet" : "Could not read posting history"}</p>
            <p>
              {isMissingTableError(current.historyError)
                ? "Migration 017 is authored in the repository but pending live apply. Until an operator applies it, no history can be stored and no window can be derived."
                : current.historyError}
            </p>
          </div>
          <button className="ghost-button" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
        </section>
      )}

      {importedNote && <p className="vp-note" role="status">{importedNote}</p>}

      {current && (
        <>
          <div className={`vp-empty vp-state-${suggestion.state === "inference" ? "configured" : "unknown"}`} role="status">
            <span className="vp-row-state">
              <CalendarRange size={15} aria-hidden="true" /> {suggestion.state === "unknown" ? "Insufficient evidence" : "Inference from your own history"}
            </span>
            <h3>{suggestion.state === "unknown" ? "No test window can be recommended yet" : "Candidate windows to test"}</h3>
            <p>{suggestion.note}</p>
            {suggestion.windows.length > 0 && (
              <ul className="vp-steps" aria-label="Candidate windows">
                {suggestion.windows.map((w) => (
                  <li key={`${w.weekday}-${w.hour_utc}`}>
                    <span>{w.observations}</span> {describeWindow(w)} <em>candidate, not a forecast</em>
                  </li>
                ))}
              </ul>
            )}
            <ol className="vp-steps" aria-label="What unlocks a recommendation">
              <li>
                <span>01</span> Have observed history: an authorized connector sync or a history import
                <em>{connectorAvailable ? "connector available" : historyReady ? "import available" : "blocked: table pending"}</em>
              </li>
              <li>
                <span>02</span> Rows must name a citable source and carry a clock time
                <em>{excludedUnverified > 0 ? `${excludedUnverified} row(s) excluded as unverified` : "ok"}</em>
              </li>
              <li>
                <span>03</span> Accumulate {MIN_OBSERVATIONS}+ usable observations
                <em>{observations.length} of {MIN_OBSERVATIONS}</em>
              </li>
              <li>
                <span>04</span> Run the candidates as experiments and import their outcomes
                <em>{suggestion.state === "inference" ? "ready" : "waits on 03"}</em>
              </li>
            </ol>
          </div>

          <div className="vp-grid">
            {providers.map(({ spec, access }) => (
              <article key={spec.id} className={`vp-card vp-state-${access.state}`}>
                <div className="card-heading">
                  <h3>{spec.label}</h3>
                  <span className="pill">{access.state}</span>
                </div>
                <p>{"reason" in access ? access.reason : "Observed history may be available from this source."}</p>
              </article>
            ))}
          </div>

          <p className="vp-note">
            Evidence class of any candidate above: <strong>inference</strong> from observed data, shown with the observation count behind each bucket. It is never a forecast of reach, and it says nothing about audiences you have not posted to.
          </p>

          {importOpen && (
            <HistoryImportModal
              open
              onClose={() => setImportOpen(false)}
              workspaceId={workspaceId}
              userId={userId}
              sources={current.sources}
              metrics={current.metrics}
              onImported={(count, metricKey) => {
                setImportOpen(false);
                setImportedNote(`Imported ${count} observed post(s) for ${metricKey}.`);
                setReloadToken((t) => t + 1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
