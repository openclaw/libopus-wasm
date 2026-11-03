import assert from "node:assert/strict";
import { createDecoder, createEncoder, getPacketInfo } from "libopus-wasm";
import { OpusEncoder } from "libopus-wasm/discordjs";

const encoder = await createEncoder();
const decoder = await createDecoder();
try {
  const pcm = makePcm(encoder.frameSize, encoder.channels, encoder.sampleRate);
  const packet = encoder.encode(pcm);
  assert.ok(packet.byteLength > 0);
  assert.equal((await getPacketInfo(packet)).samples, encoder.frameSize);
  const decoded = decoder.decode(packet);
  assert.equal(decoded.length, pcm.length);
  assert.ok(decoded.some((sample) => sample !== 0), "decoded audio must not be silent");
} finally {
  encoder.free();
  decoder.free();
}

const opus = await OpusEncoder.create(48000, 2);
try {
  const pcm = Buffer.from(makePcm(960, 2, 48000).buffer);
  const packet = opus.encode(pcm);
  assert.ok(packet.byteLength > 0);
  const decoded = opus.decode(packet);
  assert.equal(decoded.length, pcm.length);
  assert.ok(decoded.some((byte) => byte !== 0), "adapter audio must not be silent");
} finally {
  opus.free();
}
console.log("Packed ESM and Discord adapter encode/decode passed.");

function makePcm(frameSize, channels, sampleRate) {
  return Int16Array.from({ length: frameSize * channels }, (_, index) =>
    Math.round(Math.sin((Math.floor(index / channels) * 2 * Math.PI * 440) / sampleRate) * 8000),
  );
}
