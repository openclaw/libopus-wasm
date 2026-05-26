# Quickstart

A complete encode/decode roundtrip, then the few things worth knowing before
you wire it into a real pipeline.

## 1. Install

```bash
npm install libopus-wasm
```

## 2. Encode and decode a frame

```ts
import { createEncoder, createDecoder } from "libopus-wasm";

// Both factories are async: the WASM module loads once, lazily, and is shared.
const encoder = await createEncoder();
const decoder = await createDecoder();

// Defaults are Discord/WebRTC-ready: 48 kHz, stereo, 20 ms frames.
// A 20 ms stereo frame at 48 kHz is 960 samples per channel.
const pcm = new Int16Array(encoder.frameSize * encoder.channels); // 960 * 2

const packet = encoder.encode(pcm);   // Uint8Array — one raw Opus packet
const frame = decoder.decode(packet); // Int16Array — interleaved PCM

console.log(packet.byteLength, "bytes ->", frame.length, "samples");

encoder.free();
decoder.free();
```

`encode` returns a raw Opus packet with no container framing. `decode` returns
interleaved 16-bit PCM. That is the whole core loop.

## 3. Clean up deterministically

Both handles hold WASM memory and must be released with `free()`. With a
`using` declaration they are released automatically at scope exit:

```ts
{
  using encoder = await createEncoder();
  using decoder = await createDecoder();

  const packet = encoder.encode(new Int16Array(960 * 2));
  decoder.decode(packet);
} // encoder and decoder are freed here
```

Calling `free()` twice is safe. Using a handle after it is freed throws.

## 4. Read the configuration back

The factory normalizes your options; the resolved values are exposed as
read-only properties:

```ts
const encoder = await createEncoder({ sampleRate: 16000, channels: 1 });

encoder.sampleRate; // 16000
encoder.channels;   // 1
encoder.frameSize;  // 320  — 20 ms at 16 kHz
encoder.application; // Application.Audio
```

## What to read next

- [Encoding](encoding.md) — Float32 input, custom frame sizes, batches.
- [Decoding](decoding.md) — output capacity and mixed packet durations.
- [Packet loss](packet-loss.md) — FEC and concealment for realtime streams.
- [Encoder tuning](encoder-tuning.md) — bitrate, VBR, complexity, signal type.
- [API reference](api-reference.md) — every method and option in one place.
