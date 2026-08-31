import { describe, expect, it } from "vitest";
import { createEncoder } from "../src/index.js";

describe("maxPacketBytes i32 bounds", () => {
  it("rejects sizes that do not fit in a positive i32 and does not poison scratch", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 8000 });
    try {
      const pcm = makeSineFrame(encoder.frameSize, 1);
      const tooBig = /maxPacketBytes must be an integer from 1 to 2147483647/;

      expect(() => encoder.encode(pcm, { maxPacketBytes: 2 ** 32 })).toThrow(tooBig);
      expect(() => encoder.encode(pcm, { maxPacketBytes: 2 ** 32 + 16 })).toThrow(tooBig);
      expect(() => encoder.encode(pcm, { maxPacketBytes: 2 ** 31 })).toThrow(tooBig);
      expect(() => encoder.encodeFloat(new Float32Array(pcm.length), { maxPacketBytes: 2 ** 32 })).toThrow(
        tooBig,
      );

      const packet = encoder.encode(pcm);
      expect(packet.byteLength).toBeGreaterThan(0);
      expect(packet.byteLength).toBeLessThanOrEqual(4000);

      const again = encoder.encode(pcm, { maxPacketBytes: 4000 });
      expect(again.byteLength).toBeGreaterThan(0);
    } finally {
      encoder.free();
    }
  });
});

function makeSineFrame(frameSize: number, channels: 1 | 2): Int16Array {
  const pcm = new Int16Array(frameSize * channels);
  for (let sample = 0; sample < frameSize; sample += 1) {
    const value = Math.round(Math.sin((sample / frameSize) * Math.PI * 2) * 8000);
    for (let channel = 0; channel < channels; channel += 1) {
      pcm[sample * channels + channel] = value;
    }
  }
  return pcm;
}
