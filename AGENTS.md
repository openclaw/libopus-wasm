# libopus-wasm Notes

- WASM build: do not blindly pass `-O3 -flto` through libopus `CFLAGS`/`LDFLAGS`. Tested 2026-05-26 with Emscripten 5.0.7: build time grew from `28.54s` to `54.29s`, single-file module grew from `377601` to `453420` bytes, and first decode hung. Variant with `-DNDEBUG` also hung and built slower (`67.03s`).
- WASM build: libopus `CFLAGS=-O3 -fvisibility=hidden` without LTO is valid but slower. Tested 2026-05-26: build time `52.69s`, module `402064` bytes, benchmark `wasm encode 10214 ops/sec`, `wasm decode 39450 ops/sec` versus current `12633`/`39971`.
- Current known-good profile: libopus autotools defaults (`-g -O2 ...`) plus final wrapper/link `emcc -O3 -flto`.
