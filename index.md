# libopus-wasm

Small, modern WASM bindings for libopus raw packet encode/decode.

The default path is Discord/realtime voice ready: 48 kHz, stereo, 20 ms PCM frames, raw Opus packets, no Ogg/WebM container layer.

```bash
npm install libopus-wasm
```

```ts
import { createDecoder, createEncoder } from "libopus-wasm";

using encoder = await createEncoder();
using decoder = await createDecoder();

const pcm = new Int16Array(960 * 2);
const packet = encoder.encode(pcm);
const decoded = decoder.decode(packet);
const concealed = decoder.decodePacketLoss(960);
```

- Source: [openclaw/libopus-wasm](https://github.com/openclaw/libopus-wasm)
- Package: [npmjs.com/package/libopus-wasm](https://www.npmjs.com/package/libopus-wasm)
- API and usage: [README](https://github.com/openclaw/libopus-wasm#readme)
