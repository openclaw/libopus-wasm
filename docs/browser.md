# Browser usage

The main `libopus-wasm` entry is built for the browser. The WebAssembly binary
is inlined into the JavaScript as a single-file ES module, so there is:

- no second network request for a `.wasm` file,
- no `locateFile` / `wasmBinary` hook to configure,
- no `SharedArrayBuffer` and no COOP/COEP (cross-origin isolation) requirement.

Import it and go:

```ts
import { createEncoder, createDecoder } from "libopus-wasm";

const encoder = await createEncoder();
```

## Bundlers

Because the module is a self-contained ES module, every modern bundler handles
it without plugins or asset rules:

- **Vite** — works out of the box; no `assetsInclude` or `vite-plugin-wasm`.
- **webpack 5** — works without `experiments.asyncWebAssembly`.
- **esbuild / Rollup** — bundles as ordinary ESM.

The WASM is inlined, so it trades a slightly larger JS payload for zero runtime
fetching and zero deploy-time asset wiring. The module loads lazily on the first
`createEncoder` / `createDecoder` call and is shared across every handle.

## Capturing microphone audio

Web Audio delivers Float32 samples, which `encodeFloat` takes directly. The one
piece of glue you write is buffering the worklet's fixed 128-sample blocks up to
a full Opus frame (960 samples per channel for 20 ms at 48 kHz).

```ts
import { createEncoder } from "libopus-wasm";

const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const ctx = new AudioContext({ sampleRate: 48000 });
const source = ctx.createMediaStreamSource(stream);

const channels = 1;
const encoder = await createEncoder({ sampleRate: 48000, channels });
const frameSamples = encoder.frameSize * channels; // 960

let acc = new Float32Array(0);

await ctx.audioWorklet.addModule(workletUrl); // a worklet that posts Float32 blocks
const node = new AudioWorkletNode(ctx, "capture");
source.connect(node);

node.port.onmessage = (event) => {
  // event.data: Float32Array of mono samples from the worklet
  const merged = new Float32Array(acc.length + event.data.length);
  merged.set(acc);
  merged.set(event.data, acc.length);
  acc = merged;

  while (acc.length >= frameSamples) {
    const frame = acc.subarray(0, frameSamples);
    const packet = encoder.encodeFloat(frame);
    sendToPeer(packet); // your transport
    acc = acc.slice(frameSamples);
  }
};
```

For stereo, interleave the two channels into one `Float32Array` of
`frameSize * 2` before calling `encodeFloat`.

> Capture an `AudioContext` at the same `sampleRate` you pass to the encoder.
> Resampling between, say, a 44.1 kHz context and a 48 kHz encoder will distort
> pitch and frame timing.

## Playback

Decode to Float32 and hand the samples to an `AudioBuffer` or a playback
worklet:

```ts
const decoder = await createDecoder({ sampleRate: 48000, channels: 1 });
const samples = decoder.decodeFloat(packet); // Float32Array in [-1, 1]

const buffer = ctx.createBuffer(1, samples.length, 48000);
buffer.copyToChannel(samples, 0);
```

## Cleanup

Browsers do not call `free()` for you. Release handles when a call ends or a
component unmounts:

```ts
encoder.free();
decoder.free();
```

## Next

- [Encoding](encoding.md) and [Decoding](decoding.md) — the full API.
- [Packet loss](packet-loss.md) — for realtime transports that drop packets.
