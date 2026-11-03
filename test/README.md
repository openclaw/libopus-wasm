# Test cleanup ledger

Audited all six test files, the native bindings, build scripts, CI, and package smoke test at `b1c50cd`.

| Surface | Decision | Validation |
| --- | --- | --- |
| Encoder initialization | Merge duplicate native instrumentation into `codec-create-cleanup.test.ts`; retain validation-before-allocation and cleanup-after-setter-failure cases. | 51 tests pass on Linux Node 22/24/26 ([#27](https://github.com/openclaw/libopus-wasm/pull/27)). |
| Packet-size limits | Replace copied sine generator with zero PCM; remove repeated default packet-cap assertion. | Bounds rejection still followed by successful encoding. |
| Docs fixtures | Build escaping fixture once; retain repeated-build check for deterministic anchors. | Both generated-page assertions remain. |
| Long frames, CTL bounds, native allocation failures | Retain: protect stack corruption, numeric coercion, and resource ownership regressions. | Real WASM with targeted fault injection where failures cannot be induced reliably. |
| Native mappings and fixture files | No unused mappings or orphan fixtures found. | All 18 CTL values match libopus 1.6.1 headers and native switch cases; fixture consumers inspected. |
| Batch output and FEC | Compare ordered Int16/Float32 output with independent sequential codecs; distinguish FEC from ordinary decoding and concealment. | Real-WASM suite ([#28](https://github.com/openclaw/libopus-wasm/pull/28)). |
| Packet metadata | Correct the temporary-decoder description; test invariant duration at all five supported output rates. | One encoded packet inspected at each rate ([#28](https://github.com/openclaw/libopus-wasm/pull/28)). |
| Package consumers and CI | Build once; replace dry-run packing with an isolated tarball install and both public entrypoints. | Linux Node 22/24/26 executes real encode/decode and rejects silent output ([#29](https://github.com/openclaw/libopus-wasm/pull/29)). |
| Browser consumer | Build the installed tarball with Vite and run it in Chromium without Node globals, cross-origin isolation, or external WASM assets. | Int16/Float32 roundtrips and packet metadata; codec initialization makes no network requests. |

CI runs the installed-package browser check once, on Node 24, after the same tarball consumer used by the Node smoke test. It shares the Playwright dependency and Chromium installation with the Worker/AudioWorklet tests. To run it manually, install Chromium with `pnpm exec playwright install chromium`, then run `node scripts/browser-smoke.mjs <isolated-consumer-directory>` after installing the tarball there.

The allocation-failure instrumentation is intentional; ordinary roundtrips cannot verify native cleanup on those failures. Chromium coverage does not verify microphone capture, audio playback, or other browser engines.
