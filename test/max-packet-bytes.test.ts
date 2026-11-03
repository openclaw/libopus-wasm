import { describe, expect, it } from "vitest";
import { createEncoder } from "../src/index.js";

describe("maxPacketBytes i32 bounds", () => {
  it("rejects sizes that do not fit in a positive i32 and does not poison scratch", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 8000 });
    try {
      const pcm = new Int16Array(encoder.frameSize * encoder.channels);
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

    } finally {
      encoder.free();
    }
  });
});
