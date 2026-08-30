import { Bot, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { listJobs } from "../lib/jobs";
import { countModelRuns, modelRunSummary, type ModelRunCount } from "../lib/modelRuns";
import { isMissingTableError } from "../lib/experiments";
import { CREATIVE_COUNCIL_GRAPH, DEFAULT_RETRY_POLICY, ROLE_CONTRACTS, gateRuntime, validateGraph, type RuntimeCapabilities } from "../../shared/agents/graph";
import { ApiKeySettings } from "./ApiKeySettings";

/**
 * Agent workflow foundation. Shows the task graph, the role contracts, the
 * retry and review policy, and the runtime gate. There is no "run" button
 * because no agent task type is allowlisted on the gateway; the panel
 * reports `unavailable` with the exact reasons rather than simulating a run.
 *
 * Run history is counted rather than assumed. The subtitle used to state that
 * no run had ever happened here without reading anything, which is an assertion
 * about stored data wearing an observation's clothes.
 */
export function AgentWorkflowPanel({ workspaceId, gatewayState }: { workspaceId: string; gatewayState: RuntimeCapabilities["gateway"] }) {
  const [jobsProbe, setJobsProbe] = useState<{ workspaceId: string; state: RuntimeCapabilities["jobsTable"]; runs: ModelRunCount } | null>(null);
  const current = jobsProbe?.workspaceId === workspaceId ? jobsProbe : null;

  useEffect(() => {
    let mounted = true;
    Promise.all([listJobs(workspaceId, 1), countModelRuns(workspaceId)]).then(([r, runs]) => {
      if (!mounted) return;
      setJobsProbe({ workspaceId, state: r.error ? (isMissingTableError(r.error) ? "missing" : "unknown") : "applied", runs });
    });
    return () => {
      mounted = false;
    };
  }, [workspaceId]);

  const gate = gateRuntime({ gateway: gatewayState, jobsTable: current?.state ?? "unknown", agentTasksEnabled: "unknown" });
  const graph = validateGraph(CREATIVE_COUNCIL_GRAPH);

  return (
    <section className="vp-panel" aria-labelledby="agents-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Creative Council</p>
          <h2 id="agents-heading" className="vp-title">Agent workflow</h2>
          <p className="vp-subtitle">
            A transparent task graph with fixed role contracts. Output reaches you only after the Evidence Arbiter, the evaluator, and your own approval.
          </p>
          <p className="vp-hint" role="status" aria-live="polite">
            {current ? modelRunSummary(current.runs) : "Reading run history…"}
          </p>
        </div>
      </header>

      <div className={`vp-empty vp-state-${gate.state === "available" ? "configured" : "blocked"}`} role="status">
        <span className="vp-row-state"><ShieldAlert size={15} aria-hidden="true" /> Runtime {gate.state}</span>
        <h3>{gate.state === "available" ? "Runtime capabilities are present" : "Agent runs are unavailable"}</h3>
        {gate.reasons.length > 0 ? (
          <ul className="vp-steps" aria-label="Reasons">
            {gate.reasons.map((r, i) => (
              <li key={r}><span>{String(i + 1).padStart(2, "0")}</span> {r}</li>
            ))}
          </ul>
        ) : (
          <p>Every capability is positively known. Runs still require a per-run human approval checkpoint.</p>
        )}
      </div>

      <h3 className="vp-title" style={{ fontSize: "1.05rem" }}>Task graph: {CREATIVE_COUNCIL_GRAPH.name}</h3>
      {!graph.valid && <p className="error-text" role="alert">{graph.errors.join(" ")}</p>}
      <ol className="vp-steps" aria-label="Execution order">
        {graph.order.map((id, i) => {
          const node = CREATIVE_COUNCIL_GRAPH.nodes.find((n) => n.id === id);
          const contract = node ? ROLE_CONTRACTS[node.role] : null;
          return (
            <li key={id}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <strong style={{ display: "block" }}><Bot size={13} aria-hidden="true" /> {contract?.role.replace("_", " ")}</strong>
                <span className="vp-hint">{contract?.purpose}</span>
              </div>
              <em>{node?.userFacing ? "user-facing" : "internal"} · {contract?.evidenceClass}</em>
            </li>
          );
        })}
      </ol>

      <div className="vp-grid">
        {Object.values(ROLE_CONTRACTS).map((c) => (
          <article key={c.role} className="vp-card">
            <h3>{c.role.replace("_", " ")}</h3>
            <p>{c.purpose}</p>
            <dl className="vp-kv">
              <dt>Reads</dt><dd>{c.reads.join(", ")}</dd>
              <dt>Output schema</dt><dd>{c.outputSchema}</dd>
              <dt>Evidence class</dt><dd>{c.evidenceClass}</dd>
              <dt>Writes</dt><dd>{c.mayProposeWrites ? "proposes only; human checkpoint required" : "none"}</dd>
            </dl>
          </article>
        ))}
      </div>

      <p className="vp-note">
        Retry policy: at most {DEFAULT_RETRY_POLICY.maxAttemptsPerNode} attempts per node, {DEFAULT_RETRY_POLICY.maxArbiterRepairs} arbiter-guided repair, then the run fails closed with no partial output. Every run will be recorded in model_task_runs and jobs with its correlation id.
      </p>

      <div style={{ marginTop: 24 }}>
        <ApiKeySettings workspaceId={workspaceId} />
      </div>
    </section>
  );
}
