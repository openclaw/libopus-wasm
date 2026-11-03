import { Buffer } from "node:buffer";
import type { ChannelCount, OpusDecoderHandle, OpusEncoderHandle, SampleRate } from "./index.js";
import { createDecoder, createEncoder } from "./index.js";

export class OpusEncoder {
  readonly channels: number;
  readonly rate: number;
  readonly ready: Promise<void>;
  #decoder: OpusDecoderHandle | undefined;
  #encoder: OpusEncoderHandle | undefined;
  #freed = false;
  #initError: unknown;

  constructor(rate = 48_000, channels = 2) {
    this.rate = rate;
    this.channels = channels;
    this.ready = Promise.allSettled([
      createEncoder({
        channels: channels as ChannelCount,
        sampleRate: rate as SampleRate,
      }),
      createDecoder({
        channels: channels as ChannelCount,
        sampleRate: rate as SampleRate,
      }),
    ]).then(([encoderResult, decoderResult]) => {
      if (encoderResult.status === "rejected") {
        if (decoderResult.status === "fulfilled") {
          decoderResult.value.free();
        }
        throw encoderResult.reason;
      }
      const encoder = encoderResult.value;
      if (decoderResult.status === "rejected") {
        encoder.free();
        throw decoderResult.reason;
      }
      const decoder = decoderResult.value;
      if (this.#freed) {
        encoder.free();
        decoder.free();
        return;
      }
      this.#encoder = encoder;
      this.#decoder = decoder;
    }).catch((error: unknown) => {
      this.#initError = error;
      throw error;
    });
    this.ready.catch(() => undefined);
  }

  static async create(rate = 48_000, channels = 2): Promise<OpusEncoder> {
    const encoder = new OpusEncoder(rate, channels);
    await encoder.ready;
    return encoder;
  }

  encode(buf: Buffer | Uint8Array): Buffer {
    const encoder = this.#requireCodec(this.#encoder);
    const frameSize = inferFrameSize(buf.byteLength, this.channels);
    return Buffer.from(encoder.encode(buf, { frameSize }));
  }

  decode(buf: Buffer | Uint8Array): Buffer {
    const decoder = this.#requireCodec(this.#decoder);
    const pcm = decoder.decode(buf);
    return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  }

  applyEncoderCTL(ctl: number, value: number): void {
    this.#requireCodec(this.#encoder).encoderCtl(ctl, value);
  }

  applyDecoderCTL(ctl: number, value: number): void {
    this.#requireCodec(this.#decoder).decoderCtl(ctl, value);
  }

  setBitrate(bitrate: number): void {
    this.#requireCodec(this.#encoder).setBitrate(bitrate);
  }

  getBitrate(): number {
    return this.#requireCodec(this.#encoder).getBitrate();
  }

  setFEC(enabled: boolean): void {
    this.#requireCodec(this.#encoder).setFec(enabled);
  }

  setPLP(percentage: number): void {
    this.#requireCodec(this.#encoder).setPacketLossPercent(percentage);
  }

  free(): void {
    if (this.#freed) {
      return;
    }
    this.#freed = true;
    this.#encoder?.free();
    this.#decoder?.free();
  }

  [Symbol.dispose](): void {
    this.free();
  }

  #requireCodec<T extends OpusEncoderHandle | OpusDecoderHandle>(codec: T | undefined): T {
    if (this.#initError) {
      throw new Error("OpusEncoder failed to initialize", { cause: this.#initError });
    }
    if (!codec || this.#freed) {
      throw new Error("OpusEncoder is not ready; await encoder.ready or use OpusEncoder.create()");
    }
    return codec;
  }
}

function inferFrameSize(byteLength: number, channels: number): number {
  const frameSize = byteLength / 2 / channels;
  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new RangeError("PCM buffer length must contain whole signed 16-bit samples for each channel");
  }
  return frameSize;
}
