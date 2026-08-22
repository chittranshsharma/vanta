import { describe, expect, it } from "vitest";
import { detectType, looksLikeText, verifyDeclaredType } from "./magicBytes";

const b = (...xs: number[]) => new Uint8Array(xs);
const text = (s: string) => new TextEncoder().encode(s);
const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x18, ...Array.from("ftyp").map((c) => c.charCodeAt(0)), ...Array.from(brand).map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);

describe("detectType", () => {
  it("recognizes image signatures", () => {
    expect(detectType(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1))).toBe("png");
    expect(detectType(b(0xff, 0xd8, 0xff, 0xe0))).toBe("jpeg");
    expect(detectType(b(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("gif");
    expect(detectType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, ...Array.from("WEBP").map((c) => c.charCodeAt(0))]))).toBe("webp");
  });

  it("recognizes video containers", () => {
    expect(detectType(ftyp("isom"))).toBe("mp4");
    expect(detectType(ftyp("qt  "))).toBe("quicktime");
    expect(detectType(b(0x1a, 0x45, 0xdf, 0xa3, 0))).toBe("webm");
  });

  it("recognizes pdf, zip, and text", () => {
    expect(detectType(text("%PDF-1.7"))).toBe("pdf");
    expect(detectType(b(0x50, 0x4b, 0x03, 0x04))).toBe("zip");
    expect(detectType(text("date,clicks\n2026-01-01,5\n"))).toBe("text");
    expect(detectType(text("{\"a\":1}"))).toBe("text");
  });

  it("reports unknown binary and empty input", () => {
    expect(detectType(b(0, 1, 2, 3))).toBe("binary_unknown");
    expect(detectType(new Uint8Array(0))).toBe("binary_unknown");
  });
});

describe("looksLikeText", () => {
  it("accepts utf-8 with high bytes and rejects NUL", () => {
    expect(looksLikeText(text("héllo wörld\n"))).toBe(true);
    expect(looksLikeText(b(0x68, 0x00, 0x69))).toBe(false);
  });
});

describe("verifyDeclaredType", () => {
  it("accepts consistent declarations", () => {
    expect(verifyDeclaredType(text("a,b\n1,2\n"), "csv").verdict).toBe("accept");
    expect(verifyDeclaredType(b(0xff, 0xd8, 0xff), "image").verdict).toBe("accept");
    expect(verifyDeclaredType(ftyp("mp42"), "video").verdict).toBe("accept");
  });

  it("rejects a renamed binary posing as text or image", () => {
    const exe = b(0x4d, 0x5a, 0x90, 0x00, 0x03);
    const r = verifyDeclaredType(exe, "csv");
    expect(r.verdict).toBe("reject");
    expect(r.reason).toMatch(/looks like binary_unknown/);
    expect(verifyDeclaredType(text("%PDF-1.4"), "image").verdict).toBe("reject");
    expect(verifyDeclaredType(b(0x50, 0x4b, 0x03, 0x04), "image").verdict).toBe("reject");
  });

  it("rejects video bytes declared as an image and gif declared as image (gif not allowed)", () => {
    expect(verifyDeclaredType(ftyp("isom"), "image").verdict).toBe("reject");
    expect(verifyDeclaredType(b(0x47, 0x49, 0x46, 0x38), "image").verdict).toBe("reject");
  });

  it("never accepts the unsupported category", () => {
    expect(verifyDeclaredType(text("x"), "unsupported").verdict).toBe("reject");
  });
});
