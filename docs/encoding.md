# Encoding

The encoder turns one PCM frame into one raw Opus packet. It never buffers
across calls and never adds container framing — one `encode` in, one packet out.

## Create an encoder

```ts
import { createEncoder, Application, Signal } from "libopus-wasm";

const encoder = await createEncoder({
  sampleRate: 48000, // 8000 | 12000 | 16000 | 24000 | 48000
  channels: 2,       // 1 (mono) or 2 (stereo)
  application: Application.Audio,
  bitrate: 64000,    // bits per second, "auto", or "max"
});
```

Every option has a Discord/WebRTC-ready default, so `createEncoder()` with no
arguments is a valid starting point. See [Encoder tuning](encoder-tuning.md) for
the full option set.

## Int16 PCM

`encode` takes interleaved signed 16-bit little-endian PCM as an `Int16Array`
(or a `Uint8Array` view over the same bytes):

```ts
const frame = new Int16Array(encoder.frameSize * encoder.channels);
// ...fill `frame` with audio...
const packet = encoder.encode(frame); // Uint8Array
```

The frame must contain **exactly** `frameSize * channels` samples. A wrong
length throws a `RangeError` before any WASM call, so mistakes surface
immediately rather than as silent corruption.

## Float32 PCM

If your pipeline already works in floats (Web Audio, most DSP), encode them
directly — no manual conversion to Int16:

```ts
const frame = new Float32Array(encoder.frameSize * encoder.channels); // [-1, 1]
const packet = encoder.encodeFloat(frame);
```

Values are expected in `[-1, 1]`; libopus clips anything outside that range.

## Frame sizes

The default frame is 20 ms. At 48 kHz that is 960 samples per channel. Opus
accepts a fixed set of frame durations:

| Duration | 48 kHz | 24 kHz | 16 kHz | 12 kHz | 8 kHz |
| --- | --- | --- | --- | --- | --- |
| 2.5 ms | 120 | 60 | 40 | 30 | 20 |
| 5 ms | 240 | 120 | 80 | 60 | 40 |
| 10 ms | 480 | 240 | 160 | 120 | 80 |
| 20 ms | 960 | 480 | 320 | 240 | 160 |
| 40 ms | 1920 | 960 | 640 | 480 | 320 |
| 60 ms | 2880 | 1440 | 960 | 720 | 480 |

Set a non-default frame size either at construction or per call:

```ts
const encoder = await createEncoder({ frameSize: 480 }); // 10 ms default
encoder.encode(tenMsFrame);

// Override for a single call (e.g. a shorter trailing frame):
encoder.encode(twoAndAHalfMsFrame, { frameSize: 120 });
```

`frameSize` always counts **samples per channel**, never total interleaved
samples. An invalid size throws a `RangeError` listing the valid sizes for the
current sample rate.

## Batches

`encodeFrames` and `encodeFloatFrames` map over an array of frames, applying the
same options to each and returning one packet per frame:

```ts
const packets = encoder.encodeFrames([frameA, frameB, frameC]);
// packets: Uint8Array[]

const floatPackets = encoder.encodeFloatFrames([f1, f2], { frameSize: 480 });
```

These are convenience wrappers over `encode`/`encodeFloat`; each frame must
still match the configured (or overridden) frame size.

## Packet size limit

By default the encoder allocates up to 4000 bytes for a packet, which is more
than enough for any single Opus frame. Lower it if you want a hard ceiling:

```ts
encoder.encode(frame, { maxPacketBytes: 1275 }); // RFC 6716 max for one frame
```

## Next

- [Decoding](decoding.md) — turn packets back into PCM.
- [Encoder tuning](encoder-tuning.md) — bitrate, VBR, complexity, and more.
- [Packet loss](packet-loss.md) — encode with FEC for lossy transports.
