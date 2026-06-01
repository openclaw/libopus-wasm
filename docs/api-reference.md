# API reference

Everything exported from `libopus-wasm`. For the Discord-compatible adapter, see
[discord.js compatibility](discordjs.md).

```ts
import {
  loadLibopus,
  createEncoder,
  createDecoder,
  getPacketInfo,
  Application,
  Signal,
  Bitrate,
  Bandwidth,
  EncoderCtl,
  DecoderCtl,
  OpusError,
  OpusErrorCode,
  isOpusError,
} from "libopus-wasm";
```

## Top-level functions

| Function | Returns | Description |
| --- | --- | --- |
| `loadLibopus()` | `Promise<{ version: string }>` | Loads the module and returns the bundled libopus version string. |
| `createEncoder(options?)` | `Promise<OpusEncoderHandle>` | Creates a raw-packet encoder. See [EncoderOptions](#encoderoptions). |
| `createDecoder(options?)` | `Promise<OpusDecoderHandle>` | Creates a raw-packet decoder. See [DecoderOptions](#decoderoptions). |
| `getPacketInfo(packet, options?)` | `Promise<OpusPacketInfo>` | Inspects a raw packet — duration, frames, channels, bandwidth — without decoding. See [Packet inspection](packet-info.md). |

Both factories share one lazily-loaded WASM module, so the first call pays the
load cost and later calls are cheap.

## Encoder

`OpusEncoderHandle`, returned by `createEncoder`.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `application` | `Application` | Resolved encoding mode (read-only). |
| `channels` | `1 \| 2` | Channel count (read-only). |
| `frameSize` | `number` | Default frame size in samples/channel (read-only). |
| `sampleRate` | `SampleRate` | Sample rate in Hz (read-only). |

### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `encode(pcm, options?)` | `Uint8Array` | Encode one Int16 PCM frame (`Int16Array \| Uint8Array`) to a packet. |
| `encodeFloat(pcm, options?)` | `Uint8Array` | Encode one `Float32Array` frame (`[-1, 1]`) to a packet. |
| `encodeFrames(frames, options?)` | `Uint8Array[]` | Encode several Int16 frames. |
| `encodeFloatFrames(frames, options?)` | `Uint8Array[]` | Encode several Float32 frames. |
| `setBitrate(bitrate)` | `void` | Set bitrate (`number \| "auto" \| "max"`). |
| `getBitrate()` | `number` | Read the resolved bitrate. |
| `setComplexity(n)` | `void` | Set complexity `0`–`10`. |
| `setSignal(signal)` | `void` | Set the [`Signal`](#signal) hint. |
| `setMaxBandwidth(bw)` | `void` | Cap coded [`Bandwidth`](#bandwidth). |
| `setVbr(enabled)` | `void` | Toggle variable bitrate. |
| `setVbrConstraint(enabled)` | `void` | Toggle constrained VBR. |
| `setFec(enabled)` | `void` | Toggle in-band FEC. |
| `setPacketLossPercent(n)` | `void` | Set expected loss `0`–`100`. |
| `setDtx(enabled)` | `void` | Toggle discontinuous transmission. |
| `getLookahead()` | `number` | Encoder algorithmic delay in samples. |
| `getInDtx()` | `boolean` | Whether the encoder is currently in a DTX period. |
| `encoderCtl(request, value)` | `void` | Integer-setter [CTL passthrough](ctl.md). |
| `free()` | `void` | Release the underlying encoder. Idempotent. |
| `[Symbol.dispose]()` | `void` | Calls `free()`; enables `using` declarations. |

`encode` accepts an `Int16Array` or a `Uint8Array` view of the same little-endian
bytes. The frame must contain exactly `frameSize * channels` samples.

## Decoder

`OpusDecoderHandle`, returned by `createDecoder`.

### Properties

| Property | Type | Description |
| --- | --- | --- |
| `channels` | `1 \| 2` | Channel count (read-only). |
| `maxFrameSize` | `number` | Output capacity in samples/channel (read-only). |
| `sampleRate` | `SampleRate` | Sample rate in Hz (read-only). |

### Methods

| Method | Returns | Description |
| --- | --- | --- |
| `decode(packet, options?)` | `Int16Array` | Decode one packet (or `null` for PLC) to Int16 PCM. |
| `decodeFloat(packet, options?)` | `Float32Array` | Decode one packet (or `null`) to Float32 PCM. |
| `decodeFrames(packets, options?)` | `Int16Array[]` | Decode several packets; `null` entries are concealed. |
| `decodeFloatFrames(packets, options?)` | `Float32Array[]` | Float32 batch variant. |
| `decodePacketLoss(frameSize?)` | `Int16Array` | Synthesize one PLC frame (defaults to 20 ms). |
| `decodePacketLossFloat(frameSize?)` | `Float32Array` | Float32 PLC variant. |
| `decoderCtl(request, value)` | `void` | Integer-setter [CTL passthrough](ctl.md). |
| `free()` | `void` | Release the underlying decoder. Idempotent. |
| `[Symbol.dispose]()` | `void` | Calls `free()`; enables `using` declarations. |

`decode(null, { frameSize })` is equivalent to `decodePacketLoss(frameSize)`.

## Options

### EncoderOptions

Passed to `createEncoder`. All fields are optional.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sampleRate` | `SampleRate` | `48000` | One of `8000`, `12000`, `16000`, `24000`, `48000`. |
| `channels` | `1 \| 2` | `2` | Mono or stereo. |
| `application` | `Application` | `Audio` | Encoding mode. |
| `bitrate` | `number \| "auto" \| "max"` | `64000` | Target bits per second. |
| `complexity` | `number` | `10` | `0`–`10`. |
| `signal` | `Signal` | `Auto` | Content hint. |
| `maxBandwidth` | `Bandwidth` | unset | Coded-bandwidth ceiling. |
| `vbr` | `boolean` | unset | Variable bitrate. |
| `vbrConstraint` | `boolean` | unset | Constrained VBR. |
| `fec` | `boolean` | `false` | In-band FEC. |
| `packetLossPercent` | `number` | `0` | `0`–`100`. |
| `dtx` | `boolean` | `false` | Discontinuous transmission. |
| `frameSize` | `number` | 20 ms | Default samples/channel per frame. |

### DecoderOptions

Passed to `createDecoder`. All fields are optional.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `sampleRate` | `SampleRate` | `48000` | Must match the encoder. |
| `channels` | `1 \| 2` | `2` | Must match the encoder. |
| `maxFrameSize` | `number` | 120 ms | Output capacity in samples/channel. |

### EncodeOptions

Passed per `encode` / `encodeFloat` call.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `frameSize` | `number` | encoder default | Samples/channel for this frame. |
| `maxPacketBytes` | `number` | `4000` | Output buffer ceiling. |

### DecodeOptions

Passed per `decode` / `decodeFloat` call.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `decodeFec` | `boolean` | `false` | Recover a lost frame from this packet's FEC data. |
| `frameSize` | `number` | 20 ms | Frame size for PLC / FEC recovery. |
| `maxFrameSize` | `number` | decoder default | Output capacity for this call. |

## Enums and constants

### Application

| Member | Value |
| --- | --- |
| `Voip` | `2048` |
| `Audio` | `2049` |
| `RestrictedLowDelay` | `2051` |

### Signal

| Member | Value |
| --- | --- |
| `Auto` | `-1000` |
| `Voice` | `3001` |
| `Music` | `3002` |

### Bitrate

| Member | Value |
| --- | --- |
| `Auto` | `-1000` |
| `Max` | `-1` |

The string forms `"auto"` and `"max"` are accepted anywhere a `Bitrate` is.

### Bandwidth

| Member | Value |
| --- | --- |
| `Narrowband` | `1101` |
| `Mediumband` | `1102` |
| `Wideband` | `1103` |
| `Superwideband` | `1104` |
| `Fullband` | `1105` |

### EncoderCtl / DecoderCtl

Integer request codes for the CTL passthrough. See the
[CTL reference](ctl.md) for the full list and usage.

## Errors

`OpusError extends Error` is thrown when libopus itself returns an error code:

| Member | Type | Description |
| --- | --- | --- |
| `code` | `number` | The libopus error code. |
| `codeName` | `string \| undefined` | Named libopus error code, such as `"InvalidPacket"`, when known. |
| `operation` | `string \| undefined` | The call that failed (e.g. `"decode"`). |
| `message` | `string` | Human-readable libopus error text. |

Use `OpusErrorCode` for named libopus error codes and `isOpusError(error)` for
realm-safe checks.

Argument validation (wrong frame size, out-of-range option, empty packet,
non-allow-listed CTL) throws a plain `RangeError` _before_ reaching WASM. Using a
handle after `free()` throws a plain `Error`. See [Errors & validation](errors.md)
for the full breakdown.

## Limits

| Constraint | Allowed values |
| --- | --- |
| Sample rate | `8000`, `12000`, `16000`, `24000`, `48000` Hz |
| Channels | `1` (mono), `2` (stereo) |
| Encode frame duration | `2.5`, `5`, `10`, `20`, `40`, `60` ms |
| Decode output capacity | up to `120` ms |
| PLC / FEC frame size | multiples of `2.5` ms, from `2.5` to `120` ms |

## Types

These TypeScript types are exported for annotating your own code:

```ts
import type {
  OpusEncoderHandle,
  OpusDecoderHandle,
  EncoderOptions,
  DecoderOptions,
  EncodeOptions,
  DecodeOptions,
  PacketInfoOptions,
  OpusPacketInfo,
  SampleRate,
  ChannelCount,
} from "libopus-wasm";
```
