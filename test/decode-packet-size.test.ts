import { describe, expect, it } from "vitest";
import { createDecoder, createEncoder, getPacketInfo } from "../src/index.js";

const MAX_DECODE_PACKET_BYTES = 64 * 1024;

describe("decode and getPacketInfo packet size cap", () => {
  it("rejects packets larger than 64 KiB before malloc", async () => {
    const hugePacket = new Uint8Array(MAX_DECODE_PACKET_BYTES + 1);
    const tooBig = /packet must be at most 65536 bytes/;

    await expect(getPacketInfo(hugePacket)).rejects.toThrow(RangeError);
    await expect(getPacketInfo(hugePacket)).rejects.toThrow(tooBig);

    const decoder = await createDecoder();
    try {
      expect(() => decoder.decode(hugePacket)).toThrow(RangeError);
      expect(() => decoder.decode(hugePacket)).toThrow(tooBig);
    } finally {
      decoder.free();
    }
  });

  it("still inspects and decodes a valid small packet", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 8000 });
    const decoder = await createDecoder({ channels: 1, sampleRate: 8000 });
    try {
      const packet = encoder.encode(makeSineFrame(encoder.frameSize, 1));
      const info = await getPacketInfo(packet, { sampleRate: 8000 });
      const decoded = decoder.decode(packet);

      expect(packet.byteLength).toBeGreaterThan(0);
      expect(packet.byteLength).toBeLessThanOrEqual(MAX_DECODE_PACKET_BYTES);
      expect(info.channels).toBe(1);
      expect(info.samples).toBe(encoder.frameSize);
      expect(decoded.length).toBe(encoder.frameSize);
    } finally {
      encoder.free();
      decoder.free();
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
