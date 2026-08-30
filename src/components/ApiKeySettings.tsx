import { useState, useEffect } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  getStoredUserGroqKey,
  setStoredUserGroqKey,
  clearStoredUserGroqKey,
  validateGroqKeyFormat,
  maskApiKey,
  GROQ_KEY_CHANGE_EVENT,
} from '../lib/apiKeyStorage';
import { invokeGatewayHealthCheck } from '../lib/modelGateway';

interface ApiKeySettingsProps {
  workspaceId: string;
  userRole?: string;
  onKeyStatusChange?: (hasKey: boolean) => void;
}

export function ApiKeySettings({ workspaceId, userRole: _userRole, onKeyStatusChange }: ApiKeySettingsProps) {
  const [currentKey, setCurrentKey] = useState<string | null>(() => getStoredUserGroqKey(workspaceId));
  const [inputKey, setInputKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    const handleKeyChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ workspaceId?: string; hasKey: boolean }>;
      if (!customEvent.detail.workspaceId || customEvent.detail.workspaceId === workspaceId) {
        const key = getStoredUserGroqKey(workspaceId);
        setCurrentKey(key);
        onKeyStatusChange?.(Boolean(key));
      }
    };
    window.addEventListener(GROQ_KEY_CHANGE_EVENT, handleKeyChange);
    return () => {
      window.removeEventListener(GROQ_KEY_CHANGE_EVENT, handleKeyChange);
    };
  }, [workspaceId, onKeyStatusChange]);

  const handleSave = () => {
    setFeedback(null);
    const validation = validateGroqKeyFormat(inputKey);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.error || 'Invalid API key format.' });
      return;
    }
    const res = setStoredUserGroqKey(inputKey, workspaceId);
    if (res.success) {
      setCurrentKey(inputKey.trim());
      setInputKey('');
      setFeedback({ type: 'success', message: 'Your Groq API key has been securely saved in your browser.' });
      onKeyStatusChange?.(true);
    } else {
      setFeedback({ type: 'error', message: res.error || 'Failed to save API key.' });
    }
  };

  const handleClear = () => {
    clearStoredUserGroqKey(workspaceId);
    setCurrentKey(null);
    setInputKey('');
    setFeedback({ type: 'info', message: 'API key removed. AI inference will require a personal key.' });
    onKeyStatusChange?.(false);
  };

  const handleTest = async () => {
    const keyToTest = inputKey.trim() || currentKey;
    if (!keyToTest) {
      setFeedback({ type: 'error', message: 'Please enter an API key to test.' });
      return;
    }
    const validation = validateGroqKeyFormat(keyToTest);
    if (!validation.valid) {
      setFeedback({ type: 'error', message: validation.error || 'Invalid key format.' });
      return;
    }

    setTesting(true);
    setFeedback(null);
    try {
      const res = await invokeGatewayHealthCheck(workspaceId, keyToTest);
      if (res.success && res.data?.status === 'healthy') {
        setFeedback({
          type: 'success',
          message: `Connection successful! Groq API key is valid and active on model gateway (latency: ${res.latencyMs ?? '?'}ms).`,
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.message || res.error || 'Connection failed. Please check your Groq API key.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unexpected network error during key validation.',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = Boolean(currentKey);

  return (
    <section className="border border-zinc-800 bg-zinc-950/80 rounded-xl p-5 space-y-4 shadow-sm" aria-labelledby="byok-heading">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Key size={18} aria-hidden="true" />
          </div>
          <div>
            <h3 id="byok-heading" className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Groq API Key (Bring Your Own Key)
              {isConfigured ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 size={11} /> Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <AlertCircle size={11} /> Key Required
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-400">
              Provide your personal Groq API key to power Claim Grounding Audits, AI analysis, and Specialist Council tasks.
            </p>
          </div>
        </div>

        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 border border-zinc-700/80 hover:bg-zinc-800 text-zinc-300 transition-colors"
        >
          Get Free Key on Groq <ExternalLink size={12} />
        </a>
      </header>

      {/* Current Key Status Display */}
      {isConfigured && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs">
          <div className="space-y-0.5">
            <div className="text-[11px] text-zinc-400 font-medium">Active Personal Key:</div>
            <div className="font-mono text-zinc-200">{maskApiKey(currentKey)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Test Connection
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 transition-colors flex items-center gap-1"
              title="Remove key from browser storage"
            >
              <Trash2 size={12} /> Remove
            </button>
          </div>
        </div>
      )}

      {/* Enter / Update Key Input */}
      <div className="space-y-2">
        <label htmlFor="groq-key-input" className="block text-xs font-medium text-zinc-300">
          {isConfigured ? 'Replace or Update Groq API Key' : 'Enter Groq API Key (starts with gsk_)'}
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              id="groq-key-input"
              type={showPassword ? 'text' : 'password'}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="gsk_••••••••••••••••••••••••••••••••••••••••"
              className="w-full px-3 py-2 pr-10 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
              aria-label={showPassword ? 'Hide key' : 'Show key'}
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={!inputKey.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors shrink-0"
          >
            Save Key
          </button>

          {inputKey.trim() && (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-50 transition-colors shrink-0 flex items-center gap-1.5"
            >
              {testing && <Loader2 size={12} className="animate-spin" />}
              Test
            </button>
          )}
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-red-950/40 border border-red-800/50 text-red-300'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
          }`}
          role="status"
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-400" />
          ) : feedback.type === 'error' ? (
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
          ) : (
            <ShieldCheck size={14} className="shrink-0 mt-0.5 text-zinc-400" />
          )}
          <div>{feedback.message}</div>
        </div>
      )}

      {/* Security Disclosure */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60 text-[11px] text-zinc-400">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-zinc-400" />
        <div>
          <span className="font-medium text-zinc-300">Privacy Guarantee:</span> Your Groq API key is stored strictly in your local browser session and passed over encrypted HTTPS exclusively to power your workspace AI tasks. It is never shared with other tenants or stored in public database tables.
        </div>
      </div>
    </section>
  );
}
