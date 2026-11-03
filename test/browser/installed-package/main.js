import { createDecoder, createEncoder, getPacketInfo } from "libopus-wasm";

// The runner calls this after page load to catch any lazy external WASM fetch.
window.runBrowserSmoke = async () => {
  const encoder = await createEncoder();
  const decoder = await createDecoder();
  try {
    const results = [];
    for (const float of [false, true]) {
      const tone = Array.from({ length: encoder.frameSize * encoder.channels }, (_, index) =>
        Math.sin((Math.floor(index / encoder.channels) * 2 * Math.PI * 440) / encoder.sampleRate),
      );
      const packet = float
        ? encoder.encodeFloat(Float32Array.from(tone, (sample) => sample * 0.25))
        : encoder.encode(Int16Array.from(tone, (sample) => Math.round(sample * 8000)));
      const decoded = float ? decoder.decodeFloat(packet) : decoder.decode(packet);
      const info = await getPacketInfo(packet);
      results.push({
        float,
        packetBytes: packet.byteLength,
        decodedSamples: decoded.length,
        finite: decoded.every(Number.isFinite),
        audible: decoded.some((sample) => sample !== 0),
        samples: info.samples,
        channels: info.channels,
        durationMs: info.durationMs,
      });
    }
    return {
      results,
      crossOriginIsolated,
      sharedArrayBuffer: typeof SharedArrayBuffer,
      buffer: typeof Buffer,
    };
  } finally {
    encoder.free();
    decoder.free();
  }
};
