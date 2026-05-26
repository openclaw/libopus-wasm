# libopus-wasm

[![CI](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml/badge.svg)](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml)

Small, modern WASM bindings for libopus raw packet encode/decode.

The default path is Discord/realtime voice ready: 48 kHz, stereo, 20 ms PCM
frames, raw Opus packets, no Ogg/WebM container layer.

## Install

```bash
npm install libopus-wasm
```

## Usage

```ts
import { createDecoder, createEncoder } from "libopus-wasm";

const encoder = await createEncoder();
const decoder = await createDecoder();

try {
  const pcm = new Int16Array(960 * 2);
  const packet = encoder.encode(pcm);
  const decoded = decoder.decode(packet);
  console.log(decoded.length);
} finally {
  encoder.free();
  decoder.free();
}
```

## Compatibility

`libopus-wasm/discordjs` provides an async-ready adapter for the
`@discordjs/opus` method shape:

```ts
import { OpusEncoder } from "libopus-wasm/discordjs";

const opus = await OpusEncoder.create(48_000, 2);

const packet = opus.encode(pcmBuffer);
const decoded = opus.decode(packet);
opus.setBitrate(64_000);
opus.free();
```

You can also construct it directly and await `ready`:

```ts
const opus = new OpusEncoder(48_000, 2);
await opus.ready;
```

## Build

The npm package ships compiled output. Building from source requires
Emscripten (`emcc`) on `PATH`.

```bash
pnpm install
pnpm build
pnpm test
```

`pnpm build` downloads `libopus 1.6.1` from Xiph.Org, verifies the pinned
SHA-256, builds it with Emscripten, and emits a single-file ES module under
`dist/generated/`.

## API

- `loadLibopus()`: returns the bundled libopus version string.
- `createEncoder(options?)`: creates a raw packet encoder. Defaults: 48 kHz, stereo, 20 ms, audio application.
- `createDecoder(options?)`: creates a raw packet decoder. Defaults: 48 kHz, stereo, max 120 ms packet output.
- `encoder.encode(pcm, options?)`: encodes one signed 16-bit little-endian PCM frame.
- `encoder.encodeFrames(frames, options?)`: encodes several PCM frames.
- `decoder.decode(packet, options?)`: decodes one raw Opus packet to signed 16-bit little-endian PCM.
- `decoder.decodeFrames(packets, options?)`: decodes several raw Opus packets.
- `encoder.setBitrate`, `encoder.getBitrate`, `encoder.setComplexity`, `encoder.setInBandFec`, `encoder.setPacketLossPercent`, `encoder.setDtx`, `encoder.setSignal`: named CTL helpers.
- `encoder.encoderCtl(request, value)` and `decoder.decoderCtl(request, value)`: integer setter CTL escape hatches.
- `free()`: releases the underlying libopus encoder/decoder.

Supported sample rates are `8000`, `12000`, `16000`, `24000`, and `48000`.
Supported channel counts are mono and stereo.

## Benchmark

Native comparison requires `@discordjs/opus` to build on the host:

```bash
pnpm benchmark
```

Local Apple Silicon result on Node 26, 20k iterations, 48 kHz stereo, 20 ms
frames:

```text
wasm encode:   15,304 ops/sec
native encode: 15,741 ops/sec
wasm decode:   38,416 ops/sec
native decode: 41,280 ops/sec
```

The benchmark is intended as a regression check, not a stable cross-machine
score. CI also exposes a manual `Benchmark` workflow.
