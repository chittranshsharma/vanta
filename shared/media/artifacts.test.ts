import { describe, expect, it } from "vitest";
import {
  describeMediaReadiness,
  readFrameSample,
  readMediaMetadata,
  readThumbnail,
  type StoredArtifact,
} from "./artifacts";

function artifact(over: Partial<StoredArtifact> = {}): StoredArtifact {
  return {
    id: "a1",
    artifact_kind: "thumbnail",
    producer: "media_worker",
    producer_version: "0.1.0",
    storage_bucket: "workspace-assets",
    storage_path: "ws/asset/thumb.png",
    mime_type: "image/png",
    byte_size: 4096,
    features: { width: 320, height: 180 },
    coverage: "complete",
    created_at: "2026-08-20T10:00:00Z",
    ...over,
  };
}

const textAsset = { asset_kind: "script", mime_type: null, storage_path: null };
const imageAsset = { asset_kind: "thumbnail", mime_type: "image/png", storage_path: "ws/asset/orig.png" };
const videoAsset = { asset_kind: "short_video_metadata", mime_type: "video/mp4", storage_path: "ws/asset/clip.mp4" };

describe("readThumbnail", () => {
  it("accepts a row with stored image bytes and recorded pixel dimensions", () => {
    const r = readThumbnail(artifact());
    expect(r.ok && r.value).toMatchObject({ storagePath: "ws/asset/thumb.png", width: 320, height: 180, mimeType: "image/png" });
  });

  it("refuses a row of another kind rather than reading its features", () => {
    const r = readThumbnail(artifact({ artifact_kind: "media_metadata" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/is a media_metadata, not a thumbnail/);
  });

  it("refuses a row with no stored bytes", () => {
    const r = readThumbnail(artifact({ storage_bucket: null, storage_path: null }));
    expect(!r.ok && r.reason).toMatch(/no stored bytes/);
  });

  it("refuses a mime type a browser cannot be trusted to render", () => {
    const r = readThumbnail(artifact({ mime_type: "application/octet-stream" }));
    expect(!r.ok && r.reason).toMatch(/not a displayable image/);
  });

  it("refuses a row whose features do not record positive dimensions", () => {
    expect(readThumbnail(artifact({ features: {} })).ok).toBe(false);
    expect(readThumbnail(artifact({ features: { width: 320 } })).ok).toBe(false);
    expect(readThumbnail(artifact({ features: { width: 0, height: 180 } })).ok).toBe(false);
    expect(readThumbnail(artifact({ features: { width: "320", height: "180" } })).ok).toBe(false);
  });
});

describe("readFrameSample", () => {
  const frame = (features: Record<string, unknown>) =>
    readFrameSample(artifact({ artifact_kind: "frame_sample", features }));

  it("requires at_seconds, because an image with no timestamp cannot be attributed to a moment", () => {
    const r = frame({ width: 320, height: 180 });
    expect(!r.ok && r.reason).toMatch(/does not record at_seconds/);
  });

  it("accepts the first frame at second zero", () => {
    const r = frame({ width: 320, height: 180, at_seconds: 0 });
    expect(r.ok && r.value.atSeconds).toBe(0);
    expect(r.ok && r.value.frameIndex).toBeNull();
  });

  it("reads frame_index when the producer recorded one", () => {
    const r = frame({ width: 320, height: 180, at_seconds: 12.5, frame_index: 3 });
    expect(r.ok && r.value).toMatchObject({ atSeconds: 12.5, frameIndex: 3 });
  });
});

describe("readMediaMetadata", () => {
  it("reads the container, duration, video dimensions and audio presence the probe wrote", () => {
    const r = readMediaMetadata(
      artifact({
        artifact_kind: "media_metadata",
        features: { container: "mov,mp4", duration_seconds: 30.2, stream_count: 2, video: { width: 1080, height: 1920 }, audio: { codec: "aac" } },
      })
    );
    expect(r.ok && r.value).toMatchObject({ container: "mov,mp4", durationSeconds: 30.2, width: 1080, height: 1920, hasAudio: true });
  });

  it("distinguishes a recorded absence of audio from features that say nothing about it", () => {
    const withNull = readMediaMetadata(artifact({ artifact_kind: "media_metadata", features: { container: "png", audio: null } }));
    expect(withNull.ok && withNull.value.hasAudio).toBe(false);
    const silent = readMediaMetadata(artifact({ artifact_kind: "media_metadata", features: { container: "png" } }));
    expect(silent.ok && silent.value.hasAudio).toBeNull();
  });

  it("refuses a row that recorded no observation at all", () => {
    const r = readMediaMetadata(artifact({ artifact_kind: "media_metadata", features: {} }));
    expect(!r.ok && r.reason).toMatch(/records no container, duration, stream count or video stream/);
  });
});

describe("describeMediaReadiness", () => {
  it("calls every media capability not applicable for a text-only asset", () => {
    const r = describeMediaReadiness({ asset: textAsset, artifacts: [], videoIntakeEnabled: false });
    expect(r.metadata.state).toBe("not_applicable");
    expect(r.thumbnail.state).toBe("not_applicable");
    expect(r.frames.state).toBe("not_applicable");
    expect(r.usableThumbnails).toEqual([]);
  });

  it("separates a pending producer from a producer this build does not contain", () => {
    const r = describeMediaReadiness({ asset: imageAsset, artifacts: [], videoIntakeEnabled: false });
    expect(r.metadata.state).toBe("none_produced");
    expect(r.thumbnail.state).toBe("no_producer");
    expect(r.thumbnail.detail).toMatch(/missing capability rather than an empty result/);
  });

  it("says frames are not applicable while video byte intake is disabled, even for a video mime type", () => {
    const r = describeMediaReadiness({ asset: videoAsset, artifacts: [], videoIntakeEnabled: false });
    expect(r.frames.state).toBe("not_applicable");
    expect(r.frames.detail).toMatch(/Video byte intake is disabled/);
  });

  it("reports frames as an absent producer once video intake is enabled", () => {
    const r = describeMediaReadiness({ asset: videoAsset, artifacts: [], videoIntakeEnabled: true });
    expect(r.frames.state).toBe("no_producer");
  });

  it("reports existing rows that fail the contract as unreadable, with every reason", () => {
    const r = describeMediaReadiness({
      asset: imageAsset,
      artifacts: [artifact({ id: "t1", features: {} }), artifact({ id: "t2", storage_path: null })],
      videoIntakeEnabled: false,
    });
    expect(r.thumbnail.state).toBe("unreadable");
    expect(r.thumbnail.state === "unreadable" && r.thumbnail.reasons).toHaveLength(2);
    expect(r.usableThumbnails).toEqual([]);
  });

  it("is ready when at least one row satisfies the contract, and lists usable thumbnails newest first", () => {
    const r = describeMediaReadiness({
      asset: imageAsset,
      artifacts: [
        artifact({ id: "old", created_at: "2026-08-01T00:00:00Z" }),
        artifact({ id: "broken", features: {} }),
        artifact({ id: "new", created_at: "2026-08-22T00:00:00Z" }),
      ],
      videoIntakeEnabled: false,
    });
    expect(r.thumbnail.state).toBe("ready");
    expect(r.thumbnail.detail).toMatch(/2 of 3/);
    expect(r.usableThumbnails.map((t) => t.artifactId)).toEqual(["new", "old"]);
  });

  it("orders usable frames by their position in the source", () => {
    const frame = (id: string, at: number) =>
      artifact({ id, artifact_kind: "frame_sample", features: { width: 320, height: 180, at_seconds: at } });
    const r = describeMediaReadiness({
      asset: videoAsset,
      artifacts: [frame("b", 9), frame("a", 1.5), frame("c", 20)],
      videoIntakeEnabled: true,
    });
    expect(r.frames.state).toBe("ready");
    expect(r.usableFrames.map((f) => f.artifactId)).toEqual(["a", "b", "c"]);
  });
});
