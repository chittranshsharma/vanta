import React, { useState, useMemo } from 'react';
import {
  generateDecisionMatrix,
  DEFAULT_DIAGNOSTIC_RULES,
  type DiagnosticRulesConfig,
  type MatrixDimensionRow,
  type VariantComparisonCell,
} from '../lib/creativeDoctor';
import type { CreativeSceneRow, CreativeClaimRow, CreativeTwinRow } from '../lib/creativeTwin';
import type { BrandClaim } from '../lib/brandBrain';
import {
  Columns3,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sliders,
  Info,
  ArrowUpRight,
} from 'lucide-react';

interface DecisionMatrixProps {
  twins: Pick<CreativeTwinRow, 'id' | 'title' | 'asset_kind' | 'known_gaps'>[];
  scenesByTwinId: Record<string, CreativeSceneRow[]>;
  claimsByTwinId: Record<string, CreativeClaimRow[]>;
  brandClaims?: BrandClaim[];
  onOpenTwin?: (twinId: string) => void;
  onOpenTimelineDoctor?: (twinId: string) => void;
}

const STATUS_STYLE_CONFIG: Record<
  VariantComparisonCell['status'],
  { bg: string; text: string; border: string; icon: typeof CheckCircle2 }
> = {
  pass: {
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-400',
    border: 'border-emerald-800/40',
    icon: CheckCircle2,
  },
  warning: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-400',
    border: 'border-amber-800/40',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-rose-950/40',
    text: 'text-rose-400',
    border: 'border-rose-800/40',
    icon: AlertTriangle,
  },
  gap: {
    bg: 'bg-zinc-950',
    text: 'text-zinc-400',
    border: 'border-zinc-800',
    icon: HelpCircle,
  },
  neutral: {
    bg: 'bg-zinc-900/60',
    text: 'text-zinc-300',
    border: 'border-zinc-800',
    icon: Info,
  },
};

export const DecisionMatrix: React.FC<DecisionMatrixProps> = ({
  twins,
  scenesByTwinId,
  claimsByTwinId,
  brandClaims = [],
  onOpenTimelineDoctor,
}) => {
  const [selectedTwinIds, setSelectedTwinIds] = useState<string[]>(() =>
    twins.slice(0, 3).map((t) => t.id)
  );
  const [activeCellProvenance, setActiveCellProvenance] = useState<{
    twinTitle: string;
    dimensionTitle: string;
    cell: VariantComparisonCell;
  } | null>(null);
  const [config, setConfig] = useState<DiagnosticRulesConfig>(DEFAULT_DIAGNOSTIC_RULES);
  const [showConfig, setShowConfig] = useState(false);

  const selectedTwins = useMemo(
    () => twins.filter((t) => selectedTwinIds.includes(t.id)),
    [twins, selectedTwinIds]
  );

  // Pure in-memory matrix generation
  const matrixReport = useMemo(
    () =>
      generateDecisionMatrix(
        selectedTwins,
        scenesByTwinId,
        claimsByTwinId,
        brandClaims,
        config
      ),
    [selectedTwins, scenesByTwinId, claimsByTwinId, brandClaims, config]
  );

  const handleToggleTwin = (twinId: string) => {
    if (selectedTwinIds.includes(twinId)) {
      if (selectedTwinIds.length > 1) {
        setSelectedTwinIds(selectedTwinIds.filter((id) => id !== twinId));
      }
    } else {
      if (selectedTwinIds.length < 4) {
        setSelectedTwinIds([...selectedTwinIds, twinId]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Columns3 size={16} className="text-emerald-400" />
              Creative Decision Matrix
            </h2>
            <span className="text-xs font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              Rule Engine {config.version}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Multi-variant comparative matrix across structural dimensions. Pure deterministic derivation on read with transparent calculation provenance.
          </p>
        </div>

        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition"
        >
          <Sliders size={13} />
          Rule Thresholds ({config.earlyHookWindowSeconds}s / {config.highReadingBurdenWpm} WPM)
        </button>
      </div>

      {/* Rules Config Drawer */}
      {showConfig && (
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-300 border-b border-zinc-800 pb-2">
            <span>Matrix Rule Thresholds</span>
            <span className="text-[10px] text-zinc-500">Policy defaults · Zero reach/virality predictions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-zinc-400 mb-1">
                Early-Hook Window: <strong className="text-zinc-200">{config.earlyHookWindowSeconds}s</strong>
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
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">
                High Reading Burden Threshold: <strong className="text-zinc-200">{config.highReadingBurdenWpm} WPM</strong>
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
            </div>
          </div>
        </div>
      )}

      {/* Variant Selector */}
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-zinc-300">
            Select Variants to Compare (2–4 variants):
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            {selectedTwinIds.length} selected
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {twins.map((t) => {
            const isSelected = selectedTwinIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => handleToggleTwin(t.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition font-mono ${
                  isSelected
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}
                {t.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Comparative Matrix Table */}
      {selectedTwins.length === 0 ? (
        <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl text-xs text-zinc-400">
          Please select at least one creative twin to render the comparison matrix.
        </div>
      ) : (
        <div className="overflow-x-auto border border-zinc-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800">
                <th className="p-3 text-xs font-mono text-zinc-400 w-[240px] sticky left-0 bg-zinc-950 z-10 border-r border-zinc-800">
                  Evaluation Dimension
                </th>
                {selectedTwins.map((t) => (
                  <th key={t.id} className="p-3 text-xs font-mono text-zinc-200 min-w-[220px]">
                    <div className="space-y-1">
                      <div className="font-semibold text-zinc-100 truncate">{t.title}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                          {t.asset_kind}
                        </span>
                        {onOpenTimelineDoctor && (
                          <button
                            onClick={() => onOpenTimelineDoctor(t.id)}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            Timeline Doctor <ArrowUpRight size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800 text-xs">
              {matrixReport.rows.map((row: MatrixDimensionRow) => (
                <tr key={row.dimensionKey} className="hover:bg-zinc-900/40 transition">
                  <td className="p-3 font-medium text-zinc-200 sticky left-0 bg-zinc-950/90 z-10 border-r border-zinc-800">
                    <div>{row.dimensionTitle}</div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {row.policyDescription}
                    </div>
                  </td>

                  {selectedTwins.map((t) => {
                    const cell = row.cellsByTwinId[t.id];
                    if (!cell) return <td key={t.id} className="p-3 text-zinc-500" aria-label="not available">n/a</td>;

                    const style = STATUS_STYLE_CONFIG[cell.status];
                    const Icon = style.icon;

                    return (
                      <td key={t.id} className="p-3 align-top">
                        <button
                          onClick={() =>
                            setActiveCellProvenance({
                              twinTitle: t.title,
                              dimensionTitle: row.dimensionTitle,
                              cell,
                            })
                          }
                          className={`w-full p-2.5 rounded-lg border text-left transition hover:brightness-110 ${style.bg} ${style.border}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium flex items-center gap-1 ${style.text}`}>
                              <Icon size={12} />
                              {cell.formattedValue}
                            </span>
                            <span className="text-[10px] font-mono bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800">
                              {cell.evidenceClass}
                            </span>
                          </div>

                          <div className="text-[11px] text-zinc-400 truncate">
                            {cell.calculationProvenance}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Provenance Detail Modal / Drawer */}
      {activeCellProvenance && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {activeCellProvenance.dimensionTitle}
                </h3>
                <span className="text-xs text-zinc-400">
                  {activeCellProvenance.twinTitle}
                </span>
              </div>
              <button
                onClick={() => setActiveCellProvenance(null)}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-mono"
              >
                Close ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-zinc-500 font-mono">Calculated Value:</span>
                <div className="text-sm font-semibold text-zinc-100">
                  {activeCellProvenance.cell.formattedValue}
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-zinc-500 font-mono">Evidence Standard:</span>
                <div className="text-zinc-300">
                  Class: <strong className="text-zinc-100 uppercase font-mono">{activeCellProvenance.cell.evidenceClass}</strong>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-zinc-500 font-mono">Calculation Provenance:</span>
                <div className="text-zinc-300 leading-relaxed">
                  {activeCellProvenance.cell.calculationProvenance}
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 italic">
                * Note: Evaluated strictly from verified user inputs and deterministic workspace policy rules. No generative AI or predictive scores applied.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
