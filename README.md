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
  const concealed = decoder.decodePacketLoss(960);
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
- `encoder.encodeFloat(pcm, options?)`: encodes one Float32 PCM frame in `[-1, 1]`.
- `encoder.encodeFrames(frames, options?)`: encodes several PCM frames.
- `decoder.decode(packet, options?)`: decodes one raw Opus packet to signed 16-bit little-endian PCM.
- `decoder.decodeFloat(packet, options?)`: decodes one raw Opus packet to Float32 PCM in `[-1, 1]`.
- `decoder.decodePacketLoss(frameSize?)`: synthesizes one PLC frame for a lost packet. `decoder.decode(null, { frameSize })` is equivalent.
- `decoder.decodeFrames(packets, options?)`: decodes several raw Opus packets.
- `encoder.setBitrate`, `encoder.getBitrate`, `encoder.setComplexity`, `encoder.setFec`, `encoder.setPacketLossPercent`, `encoder.setDtx`, `encoder.setSignal`, `encoder.setVbr`, `encoder.setVbrConstraint`, `encoder.setMaxBandwidth`, `encoder.getLookahead`, `encoder.getInDtx`: named CTL helpers.
- `encoder.encoderCtl(request, value)` and `decoder.decoderCtl(request, value)`: curated integer setter CTL allowlists, not raw pointer-style CTL passthroughs.
- `free()`: releases the underlying libopus encoder/decoder.
- `[Symbol.dispose]()` calls `free()` for `using` declarations.

Supported sample rates are `8000`, `12000`, `16000`, `24000`, and `48000`.
Supported channel counts are mono and stereo.
Supported encode frame sizes are Opus frame durations from 2.5 ms through 60 ms;
normal decoder output capacity allows up to 120 ms. PLC and FEC frame sizes
must be exact multiples of 2.5 ms through 120 ms.

Encoder options:

- `application`: `Application.Audio`, `Application.Voip`, or `Application.RestrictedLowDelay`.
- `bitrate`: positive bits per second, `"auto"`, `"max"`, `Bitrate.Auto`, or `Bitrate.Max`.
- `complexity`: integer from `0` to `10`.
- `dtx`: enables discontinuous transmission.
- `fec`: enables Opus in-band forward error correction.
- `frameSize`: frame samples per channel. Defaults to 20 ms at the selected sample rate.
- `maxBandwidth`: `Bandwidth.Narrowband`, `Mediumband`, `Wideband`, `Superwideband`, or `Fullband`.
- `packetLossPercent`: integer from `0` to `100`.
- `signal`: `Signal.Auto`, `Signal.Voice`, or `Signal.Music`.
- `vbr` and `vbrConstraint`: configure variable bitrate mode.

TypeScript users can reference the structural handles as `OpusEncoderHandle`
and `OpusDecoderHandle`. The `libopus-wasm/discordjs` export keeps the
`OpusEncoder` class name to match the Discord ecosystem.

The main entry is browser-safe and ships a single-file WASM module, so no
`locateFile` or custom fetch hook is needed. The `libopus-wasm/discordjs`
adapter is Node-only because it uses `Buffer`.

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
