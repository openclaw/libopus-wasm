# libopus-wasm

![libopus-wasm banner](docs/assets/readme-banner.jpg)

[![CI](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml/badge.svg)](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-libopus--wasm.dev-6d4aff)](https://libopus-wasm.dev)

Small, modern WebAssembly bindings for [libopus](https://opus-codec.org/) raw
packet encode/decode. One single-file ES module that runs unchanged in browsers
and Node — no `locateFile` hook, no second `.wasm` request, no native build step.

The default path is realtime voice: 48 kHz, stereo, 20 ms frames, raw Opus
packets, no Ogg/WebM container layer.

- **Browser and Node** from one import. Bundles cleanly with Vite, webpack, esbuild.
- **Int16 and Float32 PCM** — use whatever your pipeline already speaks.
- **Loss-resilient** — in-band FEC and packet-loss concealment.
- **Tunable** — bitrate, VBR/CBR, complexity, signal, bandwidth, DTX, plus a curated CTL passthrough.
- **Drop-in `@discordjs/opus` adapter** — same method shape, no node-gyp.

📖 **Full documentation: [libopus-wasm.dev](https://libopus-wasm.dev)**

## Install

```bash
npm install libopus-wasm
```

ESM-only; Node 20+ or any current browser. No `@types` install needed.

## Quick start

```ts
import { createDecoder, createEncoder, getPacketInfo } from "libopus-wasm";

const encoder = await createEncoder(); // 48 kHz, stereo, 20 ms, audio
const decoder = await createDecoder();

const pcm = new Int16Array(encoder.frameSize * encoder.channels); // 960 * 2
const packet = encoder.encode(pcm);    // Uint8Array — one raw Opus packet
const info = await getPacketInfo(packet); // duration, frames, bandwidth
const frame = decoder.decode(packet);  // Int16Array — interleaved PCM

encoder.free();
decoder.free();
```

Both factories share one lazily-loaded WASM module; the first call pays the load
cost and the rest are cheap.

## Examples

### Float32 PCM

Encode and decode floats directly — ideal for Web Audio:

```ts
const frame = new Float32Array(encoder.frameSize * encoder.channels); // [-1, 1]
const packet = encoder.encodeFloat(frame);
const decoded = decoder.decodeFloat(packet); // Float32Array
```

### Batches

```ts
const packets = encoder.encodeFrames([frameA, frameB, frameC]); // Uint8Array[]
const frames = decoder.decodeFrames(packets);                   // Int16Array[]
```

### Packet loss: FEC + concealment

```ts
// Encoder: enable in-band FEC and declare the expected loss rate.
const encoder = await createEncoder({ fec: true, packetLossPercent: 15 });

// Decoder: a packet is lost. If the next packet is in hand, recover from its
// FEC data; otherwise synthesize a concealment frame.
const recovered = decoder.decode(nextPacket, { decodeFec: true, frameSize: 960 });
const concealed = decoder.decodePacketLoss(960); // == decode(null, { frameSize: 960 })
```

See [Packet loss](https://libopus-wasm.dev/packet-loss.html) for the full receive loop.

### Tuning the encoder

```ts
const encoder = await createEncoder({
  application: Application.Audio,
  bitrate: 96000,        // or "auto" / "max"
  complexity: 10,        // 0..10
  signal: Signal.Music,
  vbr: true,
});

encoder.setBitrate(128000);
encoder.setMaxBandwidth(Bandwidth.Wideband);
encoder.getBitrate();    // 128000
```

### Deterministic cleanup with `using`

```ts
{
  using encoder = await createEncoder();
  using decoder = await createDecoder();
  decoder.decode(encoder.encode(new Int16Array(960 * 2)));
} // both freed automatically at scope exit
```

## discord.js compatibility

`libopus-wasm/discordjs` matches the [`@discordjs/opus`](https://github.com/discordjs/opus)
method shape, minus the native toolchain. It is Node-only (uses `Buffer`) and
loads asynchronously:

```ts
import { OpusEncoder } from "libopus-wasm/discordjs";

const opus = await OpusEncoder.create(48000, 2);
const packet = opus.encode(pcmBuffer);
const decoded = opus.decode(packet);
opus.setBitrate(64000);
opus.setFEC(true);
opus.free();
```

Or construct directly and await `ready` to keep existing call sites:

```ts
const opus = new OpusEncoder(48000, 2);
await opus.ready;
```

More in [discord.js compatibility](https://libopus-wasm.dev/discordjs.html).

## Browser

The main entry inlines the WASM, so it bundles with no plugins and needs no
cross-origin isolation. Web Audio delivers Float32 samples that go straight into
`encodeFloat` — see [Browser usage](https://libopus-wasm.dev/browser.html) for a
microphone-capture walkthrough.

## API overview

Full reference with every option and constant lives at
[libopus-wasm.dev/api-reference](https://libopus-wasm.dev/api-reference.html).

### Top-level

| Function | Returns | Description |
| --- | --- | --- |
| `loadLibopus()` | `Promise<{ version }>` | Loads the module; returns the bundled libopus version. |
| `createEncoder(options?)` | `Promise<OpusEncoderHandle>` | Create a raw-packet encoder. |
| `createDecoder(options?)` | `Promise<OpusDecoderHandle>` | Create a raw-packet decoder. |
| `getPacketInfo(packet, options?)` | `Promise<OpusPacketInfo>` | Validate a raw packet and return duration, frame count, channels, and bandwidth. |

### Encoder

| Member | Description |
| --- | --- |
| `encode(pcm, options?)` | Encode one Int16 frame (`Int16Array \| Uint8Array`) → `Uint8Array`. |
| `encodeFloat(pcm, options?)` | Encode one `Float32Array` frame → `Uint8Array`. |
| `encodeFrames` / `encodeFloatFrames` | Batch variants → `Uint8Array[]`. |
| `setBitrate` / `getBitrate` | Bitrate (`number \| "auto" \| "max"`). |
| `setComplexity` `setSignal` `setMaxBandwidth` | Quality and bandwidth controls. |
| `setVbr` `setVbrConstraint` `setDtx` | Rate-mode controls. |
| `setFec` `setPacketLossPercent` | Loss-resilience controls. |
| `getLookahead` `getInDtx` | Encoder state. |
| `encoderCtl(request, value)` | Curated integer-setter [CTL passthrough](https://libopus-wasm.dev/ctl.html). |
| `free()` / `[Symbol.dispose]()` | Release WASM memory. |

Read-only: `application`, `channels`, `frameSize`, `sampleRate`.

### Decoder

| Member | Description |
| --- | --- |
| `decode(packet, options?)` | Decode a packet (or `null` for PLC) → `Int16Array`. |
| `decodeFloat(packet, options?)` | Decode → `Float32Array`. |
| `decodeFrames` / `decodeFloatFrames` | Batch variants; `null` entries are concealed. |
| `decodePacketLoss(frameSize?)` | Synthesize one concealment frame. |
| `decodePacketLossFloat(frameSize?)` | Float32 variant. |
| `decoderCtl(request, value)` | Integer-setter CTL passthrough. |
| `free()` / `[Symbol.dispose]()` | Release WASM memory. |

Read-only: `channels`, `maxFrameSize`, `sampleRate`.

### Constants

`Application` (`Voip`, `Audio`, `RestrictedLowDelay`) ·
`Signal` (`Auto`, `Voice`, `Music`) ·
`Bitrate` (`Auto`, `Max`) ·
`Bandwidth` (`Narrowband`…`Fullband`) ·
`EncoderCtl` / `DecoderCtl` request codes ·
`OpusError` (`code`, `codeName`, `operation`) ·
`OpusErrorCode` · `isOpusError`.

### Supported formats

| Constraint | Allowed values |
| --- | --- |
| Sample rate | `8000`, `12000`, `16000`, `24000`, `48000` Hz |
| Channels | `1` (mono), `2` (stereo) |
| Encode frame duration | `2.5`, `5`, `10`, `20`, `40`, `60` ms |
| Decode output capacity | up to `120` ms |
| PLC / FEC frame size | multiples of `2.5` ms, up to `120` ms |

Validation errors (wrong frame size, out-of-range option, empty packet,
non-allow-listed CTL) throw a `RangeError` before reaching WASM; libopus errors
surface as `OpusError`.

## Build from source

The npm package ships compiled output, so using it needs no toolchain. Building
from source requires Emscripten (`emcc`) on `PATH`:

```bash
pnpm install
pnpm build
pnpm test
```

`pnpm build` downloads `libopus 1.6.1` from Xiph.Org, verifies the pinned
SHA-256, compiles it with Emscripten, and emits a single-file ES module under
`dist/generated/`. See [Building from source](https://libopus-wasm.dev/building.html).

## Benchmark

Native comparison requires `@discordjs/opus` to build on the host:

```bash
pnpm benchmark
```

Apple Silicon, Node 26, 20k iterations, 48 kHz stereo, 20 ms frames:

```text
wasm encode:   15,304 ops/sec
native encode: 15,741 ops/sec
wasm decode:   38,416 ops/sec
native decode: 41,280 ops/sec
```

A regression check, not a portable score. CI also exposes a manual `Benchmark`
workflow. More in [Benchmark](https://libopus-wasm.dev/benchmark.html).

## Documentation & license

Full docs: **[libopus-wasm.dev](https://libopus-wasm.dev)**. Released under the
[MIT license](LICENSE); libopus carries its own BSD license, reproduced in
[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md). Not affiliated with Xiph.Org.
