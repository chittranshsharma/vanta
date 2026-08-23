import { CalendarRange, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { accessStateFor, listConnectors, type ConnectorAccountPublic } from "../lib/connectors";
import { analyticsProviders } from "../../shared/connectors/providers";
import { suggestTestWindows } from "../../shared/connectors/access";
import { describeWindow, toWindowObservations } from "../../shared/publishing/history";
import { groupImportBatches, type ImportBatchSummary } from "../../shared/publishing/batches";
import { deleteImportBatch, listPostObservations, type PostObservationRow } from "../lib/postHistory";
import { fetchMetricDefinitions, fetchSourcesForWorkspace, type MetricDefinitionRow, type SourceRegistryRow } from "../lib/sourceRegistry";
import { isMissingTableError } from "../lib/experiments";
import { HistoryImportModal } from "./HistoryImportModal";
import { Modal } from "./Modal";

const MIN_OBSERVATIONS = 30;

/** Local-time stamp. Batch times are wall-clock facts about the operator, not derived buckets. */
function localTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

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
export function PublishingPlanner({ workspaceId, userId, isAdmin }: { workspaceId: string; userId: string; isAdmin: boolean }) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${workspaceId}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = loaded?.key === key ? loaded : null;
  const [importOpen, setImportOpen] = useState(false);
  const [importedNote, setImportedNote] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ImportBatchSummary | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
  const batches = groupImportBatches(current?.history ?? []);

  /** Registry name for a source, or the truncated id when the registry row is not loaded. */
  const sourceLabel = (id: string) => current?.sources.find((s) => s.id === id)?.name ?? `source ${id.slice(0, 8)}`;

  async function confirmDelete() {
    const batch = pendingDelete;
    if (!batch?.batchId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const { data, error } = await deleteImportBatch({ workspaceId, userId, batchId: batch.batchId });
    setDeleteBusy(false);
    if (error || !data) {
      setDeleteError(error ?? "The delete returned no result, so nothing can be confirmed.");
      return;
    }
    setPendingDelete(null);
    setImportedNote(
      data.auditWriteFailed
        ? `Removed ${data.deleted} observed post row(s). The audit entry for this removal could not be written: ${data.auditWriteFailed}`
        : `Removed ${data.deleted} observed post row(s) and recorded the removal in the audit log.`
    );
    setReloadToken((t) => t + 1);
  }

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

          <section aria-labelledby="history-batches-heading">
            <h3 id="history-batches-heading" className="vp-subhead">Imported history batches</h3>
            <p className="vp-hint">
              Every batch listed here stored at least one observed row. An import that stored nothing leaves no record,
              so a rejected or failed import cannot be listed or explained on this screen. Counts are of rows still
              present, never of rows a file was thought to contain. Times are in your local timezone.
            </p>

            {batches.length === 0 ? (
              <p className="vp-hint">No posting history has been imported into this workspace yet.</p>
            ) : (
              <ul className="vp-steps" aria-label="Imported history batches">
                {batches.map((b) => (
                  <li key={b.batchId ?? "unbatched"}>
                    <span>{b.observations}</span>
                    <div>
                      <strong>{b.metricKeys.join(", ")}</strong> from {b.sourceIds.map(sourceLabel).join(", ")}
                      <br />
                      <em>
                        imported {localTime(b.importedLast)} · covers posts published {localTime(b.publishedFirst)} to{" "}
                        {localTime(b.publishedLast)}
                        {b.ambiguousDates > 0 && ` · ${b.ambiguousDates} ambiguous date(s)`}
                        {b.unverifiedRows > 0 && ` · ${b.unverifiedRows} row(s) excluded as unverified`}
                        {b.batchId === null && " · stored with no batch id, so it cannot be removed as a batch"}
                      </em>
                    </div>
                    {isAdmin && b.batchId !== null ? (
                      <button
                        type="button"
                        className="ghost-button-sm destructive"
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(b);
                        }}
                      >
                        <Trash2 size={13} aria-hidden="true" /> Delete batch
                      </button>
                    ) : (
                      <em>{b.batchId === null ? "no batch id" : "owner or admin only"}</em>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

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

          <Modal
            open={pendingDelete !== null}
            title="Delete this import batch?"
            onClose={() => {
              if (!deleteBusy) setPendingDelete(null);
            }}
          >
            <div className="vp-form">
              <p className="vp-note warn">
                This permanently removes {pendingDelete?.observations} observed post row(s) imported under this batch.
                Observed rows are the only evidence behind a candidate window, so any window derived from them will
                change or disappear. The removal cannot be undone from here; restoring it means re-importing the
                original file.
              </p>
              <p className="vp-hint">
                Nothing else is removed. No source, metric definition, experiment, or outcome record refers to these
                rows, so deleting them cascades to no other evidence. The removal is written to the workspace audit log
                with the batch id and the number of rows the database confirmed it removed.
              </p>
              {pendingDelete && (
                <ul className="vp-steps" aria-label="What this batch contains">
                  <li>
                    <span>{pendingDelete.observations}</span>
                    <div>
                      observed row(s) for <strong>{pendingDelete.metricKeys.join(", ")}</strong> from{" "}
                      {pendingDelete.sourceIds.map(sourceLabel).join(", ")}
                    </div>
                    <em>imported {localTime(pendingDelete.importedLast)}</em>
                  </li>
                </ul>
              )}
              {deleteError && (
                <p className="error-text" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="vp-actions">
                <button type="button" className="primary-button destructive" onClick={confirmDelete} disabled={deleteBusy}>
                  {deleteBusy ? "Deleting…" : `Delete ${pendingDelete?.observations ?? 0} observed row(s)`}
                </button>
                <button type="button" className="ghost-button-sm" onClick={() => setPendingDelete(null)} disabled={deleteBusy}>
                  Keep this batch
                </button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </section>
  );
}
