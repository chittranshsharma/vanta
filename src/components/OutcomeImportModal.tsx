import { AlertTriangle, Upload } from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { evaluateSourceCitability, type SourceRegistryRow } from "../lib/sourceRegistry";
import { importOutcomes, type ExperimentRow } from "../lib/experiments";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  buildImportPlan,
  parseCsv,
  suggestColumnMap,
  type ColumnMap,
  type ImportPlan,
  type SourceCitability,
  type VariantRef
} from "../../shared/experiments/outcomeImport";

/**
 * Outcome import. Three explicit steps: choose the registered source the
 * numbers came from, map the columns, review the plan. Nothing is written
 * until the reviewer confirms, and rejected rows are shown with reasons
 * rather than dropped quietly.
 */
export function OutcomeImportModal({ open, onClose, experiment, variants, sources, workspaceId, userId, onImported }: {
  open: boolean;
  onClose: () => void;
  experiment: ExperimentRow;
  variants: VariantRef[];
  sources: SourceRegistryRow[];
  workspaceId: string;
  userId: string;
  onImported: (count: number) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [columnMap, setColumnMap] = useState<ColumnMap>({ variant: "", value: "", observedAt: "" });
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  const headers = csvText ? parseCsv(csvText, 1).headers : [];
  const source = sources.find((s) => s.id === sourceId) ?? null;
  const citability = evaluateSourceCitability(source);
  const citabilityValue: SourceCitability | null =
    citability.status === "verified" ? "verified" : citability.status === "citable_stale" ? "citable_stale" : citability.status === "citable_unverified" ? "citable_unverified" : null;

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setError(`File is ${Math.round(file.size / 1024)} kB; the limit is ${MAX_IMPORT_BYTES / 1024} kB.`);
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setColumnMap(suggestColumnMap(parseCsv(text, 1).headers));
    setPlan(null);
    setFileNote(`${file.name} loaded in the browser only. Nothing is uploaded until you confirm the import.`);
  };

  const review = () => {
    setError(null);
    setPlan(buildImportPlan({ csvText, columnMap, variants, metricKey: experiment.primary_metric_key }));
  };

  const confirm = async () => {
    if (!plan || !sourceId || !citabilityValue) return;
    setSaving(true);
    setError(null);
    const res = await importOutcomes({
      workspaceId,
      userId,
      experimentId: experiment.id,
      metricKey: experiment.primary_metric_key,
      sourceId,
      sourceCitability: citabilityValue,
      rows: plan.accepted,
      batchId: crypto.randomUUID()
    });
    setSaving(false);
    if (res.error !== null) setError(res.error);
    else {
      onImported(res.data);
      setCsvText("");
      setPlan(null);
    }
  };

  const mappingComplete = columnMap.variant !== "" && columnMap.value !== "" && columnMap.observedAt !== "";

  return (
    <Modal open={open} title={`Import outcomes: ${experiment.title}`} onClose={onClose}>
      <div className="vp-form">
        <p className="vp-hint">
          Values are recorded as observed from the source you name, against the metric <strong>{experiment.primary_metric_key}</strong>. They are never re-scaled, averaged, or filled in.
        </p>

        <label>
          Source these numbers came from
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            <option value="">Choose a registered source</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.health_status})</option>
            ))}
          </select>
          {sources.length === 0 && <span className="vp-hint">No sources are registered. Add one in Source registry first; outcomes cannot exist without a source.</span>}
        </label>

        {source && (
          <p className={`vp-note ${citability.status === "verified" ? "" : "warn"}`}>
            {citability.status === "verified"
              ? "Source is verified and fresh. Rows will be recorded with citability: verified."
              : citability.status === "blocked"
              ? `This source cannot be cited: ${"reason" in citability ? citability.reason : ""}`
              : `${"warning" in citability ? citability.warning : ""} Rows will be recorded with citability: ${citability.status}, and will stay visibly unverified.`}
          </p>
        )}

        <label>
          CSV file
          <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }} />
        </label>
        {fileNote && <p className="vp-hint">{fileNote}</p>}

        <label>
          Or paste CSV (max {MAX_IMPORT_ROWS} rows)
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => { setCsvText(e.target.value); setPlan(null); }}
            onBlur={() => { if (csvText && !mappingComplete) setColumnMap(suggestColumnMap(parseCsv(csvText, 1).headers)); }}
            placeholder={"variant,value,date\nHook A,1204,2026-08-01"}
          />
        </label>

        {headers.length > 0 && (
          <fieldset className="vp-form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="vp-hint">Column mapping (no column is guessed at import time; confirm each one)</legend>
            {([["variant", "Variant column"], ["value", "Value column"], ["observedAt", "Observation date column"]] as const).map(([field, label]) => (
              <label key={field}>
                {label}
                <select value={columnMap[field]} onChange={(e) => { setColumnMap({ ...columnMap, [field]: e.target.value }); setPlan(null); }}>
                  <option value="">Not mapped</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        )}

        <div className="vp-actions">
          <button type="button" className="ghost-button-sm" onClick={review} disabled={!csvText || !mappingComplete}>
            <Upload size={14} aria-hidden="true" /> Review import
          </button>
          {!mappingComplete && csvText && <span className="vp-hint">Map all three columns to continue.</span>}
        </div>

        {plan && (
          <div className={`vp-empty vp-state-${plan.accepted.length > 0 ? "configured" : "blocked"}`} role="status">
            <span className="vp-row-state">{plan.accepted.length} accepted, {plan.rejected.length} rejected</span>
            {plan.truncated && <p><AlertTriangle size={13} aria-hidden="true" /> File exceeded {MAX_IMPORT_ROWS} rows; only the first {MAX_IMPORT_ROWS} were read.</p>}
            {plan.ambiguousDates > 0 && (
              <p><AlertTriangle size={13} aria-hidden="true" /> {plan.ambiguousDates} row(s) have ambiguous day/month dates, interpreted as month-first and flagged on the stored row.</p>
            )}
            <ul className="vp-steps" aria-label="Rows per variant">
              {plan.perVariant.map((v) => (
                <li key={v.variant_twin_id}><span>{v.rows}</span> {v.label} <em>rows</em></li>
              ))}
            </ul>
            {plan.rejected.length > 0 && (
              <details>
                <summary>Rejected rows ({plan.rejected.length})</summary>
                <ul className="vp-steps">
                  {plan.rejected.slice(0, 25).map((r) => (
                    <li key={`${r.line}-${r.reason}`}><span>L{r.line}</span> {r.reason}</li>
                  ))}
                </ul>
                {plan.rejected.length > 25 && <p className="vp-hint">Showing the first 25.</p>}
              </details>
            )}
            {plan.malformedLines.length > 0 && (
              <p className="vp-hint">{plan.malformedLines.length} line(s) had the wrong number of fields and were not read.</p>
            )}
          </div>
        )}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="vp-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!plan || plan.accepted.length === 0 || !citabilityValue || saving}
            onClick={confirm}
          >
            {saving ? "Importing…" : `Import ${plan?.accepted.length ?? 0} observed row(s)`}
          </button>
          <button type="button" className="ghost-button-sm" onClick={onClose}>Cancel</button>
        </div>
        {!citabilityValue && sourceId && <p className="vp-hint">This source cannot back outcome rows.</p>}
      </div>
    </Modal>
  );
}
