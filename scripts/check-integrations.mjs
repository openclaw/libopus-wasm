import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import prism from "prism-media";
import { createEncoder, createDecoder } from "libopus-wasm";
import { createPacketDecoder } from "../examples/packet-decoder.mjs";

const encoder = await createEncoder({ channels: 1, bitrate: 32000, vbr: false });
const reference = await createDecoder({ channels: 1 });
try {
  const pcm = Int16Array.from({ length: 960 }, (_, i) => Math.sin(i / 20) * 8000);
  const packets = [encoder.encode(pcm), encoder.encode(pcm)];
  const head = Buffer.alloc(19);
  head.write("OpusHead");
  head[8] = 1;
  head[9] = 1;
  head.writeUInt32LE(48000, 12);
  const tags = Buffer.alloc(16);
  tags.write("OpusTags");
  const ogg = Buffer.concat([page(head, 0, 2), page(tags, 1, 0), ...packets.map((p, i) => page(p, i + 2, i === 1 ? 4 : 0))]);
  const fragments = [];
  for (let i = 0; i < ogg.length; i += 13) fragments.push(ogg.subarray(i, i + 13));
  const output = [];
  await pipeline(Readable.from(fragments), new prism.opus.OggDemuxer(),
    await createPacketDecoder({ channels: 1 }), new Writable({
      write(chunk, _encoding, done) { output.push(chunk); done(); },
    }));
  const expected = packets.map(packet => {
    const decoded = reference.decode(packet);
    return Buffer.from(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  });
  assert.deepEqual(Buffer.concat(output), Buffer.concat(expected));
  assert.ok(output.some(chunk => chunk.some(byte => byte !== 0)));
  await assert.rejects(pipeline(Readable.from([Buffer.from([1, 2, 3, 4])]),
    await createPacketDecoder(), new Writable({ write(_chunk, _encoding, done) { done(); } })), /decode failed/);
  console.log("Prism Ogg demux -> asynchronous WASM decoder -> PCM pipeline passed, including failure cleanup.");
} finally {
  reference.free();
  encoder.free();
}

// A complete Ogg page with one short packet and the standard Ogg CRC-32.
function page(packet, sequence, flags) {
  assert.ok(packet.length < 255);
  const bytes = Buffer.alloc(28 + packet.length);
  bytes.write("OggS");
  bytes[5] = flags;
  bytes.writeBigUInt64LE(BigInt(Math.max(0, sequence - 1) * 960), 6);
  bytes.writeUInt32LE(1, 14);
  bytes.writeUInt32LE(sequence, 18);
  bytes[26] = 1;
  bytes[27] = packet.length;
  bytes.set(packet, 28);
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) crc = (crc << 1) ^ (crc & 0x80000000 ? 0x04c11db7 : 0);
  }
  bytes.writeUInt32LE(crc >>> 0, 22);
  return bytes;
}
