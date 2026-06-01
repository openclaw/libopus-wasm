# Changelog

## Unreleased

## 0.2.0 - 2026-06-01

- Add named Opus error codes, `codeName` metadata, and `isOpusError()` for structured libopus error handling.
- Add coverage tooling and broaden validation-path tests.
- Add dedicated docs pages for packet inspection (`getPacketInfo`) and error handling, list `getPacketInfo` in the API reference, and wire both into the site navigation.

## 0.1.0 - 2026-05-26

- Initial npm release of `libopus-wasm`, a small ESM-only WebAssembly wrapper around libopus 1.6.1 for raw Opus packet encode/decode in Node 20+ and browsers.
- Ship a self-contained single-file WASM module with browser and Node support, no `locateFile` hook, no second `.wasm` request, and no native install-time build.
- Add Discord/WebRTC-ready defaults: 48 kHz, stereo, 20 ms frames, raw packets, `Application.Audio`, 64 kbps, and complexity 10.
- Add async `loadLibopus()`, `createEncoder()`, `createDecoder()`, and `getPacketInfo()` top-level APIs with one lazily shared WASM module.
- Add Int16 PCM encode/decode via `encode()` and `decode()`, including `Int16Array` input and `Uint8Array` little-endian PCM input support.
- Add Float32 PCM encode/decode via `encodeFloat()` and `decodeFloat()` for Web Audio and DSP pipelines.
- Add batch helpers `encodeFrames()`, `encodeFloatFrames()`, `decodeFrames()`, and `decodeFloatFrames()`.
- Add raw packet metadata inspection with validation, returning bandwidth, channel count, frame count, sample count, samples per frame, duration, and sample rate.
- Add packet-loss concealment APIs `decodePacketLoss()`, `decodePacketLossFloat()`, and `decode(null, { frameSize })`.
- Add in-band FEC support through encoder `fec` / `packetLossPercent` options and decoder `decodeFec` recovery.
- Add encoder tuning options and setters for application, bitrate, complexity, DTX, FEC, max bandwidth, packet loss percentage, signal, VBR, and constrained VBR.
- Add encoder state readers `getBitrate()`, `getLookahead()`, and `getInDtx()`.
- Add curated integer CTL passthroughs with `EncoderCtl`, `DecoderCtl`, `encoderCtl()`, and `decoderCtl()` while rejecting pointer-style getter CTLs at the JS boundary.
- Add exported constants and types for `Application`, `Signal`, `Bitrate`, `Bandwidth`, `SampleRate`, `ChannelCount`, encoder/decoder options, packet info, handle types, and `OpusError`.
- Add strict argument validation for supported sample rates, mono/stereo channels, Opus frame durations, packet sizes, PLC/FEC frame sizes, CTL requests, and freed handles.
- Add deterministic cleanup through `free()` and `[Symbol.dispose]()` on encoder, decoder, and Discord-compatible handles.
- Add `libopus-wasm/discordjs`, a Node-only async-ready `@discordjs/opus` adapter with `OpusEncoder.create()`, `ready`, `encode()`, `decode()`, CTL methods, bitrate/FEC/PLP helpers, and `Buffer` output.
- Add reproducible source builds that download libopus 1.6.1 from Xiph.Org, verify the pinned SHA-256, compile with Emscripten, and emit generated bindings into `dist/generated/`.
- Add Vitest coverage for version reporting, defaults, encode/decode paths, non-48 kHz frame derivation, CTLs, bitrate sentinels, Float32, packet metadata, PLC/FEC, invalid packets, Discord adapter behavior, and disposal.
- Add native comparison benchmark tooling against `@discordjs/opus` plus a manual GitHub Actions benchmark workflow.
- Add CI for Node 22 and Node 24 that installs with pnpm, builds WASM, runs tests, and verifies `pnpm pack --dry-run`.
- Add generated documentation site content for install, quickstart, encoding, decoding, packet loss, encoder tuning, CTLs, Discord compatibility, browser usage, building, benchmark, and API reference.
