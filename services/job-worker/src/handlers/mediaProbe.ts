/**
 * Handler: media_probe (Upgrade D).
 *
 * Downloads the original asset bytes through a short-lived signed URL
 * created with the service-role client, verifies the magic bytes against
 * the declared category, runs ffprobe, and returns deterministic media
 * metadata as the job result. The worker writes a derived_artifacts row
 * (producer = media_worker, evidence_class = observed) on success.
 *
 * Payload: { asset_id, storage_bucket, storage_path, declared_category }
 * Requires ffprobe on PATH. Missing ffprobe is a permanent failure with a
 * clear code; the job is never silently "succeeded".
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { verifyDeclaredType, type IntakeCategory } from "../../../../shared/media/magicBytes.js";
import type { JobHandler } from "../loop.js";
import { parseFfprobe } from "./ffprobe.js";

const execFileAsync = promisify(execFile);
export const MEDIA_WORKER_VERSION = "0.1.0";
const MAX_PROBE_BYTES = 512 * 1024 * 1024;

export function makeMediaProbeHandler(supabase: SupabaseClient): JobHandler {
  return async (job, signal) => {
    const p = job.payload as { asset_id?: string; storage_bucket?: string; storage_path?: string; declared_category?: IntakeCategory };
    if (!p.asset_id || !p.storage_bucket || !p.storage_path || !p.declared_category) {
      return { ok: false, failure: { kind: "permanent", message: "payload missing asset/storage fields", code: "bad_payload" } };
    }
    if (!p.storage_path.startsWith(`${job.workspace_id}/`)) {
      return { ok: false, failure: { kind: "permanent", message: "storage path outside workspace prefix", code: "path_scope" } };
    }

    const { data: signed, error: signErr } = await supabase.storage.from(p.storage_bucket).createSignedUrl(p.storage_path, 120);
    if (signErr || !signed?.signedUrl) {
      return { ok: false, failure: { kind: "transient", message: "could not sign download url", code: "sign_failed" } };
    }

    const res = await fetch(signed.signedUrl);
    if (!res.ok) {
      return { ok: false, failure: { kind: res.status >= 500 ? "transient" : "permanent", message: `download http ${res.status}`, code: "download_failed" } };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_PROBE_BYTES) {
      return { ok: false, failure: { kind: "permanent", message: "asset exceeds probe size limit", code: "too_large" } };
    }

    const verification = verifyDeclaredType(buf, p.declared_category);
    if (verification.verdict === "reject") {
      return { ok: false, failure: { kind: "permanent", message: verification.reason ?? "type mismatch", code: "type_mismatch" } };
    }

    const dir = await mkdtemp(join(tmpdir(), "vanta-probe-"));
    const file = join(dir, "asset.bin");
    try {
      await writeFile(file, buf);
      const remainingMs = Math.max(1000, signal.deadlineMs - Date.now());
      const { stdout } = await execFileAsync(
        "ffprobe",
        ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
        { timeout: remainingMs, maxBuffer: 4 * 1024 * 1024 }
      );
      const metadata = parseFfprobe(JSON.parse(stdout));
      if (!metadata) {
        return { ok: false, failure: { kind: "permanent", message: "ffprobe output unparseable", code: "probe_unparseable" } };
      }
      return {
        ok: true,
        result: {
          artifact_kind: "media_metadata",
          producer: "media_worker",
          producer_version: MEDIA_WORKER_VERSION,
          evidence_class: "observed",
          coverage: "complete",
          detected_type: verification.detected,
          byte_size: buf.byteLength,
          features: metadata,
        },
      };
    } catch (err) {
      const e = err as NodeJS.ErrnoException & { killed?: boolean };
      if (e.code === "ENOENT") {
        return { ok: false, failure: { kind: "permanent", message: "ffprobe not installed on worker", code: "ffprobe_missing" } };
      }
      if (e.killed) {
        return { ok: false, failure: { kind: "transient", message: "ffprobe timed out", code: "timeout" } };
      }
      return { ok: false, failure: { kind: "permanent", message: "ffprobe failed", code: "probe_failed" } };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
}
