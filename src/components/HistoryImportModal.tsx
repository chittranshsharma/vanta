import { AlertTriangle, Upload } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { evaluateSourceCitability, type MetricDefinitionRow, type SourceRegistryRow } from "../lib/sourceRegistry";
import { importPostObservations } from "../lib/postHistory";
import { buildHistoryImportPlan, MAX_HISTORY_ROWS, type HistoryColumnMap, type HistoryImportPlan } from "../../shared/publishing/history";
import { MAX_IMPORT_BYTES, parseCsv, type SourceCitability } from "../../shared/experiments/outcomeImport";

/**
 * Posting-history import. Same discipline as outcome import: a registered
 * source, an explicit column mapping, a reviewed plan, then the write.
 * Rows without a clock time are rejected because an hour bucket cannot be
 * derived from a date alone.
 */
export function HistoryImportModal({ open, onClose, workspaceId, userId, sources, metrics, onImported }: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  sources: SourceRegistryRow[];
  metrics: MetricDefinitionRow[];
  onImported: (count: number, metricKey: string) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [map, setMap] = useState<HistoryColumnMap>({ publishedAt: "", value: "", postId: "" });
  const [plan, setPlan] = useState<HistoryImportPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headers = csvText ? parseCsv(csvText, 1).headers : [];
  const source = sources.find((s) => s.id === sourceId) ?? null;
  const citability = evaluateSourceCitability(source);
  const citabilityValue: SourceCitability | null =
    citability.status === "verified" ? "verified" : citability.status === "citable_stale" ? "citable_stale" : citability.status === "citable_unverified" ? "citable_unverified" : null;
  const mappingComplete = map.publishedAt !== "" && map.value !== "";

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(`File is ${Math.round(file.size / 1024)} kB; the limit is ${MAX_IMPORT_BYTES / 1024} kB.`);
      return;
    }
    setCsvText(await file.text());
    setPlan(null);
  };

  const confirm = async () => {
    if (!plan || !citabilityValue || !metricKey) return;
    setSaving(true);
    setError(null);
    const res = await importPostObservations({
      workspaceId,
      userId,
      sourceId,
      sourceCitability: citabilityValue,
      metricKey,
      rows: plan.accepted,
      batchId: crypto.randomUUID()
    });
    setSaving(false);
    if (res.error !== null) setError(res.error);
    else onImported(res.data, metricKey);
  };

  return (
    <Modal open={open} title="Import posting history" onClose={onClose}>
      <div className="vp-form">
        <p className="vp-hint">
          Posts you own, with the exact time each was published and one metric value. Rows from unverified sources are stored but excluded from window derivation.
        </p>

        <label>
          Source
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Choose a registered source</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.health_status})</option>)}
          </select>
        </label>
        {source && citabilityValue !== "verified" && (
          <p className="vp-note warn">
            {citability.status === "blocked" ? `This source cannot be cited: ${"reason" in citability ? citability.reason : ""}` : `${"warning" in citability ? citability.warning : ""}`}
          </p>
        )}

        <label>
          Metric these values measure
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            <option value="">Choose a metric definition</option>
            {metrics.map((m) => <option key={m.id} value={m.metric_key ?? ""}>{m.display_name} ({m.metric_key})</option>)}
          </select>
          {metrics.length === 0 && <span className="vp-hint">No metric definitions exist. Add one in Source registry first.</span>}
        </label>

        <label>
          CSV file
          <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
        </label>

        <label>
          Or paste CSV (max {MAX_HISTORY_ROWS} rows)
          <textarea rows={5} value={csvText} onChange={(e) => { setCsvText(e.target.value); setPlan(null); }} placeholder={"post_id,published_at,views\np1,2026-08-01T14:00:00Z,1204"} />
        </label>

        {headers.length > 0 && (
          <fieldset className="vp-form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="vp-hint">Column mapping</legend>
            {([["publishedAt", "Published at (must include a clock time)"], ["value", "Metric value"], ["postId", "Post id (optional, prevents duplicate imports)"]] as const).map(([field, label]) => (
              <label key={field}>
                {label}
                <select value={map[field]} onChange={(e) => { setMap({ ...map, [field]: e.target.value }); setPlan(null); }}>
                  <option value="">Not mapped</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        )}

        <div className="vp-actions">
          <button type="button" className="ghost-button-sm" disabled={!csvText || !mappingComplete || !metricKey} onClick={() => setPlan(buildHistoryImportPlan(csvText, map, metricKey))}>
            <Upload size={14} aria-hidden="true" /> Review import
          </button>
        </div>

        {plan && (
          <div className={`vp-empty vp-state-${plan.accepted.length > 0 ? "configured" : "blocked"}`} role="status">
            <span className="vp-row-state">{plan.accepted.length} accepted, {plan.rejected.length} rejected</span>
            {plan.duplicatesInFile > 0 && <p>{plan.duplicatesInFile} duplicate row(s) inside the file were dropped.</p>}
            {plan.ambiguousDates > 0 && <p><AlertTriangle size={13} aria-hidden="true" /> {plan.ambiguousDates} row(s) have ambiguous dates and are flagged on the stored row.</p>}
            {plan.truncated && <p><AlertTriangle size={13} aria-hidden="true" /> File exceeded {MAX_HISTORY_ROWS} rows.</p>}
            {plan.rejected.length > 0 && (
              <details>
                <summary>Rejected rows ({plan.rejected.length})</summary>
                <ul className="vp-steps">
                  {plan.rejected.slice(0, 25).map((r) => <li key={`${r.line}-${r.reason}`}><span>L{r.line}</span> {r.reason}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="vp-actions">
          <button type="button" className="primary-button" disabled={!plan || plan.accepted.length === 0 || !citabilityValue || !metricKey || saving} onClick={confirm}>
            {saving ? "Importing…" : `Import ${plan?.accepted.length ?? 0} post(s)`}
          </button>
          <button type="button" className="ghost-button-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
