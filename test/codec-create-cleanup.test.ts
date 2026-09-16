import { afterEach, describe, expect, it, vi } from "vitest";
import type createLibopusModule from "../src/generated/libopus.generated.mjs";

const lifecycle = {
  failNext: "" as "" | "encoder" | "decoder" | "malloc",
  createCalls: 0,
  encoders: new Set<number>(),
  decoders: new Set<number>(),
  cleanup: () => {},
};

vi.mock("../src/generated/libopus.generated.mjs", async () => {
  const actual = await vi.importActual<{ default: typeof createLibopusModule }>(
    "../src/generated/libopus.generated.mjs",
  );
  return {
    default: async () => {
      const module = await actual.default();
      const malloc = module._malloc.bind(module);
      module._malloc = (bytes) => {
        if (lifecycle.failNext === "malloc") {
          lifecycle.failNext = "";
          return 0;
        }
        return malloc(bytes);
      };
      const createEncoder = module._oc_create_encoder.bind(module);
      const destroyEncoder = module._oc_destroy_encoder.bind(module);
      module._oc_create_encoder = (rate, channels, application, errorPtr) => {
        lifecycle.createCalls += 1;
        if (lifecycle.failNext === "encoder") {
          lifecycle.failNext = "";
          module.HEAP32[errorPtr >> 2] = -7;
          return 0;
        }
        const ptr = createEncoder(rate, channels, application, errorPtr);
        if (ptr) lifecycle.encoders.add(ptr);
        return ptr;
      };
      module._oc_destroy_encoder = (ptr) => {
        lifecycle.encoders.delete(ptr);
        destroyEncoder(ptr);
      };
      const createDecoder = module._oc_create_decoder.bind(module);
      const destroyDecoder = module._oc_destroy_decoder.bind(module);
      module._oc_create_decoder = (rate, channels, errorPtr) => {
        lifecycle.createCalls += 1;
        if (lifecycle.failNext === "decoder") {
          lifecycle.failNext = "";
          module.HEAP32[errorPtr >> 2] = -7;
          return 0;
        }
        const ptr = createDecoder(rate, channels, errorPtr);
        if (ptr) lifecycle.decoders.add(ptr);
        return ptr;
      };
      module._oc_destroy_decoder = (ptr) => {
        lifecycle.decoders.delete(ptr);
        destroyDecoder(ptr);
      };
      lifecycle.cleanup = () => {
        for (const ptr of lifecycle.encoders) destroyEncoder(ptr);
        for (const ptr of lifecycle.decoders) destroyDecoder(ptr);
        lifecycle.encoders.clear();
        lifecycle.decoders.clear();
      };
      return module;
    },
  };
});

const { createEncoder, createDecoder, OpusErrorCode } = await import("../src/index.js");
const { OpusEncoder } = await import("../src/discordjs.js");

afterEach(() => {
  lifecycle.cleanup();
  lifecycle.failNext = "";
  lifecycle.createCalls = 0;
});

describe("codec initialization cleanup", () => {
  it.each(["encoder", "decoder"] as const)(
    "frees partial adapter initialization when the %s fails",
    async (failure) => {
      lifecycle.failNext = failure;
      const opus = new OpusEncoder();
      await expect(opus.ready).rejects.toMatchObject({ code: OpusErrorCode.AllocFail });
      expect(() => opus.getBitrate()).toThrow(/failed to initialize/);
      expect(lifecycle.encoders.size).toBe(0);
      expect(lifecycle.decoders.size).toBe(0);
      opus.free();
    },
  );

  it("frees partial initialization even when disposed before a factory fails", async () => {
    lifecycle.failNext = "decoder";
    const opus = new OpusEncoder();
    opus.free();
    await expect(opus.ready).rejects.toMatchObject({ code: OpusErrorCode.AllocFail });
    expect(lifecycle.encoders.size).toBe(0);
    expect(lifecycle.decoders.size).toBe(0);
  });

  it.each([["encoder", createEncoder], ["decoder", createDecoder]] as const)(
    "rejects a failed error-buffer allocation before calling %s",
    async (_name, create) => {
      lifecycle.failNext = "malloc";
      await expect(create()).rejects.toThrow(/WASM malloc failed for 4 bytes/);
      expect(lifecycle.createCalls).toBe(0);
      expect(lifecycle.encoders.size).toBe(0);
      expect(lifecycle.decoders.size).toBe(0);
    },
  );

  it("releases both native codecs after a successful initialization", async () => {
    const opus = await OpusEncoder.create();
    expect(lifecycle.encoders.size).toBe(1);
    expect(lifecycle.decoders.size).toBe(1);
    opus.free();
    opus.free();
    expect(lifecycle.encoders.size).toBe(0);
    expect(lifecycle.decoders.size).toBe(0);
  });
});
