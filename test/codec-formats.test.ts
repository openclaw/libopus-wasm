import { describe, expect, it } from "vitest";
import { createDecoder, createEncoder, OpusErrorCode } from "../src/index.js";

describe("codec format paths", () => {
  it.each([1, 2] as const)("preserves subarray inputs and owned outputs with %i channels", async (channels) => {
    const encoder = await createEncoder({ channels });
    const referenceEncoder = await createEncoder({ channels });
    const decoder = await createDecoder({ channels });
    const referenceDecoder = await createDecoder({ channels });
    try {
      const length = encoder.frameSize * channels;
      const integers = new Int16Array(length + 8).fill(32767).subarray(4, length + 4);
      for (let i = 0; i < length; i += 1) integers[i] = Math.round(Math.sin(i / 20) * 8000);
      const floats = new Float32Array(length + 8).fill(1).subarray(4, length + 4);
      floats.set(Float32Array.from(integers, (value) => value / 32768));
      const bytes = new Uint8Array(integers.buffer, integers.byteOffset, integers.byteLength);
      const retained: Array<Int16Array | Float32Array | Uint8Array> = [];
      const snapshots: Array<Int16Array | Float32Array | Uint8Array> = [];
      for (const float of [false, true, false, true]) {
        const packet = float ? encoder.encodeFloat(floats) : encoder.encode(bytes);
        const expectedPacket = float ? referenceEncoder.encodeFloat(floats) : referenceEncoder.encode(integers);
        expect(packet).toEqual(expectedPacket);
        const output = float ? decoder.decodeFloat(packet) : decoder.decode(packet);
        const expected = float ? referenceDecoder.decodeFloat(packet) : referenceDecoder.decode(packet);
        expect(output).toEqual(expected);
        expect(output).toBeInstanceOf(float ? Float32Array : Int16Array);
        retained.push(packet, output);
        snapshots.push(packet.slice(), output.slice());
      }
      // Grow scratch buffers after saving outputs from both sample formats.
      encoder.encodeFloat(new Float32Array(2880 * channels), { frameSize: 2880, maxPacketBytes: 8000 });
      decoder.decodePacketLossFloat(5760);
      expect(retained).toEqual(snapshots);
    } finally {
      encoder.free();
      referenceEncoder.free();
      decoder.free();
      referenceDecoder.free();
    }
  });

  it.each([false, true])("preserves errors and recovery for float=%s", async (float) => {
    const encoder = await createEncoder({ fec: true, packetLossPercent: 15 });
    const decoder = await createDecoder();
    const encode = (options = {}) => float
      ? encoder.encodeFloat(new Float32Array(1920), options)
      : encoder.encode(new Int16Array(1920), options);
    const decode = (packet: Uint8Array | null, options = {}) => float
      ? decoder.decodeFloat(packet, options)
      : decoder.decode(packet, options);
    const operation = float ? "decodeFloat" : "decode";
    try {
      const packet = encode();
      expect(() => decode(new Uint8Array([1, 2, 3, 4]))).toThrow(expect.objectContaining({
        code: OpusErrorCode.InvalidPacket, operation,
      }));
      expect(() => decode(packet, { maxFrameSize: 120 })).toThrow(expect.objectContaining({
        code: OpusErrorCode.BufferTooSmall, operation,
      }));
      expect(() => decode(new Uint8Array(), { maxFrameSize: 0 })).toThrow(/maxFrameSize/);
      expect(() => decode(null, { decodeFec: true })).toThrow(/decodeFec requires a packet/);
      expect(decode(packet)).toHaveLength(1920);
      expect(decode(null, { frameSize: 1440 })).toHaveLength(2880);
      expect(decode(packet, { decodeFec: true, frameSize: 960 })).toHaveLength(1920);
      expect(decode(packet)).toHaveLength(1920);
      encoder.free();
      decoder.free();
      expect(() => encode({ frameSize: 0 })).toThrow(/OpusEncoder has been freed/);
      expect(() => decode(null, { frameSize: 0 })).toThrow(/OpusDecoder has been freed/);
    } finally {
      encoder.free();
      decoder.free();
    }
  });
});
