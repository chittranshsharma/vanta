import { useEffect, useState } from "react";
import { Film, ImageIcon } from "lucide-react";
import { listAssetArtifacts } from "../lib/artifacts";
import { isMissingTableError } from "../lib/experiments";
import { createSignedDownloadUrl, VIDEO_INTAKE_ENABLED, WORKSPACE_ASSETS_BUCKET } from "../lib/media";
import { describeMediaReadiness, type CapabilityReadiness, type StoredArtifact } from "../../shared/media/artifacts";

/**
 * Derived media readiness for one asset.
 *
 * Everything shown here comes from `derived_artifacts` rows the workspace
 * actually holds. No placeholder image is ever rendered: a frame or thumbnail on
 * this screen means a producer wrote those bytes and the row records what it
 * rendered. When there is nothing to show, the panel says which kind of nothing
 * it is — the capability does not apply to this asset, no producer exists in this
 * build, a producer exists and has not run, or rows exist and do not carry what
 * is needed.
 */

const STATE_CLASS: Record<CapabilityReadiness["state"], string> = {
  not_applicable: "disabled",
  no_producer: "missing",
  none_produced: "unknown",
  unreadable: "missing",
  ready: "configured",
};

const STATE_BADGE: Record<CapabilityReadiness["state"], string> = {
  not_applicable: "n/a",
  no_producer: "absent",
  none_produced: "pending",
  unreadable: "broken",
  ready: "ready",
};

function CapabilityRow({ label, readiness }: { label: string; readiness: CapabilityReadiness }) {
  return (
    <li className={`vp-state-${STATE_CLASS[readiness.state]}`}>
      <span>{STATE_BADGE[readiness.state]}</span>
      <div>
        <strong>{label}</strong>
        <br />
        <em>{readiness.detail}</em>
        {readiness.state === "unreadable" && (
          <ul aria-label={`Why ${label} cannot be shown`} style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 11, color: "#fca5a5" }}>
            {readiness.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function MediaReadiness({
  workspaceId,
  asset,
}: {
  workspaceId: string;
  asset: { id: string; title: string; asset_kind: string; mime_type: string | null; storage_path: string | null };
}) {
  const key = `${workspaceId}:${asset.id}`;
  const [loaded, setLoaded] = useState<{ key: string; artifacts: StoredArtifact[]; error: string | null } | null>(null);
  const current = loaded?.key === key ? loaded : null;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await listAssetArtifacts(workspaceId, asset.id);
      if (mounted) setLoaded({ key, artifacts: data ?? [], error });
    })();
    return () => {
      mounted = false;
    };
  }, [workspaceId, asset.id, key]);

  const readiness = current
    ? describeMediaReadiness({
        asset: { asset_kind: asset.asset_kind, mime_type: asset.mime_type, storage_path: asset.storage_path },
        artifacts: current.artifacts,
        videoIntakeEnabled: VIDEO_INTAKE_ENABLED,
      })
    : null;

  const thumb = readiness?.usableThumbnails[0] ?? null;
  // Only bytes in the bucket this build knows how to sign can be displayed. An
  // artifact recorded in another bucket is reported, not fetched blindly.
  const signablePath = thumb && thumb.storageBucket === WORKSPACE_ASSETS_BUCKET ? thumb.storagePath : null;
  const [signed, setSigned] = useState<{ path: string; url: string | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!signablePath) return;
    let mounted = true;
    (async () => {
      const { url, error } = await createSignedDownloadUrl(signablePath, workspaceId);
      if (mounted) setSigned({ path: signablePath, url, error });
    })();
    return () => {
      mounted = false;
    };
  }, [signablePath, workspaceId]);

  // A signature belongs to one path. A leftover one from a previous asset is
  // ignored rather than cleared, so no effect writes state on render.
  const signedForThisThumb = signablePath !== null && signed?.path === signablePath ? signed : null;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontFamily: "DM Mono, monospace",
          color: "#85c7e9",
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Film size={13} aria-hidden="true" /> Derived media artifacts
      </div>

      {!current && (
        <p className="vp-hint" role="status" aria-live="polite" aria-busy="true">
          Reading derived artifacts for this asset…
        </p>
      )}

      {current?.error && (
        <p className="error-text" role="alert">
          {isMissingTableError(current.error)
            ? "The derived-artifacts table (migration 012) is not applied in this environment, so no thumbnail, frame sample, or probe result can be stored or read here yet."
            : current.error}
        </p>
      )}

      {readiness && (
        <>
          {thumb && (
            <figure style={{ margin: "0 0 12px" }}>
              {!signablePath ? (
                <p className="vp-hint" role="alert">
                  A thumbnail row exists but records bucket <strong>{thumb.storageBucket}</strong>, which this build cannot sign. Its
                  bytes are not shown.
                </p>
              ) : signedForThisThumb?.url ? (
                <img
                  src={signedForThisThumb.url}
                  width={thumb.width}
                  height={thumb.height}
                  alt={`Thumbnail derived from ${asset.title}, ${thumb.width} by ${thumb.height} pixels, produced by ${thumb.producer} ${thumb.producerVersion}`}
                  style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)", display: "block" }}
                />
              ) : (
                <p className="vp-hint" role={signedForThisThumb?.error ? "alert" : "status"} aria-live="polite">
                  {signedForThisThumb?.error
                    ? `A thumbnail exists but its bytes could not be signed for viewing: ${signedForThisThumb.error}`
                    : "Signing a short-lived link to the stored thumbnail…"}
                </p>
              )}
              <figcaption className="vp-hint" style={{ marginTop: 6 }}>
                {thumb.width}×{thumb.height} px · {thumb.mimeType}
                {thumb.byteSize !== null && ` · ${(thumb.byteSize / 1024).toFixed(1)} KB`} · produced by {thumb.producer} {thumb.producerVersion}
              </figcaption>
            </figure>
          )}

          <ul className="vp-steps" aria-label="Derived media capabilities">
            <CapabilityRow label="Probe metadata (container, duration, streams)" readiness={readiness.metadata} />
            <CapabilityRow label="Thumbnail" readiness={readiness.thumbnail} />
            <CapabilityRow label="Frame samples" readiness={readiness.frames} />
          </ul>

          {readiness.metadataFacts && (
            <p className="vp-hint">
              Probe observed:{" "}
              {[
                readiness.metadataFacts.container && `container ${readiness.metadataFacts.container}`,
                readiness.metadataFacts.durationSeconds !== null && `${readiness.metadataFacts.durationSeconds.toFixed(1)} s`,
                readiness.metadataFacts.width !== null &&
                  readiness.metadataFacts.height !== null &&
                  `${readiness.metadataFacts.width}×${readiness.metadataFacts.height} px`,
                readiness.metadataFacts.streamCount !== null && `${readiness.metadataFacts.streamCount} stream(s)`,
                readiness.metadataFacts.hasAudio === null ? "audio not recorded" : readiness.metadataFacts.hasAudio ? "audio present" : "no audio stream",
              ]
                .filter(Boolean)
                .join(" · ")}
              . Coverage <strong>{readiness.metadataFacts.coverage}</strong>, producer version {readiness.metadataFacts.producerVersion}.
            </p>
          )}

          {readiness.usableFrames.length > 0 && (
            <ul className="vp-steps" aria-label="Stored frame samples">
              {readiness.usableFrames.map((frame) => (
                <li key={frame.artifactId}>
                  <span>
                    <ImageIcon size={13} aria-hidden="true" />
                  </span>
                  <div>
                    frame at <strong>{frame.atSeconds.toFixed(2)} s</strong>
                    {frame.frameIndex !== null && ` (index ${frame.frameIndex})`}
                    <br />
                    <em>
                      {frame.width}×{frame.height} px · {frame.mimeType} · {frame.producer} {frame.producerVersion}
                    </em>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="vp-hint">
            Nothing on this panel is drawn from a placeholder. An image appears only where a stored artifact row records the
            bytes and the pixel size a producer wrote, and its link is signed for {WORKSPACE_ASSETS_BUCKET} and expires. Frame
            samples are listed with the second they were taken from, because a frame with no timestamp cannot be attributed to a
            moment in the source.
          </p>
        </>
      )}
    </div>
  );
}
