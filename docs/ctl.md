# CTL reference

libopus is configured through `opus_encoder_ctl` / `opus_decoder_ctl` — a
varargs interface keyed by integer request codes. `libopus-wasm` exposes this as
`encoderCtl(request, value)` and `decoderCtl(request, value)`, with the request
codes published as the `EncoderCtl` and `DecoderCtl` enums.

Most tuning has a [named setter](encoder-tuning.md); reach for CTLs when you need
a request that has no dedicated helper.

## How it works

```ts
import { createEncoder, EncoderCtl } from "libopus-wasm";

const encoder = await createEncoder();
encoder.encoderCtl(EncoderCtl.SetBitrate, 32000);
encoder.getBitrate(); // 32000
```

```ts
import { createDecoder, DecoderCtl } from "libopus-wasm";

const decoder = await createDecoder();
decoder.decoderCtl(DecoderCtl.SetGain, 256); // +3 dB, Q8 fixed-point
```

## A curated, safe subset

`encoderCtl` and `decoderCtl` accept **integer setter** requests only. This is a
deliberate safety boundary, not a thin wrapper over the C varargs API:

- **Setters, not getters.** Getter CTLs in libopus write through a pointer
  argument. Passing a JS number where libopus expects an `int*` would corrupt
  WASM memory, so getters are exposed as explicit methods
  (`getBitrate`, `getLookahead`, `getInDtx`) instead.
- **Allow-listed requests.** Only the codes in `EncoderCtl` / `DecoderCtl` are
  accepted. Any other request — including pointer-style ones — throws a
  `RangeError` at the JS boundary before touching WASM.
- **Integers only.** Both `request` and `value` must be integers, or the call
  throws a `RangeError`.

```ts
encoder.encoderCtl(4003, 0); // RangeError: not an allow-listed integer setter
```

## Encoder requests

`EncoderCtl` contains the supported encoder setter codes:

| Member | libopus request | Equivalent helper |
| --- | --- | --- |
| `SetApplication` | `OPUS_SET_APPLICATION` | (construction-time `application`) |
| `SetBitrate` | `OPUS_SET_BITRATE` | `setBitrate` |
| `SetMaxBandwidth` | `OPUS_SET_MAX_BANDWIDTH` | `setMaxBandwidth` |
| `SetVbr` | `OPUS_SET_VBR` | `setVbr` |
| `SetBandwidth` | `OPUS_SET_BANDWIDTH` | — |
| `SetComplexity` | `OPUS_SET_COMPLEXITY` | `setComplexity` |
| `SetInBandFec` | `OPUS_SET_INBAND_FEC` | `setFec` |
| `SetPacketLossPercent` | `OPUS_SET_PACKET_LOSS_PERC` | `setPacketLossPercent` |
| `SetDtx` | `OPUS_SET_DTX` | `setDtx` |
| `SetVbrConstraint` | `OPUS_SET_VBR_CONSTRAINT` | `setVbrConstraint` |
| `SetForceChannels` | `OPUS_SET_FORCE_CHANNELS` | — |
| `SetSignal` | `OPUS_SET_SIGNAL` | `setSignal` |
| `SetLsbDepth` | `OPUS_SET_LSB_DEPTH` | — |
| `SetExpertFrameDuration` | `OPUS_SET_EXPERT_FRAME_DURATION` | — |
| `SetPredictionDisabled` | `OPUS_SET_PREDICTION_DISABLED` | — |
| `SetPhaseInversionDisabled` | `OPUS_SET_PHASE_INVERSION_DISABLED` | — |

```ts
// Tell Opus the input only carries 16 meaningful bits.
encoder.encoderCtl(EncoderCtl.SetLsbDepth, 16);

// Force a stereo encode even from a mono-leaning signal.
encoder.encoderCtl(EncoderCtl.SetForceChannels, 2);
```

## Decoder requests

`DecoderCtl` covers the supported decoder setters:

| Member | libopus request | Notes |
| --- | --- | --- |
| `SetGain` | `OPUS_SET_GAIN` | Output gain in Q8 dB (256 = +3 dB). |
| `SetPhaseInversionDisabled` | `OPUS_SET_PHASE_INVERSION_DISABLED` | Disable stereo phase inversion. |

```ts
decoder.decoderCtl(DecoderCtl.SetGain, -256); // attenuate by 3 dB
```

## Next

- [Encoder tuning](encoder-tuning.md) — the named setters most code should use.
- [API reference](api-reference.md) — enum values and method signatures.
