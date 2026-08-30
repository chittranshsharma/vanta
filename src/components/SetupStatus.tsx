import { Activity, CheckCircle2, CircleDashed, CircleOff, HelpCircle } from "lucide-react";
import { useState } from "react";
import { deriveConfigStatus, gatewayItemFromProbe, type ReadinessItem, type ReadinessState } from "../lib/configStatus";
import { isFlagOn, ALL_CLIENT_FLAGS, type ClientFlag } from "../lib/flags";
import { invokeGatewayHealthCheck } from "../lib/modelGateway";
import { isSupabaseConfigured } from "../lib/supabase";
import { ApiKeySettings } from "./ApiKeySettings";

const STATE_LABEL: Record<ReadinessState, string> = {
  configured: "Configured",
  missing: "Missing",
  disabled: "Off",
  unknown: "Unknown"
};

function StateIcon({ state }: { state: ReadinessState }) {
  const size = 15;
  if (state === "configured") return <CheckCircle2 size={size} aria-hidden="true" />;
  if (state === "missing") return <CircleOff size={size} aria-hidden="true" />;
  if (state === "disabled") return <CircleDashed size={size} aria-hidden="true" />;
  return <HelpCircle size={size} aria-hidden="true" />;
}

/**
 * Setup and status panel. Shows what the build is wired for (static) and
 * lets the user run the one fixed-cost live probe that exists (gateway
 * health). Nothing here is inferred from a successful page load.
 */
export function SetupStatus({ workspaceId, canProbe, onGatewayProbe }: { workspaceId: string; canProbe: boolean; onGatewayProbe?: (state: "configured" | "missing" | "unknown") => void }) {
  const flagsOn = new Set<ClientFlag>(ALL_CLIENT_FLAGS.filter((f) => isFlagOn(f)));
  const staticItems = deriveConfigStatus({
    supabaseConfigured: isSupabaseConfigured,
    flagsOn,
    telemetryEndpoint: import.meta.env.VITE_TELEMETRY_ENDPOINT,
    appVersion: import.meta.env.VITE_APP_VERSION
  });
  const [probe, setProbe] = useState<{ running: boolean; item: ReadinessItem | null }>({ running: false, item: null });

  const items = staticItems.map((i) => (i.id === "gateway" && probe.item ? probe.item : i));

  const runProbe = async () => {
    setProbe({ running: true, item: null });
    const res = await invokeGatewayHealthCheck(workspaceId);
    const item = gatewayItemFromProbe(res.success ? { success: true } : { success: false, error: res.error ?? "unknown_error", message: res.message ?? "No message returned." });
    setProbe({ running: false, item });
    // The probe result is the only positive knowledge the browser has about the
    // gateway; share it so capability gates elsewhere stop guessing.
    onGatewayProbe?.(item.state === "disabled" ? "unknown" : item.state);
  };

  return (
    <section className="vp-panel" aria-labelledby="setup-heading">
      <header className="vp-panel-header">
        <div>
          <p className="eyebrow">Operational readiness</p>
          <h2 id="setup-heading" className="vp-title">Setup and status</h2>
          <p className="vp-subtitle">
            Static rows come from build configuration. Live rows come from a probe you ran. A row never turns green because the page loaded.
          </p>
        </div>
        <button type="button" className="ghost-button-sm" onClick={runProbe} disabled={!canProbe || probe.running} aria-describedby="probe-help">
          <Activity size={14} aria-hidden="true" /> {probe.running ? "Probing…" : "Probe model gateway"}
        </button>
      </header>
      <p id="probe-help" className="vp-hint">
        {canProbe
          ? "Sends only your workspace id and the task name. No prompt, no model content, fixed cost."
          : "Sign in with a workspace to run the probe."}
      </p>
      <ul className="vp-list" aria-live="polite">
        {items.map((item) => (
          <li key={item.id} className={`vp-row vp-state-${item.state}`}>
            <span className="vp-row-state">
              <StateIcon state={item.state} />
              <span>{STATE_LABEL[item.state]}</span>
            </span>
            <div className="vp-row-body">
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
            <span className="pill" title={item.basis === "live" ? "From a probe you ran" : "From build configuration"}>
              {item.basis}
            </span>
          </li>
        ))}
      </ul>

      {workspaceId && (
        <div style={{ marginTop: 24 }}>
          <ApiKeySettings workspaceId={workspaceId} />
        </div>
      )}
    </section>
  );
}
