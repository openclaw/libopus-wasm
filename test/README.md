# Test cleanup ledger

Audited all six test files, the native bindings, build scripts, CI, and package smoke test at `b1c50cd`.

| Surface | Decision | Validation |
| --- | --- | --- |
| Encoder initialization | Merge duplicate native instrumentation into `codec-create-cleanup.test.ts`; retain validation-before-allocation and cleanup-after-setter-failure cases. | Required: complete Vitest suite on Linux Node 22/24/26. |
| Packet-size limits | Replace copied sine generator with zero PCM; remove repeated default packet-cap assertion. | Bounds rejection still followed by successful encoding. |
| Docs fixtures | Build escaping fixture once; retain repeated-build check for deterministic anchors. | Both generated-page assertions remain. |
| Long frames, CTL bounds, native allocation failures | Retain: protect stack corruption, numeric coercion, and resource ownership regressions. | Real WASM with targeted fault injection where failures cannot be induced reliably. |
| Native mappings and fixture files | No unused mappings or orphan fixtures found. | JS callers, native exports, and fixture consumers inspected. |

Follow-ups: strengthen batch output checks; exercise the packed package in ordinary CI without redundant WASM builds; cover successful FEC decoding; correct the metadata test/docs claim that validation never decodes.
