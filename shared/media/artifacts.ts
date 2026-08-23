/**
 * Derived-artifact contract and media-readiness resolver (migration 012). Pure.
 *
 * The generated database types collapse every CHECK constraint to `string` and
 * `features` to `Json`, so the legal kinds, producers and coverages are listed
 * here as runtime values for the client to narrow against, and the per-kind
 * shape of `features` is read rather than assumed.
 *
 * `features` has no schema in the database, which means an artifact row can
 * exist and still not carry what a screen needs to render it. Every reader below
 * therefore returns either the values it found or the reason the row is not
 * usable, so a caller can say what is missing instead of rendering a guess or a
 * placeholder that implies a derived artifact the workspace does not have.
 */

export type ArtifactKind = "media_metadata" | "thumbnail" | "frame_sample" | "transcript" | "normalized_rows" | "text_features";

export const ARTIFACT_KINDS: readonly ArtifactKind[] = [
  "media_metadata",
  "thumbnail",
  "frame_sample",
  "transcript",
  "normalized_rows",
  "text_features",
] as const;

export type ArtifactProducer = "deterministic" | "media_worker" | "analysis_service" | "model_gateway";

export const ARTIFACT_PRODUCERS: readonly ArtifactProducer[] = ["deterministic", "media_worker", "analysis_service", "model_gateway"] as const;

export type ArtifactCoverage = "complete" | "partial" | "unknown";

export const ARTIFACT_COVERAGES: readonly ArtifactCoverage[] = ["complete", "partial", "unknown"] as const;

/**
 * Producers this repository actually contains, per kind.
 *
 * An empty list means nothing in this build can create the kind. That is a
 * different state from "a producer ran and found nothing", and the UI must not
 * merge the two: the first is a missing feature, the second is an empty result.
 * `media_metadata` is produced by the media worker's `media_probe` handler; no
 * handler writes any other kind.
 */
export const PRODUCERS_IN_BUILD: Readonly<Record<ArtifactKind, readonly ArtifactProducer[]>> = {
  media_metadata: ["media_worker"],
  thumbnail: [],
  frame_sample: [],
  transcript: [],
  normalized_rows: [],
  text_features: [],
};

/** Mime types a browser `<img>` can be trusted to render from stored bytes. */
export const DISPLAYABLE_IMAGE_MIME_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * A derived-artifact row after boundary narrowing, holding only the columns a
 * readiness decision depends on.
 */
export interface StoredArtifact {
  id: string;
  artifact_kind: ArtifactKind;
  producer: ArtifactProducer;
  producer_version: string;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  byte_size: number | null;
  features: Record<string, unknown>;
  coverage: ArtifactCoverage;
  created_at: string;
}

/** Either the values a row proved, or the reason it cannot be used. */
export type Usable<T> = { ok: true; value: T } | { ok: false; reason: string };

/** A finite number at `key`, or null when the value is absent or not a number. */
function num(features: Record<string, unknown>, key: string): number | null {
  const v = features[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export interface ImageBytes {
  artifactId: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  /** Pixel width recorded by the producer. */
  width: number;
  /** Pixel height recorded by the producer. */
  height: number;
  byteSize: number | null;
  producer: ArtifactProducer;
  producerVersion: string;
  createdAt: string;
}

/**
 * Stored image bytes with recorded pixel dimensions.
 *
 * Dimensions are required rather than optional: without them the screen cannot
 * lay the image out without measuring it after load, and a producer that does
 * not record what it rendered has not recorded enough to cite.
 */
function readImageBytes(a: StoredArtifact): Usable<ImageBytes> {
  if (!a.storage_bucket || !a.storage_path) {
    return { ok: false, reason: `${a.artifact_kind} ${a.id} has no stored bytes: storage_path is null` };
  }
  if (!a.mime_type || !DISPLAYABLE_IMAGE_MIME_TYPES.includes(a.mime_type)) {
    return {
      ok: false,
      reason: `${a.artifact_kind} ${a.id} declares mime type "${a.mime_type ?? "none"}", which is not a displayable image`,
    };
  }
  const width = num(a.features, "width");
  const height = num(a.features, "height");
  if (width === null || height === null || width <= 0 || height <= 0) {
    return { ok: false, reason: `${a.artifact_kind} ${a.id} does not record a positive width and height in features` };
  }
  return {
    ok: true,
    value: {
      artifactId: a.id,
      storageBucket: a.storage_bucket,
      storagePath: a.storage_path,
      mimeType: a.mime_type,
      width,
      height,
      byteSize: a.byte_size,
      producer: a.producer,
      producerVersion: a.producer_version,
      createdAt: a.created_at,
    },
  };
}

/**
 * Thumbnail contract: stored image bytes plus `features.width` and
 * `features.height` in pixels. Any future producer must write all four.
 */
export function readThumbnail(a: StoredArtifact): Usable<ImageBytes> {
  if (a.artifact_kind !== "thumbnail") {
    return { ok: false, reason: `artifact ${a.id} is a ${a.artifact_kind}, not a thumbnail` };
  }
  return readImageBytes(a);
}

export interface FrameSample extends ImageBytes {
  /** Position of the frame within the source, in seconds from its start. */
  atSeconds: number;
  /** Frame ordinal within the sampled set, when the producer recorded one. */
  frameIndex: number | null;
}

/**
 * Frame-sample contract: the thumbnail contract plus `features.at_seconds`,
 * which is what makes a frame citable — an image with no timestamp cannot be
 * attributed to a moment in the source. `features.frame_index` is optional.
 */
export function readFrameSample(a: StoredArtifact): Usable<FrameSample> {
  if (a.artifact_kind !== "frame_sample") {
    return { ok: false, reason: `artifact ${a.id} is a ${a.artifact_kind}, not a frame sample` };
  }
  const image = readImageBytes(a);
  if (!image.ok) return image;
  const atSeconds = num(a.features, "at_seconds");
  if (atSeconds === null || atSeconds < 0) {
    return {
      ok: false,
      reason: `frame_sample ${a.id} does not record at_seconds in features, so the frame cannot be attributed to a moment in the source`,
    };
  }
  const frameIndex = num(a.features, "frame_index");
  return { ok: true, value: { ...image.value, atSeconds, frameIndex: frameIndex !== null && frameIndex >= 0 ? frameIndex : null } };
}

export interface MediaMetadataFacts {
  artifactId: string;
  container: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  streamCount: number | null;
  /** True or false when `features` records an audio stream; null when it says nothing. */
  hasAudio: boolean | null;
  producerVersion: string;
  coverage: ArtifactCoverage;
  createdAt: string;
}

/**
 * Media-metadata contract, matching what the worker's ffprobe parser writes:
 * `container`, `duration_seconds`, `stream_count`, and nested `video` / `audio`
 * objects. Every field is individually optional, but a row that records none of
 * them observed nothing and is reported as unreadable rather than shown empty.
 */
export function readMediaMetadata(a: StoredArtifact): Usable<MediaMetadataFacts> {
  if (a.artifact_kind !== "media_metadata") {
    return { ok: false, reason: `artifact ${a.id} is a ${a.artifact_kind}, not media metadata` };
  }
  const f = a.features;
  const container = typeof f.container === "string" && f.container ? f.container : null;
  const durationSeconds = num(f, "duration_seconds");
  const streamCount = num(f, "stream_count");
  const video = f.video !== null && typeof f.video === "object" && !Array.isArray(f.video) ? (f.video as Record<string, unknown>) : null;
  const audioStated = "audio" in f;
  if (container === null && durationSeconds === null && streamCount === null && video === null) {
    return { ok: false, reason: `media_metadata ${a.id} records no container, duration, stream count or video stream in features` };
  }
  return {
    ok: true,
    value: {
      artifactId: a.id,
      container,
      durationSeconds,
      width: video ? num(video, "width") : null,
      height: video ? num(video, "height") : null,
      streamCount,
      hasAudio: audioStated ? f.audio !== null : null,
      producerVersion: a.producer_version,
      coverage: a.coverage,
      createdAt: a.created_at,
    },
  };
}

/**
 * Why a media capability cannot be shown, or that it can.
 *
 * The five negative states are deliberately distinct. Collapsing them into one
 * "no data" would hide the only thing an operator can act on: whether the
 * absence is the build's, the queue's, or the row's.
 */
export type CapabilityReadiness =
  /** This asset can never have the artifact, so its absence is not a gap. */
  | { state: "not_applicable"; detail: string }
  /** Nothing in this build produces the kind, so no queue will ever fill it. */
  | { state: "no_producer"; detail: string }
  /** A producer exists but has written nothing for this asset yet. */
  | { state: "none_produced"; detail: string }
  /** Rows exist and none satisfies the contract, so nothing can be shown. */
  | { state: "unreadable"; detail: string; reasons: string[] }
  /** At least one row satisfies the contract. */
  | { state: "ready"; detail: string };

export interface MediaReadiness {
  metadata: CapabilityReadiness;
  thumbnail: CapabilityReadiness;
  frames: CapabilityReadiness;
  /** Probe facts, when `metadata.state` is "ready". */
  metadataFacts: MediaMetadataFacts | null;
  /** Thumbnails satisfying the contract, newest first. Empty unless `thumbnail.state` is "ready". */
  usableThumbnails: ImageBytes[];
  /** Frame samples satisfying the contract, earliest first. Empty unless `frames.state` is "ready". */
  usableFrames: FrameSample[];
}

export interface MediaReadinessInput {
  /** The asset the artifacts belong to. `asset_kind` is the raw column value. */
  asset: { asset_kind: string; mime_type: string | null; storage_path: string | null };
  /** Every artifact stored for that asset, already narrowed at the read boundary. */
  artifacts: StoredArtifact[];
  /**
   * Whether this build ingests video bytes. While it does not, no asset holds a
   * moving image, so frame sampling is not applicable rather than pending.
   */
  videoIntakeEnabled: boolean;
}

/** The state of one capability, given the rows of its kind and whether it applies. */
function resolve(
  kind: ArtifactKind,
  applicable: { ok: true } | { ok: false; detail: string },
  rows: StoredArtifact[],
  usableCount: number,
  reasons: string[]
): CapabilityReadiness {
  if (!applicable.ok) return { state: "not_applicable", detail: applicable.detail };
  if (rows.length === 0) {
    return PRODUCERS_IN_BUILD[kind].length === 0
      ? {
          state: "no_producer",
          detail: `Nothing in this build produces ${kind.replace(/_/g, " ")} artifacts. The table accepts them, but no worker writes one, so this is a missing capability rather than an empty result.`,
        }
      : {
          state: "none_produced",
          detail: `No ${kind.replace(/_/g, " ")} artifact has been stored for this asset yet. It is produced by a queued job, so this is pending, not refused.`,
        };
  }
  if (usableCount === 0) {
    return {
      state: "unreadable",
      detail: `${rows.length} ${kind.replace(/_/g, " ")} row(s) exist for this asset and none carries what is needed to show it.`,
      reasons,
    };
  }
  return {
    state: "ready",
    detail: `${usableCount} of ${rows.length} ${kind.replace(/_/g, " ")} row(s) satisfy the contract.`,
  };
}

/**
 * Per-capability media readiness for one asset, from stored rows only.
 *
 * Nothing here infers, waits, or retries: it reports what the workspace holds
 * and why anything absent is absent. A caller that wants to display bytes must
 * sign a URL for a path this returned, so an artifact row is a precondition for
 * any image appearing on screen.
 */
export function describeMediaReadiness(input: MediaReadinessInput): MediaReadiness {
  const { asset, artifacts } = input;
  const hasBytes = Boolean(asset.storage_path);
  const storedBytes: { ok: true } | { ok: false; detail: string } = hasBytes
    ? { ok: true }
    : { ok: false, detail: "This asset holds no stored bytes, so there is nothing to probe or render. Text-only assets carry their content in the asset row itself." };

  const rowsOf = (kind: ArtifactKind) => artifacts.filter((a) => a.artifact_kind === kind);

  const metadataRows = rowsOf("media_metadata");
  const metadataRead = metadataRows.map(readMediaMetadata);
  const metadataFacts = metadataRead.find((r): r is { ok: true; value: MediaMetadataFacts } => r.ok)?.value ?? null;

  const thumbnailRows = rowsOf("thumbnail");
  const thumbnailRead = thumbnailRows.map(readThumbnail);
  const usableThumbnails = thumbnailRead
    .filter((r): r is { ok: true; value: ImageBytes } => r.ok)
    .map((r) => r.value)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const frameRows = rowsOf("frame_sample");
  const frameRead = frameRows.map(readFrameSample);
  const usableFrames = frameRead
    .filter((r): r is { ok: true; value: FrameSample } => r.ok)
    .map((r) => r.value)
    .sort((a, b) => a.atSeconds - b.atSeconds);

  const framesApplicable: { ok: true } | { ok: false; detail: string } = !input.videoIntakeEnabled
    ? {
        ok: false,
        detail: "Video byte intake is disabled in this build, so no asset holds a moving image to sample frames from. Enabling it is a deployment decision, not a setting on this screen.",
      }
    : hasBytes && (asset.mime_type ?? "").startsWith("video/")
      ? { ok: true }
      : { ok: false, detail: "This asset is not stored video, so it has no frames to sample." };

  const failures = (rs: Array<Usable<unknown>>) => rs.filter((r): r is { ok: false; reason: string } => !r.ok).map((r) => r.reason);

  return {
    metadata: resolve("media_metadata", storedBytes, metadataRows, metadataFacts ? 1 : 0, failures(metadataRead)),
    thumbnail: resolve("thumbnail", storedBytes, thumbnailRows, usableThumbnails.length, failures(thumbnailRead)),
    frames: resolve("frame_sample", framesApplicable, frameRows, usableFrames.length, failures(frameRead)),
    metadataFacts,
    usableThumbnails,
    usableFrames,
  };
}
