import { Transform } from "node:stream";
import { createDecoder } from "libopus-wasm";

// Feed one raw Opus packet per chunk, for example from prism.opus.OggDemuxer.
// Container headers, pre-skip and end trimming remain the demuxer's/app's job.
export async function createPacketDecoder(options = {}) {
  const decoder = await createDecoder(options);
  return new Transform({
    writableObjectMode: true,
    transform(packet, _encoding, done) {
      try {
        const pcm = decoder.decode(packet);
        done(null, Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
      } catch (error) {
        done(error);
      }
    },
    destroy(error, done) {
      decoder.free();
      done(error);
    },
  });
}
