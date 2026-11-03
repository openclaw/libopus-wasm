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

The single-file ES module needs no external WASM asset rule. CI builds the
browser entry with Vite and exercises Chromium plus a module Worker. Other
bundlers can consume ESM, but are not part of this repository's verified matrix.

`pnpm size:check` reports minified browser JavaScript, gzip bytes and built
package bytes separately. The core must keep zero runtime dependencies; its
browser bundle has a 220 KB gzip ceiling. This is a regression guard, not a
claim about network transfer or memory use.

## Worker and AudioWorklet example

Run `pnpm build`, then `pnpm exec vite` and open `/examples/browser.html`.
The example sends 128-sample AudioWorklet blocks to a module Worker, assembles
960-sample mono frames in one reusable buffer, encodes there and decodes back on
the main thread. The button uses a synthetic tone, so no microphone permission
is needed. It closes the context, worker and codecs after five packets.

The codec runs in the Worker, not on the AudioWorklet rendering thread. For a
microphone, feed the capture node from your `MediaStreamAudioSourceNode` and
stop the media tracks when finished. Keep capture queues bounded in a long-lived
application; the short demo does not implement transport congestion control.

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
