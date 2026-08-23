/**
 * Experiment and outcome-calibration foundation (pure).
 *
 * An experiment is an explicit, falsifiable statement about creative
 * variants plus the evidence it needs before any outcome may be read.
 * Nothing here produces a result: it only decides whether a result could
 * be observed, and labels every row with its evidence class.
 */

export type ExperimentStatus = "draft" | "ready" | "running" | "awaiting_outcomes" | "concluded" | "abandoned";

export const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = ["draft", "ready", "running", "awaiting_outcomes", "concluded", "abandoned"] as const;

const TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["ready", "abandoned"],
  ready: ["running", "draft", "abandoned"],
  running: ["awaiting_outcomes", "abandoned"],
  awaiting_outcomes: ["concluded", "abandoned"],
  concluded: [],
  abandoned: []
};

export function canTransitionExperiment(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type OutcomeSourceKind = "connector" | "csv_import" | "none";

export const OUTCOME_SOURCE_KINDS: readonly OutcomeSourceKind[] = ["connector", "csv_import", "none"] as const;

export interface ExperimentDefinition {
  hypothesis: string;
  /** Metric key from metric_definitions; the only thing an outcome can be read against. */
  primaryMetricKey: string;
  /** Creative twin ids under test; two or more for a comparison. */
  variantTwinIds: string[];
  minObservationsPerVariant: number;
  outcomeSource: OutcomeSourceKind;
}

export interface ReadinessContext {
  metricDefined: boolean;
  variantsExist: string[];
  /** Access state of the outcome source, as produced by shared/connectors/access. */
  sourceState: "available" | "stale" | "unknown" | "not_applicable";
}

export interface Readiness {
  state: "ready" | "blocked";
  blockers: string[];
}

export const HYPOTHESIS_MIN_LENGTH = 20;

export function evaluateReadiness(def: ExperimentDefinition, ctx: ReadinessContext): Readiness {
  const blockers: string[] = [];
  if (def.hypothesis.trim().length < HYPOTHESIS_MIN_LENGTH) blockers.push(`Hypothesis must be at least ${HYPOTHESIS_MIN_LENGTH} characters and falsifiable.`);
  if (!def.primaryMetricKey) blockers.push("Choose a primary metric from the metric definitions.");
  else if (!ctx.metricDefined) blockers.push(`Metric "${def.primaryMetricKey}" is not defined in this workspace.`);
  if (def.variantTwinIds.length < 2) blockers.push("At least two variants are required for a comparison.");
  const missing = def.variantTwinIds.filter((id) => !ctx.variantsExist.includes(id));
  if (missing.length > 0) blockers.push(`${missing.length} variant(s) no longer exist in this workspace.`);
  if (new Set(def.variantTwinIds).size !== def.variantTwinIds.length) blockers.push("Variants must be distinct.");
  if (!Number.isInteger(def.minObservationsPerVariant) || def.minObservationsPerVariant < 1) blockers.push("Minimum observations per variant must be a positive integer.");
  if (def.outcomeSource === "none") blockers.push("Declare where outcomes will come from (authorized connector or CSV import). Without it the experiment can never conclude.");
  if (def.outcomeSource === "connector" && ctx.sourceState !== "available") blockers.push(`Outcome connector is ${ctx.sourceState}; outcomes cannot be read until it is available.`);
  return { state: blockers.length === 0 ? "ready" : "blocked", blockers };
}

/** One observed outcome row. Evidence class is fixed: an outcome without a source is not an outcome. */
export interface OutcomeRowInput {
  variant_twin_id: string;
  metric_key: string;
  value: number;
  observed_at: string;
  source_id: string | null;
  source_kind: OutcomeSourceKind;
}

export interface OutcomeValidation {
  accepted: Array<OutcomeRowInput & { evidence_class: "observed" }>;
  rejected: Array<{ row: OutcomeRowInput; reason: string }>;
}

export function validateOutcomeRows(rows: OutcomeRowInput[], def: ExperimentDefinition): OutcomeValidation {
  const accepted: OutcomeValidation["accepted"] = [];
  const rejected: OutcomeValidation["rejected"] = [];
  for (const row of rows) {
    if (!def.variantTwinIds.includes(row.variant_twin_id)) { rejected.push({ row, reason: "Variant is not part of this experiment." }); continue; }
    if (row.metric_key !== def.primaryMetricKey) { rejected.push({ row, reason: `Metric ${row.metric_key} is not the experiment's primary metric.` }); continue; }
    if (!Number.isFinite(row.value)) { rejected.push({ row, reason: "Value is not a finite number." }); continue; }
    if (Number.isNaN(Date.parse(row.observed_at))) { rejected.push({ row, reason: "observed_at is not a valid timestamp." }); continue; }
    if (row.source_kind === "none" || !row.source_id) { rejected.push({ row, reason: "Outcome has no source; unsourced numbers cannot be observed evidence." }); continue; }
    accepted.push({ ...row, evidence_class: "observed" });
  }
  return { accepted, rejected };
}

export interface CalibrationReadiness {
  state: "insufficient" | "ready";
  perVariant: Array<{ variant_twin_id: string; observations: number; needed: number }>;
  note: string;
}

/** Whether enough observed outcomes exist to read the experiment at all. Says nothing about which variant won. */
export function calibrationReadiness(def: ExperimentDefinition, outcomes: Array<{ variant_twin_id: string }>): CalibrationReadiness {
  const perVariant = def.variantTwinIds.map((id) => ({
    variant_twin_id: id,
    observations: outcomes.filter((o) => o.variant_twin_id === id).length,
    needed: def.minObservationsPerVariant
  }));
  const short = perVariant.filter((v) => v.observations < v.needed);
  if (short.length > 0) {
    return { state: "insufficient", perVariant, note: `${short.length} of ${perVariant.length} variants are below the ${def.minObservationsPerVariant} observation minimum. No reading is possible.` };
  }
  return { state: "ready", perVariant, note: "Every variant meets the observation minimum. A reading is possible; it is still only as good as the source behind each row." };
}
