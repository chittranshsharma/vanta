import { CalendarRange, Trash2, Upload, BarChart3, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { accessStateFor, listConnectors, type ConnectorAccountPublic } from "../lib/connectors";
import { analyticsProviders } from "../../shared/connectors/providers";
import { suggestTestWindows } from "../../shared/connectors/access";
import { describeWindow, toWindowObservations } from "../../shared/publishing/history";
import { groupImportBatches, type ImportBatchSummary } from "../../shared/publishing/batches";
import { deleteImportBatch, listPostObservations, type PostObservationRow } from "../lib/postHistory";
import { fetchMetricDefinitions, fetchSourcesForWorkspace, type MetricDefinitionRow, type SourceRegistryRow } from "../lib/sourceRegistry";
import { isMissingTableError } from "../lib/experiments";
import { isRetryableRead, readFailureSummary, type ReadError } from "../lib/rows";
import { HistoryImportModal } from "./HistoryImportModal";
import { Modal } from "./Modal";
import {
  optimizePublishingSchedule,
  SCHEDULE_OPTIMIZER_POLICY,
  DEFAULT_MIN_OBSERVATIONS_PER_BUCKET,
  type ObservedPublicationRecord,
  type ScheduleOptimizerResult,
} from "../../shared/publishing/scheduleOptimizer";

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
  /** Non-null when the registry reads an import needs did not succeed, so neither list is empty — it is unread. */
  registryError: ReadError | null;
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
      // An import row must name a registered source and a defined metric, so both
      // registry reads gate the same affordance. Reporting whichever failed is
      // enough: the recovery is the same read, and neither list may be shown as
      // empty on data that was never read.
      setLoaded({
        key,
        connectors: conns.data ?? [],
        history: history.data ?? [],
        historyError: history.error,
        metrics: metrics.data ?? [],
        sources: sources.data ?? [],
        registryError: sources.error ?? metrics.error
      });
    })();
    return () => {
      mounted = false;
    };
  }, [workspaceId, key]);

  const providers = current ? analyticsProviders().map((p) => ({ spec: p, access: accessStateFor(current.connectors, p.id, p.analyticsScopes) })) : [];
  const connectorAvailable = providers.some((p) => p.access.state === "available");
  const { observations, excludedUnverified, timeZone } = toWindowObservations(current?.history ?? []);
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

  const pubRecords: ObservedPublicationRecord[] = (current?.history ?? []).map((row) => ({
    id: row.id,
    sourceId: row.source_id,
    evidenceClass: "observed",
    metricKey: row.metric_key,
    unit: "count",
    calculationMethod: "sum",
    value: row.value,
    publishedAt: row.published_at,
    citability: row.source_citability === "verified" ? "verified" : "citable_unverified",
  }));

  const scheduleOptimizerResult: ScheduleOptimizerResult | null = current && pubRecords.length > 0
    ? optimizePublishingSchedule(pubRecords, {
        workspaceId,
        timeZone,
        expectedMetricKey: "impressions",
        expectedUnit: "count",
        expectedCalculationMethod: "sum",
        bucketResolution: "hour_of_day",
      })
    : null;

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
        <button type="button" className="ghost-button-sm" onClick={() => setImportOpen(true)} disabled={!historyReady || Boolean(current?.registryError) || (current?.sources.length ?? 0) === 0}>
          <Upload size={14} aria-hidden="true" /> Import posting history
        </button>
      </header>

      {!current && <div className="brand-brain-loading" role="status" aria-live="polite">Checking authorized sources and history…</div>}

      {current?.registryError && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">Import is unavailable</p>
            <p>{readFailureSummary(current.registryError, "the source registry and metric definitions this import needs")}</p>
            <p className="vp-hint">
              Every imported row must name a registered source and a defined metric. Neither is shown as empty, because neither was read.
            </p>
          </div>
          {isRetryableRead(current.registryError) && (
            <button className="ghost-button" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
          )}
        </section>
      )}

      {current && !current.registryError && current.sources.length === 0 && (
        <p className="vp-note" role="status">
          Import is unavailable: this workspace has no registered sources. Add one in Source registry first, since every imported row records where it came from.
        </p>
      )}

      {current?.historyError && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">{isMissingTableError(current.historyError) ? "Posting history table is not reachable" : "Could not read posting history"}</p>
            <p>
              {isMissingTableError(current.historyError)
                ? "The posting-history table is not reachable from this build. Migration 017 defines it; ask an operator to confirm it is applied to this environment. Until then no history can be stored and no window can be derived."
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
                  <li key={`${w.weekday}-${w.hour}`}>
                    <span>{w.observations}</span> {describeWindow(w, timeZone)} <em>candidate, not a forecast</em>
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
          <p className="vp-hint">
            Hours are wall-clock in <strong>{timeZone}</strong>, this device&apos;s timezone, and each post was placed in the
            hour its own clock read at publication. Where that zone observes daylight saving, the same bucket is a
            different absolute time in summer than in winter. Viewing from another zone regroups the buckets, so a window
            is a claim about your posting clock, not about your audience&apos;s.
          </p>

          {/* Descriptive Schedule Optimizer Summary Section */}
          {scheduleOptimizerResult && (
            <section className="mt-8 border border-zinc-800 rounded-xl p-5 bg-zinc-950/80 space-y-4" aria-labelledby="schedule-optimizer-heading">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 id="schedule-optimizer-heading" className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <BarChart3 size={16} className="text-emerald-400" /> Historical Schedule Optimizer
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Pure historical observation summary across configured time buckets. Strictly descriptive — never a predictive best-time forecast.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    scheduleOptimizerResult.status === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  }`}>
                    Status: {scheduleOptimizerResult.status}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                    Policy: {scheduleOptimizerResult.status === "success" ? scheduleOptimizerResult.statistics.policy : SCHEDULE_OPTIMIZER_POLICY}
                  </span>
                </div>
              </div>

              {/* Sample Gate & Timezone Notice */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                  <span className="text-zinc-500 block text-[10px] uppercase">Sample Sufficiency</span>
                  <span className="font-mono font-semibold text-zinc-200">
                    {scheduleOptimizerResult.status === "success"
                      ? `${scheduleOptimizerResult.statistics.totalAcceptedObservations} total observations (${scheduleOptimizerResult.statistics.eligibleBucketsCount} eligible buckets)`
                      : `${scheduleOptimizerResult.validObservationCount} of ${scheduleOptimizerResult.requiredMinimum} required`}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                  <span className="text-zinc-500 block text-[10px] uppercase">Timezone / Clock</span>
                  <span className="font-mono text-zinc-200">{scheduleOptimizerResult.timeZone}</span>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 text-xs">
                  <span className="text-zinc-500 block text-[10px] uppercase">Per-Bucket Gate</span>
                  <span className="font-mono text-zinc-200">
                    Min {DEFAULT_MIN_OBSERVATIONS_PER_BUCKET} observations/bucket
                  </span>
                </div>
              </div>

              {/* Top Performing Historical Buckets */}
              {scheduleOptimizerResult.status === "success" && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      Strongest Historical Buckets ({scheduleOptimizerResult.highestObservedBuckets.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {scheduleOptimizerResult.highestObservedBuckets.map((bucket) => (
                        <div key={bucket.bucketKey} className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/30 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-medium text-zinc-100">{bucket.bucketKey}</span>
                            <span className="text-[10px] text-zinc-500 ml-2">({bucket.observationCount} observations)</span>
                          </div>
                          <span className="font-mono text-emerald-300 font-semibold">{bucket.medianValue.toFixed(1)} median</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {scheduleOptimizerResult.comparisonNote && (
                    <p className="text-xs text-zinc-400 italic">{scheduleOptimizerResult.comparisonNote}</p>
                  )}
                </div>
              )}

              {/* Insufficient Evidence Warning Banner */}
              {scheduleOptimizerResult.status === "insufficient_evidence" && (
                <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <div>
                    <strong>Insufficient Historical Evidence:</strong> {scheduleOptimizerResult.reason}
                  </div>
                </div>
              )}

              {/* Limitations / Known Gaps */}
              {scheduleOptimizerResult.knownGaps && scheduleOptimizerResult.knownGaps.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-zinc-800/80">
                  <h5 className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">Declared Limitations</h5>
                  <ul className="text-[11px] text-zinc-400 list-disc list-inside space-y-0.5">
                    {scheduleOptimizerResult.knownGaps.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

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
