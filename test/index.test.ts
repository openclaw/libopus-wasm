import { describe, expect, it } from "vitest";
import { Application, OpusError, createDecoder, createEncoder, loadLibopus } from "../src/index.js";

describe("libopus-wasm", () => {
  it("reports the bundled libopus version", async () => {
    const info = await loadLibopus();

    expect(info.version).toContain("libopus");
    expect(info.version).toContain("1.6.1");
  });

  it("encodes and decodes a 20ms stereo frame", async () => {
    const frameSize = 960;
    const encoder = await createEncoder({
      application: Application.Audio,
      bitrate: 64_000,
      channels: 2,
      fec: true,
      packetLossPercent: 5,
      sampleRate: 48_000,
    });
    const decoder = await createDecoder({ channels: 2, sampleRate: 48_000 });
    try {
      const pcm = new Int16Array(frameSize * 2);
      for (let sample = 0; sample < frameSize; sample += 1) {
        const value = Math.round(Math.sin((sample / frameSize) * Math.PI * 2) * 8000);
        pcm[sample * 2] = value;
        pcm[sample * 2 + 1] = value;
      }

      const packet = encoder.encodePcm16(pcm, frameSize);
      const decoded = decoder.decodeFrame(packet, frameSize);

      expect(packet.byteLength).toBeGreaterThan(0);
      expect(packet.byteLength).toBeLessThan(4000);
      expect(decoded.length).toBe(frameSize * 2);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("returns JS errors for invalid packets", async () => {
    const decoder = await createDecoder({ channels: 2, sampleRate: 48_000 });
    try {
      expect(() => decoder.decodeFrame(new Uint8Array([1, 2, 3, 4]), 960)).toThrow(OpusError);
    } finally {
      decoder.free();
    }
  });

  it("rejects invalid frame sizes before touching wasm", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 48_000 });
    try {
      expect(() => encoder.encodePcm16(new Int16Array(0), 0)).toThrow(RangeError);
    } finally {
      encoder.free();
    }
  });
});
