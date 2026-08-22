/**
 * Decision Room guidance (pure). Chooses the next action that is actually
 * safe and possible given what the workspace has, and says what each later
 * step is still waiting for. It never claims progress that does not exist
 * and never points at a panel whose backing table is unavailable.
 */

export type WorkspacePanel = "brand" | "intake" | "twin" | "sources" | "experiments" | "publishing";

export interface WorkspaceFacts {
  hasBrandName: boolean;
  approvedClaimCount: number;
  assetCount: number;
  twinCount: number;
  sourceCount: number;
  citableSourceCount: number;
  metricDefinitionCount: number;
  experimentCount: number;
  /** null when the experiments table is unavailable (migration pending). */
  observedOutcomeCount: number | null;
  /** null when the posting-history table is unavailable (migration pending). */
  postObservationCount: number | null;
}

export interface LadderStep {
  id: string;
  title: string;
  detail: string;
  panel: WorkspacePanel;
  state: "done" | "next" | "waiting" | "blocked";
}

export interface DecisionRoomGuidance {
  steps: LadderStep[];
  next: LadderStep | null;
  /** Short, honest summary of where the workspace stands. */
  summary: string;
}

export function deriveGuidance(f: WorkspaceFacts): DecisionRoomGuidance {
  const raw: Array<Omit<LadderStep, "state"> & { done: boolean; blocked?: string }> = [
    {
      id: "brand",
      title: "Define the Brand Brain",
      detail: f.hasBrandName
        ? `Saved. ${f.approvedClaimCount} approved claim(s) recorded.`
        : "Product, audience, approved claims, and prohibited claims. Blank fields stay blank; nothing is inferred.",
      panel: "brand",
      done: f.hasBrandName
    },
    {
      id: "asset",
      title: "Intake a creative asset",
      detail: f.assetCount > 0 ? `${f.assetCount} asset(s) registered.` : "A script, hook set, or landing copy. Intake is local and private; nothing is sent for external analysis.",
      panel: "intake",
      done: f.assetCount > 0
    },
    {
      id: "twin",
      title: "Build a Creative Twin",
      detail: f.twinCount > 0 ? `${f.twinCount} twin(s) built.` : "Deterministic scene and claim structure from the asset you provided. Unspecified visuals stay unspecified.",
      panel: "twin",
      done: f.twinCount > 0
    },
    {
      id: "sources",
      title: "Register a citable source",
      detail:
        f.citableSourceCount > 0
          ? `${f.citableSourceCount} of ${f.sourceCount} source(s) can be cited.`
          : f.sourceCount > 0
          ? `${f.sourceCount} source(s) registered but none are citable yet; verify them or mark their freshness window.`
          : "Numeric claims stay unverified until a source backs them.",
      panel: "sources",
      done: f.citableSourceCount > 0
    },
    {
      id: "metric",
      title: "Define the metric to be read",
      detail: f.metricDefinitionCount > 0 ? `${f.metricDefinitionCount} metric definition(s).` : "An experiment can only be read against a metric you have defined.",
      panel: "sources",
      done: f.metricDefinitionCount > 0
    },
    {
      id: "experiment",
      title: "Define an experiment",
      detail:
        f.observedOutcomeCount === null
          ? "Experiment tables are not applied in this environment yet."
          : f.experimentCount > 0
          ? `${f.experimentCount} experiment(s) defined.`
          : "A falsifiable hypothesis comparing two twins on one metric.",
      panel: "experiments",
      done: f.experimentCount > 0,
      blocked: f.observedOutcomeCount === null ? "Migration 016 is pending live apply." : undefined
    },
    {
      id: "outcomes",
      title: "Import observed outcomes",
      detail:
        f.observedOutcomeCount === null
          ? "Unavailable until the experiment tables exist."
          : f.observedOutcomeCount > 0
          ? `${f.observedOutcomeCount} observed row(s) imported.`
          : "Rows must name a registered source. Until then no experiment can be read.",
      panel: "experiments",
      done: (f.observedOutcomeCount ?? 0) > 0,
      blocked: f.observedOutcomeCount === null ? "Migration 016 is pending live apply." : undefined
    },
    {
      id: "history",
      title: "Import posting history",
      detail:
        f.postObservationCount === null
          ? "Posting-history table is not applied in this environment yet."
          : f.postObservationCount > 0
          ? `${f.postObservationCount} observed post(s) stored.`
          : "Your own published posts with exact times. The only input a test window may come from.",
      panel: "publishing",
      done: (f.postObservationCount ?? 0) > 0,
      blocked: f.postObservationCount === null ? "Migration 017 is pending live apply." : undefined
    }
  ];

  let nextAssigned = false;
  const steps: LadderStep[] = raw.map((r) => {
    if (r.done) return { id: r.id, title: r.title, detail: r.detail, panel: r.panel, state: "done" };
    if (r.blocked) return { id: r.id, title: r.title, detail: `${r.detail} ${r.blocked}`.trim(), panel: r.panel, state: "blocked" };
    if (!nextAssigned) {
      nextAssigned = true;
      return { id: r.id, title: r.title, detail: r.detail, panel: r.panel, state: "next" };
    }
    return { id: r.id, title: r.title, detail: r.detail, panel: r.panel, state: "waiting" };
  });

  const next = steps.find((s) => s.state === "next") ?? null;
  const doneCount = steps.filter((s) => s.state === "done").length;
  const blockedCount = steps.filter((s) => s.state === "blocked").length;
  const summary = next
    ? `${doneCount} of ${steps.length} steps done. Next: ${next.title.toLowerCase()}.${blockedCount > 0 ? ` ${blockedCount} step(s) blocked by pending migrations.` : ""}`
    : blockedCount > 0
    ? `${doneCount} of ${steps.length} steps done. The rest are blocked by pending migrations, not by your input.`
    : "Every setup step is done. Any remaining gap is evidence, not configuration.";

  return { steps, next, summary };
}
