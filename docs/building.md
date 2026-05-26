# Building from source

The published npm package ships compiled WebAssembly, so **using** the library
needs no build step. Build from source only when you want to audit the
toolchain, pin a different libopus, or hack on the bindings.

## Prerequisites

- [Emscripten](https://emscripten.org/) (`emcc`) on your `PATH`.
- [pnpm](https://pnpm.io/) — the repo's package manager.
- Node 20 or newer.

Verify the toolchain:

```bash
emcc --version
pnpm --version
```

## Build

```bash
pnpm install
pnpm build
```

`pnpm build` runs three steps:

1. `build:wasm` — `node scripts/build-libopus-wasm.mjs` downloads **libopus
   1.6.1** from Xiph.Org, verifies it against a pinned SHA-256, compiles it with
   Emscripten, and emits a single-file ES module into `src/generated/`.
2. `tsc` — type-checks and compiles the TypeScript in `src/` to `dist/`.
3. `copy-generated` — copies the generated WASM module into `dist/`.

The result in `dist/` is exactly what gets published.

## Test

```bash
pnpm test
```

This rebuilds the WASM module and runs the [Vitest](https://vitest.dev/) suite,
which exercises encode/decode roundtrips, Float32 paths, FEC and PLC, CTL
validation, error handling, and the discord.js adapter.

Type-check without emitting:

```bash
pnpm typecheck
```

## Clean

```bash
pnpm clean   # removes dist/ and the .cache/ build directory
```

The first build downloads and compiles libopus into `.cache/`, which takes a
while; later builds reuse it. `pnpm clean` forces a fresh download and compile.

## How the WASM is packaged

The build emits a **single-file** ES module with the `.wasm` bytes inlined as
base64. That is what makes the package browser-safe with no `locateFile` hook
and no second network request. The C entry points are thin wrappers in
`native/opus_wasm_wrapper.c` (prefixed `oc_`) that the TypeScript in
`src/index.ts` calls into.

## Next

- [Benchmark](benchmark.md) — measure the build against the native addon.
- [API reference](api-reference.md) — the surface the bindings expose.
