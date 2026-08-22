/**
 * Server-side task flags (Upgrade G applied to Upgrade A).
 *
 * A task must be both allowlisted (schemas.ts) and enabled here to run.
 * Enabling is operator configuration, never browser input:
 *   ENABLED_TASKS="gateway_health_check,claim_grounding_audit"
 * Health check is always enabled so the deploy can be probed.
 */

import { ALLOWLISTED_TASKS, DEFAULT_ENABLED_TASKS, type TaskType } from "./schemas.ts";

export function parseEnabledTasks(envValue: string | undefined | null): Set<TaskType> {
  const enabled = new Set<TaskType>(DEFAULT_ENABLED_TASKS);
  if (!envValue) return enabled;
  for (const raw of envValue.split(",")) {
    const name = raw.trim();
    if (ALLOWLISTED_TASKS.includes(name as TaskType)) enabled.add(name as TaskType);
    // Unknown names are ignored: a typo cannot enable anything.
  }
  return enabled;
}

export function isTaskEnabled(task: TaskType, envValue: string | undefined | null): boolean {
  return parseEnabledTasks(envValue).has(task);
}
