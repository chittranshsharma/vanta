/**
 * Magic-byte file type detection (Upgrade D).
 *
 * Client-declared MIME types and extensions are untrusted. This module
 * sniffs the leading bytes and reports whether the declared category is
 * consistent with the content. Pure; runs in the browser, the worker, and
 * tests. Text formats (CSV, TXT, MD, JSON) have no magic number, so they
 * are accepted only when the bytes look like text.
 */

export type DetectedType =
  | "png"
  | "jpeg"
  | "gif"
  | "webp"
  | "pdf"
  | "mp4"
  | "quicktime"
  | "webm"
  | "zip"
  | "text"
  | "binary_unknown";

export type IntakeCategory = "csv" | "text" | "json" | "image" | "video" | "unsupported";

const ACCEPTED: Record<IntakeCategory, readonly DetectedType[]> = {
  csv: ["text"],
  text: ["text"],
  json: ["text"],
  image: ["png", "jpeg", "webp"],
  video: ["mp4", "quicktime", "webm"],
  unsupported: [],
};

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i += 1) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let out = "";
  for (let i = start; i < Math.min(bytes.length, start + len); i += 1) out += String.fromCharCode(bytes[i]);
  return out;
}

/** True when the sample contains no NUL bytes and is mostly printable or whitespace. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 4096): boolean {
  const n = Math.min(bytes.length, sampleSize);
  if (n === 0) return false;
  let printable = 0;
  for (let i = 0; i < n; i += 1) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127) || b >= 128) printable += 1;
  }
  return printable / n > 0.95;
}

export function detectType(bytes: Uint8Array): DetectedType {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  // ISO BMFF: size(4) + 'ftyp' + brand
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand.startsWith("qt")) return "quicktime";
    return "mp4";
  }
  if (looksLikeText(bytes)) return "text";
  return "binary_unknown";
}

export interface TypeVerification {
  detected: DetectedType;
  declaredCategory: IntakeCategory;
  verdict: "accept" | "reject";
  reason: string | null;
}

/**
 * Compares sniffed content with the category the intake validator derived
 * from the declared MIME/extension. Mismatch rejects; the asset is never
 * stored under a type its bytes do not support.
 */
export function verifyDeclaredType(bytes: Uint8Array, declaredCategory: IntakeCategory): TypeVerification {
  const detected = detectType(bytes);
  const ok = ACCEPTED[declaredCategory].includes(detected);
  if (ok) return { detected, declaredCategory, verdict: "accept", reason: null };
  return {
    detected,
    declaredCategory,
    verdict: "reject",
    reason: `Declared ${declaredCategory} but content looks like ${detected}.`,
  };
}
