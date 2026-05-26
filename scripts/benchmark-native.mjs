import { performance } from "node:perf_hooks";
import discordOpus from "@discordjs/opus";
import { Application, createDecoder, createEncoder, loadLibopus } from "../dist/index.js";

const sampleRate = 48_000;
const channels = 2;
const frameSize = 960;
const warmupIterations = Number(process.env.LIBOPUS_WASM_BENCH_WARMUP ?? 1_000);
const iterations = Number(process.env.LIBOPUS_WASM_BENCH_ITERATIONS ?? 20_000);
const pcm = createToneFrame();
const pcmBuffer = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);

const wasmEncoder = await createEncoder({
  application: Application.Audio,
  bitrate: 64_000,
  channels,
  sampleRate,
});
const wasmDecoder = await createDecoder({ channels, sampleRate });
const { OpusEncoder: NativeOpusEncoder } = discordOpus;
const native = new NativeOpusEncoder(sampleRate, channels);
native.setBitrate(64_000);

try {
  const wasmPacket = wasmEncoder.encode(pcm, { frameSize });
  const nativePacket = native.encode(pcmBuffer, frameSize);
  const libopus = await loadLibopus();

  const results = [
    bench("wasm encode", warmupIterations, iterations, () => {
      wasmEncoder.encode(pcm, { frameSize });
    }),
    bench("native encode", warmupIterations, iterations, () => {
      native.encode(pcmBuffer, frameSize);
    }),
    bench("wasm decode", warmupIterations, iterations, () => {
      wasmDecoder.decode(wasmPacket, { maxFrameSize: frameSize });
    }),
    bench("native decode", warmupIterations, iterations, () => {
      native.decode(nativePacket, frameSize);
    }),
  ];

  console.log(
    JSON.stringify(
      {
        channels,
        frameSize,
        iterations,
        libopus: libopus.version,
        native: "@discordjs/opus",
        packetBytes: {
          native: nativePacket.byteLength,
          wasm: wasmPacket.byteLength,
        },
        results,
        sampleRate,
        warmupIterations,
      },
      null,
      2,
    ),
  );
} finally {
  wasmDecoder.free();
  wasmEncoder.free();
}

function bench(name, warmup, count, fn) {
  for (let index = 0; index < warmup; index += 1) {
    fn();
  }
  const start = performance.now();
  for (let index = 0; index < count; index += 1) {
    fn();
  }
  const durationMs = performance.now() - start;
  return {
    durationMs: Math.round(durationMs * 100) / 100,
    name,
    opsPerSecond: Math.round((count / durationMs) * 1000),
  };
}

function createToneFrame() {
  const frame = new Int16Array(frameSize * channels);
  for (let sample = 0; sample < frameSize; sample += 1) {
    const value = Math.round(Math.sin((sample / frameSize) * Math.PI * 2) * 8000);
    frame[sample * channels] = value;
    frame[sample * channels + 1] = value;
  }
  return frame;
}
