import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { OpusEncoder as DiscordOpusEncoder } from "../src/discordjs.js";
import {
  Application,
  Bandwidth,
  Bitrate,
  DecoderCtl,
  EncoderCtl,
  OpusError,
  Signal,
  createDecoder,
  createEncoder,
  loadLibopus,
} from "../src/index.js";

describe("libopus-wasm", () => {
  it("reports the bundled libopus version", async () => {
    const info = await loadLibopus();

    expect(info.version).toContain("libopus");
    expect(info.version).toContain("1.6.1");
  });

  it("uses Discord-ready defaults", async () => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const pcm = makeSineFrame(encoder.frameSize, encoder.channels);

      const packet = encoder.encode(pcm);
      const decoded = decoder.decode(packet);

      expect(encoder.application).toBe(Application.Audio);
      expect(encoder.channels).toBe(2);
      expect(encoder.frameSize).toBe(960);
      expect(encoder.sampleRate).toBe(48_000);
      expect(packet.byteLength).toBeGreaterThan(0);
      expect(packet.byteLength).toBeLessThan(4000);
      expect(decoded.length).toBe(encoder.frameSize * encoder.channels);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("encodes and decodes batches", async () => {
    const encoder = await createEncoder({
      bitrate: 64_000,
      channels: 2,
      complexity: 7,
      frameSize: 960,
      fec: true,
      maxBandwidth: Bandwidth.Fullband,
      packetLossPercent: 5,
      sampleRate: 48_000,
      signal: Signal.Music,
      vbr: true,
      vbrConstraint: true,
    });
    const decoder = await createDecoder({ channels: 2, sampleRate: 48_000 });
    try {
      const frames = [makeSineFrame(960, 2), makeSineFrame(960, 2)];

      const packets = encoder.encodeFrames(frames);
      const decoded = decoder.decodeFrames(packets);

      expect(packets).toHaveLength(2);
      expect(decoded.map((frame) => frame.length)).toEqual([1920, 1920]);
      expect(encoder.getBitrate()).toBe(64_000);
      expect(encoder.getLookahead()).toBeGreaterThan(0);
      expect(encoder.getInDtx()).toBe(false);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("derives 20 ms default frames from non-48 kHz sample rates", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 8000 });
    const decoder = await createDecoder({ channels: 1, sampleRate: 8000 });
    try {
      const packet = encoder.encode(makeSineFrame(encoder.frameSize, encoder.channels));
      const decoded = decoder.decode(packet);

      expect(encoder.frameSize).toBe(160);
      expect(decoder.maxFrameSize).toBe(960);
      expect(decoded.length).toBe(160);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("supports raw encoder CTLs", async () => {
    const encoder = await createEncoder();
    try {
      encoder.encoderCtl(EncoderCtl.SetBitrate, 32_000);

      expect(encoder.getBitrate()).toBe(32_000);
    } finally {
      encoder.free();
    }
  });

  it("accepts Opus bitrate sentinels", async () => {
    const encoder = await createEncoder({ bitrate: "auto" });
    try {
      expect(encoder.getBitrate()).toBeGreaterThan(0);

      encoder.setBitrate("max");
      expect(encoder.getBitrate()).toBeGreaterThan(0);

      encoder.setBitrate(Bitrate.Auto);
      expect(encoder.getBitrate()).toBeGreaterThan(0);
    } finally {
      encoder.free();
    }
  });

  it("encodes and decodes Float32 PCM", async () => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const packet = encoder.encodeFloat(makeSineFloatFrame(encoder.frameSize, encoder.channels));
      const decoded = decoder.decodeFloat(packet);

      expect(packet.byteLength).toBeGreaterThan(0);
      expect(decoded).toBeInstanceOf(Float32Array);
      expect(decoded.length).toBe(encoder.frameSize * encoder.channels);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("synthesizes packet-loss concealment frames", async () => {
    const encoder = await createEncoder({ fec: true, packetLossPercent: 15 });
    const decoder = await createDecoder();
    try {
      const packet = encoder.encode(makeSineFrame(encoder.frameSize, encoder.channels));
      decoder.decode(packet);

      const concealed = decoder.decodePacketLoss(encoder.frameSize);
      const concealedViaNull = decoder.decode(null, { frameSize: encoder.frameSize });
      const concealedThirtyMs = decoder.decodePacketLoss(1440);
      const concealedFloat = decoder.decodePacketLossFloat(encoder.frameSize);

      expect(concealed.length).toBe(encoder.frameSize * encoder.channels);
      expect(concealedViaNull.length).toBe(encoder.frameSize * encoder.channels);
      expect(concealedThirtyMs.length).toBe(1440 * encoder.channels);
      expect(concealedFloat.length).toBe(encoder.frameSize * encoder.channels);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("rejects pointer-style CTL requests at the JS boundary", async () => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      decoder.decoderCtl(DecoderCtl.SetGain, 0);

      expect(() => encoder.encoderCtl(4003, 0)).toThrow(RangeError);
      expect(() => decoder.decoderCtl(4045, 0)).toThrow(RangeError);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("returns JS errors for invalid packets", async () => {
    const decoder = await createDecoder();
    try {
      expect(() => decoder.decode(new Uint8Array([1, 2, 3, 4]))).toThrow(OpusError);
    } finally {
      decoder.free();
    }
  });

  it("rejects invalid frame sizes before touching wasm", async () => {
    const encoder = await createEncoder({ channels: 1, sampleRate: 8000 });
    try {
      expect(() => encoder.encode(new Int16Array(0), { frameSize: 0 })).toThrow(RangeError);
      expect(() => encoder.encode(new Int16Array(5760), { frameSize: 5760 })).toThrow(
        /samples at 8000 Hz/,
      );
    } finally {
      encoder.free();
    }
  });

  it("offers an async @discordjs/opus-compatible adapter", async () => {
    const opus = await DiscordOpusEncoder.create(48_000, 2);
    try {
      const pcm = Buffer.from(makeSineFrame(960, 2).buffer);

      const packet = opus.encode(pcm);
      const decoded = opus.decode(packet);
      opus.applyEncoderCTL(EncoderCtl.SetBandwidth, 1105);
      opus.applyEncoderCTL(EncoderCtl.SetForceChannels, 2);
      opus.applyDecoderCTL(DecoderCtl.SetPhaseInversionDisabled, 1);
      opus.setBitrate(48_000);
      opus.setFEC(true);
      opus.setPLP(10);

      expect(packet).toBeInstanceOf(Buffer);
      expect(decoded).toBeInstanceOf(Buffer);
      expect(decoded.byteLength).toBe(960 * 2 * 2);
      expect(opus.getBitrate()).toBe(48_000);
    } finally {
      opus.free();
    }
  });

  it("surfaces async discord adapter init failures from sync methods", async () => {
    const opus = new DiscordOpusEncoder(44_100, 2);
    await expect(opus.ready).rejects.toThrow(RangeError);

    expect(() => opus.encode(Buffer.alloc(960 * 2 * 2))).toThrow(/failed to initialize/);
  });

  it("supports explicit disposal", async () => {
    const encoder = await createEncoder();
    encoder[Symbol.dispose]();

    expect(() => encoder.encode(makeSineFrame(960, 2))).toThrow(/freed/);
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

function makeSineFloatFrame(frameSize: number, channels: 1 | 2): Float32Array {
  const pcm = new Float32Array(frameSize * channels);
  for (let sample = 0; sample < frameSize; sample += 1) {
    const value = Math.sin((sample / frameSize) * Math.PI * 2) * 0.25;
    for (let channel = 0; channel < channels; channel += 1) {
      pcm[sample * channels + channel] = value;
    }
  }
  return pcm;
}
