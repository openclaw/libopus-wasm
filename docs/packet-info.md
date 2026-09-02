# Packet inspection

`getPacketInfo` reads the header of a raw Opus packet and reports what it
contains — duration, frame count, channels, and bandwidth — without decoding the
audio. It is the cheap way to validate an incoming packet or to learn its shape
before you hand it to a decoder.

```ts
import { getPacketInfo } from "libopus-wasm";

const info = await getPacketInfo(packet);
info.durationMs;      // 20
info.frames;          // 1
info.samples;         // 960  (per channel, at the given sample rate)
info.samplesPerFrame; // 960
info.channels;        // 1 | 2
info.sampleRate;      // 48000
info.bandwidth;       // Bandwidth.Fullband
```

Like the factories, the first call lazily loads the shared WASM module; later
calls are cheap.

## Sample rate

Opus packets do not carry their sample rate in band, so `durationMs`, `samples`,
and `samplesPerFrame` are computed against the rate you pass — `48000` Hz by
default. Pass the rate the stream was encoded at to get accurate timing:

```ts
const info = await getPacketInfo(packet, { sampleRate: 16000 });
```

Only the [supported rates](api-reference.md#limits) (`8000`, `12000`, `16000`,
`24000`, `48000`) are accepted; anything else throws a `RangeError`.

## What you get back

| Field | Type | Meaning |
| --- | --- | --- |
| `durationMs` | `number` | Total audio in the packet, `2.5`–`120` ms. |
| `frames` | `number` | Opus frames packed into the packet (`1`–`48`). |
| `samples` | `number` | Total samples per channel at `sampleRate`. |
| `samplesPerFrame` | `number` | Samples per channel in one frame. |
| `channels` | `1 \| 2` | Channel count encoded in the packet. |
| `sampleRate` | `SampleRate` | The rate the figures were computed against. |
| `bandwidth` | `Bandwidth` | Coded bandwidth — `Narrowband`…`Fullband`. |

`samples === frames * samplesPerFrame`, and `durationMs === samples / sampleRate
* 1000`. The result is read-only.

## Sizing a decoder

Use the duration to confirm a packet fits a decoder's
[output capacity](decoding.md#output-capacity) before decoding:

```ts
const info = await getPacketInfo(packet);
if (info.durationMs > 60) {
  // larger than this decoder's 60 ms buffer — raise maxFrameSize or skip.
}
const frame = decoder.decode(packet);
```

## Invalid packets

A corrupt or truncated packet surfaces the libopus error as an
[`OpusError`](errors.md). An empty `Uint8Array`, or a packet larger than
64 KiB, throws a `RangeError` before reaching WASM.

```ts
import { OpusError } from "libopus-wasm";

try {
  await getPacketInfo(suspectPacket);
} catch (err) {
  if (err instanceof OpusError) {
    // not a valid Opus packet
  }
}
```

## Next

- [Errors & validation](errors.md) — how failures surface.
- [Decoding](decoding.md) — turn the packet into PCM.
- [API reference](api-reference.md#top-level-functions) — full signature.
