# discord.js compatibility

`libopus-wasm/discordjs` exposes an `OpusEncoder` class that matches the method
shape of [`@discordjs/opus`](https://github.com/discordjs/opus). It lets you
swap a native addon for a WASM build without a node-gyp toolchain, prebuilt
binaries, or platform-specific install steps.

This entry point uses `node:buffer` and is **Node-only**. For browsers, use the
main [`libopus-wasm`](api-reference.md) entry directly.

## The one difference: it loads asynchronously

`@discordjs/opus` builds its encoder synchronously in the constructor. WASM
compiles asynchronously, so the adapter has to as well. There are two ways to
wait for it.

### Recommended: the async factory

```ts
import { OpusEncoder } from "libopus-wasm/discordjs";

const opus = await OpusEncoder.create(48000, 2);

const packet = opus.encode(pcmBuffer); // Buffer
const frame = opus.decode(packet);     // Buffer
opus.free();
```

### Or construct and await `ready`

This keeps `new OpusEncoder(...)` calls compatible with existing code:

```ts
const opus = new OpusEncoder(48000, 2);
await opus.ready;

opus.encode(pcmBuffer);
```

If you call a method before initialization finishes, it throws rather than
returning garbage. If initialization itself fails (for example, an unsupported
sample rate), `ready` rejects and the synchronous methods throw an error whose
`cause` is the original failure.

## API

`OpusEncoder` mirrors the `@discordjs/opus` surface:

| Member | Description |
| --- | --- |
| `new OpusEncoder(rate?, channels?)` | Construct; defaults `48000`, `2`. Then `await ready`. |
| `OpusEncoder.create(rate?, channels?)` | Async factory; resolves when ready. |
| `encode(buf)` | Encode a PCM `Buffer`/`Uint8Array` to an Opus `Buffer`. |
| `decode(buf)` | Decode an Opus `Buffer`/`Uint8Array` to a PCM `Buffer`. |
| `setBitrate(bitrate)` / `getBitrate()` | Bits per second. |
| `setFEC(enabled)` | Toggle in-band FEC. |
| `setPLP(percentage)` | Set expected packet-loss percentage (`0`–`100`). |
| `applyEncoderCTL(ctl, value)` | Raw encoder CTL passthrough. |
| `applyDecoderCTL(ctl, value)` | Raw decoder CTL passthrough. |
| `free()` | Release the underlying encoder and decoder. |
| `ready` | `Promise<void>` that resolves when the codec is usable. |

`encode` infers the frame size from the buffer length and channel count, exactly
like the native addon, so existing voice code that hands it 20 ms frames keeps
working.

## Migrating

```ts
// Before
import { OpusEncoder } from "@discordjs/opus";
const opus = new OpusEncoder(48000, 2);

// After
import { OpusEncoder } from "libopus-wasm/discordjs";
const opus = await OpusEncoder.create(48000, 2);
```

```ts
const packet = opus.encode(frame);
const pcm = opus.decode(packet);
opus.applyEncoderCTL(EncoderCtl.SetBitrate, 64000);
opus.setFEC(true);
opus.setPLP(10);
```

The CTL codes are the same integers as `@discordjs/opus`; import the
[`EncoderCtl` / `DecoderCtl`](ctl.md) enums from `libopus-wasm` for readable
names.

## When to use the main API instead

The adapter trades flexibility for familiarity. If you are writing new code, or
need Float32 PCM, explicit frame sizes, batch helpers, or browser support, use
the main [`libopus-wasm`](encoding.md) API — it is a superset of what the
adapter offers.

## Next

- [Encoding](encoding.md) and [Decoding](decoding.md) — the full native API.
- [CTL reference](ctl.md) — the request codes used by `applyEncoderCTL`.
