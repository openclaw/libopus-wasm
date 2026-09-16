import { describe, expect, it } from "vitest";
import { Application, Bitrate, createDecoder, createEncoder, DecoderCtl, EncoderCtl, OpusError } from "../src/index.js";

describe("CTL integer bounds", () => {
  it.each([2 ** 32 + Application.Audio, Application.Audio + 0.5])(
    "rejects application %s instead of coercing it into an Opus mode",
    async (application) => {
      await expect(createEncoder({ application: application as Application })).rejects.toThrow(RangeError);
    },
  );

  it.each([2 ** 32 + 32_000, -(2 ** 32) + 32_000, 2 ** 32 - 1, Number.MAX_SAFE_INTEGER])(
    "rejects overflowing encoder CTL value %s without changing the bitrate",
    async (value) => {
      using encoder = await createEncoder({ bitrate: 64_000 });
      expect(() => encoder.encoderCtl(EncoderCtl.SetBitrate, value)).toThrow(RangeError);
      expect(encoder.getBitrate()).toBe(64_000);
    },
  );

  it.each([2 ** 32, -(2 ** 32), 2 ** 31, -(2 ** 31) - 1])(
    "rejects overflowing decoder CTL value %s",
    async (value) => {
      using decoder = await createDecoder();
      expect(() => decoder.decoderCtl(DecoderCtl.SetGain, value)).toThrow(RangeError);
    },
  );

  it("rejects overflowing bitrate options and setters", async () => {
    const bitrate = 2 ** 32 + 32_000;
    await expect(createEncoder({ bitrate })).rejects.toThrow(RangeError);
    using encoder = await createEncoder({ bitrate: 64_000 });
    expect(() => encoder.setBitrate(bitrate)).toThrow(RangeError);
    expect(encoder.getBitrate()).toBe(64_000);
  });

  it("preserves signed i32 values and native validation", async () => {
    using encoder = await createEncoder();
    using decoder = await createDecoder();
    encoder.setBitrate(2 ** 31 - 1);
    expect(encoder.getBitrate()).toBeGreaterThan(0);
    encoder.encoderCtl(EncoderCtl.SetBitrate, Bitrate.Auto);
    encoder.encoderCtl(EncoderCtl.SetBitrate, Bitrate.Max);
    expect(() => encoder.encoderCtl(EncoderCtl.SetBitrate, -(2 ** 31))).toThrow(OpusError);
    decoder.decoderCtl(DecoderCtl.SetGain, -256);
    expect(() => decoder.decoderCtl(DecoderCtl.SetGain, 2 ** 31 - 1)).toThrow(OpusError);
    expect(() => decoder.decoderCtl(DecoderCtl.SetGain, -(2 ** 31))).toThrow(OpusError);
  });
});
