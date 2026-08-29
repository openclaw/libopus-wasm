import { beforeEach, describe, expect, it, vi } from "vitest";
import type createLibopusModule from "../src/generated/libopus.generated.mjs";

const lifecycle = {
  created: 0,
  destroyed: 0,
  failNextEncoderCtl: false,
};

vi.mock("../src/generated/libopus.generated.mjs", async () => {
  const actual = await vi.importActual<{ default: typeof createLibopusModule }>(
    "../src/generated/libopus.generated.mjs",
  );
  return {
    default: async () => {
      const module = await actual.default();
      const create = module._oc_create_encoder.bind(module);
      const destroy = module._oc_destroy_encoder.bind(module);
      const encoderCtl = module._oc_encoder_ctl.bind(module);
      module._oc_create_encoder = (sampleRate, channels, application, errorPtr) => {
        const ptr = create(sampleRate, channels, application, errorPtr);
        if (ptr) {
          lifecycle.created += 1;
        }
        return ptr;
      };
      module._oc_destroy_encoder = (ptr) => {
        if (ptr) {
          lifecycle.destroyed += 1;
        }
        destroy(ptr);
      };
      module._oc_encoder_ctl = (ptr, request, value) => {
        if (lifecycle.failNextEncoderCtl) {
          lifecycle.failNextEncoderCtl = false;
          return -1;
        }
        return encoderCtl(ptr, request, value);
      };
      return module;
    },
  };
});

const { createEncoder, Signal } = await import("../src/index.js");

describe("encoder create cleanup", () => {
  beforeEach(() => {
    lifecycle.created = 0;
    lifecycle.destroyed = 0;
    lifecycle.failNextEncoderCtl = false;
  });

  it("rejects invalid create-time tuning without allocating a native encoder", async () => {
    await expect(createEncoder({ complexity: 11 })).rejects.toThrow(
      /complexity must be an integer from 0 to 10/,
    );
    await expect(createEncoder({ packetLossPercent: 101 })).rejects.toThrow(
      /packetLossPercent must be an integer from 0 to 100/,
    );
    await expect(createEncoder({ signal: 9999 as Signal })).rejects.toThrow(
      /signal must be Signal.Auto, Signal.Voice, or Signal.Music/,
    );

    expect(lifecycle.created).toBe(0);
    expect(lifecycle.destroyed).toBe(0);
  });

  it("destroys the native encoder if a post-create setter throws", async () => {
    lifecycle.failNextEncoderCtl = true;

    await expect(createEncoder()).rejects.toBeInstanceOf(Error);
    expect(lifecycle.created).toBe(1);
    expect(lifecycle.destroyed).toBe(1);
  });
});
