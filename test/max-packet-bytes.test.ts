import { describe, expect, it } from "vitest";
import { createDecoder, createEncoder } from "../src/index.js";

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


describe("large encoder packet ceilings", () => {
  it.each([1, 2] as const)("bounds native work for %i channels without changing the public ceiling", async (channels) => {
    for (const frameSize of [1920, 2880]) {
      for (const vbr of [true, false]) {
        using encoder = await createEncoder({ channels, frameSize, vbr, bitrate: "max" });
        using reference = await createEncoder({ channels, frameSize, vbr, bitrate: "max" });
        using decoder = await createDecoder({ channels });
        const integers = Int16Array.from({ length: frameSize * channels }, (_, i) => Math.round(Math.sin(i / 20) * 8000));
        const floats = Float32Array.from(integers, value => value / 32768);
        for (const maxPacketBytes of [1, 1275, 4000, 7656, 32 * 1024 * 1024, 0x7fff_ffff]) {
          for (const float of [false, true]) {
            const packet = float ? encoder.encodeFloat(floats, { maxPacketBytes }) : encoder.encode(integers, { maxPacketBytes });
            const bounded = { maxPacketBytes: Math.min(maxPacketBytes, 7656) };
            const expected = float ? reference.encodeFloat(floats, bounded) : reference.encode(integers, bounded);
            expect(packet).toEqual(expected);
            expect(packet.byteLength).toBeLessThanOrEqual(maxPacketBytes);
            expect(decoder.decode(packet)).toHaveLength(integers.length);
          }
        }
        const following = encoder.encode(new Int16Array(960 * channels), { frameSize: 960 });
        expect(decoder.decode(following)).toHaveLength(960 * channels);
      }
    }
  });
});
