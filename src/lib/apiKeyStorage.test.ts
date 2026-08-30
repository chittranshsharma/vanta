import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateGroqKeyFormat,
  maskApiKey,
  getStoredUserGroqKey,
  setStoredUserGroqKey,
  clearStoredUserGroqKey,
} from './apiKeyStorage';

class MemoryStorage implements Storage {
  private store: Record<string, string> = {};

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

describe('apiKeyStorage (BYOK Groq API Key)', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage: memoryStorage,
        dispatchEvent: () => true,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error cleanup window mock
    delete globalThis.window;
  });

  describe('validateGroqKeyFormat', () => {
    it('accepts valid Groq API key', () => {
      const res = validateGroqKeyFormat('gsk_1234567890abcdef1234567890');
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects keys without gsk_ prefix', () => {
      const res = validateGroqKeyFormat('sk-1234567890abcdef1234567890');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('start with "gsk_"');
    });

    it('rejects keys that are too short', () => {
      const res = validateGroqKeyFormat('gsk_short');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('too short');
    });

    it('rejects keys with invalid characters', () => {
      const res = validateGroqKeyFormat('gsk_invalid$key*characters@12345');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('invalid characters');
    });

    it('rejects empty or null input', () => {
      expect(validateGroqKeyFormat('').valid).toBe(false);
      // @ts-expect-error test invalid type
      expect(validateGroqKeyFormat(null).valid).toBe(false);
    });
  });

  describe('maskApiKey', () => {
    it('safely masks standard Groq key', () => {
      const masked = maskApiKey('gsk_1234567890abcdef9999');
      expect(masked).toBe('gsk_••••••••••••9999');
      expect(masked).not.toContain('1234567890abcdef');
    });

    it('returns empty string for null or empty input', () => {
      expect(maskApiKey('')).toBe('');
      expect(maskApiKey(null)).toBe('');
    });
  });

  describe('Storage CRUD operations', () => {
    const validKey = 'gsk_abcdef1234567890abcdef1234';

    it('saves and retrieves global key', () => {
      const saveRes = setStoredUserGroqKey(validKey);
      expect(saveRes.success).toBe(true);
      expect(getStoredUserGroqKey()).toBe(validKey);
    });

    it('saves and retrieves workspace-scoped key', () => {
      const wsId = 'ws-test-123';
      const saveRes = setStoredUserGroqKey(validKey, wsId);
      expect(saveRes.success).toBe(true);
      expect(getStoredUserGroqKey(wsId)).toBe(validKey);
    });

    it('falls back to global key if workspace-scoped key is not set', () => {
      setStoredUserGroqKey(validKey);
      expect(getStoredUserGroqKey('other-ws')).toBe(validKey);
    });

    it('clears stored key', () => {
      setStoredUserGroqKey(validKey);
      expect(getStoredUserGroqKey()).toBe(validKey);
      clearStoredUserGroqKey();
      expect(getStoredUserGroqKey()).toBeNull();
    });

    it('rejects invalid key on save', () => {
      const saveRes = setStoredUserGroqKey('invalid_key');
      expect(saveRes.success).toBe(false);
      expect(saveRes.error).toBeDefined();
      expect(getStoredUserGroqKey()).toBeNull();
    });
  });
});
