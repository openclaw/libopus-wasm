# libopus-wasm

[![CI](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml/badge.svg)](https://github.com/openclaw/libopus-wasm/actions/workflows/ci.yml)

Small, modern WASM bindings for libopus raw packet encode/decode.

This package targets the narrow realtime voice use case: 48 kHz PCM and raw
Opus packets, with no Ogg/WebM container layer.

## Install

```bash
npm install libopus-wasm
```

## Usage

```ts
import { Application, createDecoder, createEncoder } from "libopus-wasm";

const encoder = await createEncoder({
  sampleRate: 48_000,
  channels: 2,
  application: Application.Audio,
});
const decoder = await createDecoder({ sampleRate: 48_000, channels: 2 });

try {
  const frameSize = 960; // 20 ms at 48 kHz
  const pcm = new Int16Array(frameSize * 2);
  const packet = encoder.encodePcm16(pcm, frameSize);
  const decoded = decoder.decodeFrame(packet, frameSize);
  console.log(decoded.length);
} finally {
  encoder.free();
  decoder.free();
}
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
- `createEncoder(options)`: creates a raw packet encoder.
- `createDecoder(options)`: creates a raw packet decoder.
- `encoder.encodePcm16(pcm, frameSize)`: encodes one PCM frame.
- `decoder.decodeFrame(packet, frameSize)`: decodes one raw Opus packet.
- `encoder.setBitrate`, `encoder.setFec`, `encoder.setPacketLossPercent`: small CTL surface for realtime voice tuning.
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
