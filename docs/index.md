---
title: Overview
permalink: /
description: "Small, modern WebAssembly bindings for libopus raw-packet encode and decode — Discord/WebRTC-ready 48 kHz stereo defaults, Int16 and Float32 PCM, in-band FEC, packet-loss concealment, and a drop-in @discordjs/opus adapter, in browsers and Node."
---

## Try it

`libopus-wasm` wraps [libopus](https://opus-codec.org/) 1.6.1 in a small,
single-file WebAssembly module. The default path is realtime voice: 48 kHz,
stereo, 20 ms frames, raw Opus packets — no Ogg or WebM container in the way.

```ts
import { createEncoder, createDecoder } from "libopus-wasm";

const encoder = await createEncoder(); // 48 kHz, stereo, 20 ms, audio
const decoder = await createDecoder();

const pcm = new Int16Array(960 * 2); // one 20 ms stereo frame
const packet = encoder.encode(pcm);  // -> Uint8Array, a raw Opus packet
const frame = decoder.decode(packet); // -> Int16Array, interleaved PCM

encoder.free();
decoder.free();
```

The same module runs unchanged in browsers and Node. There is no `locateFile`
hook, no second `.wasm` request, and no native build step at install time.

## What it does

- **Raw Opus packets.** Encode/decode single frames and batches. You own the
  framing, so it drops straight into WebRTC, Discord, or a custom transport.
- **Browser and Node from one entry.** A single-file ES module with the WASM
  inlined. Bundles cleanly with Vite, webpack, esbuild, and friends.
- **Int16 and Float32 PCM.** Use whichever your audio pipeline already speaks.
- **Loss resilience.** In-band FEC plus packet-loss concealment for the frames
  that never arrive.
- **Tunable.** Bitrate, VBR/CBR, complexity, signal type, bandwidth, DTX, and a
  curated CTL passthrough for everything else.
- **Drop-in for `@discordjs/opus`.** A compatibility adapter keeps the same
  method shape, minus the native toolchain.

## Pick your path

- **Just trying it.** [Install](install.md) then [Quickstart](quickstart.md) —
  a full encode/decode roundtrip in a couple of minutes.
- **Encoding audio.** [Encoding](encoding.md) covers Int16 vs Float32, frame
  sizes, and batches.
- **Decoding audio.** [Decoding](decoding.md) covers output capacity and
  variable packet durations.
- **Handling loss.** [Packet loss](packet-loss.md) walks through FEC and PLC for
  realtime streams.
- **Tuning quality and bitrate.** [Encoder tuning](encoder-tuning.md) and the
  [CTL reference](ctl.md).
- **Coming from Discord.** [discord.js compatibility](discordjs.md) is a near
  drop-in for `@discordjs/opus`.
- **Shipping to the web.** [Browser usage](browser.md) covers bundlers and Web
  Audio capture.
- **Looking up a method.** The [API reference](api-reference.md) lists every
  function, option, and constant.

## Project

Wraps libopus 1.6.1 from Xiph.Org. Released under the
[MIT license](https://github.com/openclaw/libopus-wasm/blob/main/LICENSE);
libopus carries its own BSD license, reproduced in
[THIRD_PARTY_NOTICES](https://github.com/openclaw/libopus-wasm/blob/main/THIRD_PARTY_NOTICES.md).
Source and issues live on [GitHub](https://github.com/openclaw/libopus-wasm).
Not affiliated with Xiph.Org or the Opus authors.
