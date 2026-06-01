# Errors & validation

Failures fall into two kinds, and the kind tells you whose mistake it was.
**Argument validation** throws a plain `RangeError` before anything reaches
WASM — that is a bug in the calling code. **libopus failures** throw an
`OpusError` — the codec rejected otherwise well-formed input, usually a corrupt
or truncated packet.

## RangeError: bad arguments

Every option and buffer is checked up front. A wrong frame size, an
out-of-range option, an empty packet, or a CTL request outside the allow-list
throws synchronously with a `RangeError`:

```ts
encoder.encode(new Int16Array(123)); // RangeError: wrong sample count
await createEncoder({ channels: 3 }); // RangeError: channels must be 1 or 2
```

These never reach the WASM boundary, so they cost nothing and carry a precise
message. Treat them as programming errors to fix, not conditions to catch at
runtime.

## OpusError: the codec rejected it

When libopus itself returns an error code — a malformed packet handed to
`decode` or `getPacketInfo`, for example — it surfaces as an `OpusError`:

```ts
import { OpusErrorCode, isOpusError } from "libopus-wasm";

try {
  decoder.decode(corruptPacket);
} catch (err) {
  if (isOpusError(err)) {
    if (err.operation === "decode" && err.code === OpusErrorCode.InvalidPacket) {
      // Drop or conceal this corrupt packet.
    }
  }
}
```

| Member | Type | Description |
| --- | --- | --- |
| `code` | `number` | The raw libopus error code (negative). |
| `codeName` | `string \| undefined` | Named libopus error code, such as `"InvalidPacket"`, when known. |
| `operation` | `string \| undefined` | The call that failed — `"decode"`, `"encode"`, `"getPacketInfo"`, … |
| `message` | `string` | libopus's own error text, prefixed with the operation and code. |

`OpusError extends Error`, so `instanceof Error` matches it too. Use
`isOpusError()` when errors may cross package or realm boundaries.

## Empty vs. lost packets

An **empty** `Uint8Array` is rejected with a `RangeError` — a zero-length buffer
is not a valid packet. To signal a *lost* packet to the decoder, pass `null`
(or call `decodePacketLoss`), which triggers
[packet-loss concealment](packet-loss.md) instead of an error.

```ts
decoder.decode(new Uint8Array(0)); // RangeError — don't do this
decoder.decode(null);              // concealed frame — the right way
```

## Using a freed handle

Calling any method on an encoder or decoder after `free()` (or after a `using`
scope exits) throws a plain `Error`. Allocate a fresh handle rather than reusing
a freed one — see [resource cleanup](quickstart.md#3-clean-up-deterministically).

## Next

- [Decoding](decoding.md#invalid-packets) — where decode errors come from.
- [Packet inspection](packet-info.md) — validate a packet without decoding.
- [API reference](api-reference.md#errors) — the error surface at a glance.
