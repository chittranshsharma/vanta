import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, Key, ChevronDown, ChevronUp } from 'lucide-react';
import {
  invokeClaimGroundingAudit,
  type ClaimGroundingResult,
  type ClaimGroundingVerdict,
} from '../lib/modelGateway';
import { getStoredUserGroqKey, GROQ_KEY_CHANGE_EVENT } from '../lib/apiKeyStorage';
import { ApiKeySettings } from './ApiKeySettings';
import type { CreativeClaimRow } from '../lib/creativeTwin';
import type { BrandClaim } from '../lib/brandBrain';

interface ClaimGroundingPanelProps {
  workspaceId: string;
  twinId: string;
  claims: CreativeClaimRow[];
  brandClaims: BrandClaim[];
  userRole?: string;
}

const VERDICT_LABEL: Record<ClaimGroundingVerdict['verdict'], string> = {
  backed_by_proof: 'Backed by proof',
  approved_no_proof: 'Approved, no proof point',
  conditional: 'Conditional',
  prohibited: 'Prohibited',
  unmatched: 'No matching brand claim',
};

const VERDICT_CLASS: Record<ClaimGroundingVerdict['verdict'], string> = {
  backed_by_proof: 'text-emerald-400',
  approved_no_proof: 'text-sky-300',
  conditional: 'text-amber-300',
  prohibited: 'text-red-400',
  unmatched: 'text-zinc-400',
};

/**
 * Review queue for the Ticket 5.1 model task. Every verdict is labelled as
 * model inference needing human review. Nothing here writes to creative_claims.
 */
export function ClaimGroundingPanel({ workspaceId, twinId, claims, brandClaims, userRole }: ClaimGroundingPanelProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ClaimGroundingResult | null>(null);
  const [hasUserKey, setHasUserKey] = useState<boolean>(() => Boolean(getStoredUserGroqKey(workspaceId)));
  const [showKeySettings, setShowKeySettings] = useState(false);

  useEffect(() => {
    const handleKeyChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ workspaceId?: string; hasKey: boolean }>;
      if (!customEvent.detail.workspaceId || customEvent.detail.workspaceId === workspaceId) {
        setHasUserKey(Boolean(getStoredUserGroqKey(workspaceId)));
      }
    };
    window.addEventListener(GROQ_KEY_CHANGE_EVENT, handleKeyChange);
    return () => {
      window.removeEventListener(GROQ_KEY_CHANGE_EVENT, handleKeyChange);
    };
  }, [workspaceId]);

  const isAuthorized = !userRole || ['owner', 'admin'].includes(userRole);

  const run = async () => {
    if (!isAuthorized) return;
    setRunning(true);
    setResult(null);
    const res = await invokeClaimGroundingAudit(workspaceId, twinId);
    setResult(res);
    setRunning(false);
    if (!res.success && (res.error === 'custom_key_required' || res.error === 'gateway_not_configured')) {
      setShowKeySettings(true);
    }
  };

  const claimText = (id: string) => claims.find((c) => c.id === id)?.claim_text ?? id;
  const brandText = (id: string | null) => (id ? brandClaims.find((b) => b.id === id)?.claim_text ?? id : null);

  return (
    <section className="mt-6 border border-zinc-800 rounded-xl p-4 space-y-3" aria-labelledby="grounding-heading">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 id="grounding-heading" className="text-sm font-semibold text-zinc-100">
            Claim-grounding audit
          </h4>
          <p className="text-xs text-zinc-400">
            Model inference over this twin's claims and the approved Brand Codex. Cites only existing IDs; rejected
            outputs are never shown. Every verdict needs human review and does not change the claim.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKeySettings((prev) => !prev)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1.5"
          >
            <Key size={13} className={hasUserKey ? 'text-emerald-400' : 'text-amber-400'} />
            {hasUserKey ? 'Groq Key (BYOK)' : 'Set Groq Key'}
            {showKeySettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running || claims.length === 0 || !isAuthorized}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100"
          >
            {running ? 'Running…' : 'Run audit'}
          </button>
        </div>
      </div>

      {showKeySettings && (
        <div className="pt-2 pb-1">
          <ApiKeySettings workspaceId={workspaceId} userRole={userRole} onKeyStatusChange={setHasUserKey} />
        </div>
      )}

      <div className="text-[11px] text-zinc-400 bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-2.5 space-y-1">
        <div className="text-zinc-300 font-medium">Provider disclosure before dispatch:</div>
        <div>
          Audit dispatches extracted claim text and active Brand Codex proof points to Groq (<code className="font-mono text-zinc-300">qwen/qwen3.8-27b</code>) for structured verification. Raw media files are never transmitted.
        </div>
        {!isAuthorized && (
          <div className="text-amber-400/90 font-medium">
            Only workspace owners and administrators can dispatch Claim Grounding Audits during beta.
          </div>
        )}
      </div>

      {claims.length === 0 && <p className="text-xs text-zinc-500">No extracted claims; nothing to ground.</p>}

      {result && !result.success && (
        <div className="flex items-start gap-2 text-xs text-red-300" role="alert">
          <ShieldAlert size={14} />
          <div>
            <div>
              {result.error === 'task_disabled'
                ? 'This task is not enabled on the deployment. An operator must set ENABLED_TASKS.'
                : result.error === 'brand_codex_empty'
                ? 'No approved brand claims exist; configure Brand Brain first.'
                : result.error === 'custom_key_required' || result.error === 'gateway_not_configured'
                ? 'A personal Groq API key is required. Please configure your key in settings above.'
                : result.message || result.error}
            </div>
            {result.validationErrors && result.validationErrors.length > 0 && (
              <div className="text-zinc-500 mt-1">
                Output rejected by the server validator ({result.validationErrors.length} problem
                {result.validationErrors.length === 1 ? '' : 's'}). Nothing displayed.
              </div>
            )}
            {result.correlationId && <div className="text-zinc-500 font-mono">correlation {result.correlationId}</div>}
          </div>
        </div>
      )}

      {result && result.success && result.data && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle size={13} />
            <span>
              Inference, needs human review. Prompt v{result.data.prompt_version}, schema v{result.data.schema_version}
              {result.data.repaired ? ', one schema repair used' : ''}. Confidence is the model's self-report and is
              not calibrated.
            </span>
          </div>
          <ul className="space-y-2">
            {result.data.verdicts.map((v) => (
              <li key={v.creative_claim_id} className="border border-zinc-800 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-zinc-200">{claimText(v.creative_claim_id)}</span>
                  <span className={`font-mono ${VERDICT_CLASS[v.verdict]}`}>
                    {VERDICT_LABEL[v.verdict]} · {v.evidence_class} · {v.confidence}
                  </span>
                </div>
                {v.matched_brand_claim_id && (
                  <div className="text-zinc-400">Brand claim: {brandText(v.matched_brand_claim_id)}</div>
                )}
                {v.cited_proof_point_ids.length > 0 && (
                  <div className="text-zinc-500 font-mono">proof: {v.cited_proof_point_ids.join(', ')}</div>
                )}
                <div className="text-zinc-400">{v.rationale}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
