import { afterEach, describe, expect, it, vi } from "vitest";
import type createLibopusModule from "../src/generated/libopus.generated.mjs";

const lifecycle = {
  failNext: "" as "" | "encoder" | "decoder" | "malloc" | "encoderCtl" | "encode" | "encodeFloat" | "decode" | "decodeFloat",
  createCalls: 0,
  encoderDestroyCalls: 0,
  growOnNextMalloc: false,
  heapGrew: false,
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
        if (lifecycle.growOnNextMalloc) {
          lifecycle.growOnNextMalloc = false;
          const previousBytes = module.HEAPU8.byteLength;
          const growth = malloc(32 * 1024 * 1024);
          lifecycle.heapGrew = module.HEAPU8.byteLength > previousBytes;
          module._free(growth);
        }
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
        lifecycle.encoderDestroyCalls += 1;
        lifecycle.encoders.delete(ptr);
        destroyEncoder(ptr);
      };
      const encoderCtl = module._oc_encoder_ctl.bind(module);
      module._oc_encoder_ctl = (ptr, request, value) => {
        if (lifecycle.failNext === "encoderCtl") {
          lifecycle.failNext = "";
          return -1;
        }
        return encoderCtl(ptr, request, value);
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
      const rejectNext = <Args extends number[]>(operation: string, native: (...args: Args) => number) =>
        (...args: Args): number => {
          if (lifecycle.failNext === operation) {
            lifecycle.failNext = "";
            return -3;
          }
          return native(...args);
        };
      module._oc_encode = rejectNext("encode", module._oc_encode.bind(module));
      module._oc_encode_float = rejectNext("encodeFloat", module._oc_encode_float.bind(module));
      module._oc_decode = rejectNext("decode", module._oc_decode.bind(module));
      module._oc_decode_float = rejectNext("decodeFloat", module._oc_decode_float.bind(module));
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

const { createEncoder, createDecoder, OpusErrorCode, Signal } = await import("../src/index.js");
const { OpusEncoder } = await import("../src/discordjs.js");

afterEach(() => {
  lifecycle.cleanup();
  lifecycle.failNext = "";
  lifecycle.createCalls = 0;
  lifecycle.encoderDestroyCalls = 0;
  lifecycle.growOnNextMalloc = false;
  lifecycle.heapGrew = false;
});

describe("codec initialization cleanup", () => {
  it("rejects invalid create-time tuning without allocating a native encoder", async () => {
    await expect(createEncoder({ complexity: 11 })).rejects.toThrow(RangeError);
    await expect(createEncoder({ packetLossPercent: 101 })).rejects.toThrow(RangeError);
    await expect(createEncoder({ signal: 9999 as Signal })).rejects.toThrow(RangeError);
    expect(lifecycle.createCalls).toBe(0);
    expect(lifecycle.encoderDestroyCalls).toBe(0);
    expect(lifecycle.encoders.size).toBe(0);
  });

  it("destroys the native encoder if a post-create setter fails", async () => {
    lifecycle.failNext = "encoderCtl";
    await expect(createEncoder()).rejects.toMatchObject({ code: OpusErrorCode.BadArg });
    expect(lifecycle.createCalls).toBe(1);
    expect(lifecycle.encoderDestroyCalls).toBe(1);
    expect(lifecycle.encoders.size).toBe(0);
  });

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

  it.each(["pcm", "packet"] as const)("keeps encoder scratch usable after failed %s growth", async (buffer) => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const pcm = new Int16Array(encoder.frameSize * encoder.channels);
      encoder.encode(pcm);
      lifecycle.failNext = "malloc";
      expect(() => buffer === "pcm"
        ? encoder.encodeFloat(new Float32Array(pcm.length))
        : encoder.encode(pcm, { maxPacketBytes: 8000 })).toThrow(/WASM malloc failed/);
      expect(decoder.decode(encoder.encode(pcm))).toHaveLength(pcm.length);
      expect(decoder.decode(encoder.encodeFloat(new Float32Array(pcm.length)))).toHaveLength(pcm.length);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it.each([
    ["encode", false], ["encodeFloat", false],
    ["decode", false], ["decodeFloat", false],
    ["decode", true], ["decodeFloat", true],
  ] as const)("preserves native %s error labels (packet loss=%s)", async (operation, packetLoss) => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const pcm = new Int16Array(1920);
      const packet = encoder.encode(pcm);
      lifecycle.failNext = operation;
      const call = () => operation === "encode" ? encoder.encode(pcm)
        : operation === "encodeFloat" ? encoder.encodeFloat(new Float32Array(1920))
        : decoder[operation](packetLoss ? null : packet);
      const label = packetLoss
        ? (operation === "decodeFloat" ? "decodePacketLossFloat" : "decodePacketLoss")
        : operation;
      expect(call).toThrow(expect.objectContaining({ code: OpusErrorCode.InternalError, operation: label }));
      const recovered = call();
      if (operation.startsWith("decode")) expect(recovered).toHaveLength(1920);
      else expect(recovered.byteLength).toBeGreaterThan(0);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("uses current heap views after allocation grows WASM memory", async () => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const pcm = new Int16Array(1920);
      const packet = encoder.encode(pcm);
      const retained = decoder.decode(packet);
      const snapshot = retained.slice();
      lifecycle.growOnNextMalloc = true;
      const next = encoder.encodeFloat(new Float32Array(1920));
      expect(lifecycle.heapGrew).toBe(true);
      expect(decoder.decodeFloat(next)).toHaveLength(1920);
      expect(retained).toEqual(snapshot);
    } finally {
      encoder.free();
      decoder.free();
    }
  });

  it("keeps decoder scratch usable after failed PCM growth", async () => {
    const encoder = await createEncoder();
    const decoder = await createDecoder();
    try {
      const packet = encoder.encode(new Int16Array(encoder.frameSize * encoder.channels));
      decoder.decode(packet);
      lifecycle.failNext = "malloc";
      expect(() => decoder.decodeFloat(packet)).toThrow(/WASM malloc failed/);
      expect(decoder.decode(packet)).toHaveLength(encoder.frameSize * encoder.channels);
      expect(decoder.decodeFloat(packet)).toHaveLength(encoder.frameSize * encoder.channels);
    } finally {
      encoder.free();
      decoder.free();
    }
  });
});
