# Benchmark

A WASM codec is only useful if it keeps up with realtime. The repo ships a
benchmark that pits `libopus-wasm` against the native
[`@discordjs/opus`](https://github.com/discordjs/opus) addon on the same frames.

## Run it

```bash
pnpm benchmark
```

This builds the library and then runs `scripts/benchmark-native.mjs`. The native
comparison requires `@discordjs/opus` to build on the host (a dev dependency),
so a working node-gyp toolchain is needed for the benchmark — though never for
using `libopus-wasm` itself.

## Sample result

Apple Silicon, Node 26, 20,000 iterations, 48 kHz stereo, 20 ms frames:

```text
wasm encode:   15,304 ops/sec
native encode: 15,741 ops/sec
wasm decode:   38,416 ops/sec
native decode: 41,280 ops/sec
```

Encode runs within a few percent of native; decode is close behind. For 20 ms
frames that is far above the ~50 frames/sec a single realtime stream needs, with
ample headroom for many concurrent streams.

> These numbers are a regression check, not a portable score. Absolute
> throughput depends on CPU, Node version, and Emscripten flags, so compare runs
> on the same machine rather than against the figures above.

## In CI

The GitHub Actions workflow exposes a manual **Benchmark** job
(`workflow_dispatch`) so you can capture numbers on the CI runner on demand,
separate from the per-commit test run.

## Next

- [Building from source](building.md) — produce the build the benchmark runs.
- [Encoder tuning](encoder-tuning.md) — `complexity` is the main throughput knob.
