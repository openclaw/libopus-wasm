import assert from "node:assert/strict";
import { createDecoder, createEncoder, getPacketInfo } from "libopus-wasm";
import { OpusEncoder } from "libopus-wasm/discordjs";

const encoder = await createEncoder();
const decoder = await createDecoder();
try {
  const pcm = new Int16Array(encoder.frameSize * encoder.channels);
  const packet = encoder.encode(pcm);
  assert.ok(packet.byteLength > 0);
  assert.equal((await getPacketInfo(packet)).samples, encoder.frameSize);
  assert.equal(decoder.decode(packet).length, pcm.length);
} finally {
  encoder.free();
  decoder.free();
}

const opus = await OpusEncoder.create(48000, 2);
try {
  const pcm = Buffer.alloc(960 * 2 * 2);
  const packet = opus.encode(pcm);
  assert.ok(packet.byteLength > 0);
  assert.equal(opus.decode(packet).length, pcm.length);
} finally {
  opus.free();
}
console.log("Packed ESM and Discord adapter encode/decode passed.");
