import { describe, expect, it } from "vitest";
import { parseFfprobe } from "./ffprobe.js";

describe("parseFfprobe", () => {
  it("extracts container, duration, video and audio streams", () => {
    const md = parseFfprobe({
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.345", bit_rate: "2500000" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "30000/1001" },
        { codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "48000" },
      ],
    });
    expect(md).toEqual({
      container: "mov,mp4,m4a,3gp,3g2,mj2",
      duration_seconds: 12.345,
      bit_rate: 2500000,
      video: { codec: "h264", width: 1080, height: 1920, frame_rate: 29.97 },
      audio: { codec: "aac", channels: 2, sample_rate: 48000 },
      stream_count: 2,
    });
  });

  it("returns nulls rather than guesses for missing fields", () => {
    const md = parseFfprobe({ format: {}, streams: [{ codec_type: "video" }] });
    expect(md?.duration_seconds).toBeNull();
    expect(md?.video).toEqual({ codec: "unknown", width: 0, height: 0, frame_rate: null });
    expect(md?.audio).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseFfprobe(null)).toBeNull();
    expect(parseFfprobe("x")).toBeNull();
  });
});
