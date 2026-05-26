# Encoder tuning

Opus exposes a lot of knobs. `libopus-wasm` surfaces the common ones as typed
options and named setters, and the rest through a curated
[CTL passthrough](ctl.md). Everything here can be set at construction time or
changed later at runtime.

## Options at a glance

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `application` | `Application` | `Audio` | Encoding mode. `Voip`, `Audio`, `RestrictedLowDelay`. |
| `bitrate` | `number \| "auto" \| "max"` | `64000` | Target bits per second. |
| `complexity` | `0`–`10` | `10` | Quality vs CPU. |
| `signal` | `Signal` | `Auto` | Hint: `Auto`, `Voice`, `Music`. |
| `maxBandwidth` | `Bandwidth` | unset | Upper bound on coded bandwidth. |
| `vbr` | `boolean` | libopus default | Variable vs constant bitrate. |
| `vbrConstraint` | `boolean` | libopus default | Constrained VBR. |
| `fec` | `boolean` | `false` | In-band forward error correction. |
| `packetLossPercent` | `0`–`100` | `0` | Expected loss; drives FEC redundancy. |
| `dtx` | `boolean` | `false` | Discontinuous transmission for silence. |
| `frameSize` | `number` | 20 ms | Default samples/channel per frame. |

```ts
const encoder = await createEncoder({
  application: Application.Audio,
  bitrate: 96000,
  complexity: 10,
  signal: Signal.Music,
  vbr: true,
});
```

## Application mode

Set this at construction — it cannot change after the encoder is created.

| Mode | Best for |
| --- | --- |
| `Application.Voip` | Speech; optimizes for intelligibility. |
| `Application.Audio` | Music and general audio (the default). |
| `Application.RestrictedLowDelay` | Lowest latency; disables the speech-only modes. |

## Bitrate

`bitrate` accepts an integer in bits per second, or one of two sentinels:

```ts
encoder.setBitrate(128000);     // 128 kbps
encoder.setBitrate("auto");     // let Opus choose from sample rate + channels
encoder.setBitrate("max");      // use the maximum the frame allows
encoder.getBitrate();           // read the resolved value back
```

The `Bitrate` enum exposes the same sentinels as values
(`Bitrate.Auto`, `Bitrate.Max`) if you prefer them over the string forms.

## VBR vs CBR

```ts
encoder.setVbr(true);            // variable bitrate (default in libopus)
encoder.setVbr(false);           // constant bitrate
encoder.setVbrConstraint(true);  // constrained VBR — caps peaks for CBR-like budgets
```

Constant bitrate gives predictable packet sizes; VBR gives better quality for
the same average bitrate. Use constrained VBR when a transport needs a tight
ceiling but you still want some adaptivity.

## Complexity

```ts
encoder.setComplexity(10); // 0 (fastest, lowest quality) .. 10 (best)
```

10 is the default. Lower it only if CPU is the bottleneck; the quality cost is
usually larger than the CPU saving on modern hardware.

## Signal type

A hint that nudges Opus toward the right internal model:

```ts
encoder.setSignal(Signal.Voice); // speech
encoder.setSignal(Signal.Music); // music
encoder.setSignal(Signal.Auto);  // let Opus decide (default)
```

## Bandwidth ceiling

Cap the coded audio bandwidth — handy when you deliberately want a narrower,
cheaper stream:

```ts
import { Bandwidth } from "libopus-wasm";

encoder.setMaxBandwidth(Bandwidth.Wideband); // up to 8 kHz audio bandwidth
```

`Bandwidth` ranges from `Narrowband` (1) through `Mediumband`, `Wideband`,
`Superwideband`, to `Fullband` (5).

## DTX

Discontinuous transmission emits much smaller packets during silence, saving
bandwidth on a voice channel:

```ts
encoder.setDtx(true);
encoder.getInDtx(); // true while the encoder is currently in a DTX (silence) period
```

## Loss resilience

FEC and the expected loss percentage live here too; see
[Packet loss](packet-loss.md) for how they pair with the decoder.

```ts
encoder.setFec(true);
encoder.setPacketLossPercent(10);
```

## Encoder delay

Opus adds a fixed look-ahead. Read it to align encoder and decoder timelines
(for example, to trim the leading samples when comparing to a reference):

```ts
encoder.getLookahead(); // samples of algorithmic delay at the encoder's rate
```

## Anything else

Settings without a named helper are reachable through the typed CTL
passthrough — see [the CTL reference](ctl.md).

## Next

- [Packet loss](packet-loss.md) — make FEC and PLC work together.
- [CTL reference](ctl.md) — the full integer-setter passthrough.
- [API reference](api-reference.md) — setter signatures and enum values.
