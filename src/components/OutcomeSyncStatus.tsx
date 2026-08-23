import { Link2Off, Plug } from "lucide-react";
import { MISSING_SYNC_PIECES, type OutcomeSyncCapability } from "../../shared/connectors/outcomeSync";

/**
 * Connector outcome-sync status.
 *
 * An experiment can declare that its outcomes will arrive from an authorized
 * connector. Nothing in this build can deliver that, and this panel says so per
 * provider rather than leaving the option looking operational. The four absences
 * are listed once, not per provider, because they are the same four everywhere
 * and repeating them would read as four problems per platform.
 *
 * No sync control is rendered. A button that cannot produce a row is worse than
 * no button.
 */

const STATE_CLASS: Record<OutcomeSyncCapability["state"], string> = {
  not_applicable: "disabled",
  not_implemented: "missing",
  setup_required: "unknown",
  blocked: "missing",
  stale: "unknown",
  ready: "configured",
};

const STATE_BADGE: Record<OutcomeSyncCapability["state"], string> = {
  not_applicable: "n/a",
  not_implemented: "absent",
  setup_required: "setup",
  blocked: "blocked",
  stale: "stale",
  ready: "ready",
};

export function OutcomeSyncStatus({ capabilities, heading = "Connector outcome sync" }: { capabilities: OutcomeSyncCapability[]; heading?: string }) {
  const anyUnimplemented = capabilities.some((c) => c.state === "not_implemented");

  return (
    <div>
      <p className="state-overline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {anyUnimplemented ? <Link2Off size={13} aria-hidden="true" /> : <Plug size={13} aria-hidden="true" />} {heading}
      </p>

      <ul className="vp-steps" aria-label="Outcome sync status per provider">
        {capabilities.map((c) => (
          <li key={c.provider} className={`vp-state-${STATE_CLASS[c.state]}`}>
            <span>{STATE_BADGE[c.state]}</span>
            <div>
              <strong>{c.label}</strong>
              <br />
              <em>{c.detail}</em>
              {c.nextInput && (
                <>
                  <br />
                  <em>Next: {c.nextInput}</em>
                </>
              )}
              {c.state !== "not_implemented" && c.access?.state === "unknown" && c.access.reason !== c.detail && (
                <>
                  <br />
                  <em>Connection: {c.access.reason}</em>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {anyUnimplemented && (
        <>
          <p className="vp-hint">Four separate things are absent before any provider could deliver an outcome row. Clearing one alone changes nothing:</p>
          <ul className="vp-steps" aria-label="What is missing before any connector sync could run">
            {MISSING_SYNC_PIECES.map((piece, i) => (
              <li key={piece}>
                <span>{i + 1}</span>
                <div>{piece}</div>
              </li>
            ))}
          </ul>
          <p className="vp-hint">
            Until then, outcomes are imported from a CSV against a registered source, and each row keeps that source and its citability. An
            experiment whose outcomes are set to connector sync cannot conclude.
          </p>
        </>
      )}
    </div>
  );
}
