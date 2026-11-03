import { PerformanceObserver, performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { createDecoder, createEncoder } from "../dist/index.js";

const encoder = await createEncoder();
const decoder = await createDecoder();
const input = new Float32Array(encoder.frameSize * encoder.channels);
for (let i = 0; i < input.length; i++) input[i] = Math.sin(i / 20) * 0.2;
const iterations = 5000;
const durations = new Float64Array(iterations);
let outputBytes = 0;
let gcMs = 0;
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) gcMs += entry.duration;
});
try {
  for (let i = 0; i < 100; i++) decoder.decodeFloat(encoder.encodeFloat(input));
  globalThis.gc?.();
  observer.observe({ entryTypes: ["gc"] });
  const started = performance.now();
  for (let i = 0; i < iterations; i++) {
    const tick = performance.now();
    const packet = encoder.encodeFloat(input);
    outputBytes += packet.byteLength + decoder.decodeFloat(packet).byteLength;
    durations[i] = performance.now() - tick;
  }
  const elapsedMs = performance.now() - started;
  await setImmediate();
  await setImmediate();
  durations.sort();
  console.log(JSON.stringify({ iterations, frameDurationMs: 20, elapsedMs,
    p99Ms: durations[Math.floor(iterations * 0.99)], gcMs,
    outputBytesPerFrame: outputBytes / iterations,
    note: "Synthetic 48 kHz stereo Float32 loop; owned result bytes only, not total allocation or a real-time guarantee." }));
} finally {
  observer.disconnect();
  encoder.free();
  decoder.free();
}
