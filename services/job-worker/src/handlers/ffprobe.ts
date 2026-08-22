/**
 * ffprobe output parsing (Upgrade D). Pure so it can be tested without ffprobe installed.
 * The worker shells out to `ffprobe -v error -print_format json -show_format -show_streams <file>`.
 */

export interface MediaMetadata {
  container: string | null;
  duration_seconds: number | null;
  bit_rate: number | null;
  video: { codec: string; width: number; height: number; frame_rate: number | null } | null;
  audio: { codec: string; channels: number | null; sample_rate: number | null } | null;
  stream_count: number;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function frameRate(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const [a, b] = v.split("/").map(Number);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return Math.round((a / b) * 1000) / 1000;
}

export function parseFfprobe(json: unknown): MediaMetadata | null {
  if (!json || typeof json !== "object") return null;
  const o = json as { format?: Record<string, unknown>; streams?: Array<Record<string, unknown>> };
  const streams = Array.isArray(o.streams) ? o.streams : [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  return {
    container: typeof o.format?.format_name === "string" ? o.format.format_name : null,
    duration_seconds: num(o.format?.duration),
    bit_rate: num(o.format?.bit_rate),
    video: v
      ? {
          codec: String(v.codec_name ?? "unknown"),
          width: num(v.width) ?? 0,
          height: num(v.height) ?? 0,
          frame_rate: frameRate(v.avg_frame_rate) ?? frameRate(v.r_frame_rate),
        }
      : null,
    audio: a ? { codec: String(a.codec_name ?? "unknown"), channels: num(a.channels), sample_rate: num(a.sample_rate) } : null,
    stream_count: streams.length,
  };
}
