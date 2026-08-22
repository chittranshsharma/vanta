import React, { useState, useMemo } from 'react';
import {
  deriveTimelineDiagnostics,
  DEFAULT_DIAGNOSTIC_RULES,
  type DiagnosticSeverity,
  type DiagnosticRulesConfig,
} from '../lib/creativeDoctor';
import type { CreativeSceneRow, CreativeClaimRow, CreativeTwinRow } from '../lib/creativeTwin';
import type { BrandClaim } from '../lib/brandBrain';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  Clock,
  Sliders,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface TimelineDoctorProps {
  twin: Pick<CreativeTwinRow, 'id' | 'title' | 'asset_kind' | 'known_gaps'>;
  scenes: CreativeSceneRow[];
  claims: CreativeClaimRow[];
  brandClaims?: BrandClaim[];
  onOpenSceneEditor?: (sceneId: string) => void;
  onBack?: () => void;
}

const SEVERITY_CONFIG: Record<
  DiagnosticSeverity,
  { label: string; bg: string; text: string; border: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: 'Critical',
    bg: 'bg-rose-950/80',
    text: 'text-rose-400',
    border: 'border-rose-800/50',
    icon: AlertCircle,
  },
  warning: {
    label: 'Warning',
    bg: 'bg-amber-950/80',
    text: 'text-amber-400',
    border: 'border-amber-800/50',
    icon: AlertTriangle,
  },
  info: {
    label: 'Info',
    bg: 'bg-blue-950/80',
    text: 'text-blue-400',
    border: 'border-blue-800/50',
    icon: Info,
  },
  gap: {
    label: 'Gap',
    bg: 'bg-zinc-900',
    text: 'text-zinc-400',
    border: 'border-zinc-700/50',
    icon: HelpCircle,
  },
};

export const TimelineDoctor: React.FC<TimelineDoctorProps> = ({
  twin,
  scenes,
  claims,
  brandClaims = [],
  onOpenSceneEditor,
  onBack,
}) => {
  const [config, setConfig] = useState<DiagnosticRulesConfig>(DEFAULT_DIAGNOSTIC_RULES);
  const [showConfig, setShowConfig] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'all' | DiagnosticSeverity>('all');
  const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);

  // Pure in-memory derivation
  const diagnostics = useMemo(
    () => deriveTimelineDiagnostics(twin, scenes, claims, brandClaims, config),
    [twin, scenes, claims, brandClaims, config]
  );

  const filteredDiagnostics = useMemo(() => {
    return diagnostics.filter((d) => {
      if (severityFilter !== 'all' && d.severity !== severityFilter) return false;
      if (selectedSceneIndex !== null && d.sceneIndex !== null && d.sceneIndex !== selectedSceneIndex) {
        return false;
      }
      return true;
    });
  }, [diagnostics, severityFilter, selectedSceneIndex]);

  const hasCompleteTimecodes = scenes.length > 0 && scenes.every((s) => s.start_seconds !== null && s.end_seconds !== null);
  const totalDuration = hasCompleteTimecodes
    ? Math.max(...scenes.map((s) => s.end_seconds || 0), 1)
    : null;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Clock size={16} className="text-emerald-400" />
              Timeline Doctor
            </h2>
            <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              Rule Engine {config.version}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Deterministic diagnostic analysis grounded in verified text and timestamps. Derived dynamically on read.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition"
          >
            <Sliders size={13} />
            Policy Rules ({config.earlyHookWindowSeconds}s / {config.highReadingBurdenWpm} WPM)
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
            >
              Back to Inspector
            </button>
          )}
        </div>
      </div>

      {/* Rules Config Drawer (Visible & Configurable) */}
      {showConfig && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-300 border-b border-zinc-800 pb-2">
            <span>Configurable Diagnostic Rule Parameters</span>
            <span className="text-[10px] text-zinc-500">Policy defaults · Not reach predictions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                Early-Hook Window (seconds): <strong className="text-zinc-200">{config.earlyHookWindowSeconds}s</strong>
              </label>
              <input
                type="range"
                min="1.5"
                max="6.0"
                step="0.5"
                value={config.earlyHookWindowSeconds}
                onChange={(e) =>
                  setConfig({ ...config, earlyHookWindowSeconds: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-zinc-500">
                Rule R-HOOK-002 evaluates whether hook begins within this threshold.
              </span>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                High Reading Burden Threshold (WPM): <strong className="text-zinc-200">{config.highReadingBurdenWpm} WPM</strong>
              </label>
              <input
                type="range"
                min="150"
                max="220"
                step="10"
                value={config.highReadingBurdenWpm}
                onChange={(e) =>
                  setConfig({ ...config, highReadingBurdenWpm: parseInt(e.target.value, 10) })
                }
                className="w-full accent-emerald-500"
              />
              <span className="text-[10px] text-zinc-500">
                Rule R-PACE-001 flags spoken speed exceeding conversational density.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Visual Timeline Bar (Rendered only if complete timestamps exist; otherwise sequential disclosure) */}
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-zinc-300">
            {hasCompleteTimecodes ? `Asset Timeline (0.0s – ${totalDuration?.toFixed(1)}s)` : 'Sequential Scene Overview (Timecodes Incomplete)'}
          </span>
          <span className="text-[11px] text-zinc-400">
            {selectedSceneIndex !== null ? (
              <button
                onClick={() => setSelectedSceneIndex(null)}
                className="text-emerald-400 hover:underline"
              >
                Clear Scene Filter (Scene {selectedSceneIndex + 1})
              </button>
            ) : (
              'Click scene to isolate diagnostics'
            )}
          </span>
        </div>

        {/* Timed Bar / Sequential Card Strip */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {scenes.map((scene) => {
            const hasTime = scene.start_seconds !== null && scene.end_seconds !== null;
            const isSelected = selectedSceneIndex === scene.scene_index;
            const sceneDiags = diagnostics.filter((d) => d.sceneIndex === scene.scene_index);
            const hasWarning = sceneDiags.some((d) => d.severity === 'warning' || d.severity === 'critical');

            return (
              <button
                key={scene.id}
                onClick={() =>
                  setSelectedSceneIndex(isSelected ? null : scene.scene_index)
                }
                className={`flex-1 min-w-[130px] p-3 rounded-lg border text-left transition ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500'
                    : hasWarning
                    ? 'bg-amber-950/20 border-amber-800/40 hover:border-amber-700'
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-mono text-zinc-400">
                    Scene {scene.scene_index + 1}
                  </span>
                  <span className="text-[10px] font-mono uppercase bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                    {scene.shot_purpose.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-zinc-200 font-mono">
                  {hasTime ? `${scene.start_seconds}s – ${scene.end_seconds}s` : 'Unknown Time'}
                </div>

                <div className="text-[11px] text-zinc-400 truncate mt-1">
                  {scene.spoken_transcript || scene.on_screen_text || 'No spoken text'}
                </div>

                {scene.reading_burden_wpm !== null && (
                  <div className="text-[10px] font-mono text-zinc-500 mt-1">
                    {scene.reading_burden_wpm} WPM
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Diagnostics List with Severity Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-400">Filter Severity:</span>
            {(['all', 'critical', 'warning', 'info', 'gap'] as const).map((sev) => {
              const count =
                sev === 'all'
                  ? diagnostics.length
                  : diagnostics.filter((d) => d.severity === sev).length;
              return (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md border transition capitalize ${
                    severityFilter === sev
                      ? 'bg-zinc-200 text-zinc-900 border-zinc-200 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {sev} ({count})
                </button>
              );
            })}
          </div>

          <div className="text-xs font-mono text-zinc-500">
            {filteredDiagnostics.length} findings displayed
          </div>
        </div>

        {filteredDiagnostics.length === 0 ? (
          <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-2">
            <ShieldCheck size={24} className="mx-auto text-emerald-400" />
            <div className="text-xs font-medium text-zinc-200">
              No matching diagnostic alerts for active filter.
            </div>
            <div className="text-[11px] text-zinc-500">
              Script adheres to all configured deterministic policy thresholds.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDiagnostics.map((diag) => {
              const sev = SEVERITY_CONFIG[diag.severity];
              const Icon = sev.icon;

              return (
                <div
                  key={diag.id}
                  className={`p-4 bg-zinc-900/80 border ${sev.border} rounded-xl space-y-3 transition`}
                >
                  {/* Top Line: Badge, Rule ID, Evidence Badge */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1 text-xs font-mono uppercase px-2 py-0.5 rounded border ${sev.bg} ${sev.text} ${sev.border}`}
                      >
                        <Icon size={12} />
                        {diag.severity}
                      </span>
                      <span className="text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded">
                        {diag.ruleId} ({diag.ruleVersion})
                      </span>
                      <span className="text-xs font-semibold text-zinc-100">
                        {diag.ruleTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/50">
                        Class: {diag.evidenceClass}
                      </span>
                      {diag.sceneIndex !== null && onOpenSceneEditor && (
                        <button
                          onClick={() => {
                            const target = scenes.find((s) => s.scene_index === diag.sceneIndex);
                            if (target) onOpenSceneEditor(target.id);
                          }}
                          className="px-2 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded font-medium transition flex items-center gap-1"
                        >
                          Edit Scene {diag.sceneIndex + 1} <ChevronRight size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Observed Fact */}
                  <div className="text-xs bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800/60 font-mono text-zinc-300">
                    <span className="text-zinc-500">Observed Input: </span>
                    {diag.observedFact}
                  </div>

                  {/* Policy Finding Explanation */}
                  <div className="text-xs text-zinc-300 leading-relaxed">
                    {diag.findingExplanation}
                  </div>

                  {/* Actionable Edit Recommendation */}
                  <div className="p-2.5 bg-emerald-950/20 border border-emerald-800/30 rounded-lg text-xs text-emerald-300/90 flex items-start gap-2">
                    <ArrowRight size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div>
                      <strong className="font-semibold text-emerald-300">Actionable Edit Recommendation: </strong>
                      {diag.recommendedEdit}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
