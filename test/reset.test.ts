import { describe, expect, it } from "vitest";
import { createDecoder, createEncoder, DecoderCtl } from "../src/index.js";

describe("stream reset", () => {
  it.each([false, true])("matches fresh encoder and decoder history (float=%s)", async (float) => {
    const options = { channels: 1, bitrate: 32000, complexity: 5, fec: true, packetLossPercent: 10 } as const;
    using encoder = await createEncoder(options);
    using freshEncoder = await createEncoder(options);
    using decoder = await createDecoder({ channels: 1 });
    using freshDecoder = await createDecoder({ channels: 1 });
    const pcm = Int16Array.from({ length: 960 }, (_, i) => Math.round(Math.sin(i / 19) * 8000));
    const floats = Float32Array.from(pcm, (sample) => sample / 32768);
    const encode = (codec: typeof encoder) => float ? codec.encodeFloat(floats) : codec.encode(pcm);
    const decode = (codec: typeof decoder, packet: Uint8Array) => float ? codec.decodeFloat(packet) : codec.decode(packet);
    decode(decoder, encode(encoder));
    decoder.decodePacketLoss();
    encoder.setBitrate(24000);
    freshEncoder.setBitrate(24000);
    decoder.decoderCtl(DecoderCtl.SetGain, 256);
    freshDecoder.decoderCtl(DecoderCtl.SetGain, 256);
    encoder.reset();
    decoder.reset();
    const packet = encode(encoder);
    expect(packet).toEqual(encode(freshEncoder));
    expect(encoder.getBitrate()).toBe(24000);
    expect(decode(decoder, packet)).toEqual(decode(freshDecoder, packet));
    encoder.reset();
    decoder.reset();
    freshEncoder.reset();
    freshDecoder.reset();
    expect(encode(encoder)).toEqual(encode(freshEncoder));
    encoder.free();
    decoder.free();
    expect(() => encoder.reset()).toThrow(/freed/);
    expect(() => decoder.reset()).toThrow(/freed/);
  });
});
