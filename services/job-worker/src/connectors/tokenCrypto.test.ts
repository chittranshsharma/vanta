import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, loadTokenKey } from "./tokenCrypto.js";

const env = { CONNECTOR_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CONNECTOR_TOKEN_KEY_ID: "k1" };

describe("token crypto", () => {
  it("refuses missing or wrong-length keys", () => {
    expect(loadTokenKey({})).toBeNull();
    expect(loadTokenKey({ CONNECTOR_TOKEN_KEY: Buffer.alloc(16).toString("base64"), CONNECTOR_TOKEN_KEY_ID: "k" })).toBeNull();
  });

  it("round-trips and produces distinct ciphertext per call", () => {
    const key = loadTokenKey(env)!;
    const a = encryptToken("refresh-token-123", key);
    const b = encryptToken("refresh-token-123", key);
    expect(a.equals(b)).toBe(false);
    expect(decryptToken(a, key)).toBe("refresh-token-123");
    expect(a.toString("utf8")).not.toContain("refresh-token");
  });

  it("fails authentication when tampered or decrypted with another key", () => {
    const key = loadTokenKey(env)!;
    const c = encryptToken("secret", key);
    c[c.length - 1] ^= 0xff;
    expect(() => decryptToken(c, key)).toThrow();
    const other = loadTokenKey({ CONNECTOR_TOKEN_KEY: Buffer.alloc(32, 9).toString("base64"), CONNECTOR_TOKEN_KEY_ID: "k2" })!;
    expect(() => decryptToken(encryptToken("secret", key), other)).toThrow();
  });
});
