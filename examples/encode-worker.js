import { createEncoder } from "../dist/index.js";

// One encoder per worker; accumulate arbitrary Web Audio blocks into Opus frames.
const encoder = await createEncoder({ sampleRate: 48000, channels: 1 });
const frame = new Float32Array(encoder.frameSize);
let used = 0;
self.onmessage = ({ data }) => {
  try {
    if (data.type === "reset") {
      encoder.reset();
      used = 0;
    } else if (data.type === "close") {
      encoder.free();
      self.close();
    } else if (data.type === "pcm") {
      for (let offset = 0; offset < data.samples.length;) {
        const count = Math.min(frame.length - used, data.samples.length - offset);
        frame.set(data.samples.subarray(offset, offset + count), used);
        used += count;
        offset += count;
        if (used === frame.length) {
          const packet = encoder.encodeFloat(frame);
          self.postMessage({ type: "packet", packet }, [packet.buffer]);
          used = 0;
        }
      }
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  }
};
self.postMessage({ type: "ready" });
