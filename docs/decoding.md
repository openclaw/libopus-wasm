# Decoding

The decoder turns one raw Opus packet into one PCM frame. Like the encoder, it
is stateful per stream but works one packet at a time.

## Create a decoder

```ts
import { createDecoder } from "libopus-wasm";

const decoder = await createDecoder({
  sampleRate: 48000, // must match how the stream was encoded
  channels: 2,
});
```

The decoder's sample rate and channel count must match the encoder that
produced the packets. There is no in-band signalling of these in a raw Opus
packet, so you carry them out of band (the same way Discord and WebRTC do).

## Int16 PCM

```ts
const frame = decoder.decode(packet); // Int16Array, interleaved
frame.length; // === samplesDecoded * channels
```

The result is interleaved signed 16-bit little-endian PCM. The length tells you
how many samples the packet held — Opus packets can carry 2.5–120 ms of audio,
so do not assume it equals your encoder's frame size.

## Float32 PCM

```ts
const frame = decoder.decodeFloat(packet); // Float32Array in [-1, 1]
```

Useful when the output goes straight into Web Audio, which expects float
samples.

## Output capacity

A decoder allocates enough scratch for the largest packet it expects. By
default that is **120 ms** (`maxFrameSize`), the largest an Opus packet can
hold. Lower it if you know your packets are always short and want a tighter
buffer:

```ts
const decoder = await createDecoder({ maxFrameSize: 960 }); // cap at 20 ms
```

```ts
decoder.maxFrameSize; // resolved capacity in samples per channel
```

If a packet decodes to more samples than `maxFrameSize`, the call throws rather
than overrunning. Raise `maxFrameSize`, or override it per call:

```ts
decoder.decode(packet, { maxFrameSize: 2880 }); // allow up to 60 ms here
```

## Batches

`decodeFrames` and `decodeFloatFrames` map over an array of packets:

```ts
const frames = decoder.decodeFrames(packets);          // Int16Array[]
const floatFrames = decoder.decodeFloatFrames(packets); // Float32Array[]
```

A `null` entry in the array is treated as a lost packet and concealed — see
[Packet loss](packet-loss.md).

## Invalid packets

A corrupt or truncated packet makes libopus return an error, surfaced as an
`OpusError` with the libopus code and a readable message:

```ts
import { OpusError } from "libopus-wasm";

try {
  decoder.decode(new Uint8Array([1, 2, 3, 4]));
} catch (err) {
  if (err instanceof OpusError) {
    console.error(err.operation, err.code, err.message);
  }
}
```

Passing an **empty** `Uint8Array` is a different mistake and throws a
`RangeError` — use `null` (or `decodePacketLoss`) to signal a lost packet, not a
zero-length buffer.

## Next

- [Packet loss](packet-loss.md) — conceal dropped packets and recover with FEC.
- [Errors & validation](errors.md) — `RangeError` vs `OpusError`, empty vs lost.
- [API reference](api-reference.md) — full decoder method list.
