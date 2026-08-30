/**
 * Client-Side API Key Storage & Utilities (BYOK - Bring Your Own Key)
 *
 * Security Invariants:
 * 1. Keys are stored strictly in client localStorage/session, never persisted in shared database tables.
 * 2. Provides safe masking so keys are never displayed in full in the UI.
 * 3. Validates standard Groq key format ('gsk_...' with minimum length).
 * 4. Dispatches change events so UI components update reactively.
 */

const STORAGE_KEY_PREFIX = 'vanta_byok_groq_key';
export const GROQ_KEY_CHANGE_EVENT = 'vanta:groq-key-changed';

/**
 * Validates whether a given string matches standard Groq API key format.
 */
export function validateGroqKeyFormat(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required.' };
  }
  const trimmed = key.trim();
  if (!trimmed.startsWith('gsk_')) {
    return { valid: false, error: 'Groq API keys must start with "gsk_".' };
  }
  if (trimmed.length < 20) {
    return { valid: false, error: 'Groq API key appears too short.' };
  }
  if (!/^gsk_[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { valid: false, error: 'Groq API key contains invalid characters.' };
  }
  return { valid: true };
}

/**
 * Returns a masked representation of the API key for safe UI display.
 * E.g., 'gsk_••••••••••••3f8a'
 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return 'gsk_••••••••';
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}••••••••••••${suffix}`;
}

/**
 * Retrieves the stored user Groq API key from client localStorage.
 */
export function getStoredUserGroqKey(workspaceId?: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Check workspace-scoped key first, then global key fallback
    if (workspaceId) {
      const scoped = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}_${workspaceId}`);
      if (scoped && validateGroqKeyFormat(scoped).valid) return scoped.trim();
    }
    const globalKey = window.localStorage.getItem(STORAGE_KEY_PREFIX);
    if (globalKey && validateGroqKeyFormat(globalKey).valid) return globalKey.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Saves the user's Groq API key to client localStorage and notifies listeners.
 */
export function setStoredUserGroqKey(key: string, workspaceId?: string): { success: boolean; error?: string } {
  const validation = validateGroqKeyFormat(key);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, error: 'Browser storage is unavailable.' };
    }
    const trimmed = key.trim();
    if (workspaceId) {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}_${workspaceId}`, trimmed);
    } else {
      window.localStorage.setItem(STORAGE_KEY_PREFIX, trimmed);
    }
    window.dispatchEvent(new CustomEvent(GROQ_KEY_CHANGE_EVENT, { detail: { workspaceId, hasKey: true } }));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save API key.' };
  }
}

/**
 * Removes the stored user Groq API key from client localStorage and notifies listeners.
 */
export function clearStoredUserGroqKey(workspaceId?: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (workspaceId) {
      window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}_${workspaceId}`);
    }
    window.localStorage.removeItem(STORAGE_KEY_PREFIX);
    window.dispatchEvent(new CustomEvent(GROQ_KEY_CHANGE_EVENT, { detail: { workspaceId, hasKey: false } }));
  } catch {
    // Ignore storage errors on cleanup
  }
}
