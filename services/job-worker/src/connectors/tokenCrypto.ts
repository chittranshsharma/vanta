/**
 * OAuth token encryption (Upgrade F). AES-256-GCM with a key that lives
 * only in the backend environment (CONNECTOR_TOKEN_KEY, base64, 32 bytes).
 * Ciphertext layout: iv(12) | tag(16) | data. key_id travels alongside so
 * rotation is possible without re-encrypting everything at once.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface TokenKey {
  id: string;
  key: Buffer;
}

export function loadTokenKey(env: Record<string, string | undefined> = process.env): TokenKey | null {
  const b64 = env.CONNECTOR_TOKEN_KEY;
  const id = env.CONNECTOR_TOKEN_KEY_ID;
  if (!b64 || !id) return null;
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) return null;
  return { id, key };
}

export function encryptToken(plain: string, key: TokenKey): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key.key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]);
}

export function decryptToken(ciphertext: Buffer, key: TokenKey): string {
  if (ciphertext.length < 28) throw new Error("ciphertext too short");
  const iv = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(12, 28);
  const data = ciphertext.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key.key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
