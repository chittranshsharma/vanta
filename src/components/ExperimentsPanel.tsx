import { FlaskConical, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { supabase } from "../lib/supabase";
import { fetchMetricDefinitions, fetchSourcesForWorkspace, type MetricDefinitionRow, type SourceRegistryRow } from "../lib/sourceRegistry";
import { listConnectors, type ConnectorAccountPublic } from "../lib/connectors";
import { connectorOutcomeSourceState, describeAllOutcomeSync, type OutcomeSyncCapability } from "../../shared/connectors/outcomeSync";
import { createExperiment, isMissingTableError, listExperiments, listOutcomes, setExperimentStatus, type ExperimentOutcomeRow, type ExperimentRow } from "../lib/experiments";
import { OutcomeImportModal } from "./OutcomeImportModal";
import { OutcomeSyncStatus } from "./OutcomeSyncStatus";
import { calibrationReadiness, canTransitionExperiment, evaluateReadiness, HYPOTHESIS_MIN_LENGTH, type ExperimentStatus, type OutcomeSourceKind } from "../../shared/experiments/model";

interface TwinLite { id: string; title: string }

interface Loaded {
  key: string;
  experiments: ExperimentRow[];
  experimentsError: string | null;
  twins: TwinLite[];
  metrics: MetricDefinitionRow[];
  connectors: ConnectorAccountPublic[];
  sources: SourceRegistryRow[];
}

const STATUS_NEXT: Partial<Record<ExperimentStatus, { to: ExperimentStatus; label: string }[]>> = {
  draft: [{ to: "ready", label: "Mark ready" }, { to: "abandoned", label: "Abandon" }],
  ready: [{ to: "running", label: "Start" }, { to: "draft", label: "Back to draft" }],
  running: [{ to: "awaiting_outcomes", label: "Stop collecting" }, { to: "abandoned", label: "Abandon" }],
  awaiting_outcomes: [{ to: "concluded", label: "Conclude" }, { to: "abandoned", label: "Abandon" }]
};

/**
 * Experiments and outcome calibration (foundation). Defines falsifiable
 * tests over existing twins; reads nothing until observed, sourced outcome
 * rows exist. Shows calibration readiness, never a winner.
 */
export function ExperimentsPanel({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [reloadToken, setReloadToken] = useState(0);
  const key = `${workspaceId}:${reloadToken}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const current = loaded?.key === key ? loaded : null;
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [importFor, setImportFor] = useState<ExperimentRow | null>(null);
  const [importedNote, setImportedNote] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [exp, twinsRes, metrics, conns, sources] = await Promise.all([
        listExperiments(workspaceId),
        supabase.from("creative_twins").select("id,title").eq("workspace_id", workspaceId),
        fetchMetricDefinitions(workspaceId),
        listConnectors(workspaceId),
        fetchSourcesForWorkspace(workspaceId)
      ]);
      if (!mounted) return;
      setLoaded({
        key,
        experiments: exp.data ?? [],
        experimentsError: exp.error,
        twins: (twinsRes.data ?? []) as TwinLite[],
        metrics,
        connectors: conns.data ?? [],
        sources
      });
    })();
    return () => {
      mounted = false;
    };
  }, [workspaceId, key]);

  const transition = async (exp: ExperimentRow, to: ExperimentStatus) => {
    setActionError(null);
    if (!canTransitionExperiment(exp.status, to)) {
      setActionError(`Cannot move from ${exp.status} to ${to}.`);
      return;
    }
    const r = await setExperimentStatus(exp.id, workspaceId, to);
    if (r.error) setActionError(r.error);
    else setReloadToken((t) => t + 1);
  };

  // What a connector could actually deliver, not merely whether one is connected.
  // An account with a live token is not an available outcome source while no sync
  // path exists to read it, so readiness is derived from the sync capability.
  const syncCapabilities: OutcomeSyncCapability[] = current ? describeAllOutcomeSync(current.connectors, new Date()) : [];
  const connectorSourceState = connectorOutcomeSourceState(syncCapabilities);

  return (
    <section className="vp-panel" aria-labelledby="experiments-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Outcome calibration</p>
          <h2 id="experiments-heading" className="vp-title">Experiments</h2>
          <p className="vp-subtitle">
            A hypothesis, the variants it compares, the metric it is read against, and where observed outcomes will come from. No reading exists until sourced outcome rows do.
          </p>
        </div>
        <button type="button" className="primary-button" onClick={() => setCreateOpen(true)} disabled={!current || Boolean(current.experimentsError)}>
          <Plus size={16} aria-hidden="true" /> New experiment
        </button>
      </header>

      {!current && <div className="brand-brain-loading" role="status" aria-live="polite">Loading experiments…</div>}

      {current?.experimentsError && (
        <section className="load-error" role="alert">
          <div>
            <p className="state-overline">{isMissingTableError(current.experimentsError) ? "Experiment tables are not applied yet" : "Could not load experiments"}</p>
            <p>
              {isMissingTableError(current.experimentsError)
                ? "Migration 016 is authored in the repository but pending live apply. Definitions cannot be saved until an operator applies it."
                : current.experimentsError}
            </p>
          </div>
          <button className="ghost-button" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
        </section>
      )}
      {actionError && <p className="error-text" role="alert">{actionError}</p>}

      {current && !current.experimentsError && current.experiments.length === 0 && (
        <div className="vp-empty">
          <span className="vp-row-state"><FlaskConical size={15} aria-hidden="true" /> No experiments</span>
          <h3>Nothing is under test.</h3>
          <p>
            You need at least two Creative Twins and one metric definition. This workspace has {current.twins.length} twin(s) and {current.metrics.length} metric definition(s).
          </p>
        </div>
      )}

      {current && current.experiments.length > 0 && (
        <ul className="vp-list">
          {current.experiments.map((exp) => {
            const readiness = evaluateReadiness(
              {
                hypothesis: exp.hypothesis,
                primaryMetricKey: exp.primary_metric_key,
                variantTwinIds: exp.variant_twin_ids,
                minObservationsPerVariant: exp.min_observations_per_variant,
                outcomeSource: exp.outcome_source
              },
              {
                metricDefined: current.metrics.some((m) => m.metric_key === exp.primary_metric_key),
                variantsExist: current.twins.map((t) => t.id),
                sourceState: exp.outcome_source === "connector" ? connectorSourceState : "not_applicable"
              }
            );
            return (
              <li key={exp.id} className={`vp-row vp-state-${readiness.state === "ready" ? "configured" : "blocked"}`}>
                <span className="vp-row-state">{exp.status.replace("_", " ")}</span>
                <div className="vp-row-body">
                  <strong>{exp.title}</strong>
                  <p>{exp.hypothesis}</p>
                  <dl className="vp-kv">
                    <dt>Metric</dt><dd>{exp.primary_metric_key}</dd>
                    <dt>Variants</dt><dd>{exp.variant_twin_ids.map((id) => current.twins.find((t) => t.id === id)?.title ?? "missing twin").join(" vs ")}</dd>
                    <dt>Outcomes from</dt><dd>{exp.outcome_source === "none" ? "undeclared" : exp.outcome_source.replace("_", " ")}</dd>
                    <dt>Readiness</dt><dd>{readiness.state === "ready" ? "ready" : readiness.blockers.join(" ")}</dd>
                  </dl>
                  {selected === exp.id && <OutcomeSummary experiment={exp} workspaceId={workspaceId} refreshToken={reloadToken} />}
                  <div className="vp-actions">
                    {(STATUS_NEXT[exp.status] ?? []).map((n) => (
                      <button key={n.to} type="button" className="ghost-button-sm" disabled={n.to === "ready" && readiness.state !== "ready"} onClick={() => transition(exp, n.to)}>
                        {n.label}
                      </button>
                    ))}
                    <button type="button" className="link-button" onClick={() => setSelected(selected === exp.id ? null : exp.id)} aria-expanded={selected === exp.id}>
                      {selected === exp.id ? "Hide outcomes" : "Show outcomes"}
                    </button>
                    <button type="button" className="ghost-button-sm" onClick={() => setImportFor(exp)} disabled={exp.status === "draft" || exp.status === "abandoned"}>
                      Import outcomes
                    </button>
                    {exp.status === "draft" && <span className="vp-hint">Mark the experiment ready before importing outcomes.</span>}
                  </div>
                </div>
                <span className="pill">{readiness.state}</span>
              </li>
            );
          })}
        </ul>
      )}

      {importedNote && <p className="vp-note" role="status">{importedNote}</p>}

      {current && !current.experimentsError && <OutcomeSyncStatus capabilities={syncCapabilities} />}

      <p className="vp-note">
        CSV import is available now: rows must name a registered source and are stored as <strong>observed from that source</strong>, with the source's citability at import time recorded on each row. Nothing computes a winner.
      </p>

      {current && importFor && (
        <OutcomeImportModal
          open
          onClose={() => setImportFor(null)}
          experiment={importFor}
          variants={importFor.variant_twin_ids.map((id) => ({ id, label: current.twins.find((t) => t.id === id)?.title ?? id }))}
          sources={current.sources}
          workspaceId={workspaceId}
          userId={userId}
          onImported={(count) => {
            setImportFor(null);
            setImportedNote(`Imported ${count} observed row(s). Every row keeps its source and citability.`);
            setReloadToken((t) => t + 1);
          }}
        />
      )}

      {current && (
        <CreateExperimentModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          twins={current.twins}
          metrics={current.metrics}
          onCreated={() => {
            setCreateOpen(false);
            setReloadToken((t) => t + 1);
          }}
          workspaceId={workspaceId}
          userId={userId}
          syncCapabilities={syncCapabilities}
        />
      )}
    </section>
  );
}

function OutcomeSummary({ experiment, workspaceId, refreshToken }: { experiment: ExperimentRow; workspaceId: string; refreshToken: number }) {
  const key = `${experiment.id}:${refreshToken}`;
  const [res, setRes] = useState<{ id: string; rows: ExperimentOutcomeRow[]; error: string | null } | null>(null);
  const current = res?.id === key ? res : null;
  useEffect(() => {
    let mounted = true;
    listOutcomes(experiment.id, workspaceId).then((r) => {
      if (mounted) setRes({ id: key, rows: r.data ?? [], error: r.error });
    });
    return () => {
      mounted = false;
    };
  }, [experiment.id, workspaceId, key]);
  if (!current) return <p className="vp-hint" role="status">Loading outcomes…</p>;
  if (current.error) return <p className="error-text">{current.error}</p>;
  const cal = calibrationReadiness(
    { hypothesis: experiment.hypothesis, primaryMetricKey: experiment.primary_metric_key, variantTwinIds: experiment.variant_twin_ids, minObservationsPerVariant: experiment.min_observations_per_variant, outcomeSource: experiment.outcome_source },
    current.rows
  );
  return (
    <div className={`vp-empty vp-state-${cal.state === "ready" ? "configured" : "unknown"}`}>
      <span className="vp-row-state">{cal.state === "ready" ? "Calibration possible" : "Insufficient evidence"}</span>
      <p>{cal.note}</p>
      <ul className="vp-steps">
        {cal.perVariant.map((v) => (
          <li key={v.variant_twin_id}><span>{v.observations}/{v.needed}</span> {v.variant_twin_id} <em>observed rows</em></li>
        ))}
      </ul>
      {current.rows.length > 0 && <p className="vp-hint">{describeProvenance(current.rows)}</p>}
    </div>
  );
}

function CreateExperimentModal({ open, onClose, twins, metrics, onCreated, workspaceId, userId, syncCapabilities }: {
  open: boolean;
  onClose: () => void;
  twins: TwinLite[];
  metrics: MetricDefinitionRow[];
  onCreated: () => void;
  workspaceId: string;
  userId: string;
  syncCapabilities: OutcomeSyncCapability[];
}) {
  const [title, setTitle] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [metricKey, setMetricKey] = useState("");
  const [variants, setVariants] = useState<string[]>([]);
  const [minObs, setMinObs] = useState(30);
  const [source, setSource] = useState<OutcomeSourceKind>("csv_import");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectorSourceState = connectorOutcomeSourceState(syncCapabilities);
  const readiness = evaluateReadiness(
    { hypothesis, primaryMetricKey: metricKey, variantTwinIds: variants, minObservationsPerVariant: minObs, outcomeSource: source },
    { metricDefined: metrics.some((m) => m.metric_key === metricKey), variantsExist: twins.map((t) => t.id), sourceState: source === "connector" ? connectorSourceState : "not_applicable" }
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await createExperiment({ workspaceId, userId, title: title.trim(), hypothesis: hypothesis.trim(), primaryMetricKey: metricKey, variantTwinIds: variants, minObservationsPerVariant: minObs, outcomeSource: source });
    setSaving(false);
    if (r.error) setError(r.error);
    else onCreated();
  };

  return (
    <Modal open={open} title="New experiment" onClose={onClose}>
      <form className="vp-form" onSubmit={submit} noValidate>
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
        </label>
        <label>
          Hypothesis (falsifiable, at least {HYPOTHESIS_MIN_LENGTH} characters)
          <textarea value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} rows={3} aria-describedby="hyp-help" />
          <span id="hyp-help" className="vp-hint">State what would prove it wrong, for example: "Variant B completion rate is not higher than A".</span>
        </label>
        <label>
          Primary metric
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            <option value="">Choose a metric definition</option>
            {metrics.map((m) => (
              <option key={m.id} value={m.metric_key ?? ""}>{m.display_name} ({m.metric_key})</option>
            ))}
          </select>
          {metrics.length === 0 && <span className="vp-hint">No metric definitions exist. Add one in Source registry first.</span>}
        </label>
        <fieldset className="vp-form" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="vp-hint">Variants (choose two or more)</legend>
          {twins.length === 0 && <span className="vp-hint">No Creative Twins exist yet.</span>}
          {twins.map((t) => (
            <label key={t.id} style={{ gridTemplateColumns: "auto 1fr", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={variants.includes(t.id)}
                onChange={(e) => setVariants(e.target.checked ? [...variants, t.id] : variants.filter((v) => v !== t.id))}
              />
              {t.title}
            </label>
          ))}
        </fieldset>
        <label>
          Minimum observed rows per variant
          <input type="number" min={1} value={minObs} onChange={(e) => setMinObs(Number(e.target.value))} />
        </label>
        <label>
          Outcomes will come from
          <select value={source} onChange={(e) => setSource(e.target.value as OutcomeSourceKind)}>
            <option value="csv_import">CSV import from a registered source</option>
            <option value="connector">
              Authorized connector sync{connectorSourceState === "available" ? "" : " (no sync path in this build)"}
            </option>
            <option value="none">Undeclared (experiment can never conclude)</option>
          </select>
        </label>
        {source === "connector" && <OutcomeSyncStatus capabilities={syncCapabilities} heading="What connector sync would need" />}
        {readiness.blockers.length > 0 && (
          <ul className="vp-steps" aria-label="Blockers">
            {readiness.blockers.map((b) => (
              <li key={b}><span>!</span> {b}</li>
            ))}
          </ul>
        )}
        {error && <p className="error-text" role="alert">{error}</p>}
        <div className="vp-actions">
          <button type="submit" className="primary-button" disabled={saving || hypothesis.trim().length < HYPOTHESIS_MIN_LENGTH || !title.trim()}>
            {saving ? "Saving…" : "Save as draft"}
          </button>
          <span className="vp-hint">Drafts can be saved with blockers; "Mark ready" stays disabled until they clear.</span>
        </div>
      </form>
    </Modal>
  );
}

/** Plain-language provenance line: where the rows came from and what is unverified about them. */
function describeProvenance(rows: ExperimentOutcomeRow[]): string {
  const verified = rows.filter((r) => r.source_citability === "verified").length;
  const ambiguous = rows.filter((r) => r.date_ambiguous).length;
  const sources = new Set(rows.map((r) => r.source_id)).size;
  const parts = [`${rows.length} row(s) from ${sources} source(s)`, `${verified} from a verified source, ${rows.length - verified} from stale or unverified sources`];
  if (ambiguous > 0) parts.push(`${ambiguous} with ambiguous dates`);
  return `${parts.join("; ")}.`;
}
