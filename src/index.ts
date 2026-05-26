import createLibopusModule from "./generated/libopus.generated.mjs";

export const Application = {
  Voip: 2048,
  Audio: 2049,
  RestrictedLowDelay: 2051,
} as const;

export type Application = (typeof Application)[keyof typeof Application];

export type CodecOptions = {
  channels: 1 | 2;
  sampleRate: 8000 | 12000 | 16000 | 24000 | 48000;
};

export type EncoderOptions = CodecOptions & {
  application?: Application;
  bitrate?: number;
  fec?: boolean;
  packetLossPercent?: number;
};

export type DecodeOptions = {
  decodeFec?: boolean;
};

export type EncodeOptions = {
  maxPacketBytes?: number;
};

export type OpusEncoder = {
  readonly channels: 1 | 2;
  readonly sampleRate: CodecOptions["sampleRate"];
  encodePcm16(pcm: Int16Array | Uint8Array, frameSize: number, options?: EncodeOptions): Uint8Array;
  free(): void;
  setBitrate(bitrate: number): void;
  setFec(enabled: boolean): void;
  setPacketLossPercent(percentage: number): void;
};

export type OpusDecoder = {
  readonly channels: 1 | 2;
  readonly sampleRate: CodecOptions["sampleRate"];
  decodeFrame(packet: Uint8Array, frameSize: number, options?: DecodeOptions): Int16Array;
  free(): void;
};

type LibopusModule = Awaited<ReturnType<typeof createLibopusModule>>;

let modulePromise: Promise<LibopusModule> | undefined;

export async function loadLibopus(): Promise<{
  version: string;
}> {
  const module = await getModule();
  return { version: module.UTF8ToString(module._oc_get_version_string()) };
}

export async function createEncoder(options: EncoderOptions): Promise<OpusEncoder> {
  const module = await getModule();
  return new WasmOpusEncoder(module, options);
}

export async function createDecoder(options: CodecOptions): Promise<OpusDecoder> {
  const module = await getModule();
  return new WasmOpusDecoder(module, options);
}

class WasmOpusEncoder implements OpusEncoder {
  readonly channels: 1 | 2;
  readonly sampleRate: CodecOptions["sampleRate"];
  #freed = false;
  #module: LibopusModule;
  #ptr: number;

  constructor(module: LibopusModule, options: EncoderOptions) {
    validateCodecOptions(options);
    this.#module = module;
    this.channels = options.channels;
    this.sampleRate = options.sampleRate;
    const errorPtr = module._malloc(4);
    try {
      const ptr = module._oc_create_encoder(
        options.sampleRate,
        options.channels,
        options.application ?? Application.Audio,
        errorPtr,
      );
      const error = module.HEAP16[errorPtr >> 1] ?? 0;
      if (!ptr || error !== 0) {
        throw new OpusError(error, formatOpusError(module, error));
      }
      this.#ptr = ptr;
    } finally {
      module._free(errorPtr);
    }
    if (options.bitrate !== undefined) {
      this.setBitrate(options.bitrate);
    }
    if (options.fec !== undefined) {
      this.setFec(options.fec);
    }
    if (options.packetLossPercent !== undefined) {
      this.setPacketLossPercent(options.packetLossPercent);
    }
  }

  encodePcm16(pcm: Int16Array | Uint8Array, frameSize: number, options: EncodeOptions = {}): Uint8Array {
    this.#assertLive();
    validateFrameSize(frameSize);
    const pcmBytes = toUint8Array(pcm);
    const expectedBytes = frameSize * this.channels * 2;
    if (pcmBytes.byteLength !== expectedBytes) {
      throw new RangeError(
        `PCM frame has ${pcmBytes.byteLength} bytes; expected ${expectedBytes} for ${frameSize} samples and ${this.channels} channel(s)`,
      );
    }
    const maxPacketBytes = options.maxPacketBytes ?? 4000;
    if (!Number.isInteger(maxPacketBytes) || maxPacketBytes <= 0) {
      throw new RangeError("maxPacketBytes must be a positive integer");
    }
    const pcmPtr = this.#module._malloc(pcmBytes.byteLength);
    const packetPtr = this.#module._malloc(maxPacketBytes);
    try {
      this.#module.HEAPU8.set(pcmBytes, pcmPtr);
      const encodedBytes = this.#module._oc_encode(
        this.#ptr,
        pcmPtr,
        frameSize,
        packetPtr,
        maxPacketBytes,
      );
      if (encodedBytes < 0) {
        throw new OpusError(encodedBytes, formatOpusError(this.#module, encodedBytes));
      }
      return this.#module.HEAPU8.slice(packetPtr, packetPtr + encodedBytes);
    } finally {
      this.#module._free(packetPtr);
      this.#module._free(pcmPtr);
    }
  }

  setBitrate(bitrate: number): void {
    this.#assertLive();
    if (!Number.isInteger(bitrate) || bitrate <= 0) {
      throw new RangeError("bitrate must be a positive integer");
    }
    this.#checkCtl(this.#module._oc_encoder_ctl_set_bitrate(this.#ptr, bitrate));
  }

  setFec(enabled: boolean): void {
    this.#assertLive();
    this.#checkCtl(this.#module._oc_encoder_ctl_set_fec(this.#ptr, enabled ? 1 : 0));
  }

  setPacketLossPercent(percentage: number): void {
    this.#assertLive();
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
      throw new RangeError("packetLossPercent must be an integer from 0 to 100");
    }
    this.#checkCtl(this.#module._oc_encoder_ctl_set_packet_loss_percent(this.#ptr, percentage));
  }

  free(): void {
    if (this.#freed) {
      return;
    }
    this.#module._oc_destroy_encoder(this.#ptr);
    this.#freed = true;
  }

  #assertLive(): void {
    if (this.#freed) {
      throw new Error("OpusEncoder has been freed");
    }
  }

  #checkCtl(code: number): void {
    if (code < 0) {
      throw new OpusError(code, formatOpusError(this.#module, code));
    }
  }
}

class WasmOpusDecoder implements OpusDecoder {
  readonly channels: 1 | 2;
  readonly sampleRate: CodecOptions["sampleRate"];
  #freed = false;
  #module: LibopusModule;
  #ptr: number;

  constructor(module: LibopusModule, options: CodecOptions) {
    validateCodecOptions(options);
    this.#module = module;
    this.channels = options.channels;
    this.sampleRate = options.sampleRate;
    const errorPtr = module._malloc(4);
    try {
      const ptr = module._oc_create_decoder(options.sampleRate, options.channels, errorPtr);
      const error = module.HEAP16[errorPtr >> 1] ?? 0;
      if (!ptr || error !== 0) {
        throw new OpusError(error, formatOpusError(module, error));
      }
      this.#ptr = ptr;
    } finally {
      module._free(errorPtr);
    }
  }

  decodeFrame(packet: Uint8Array, frameSize: number, options: DecodeOptions = {}): Int16Array {
    this.#assertLive();
    validateFrameSize(frameSize);
    if (packet.byteLength === 0) {
      throw new RangeError("packet must not be empty");
    }
    const packetPtr = this.#module._malloc(packet.byteLength);
    const pcmBytes = frameSize * this.channels * 2;
    const pcmPtr = this.#module._malloc(pcmBytes);
    try {
      this.#module.HEAPU8.set(packet, packetPtr);
      const decodedSamples = this.#module._oc_decode(
        this.#ptr,
        packetPtr,
        packet.byteLength,
        pcmPtr,
        frameSize,
        options.decodeFec ? 1 : 0,
      );
      if (decodedSamples < 0) {
        throw new OpusError(decodedSamples, formatOpusError(this.#module, decodedSamples));
      }
      const sampleCount = decodedSamples * this.channels;
      return this.#module.HEAP16.slice(pcmPtr >> 1, (pcmPtr >> 1) + sampleCount);
    } finally {
      this.#module._free(pcmPtr);
      this.#module._free(packetPtr);
    }
  }

  free(): void {
    if (this.#freed) {
      return;
    }
    this.#module._oc_destroy_decoder(this.#ptr);
    this.#freed = true;
  }

  #assertLive(): void {
    if (this.#freed) {
      throw new Error("OpusDecoder has been freed");
    }
  }
}

export class OpusError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "OpusError";
    this.code = code;
  }
}

async function getModule(): Promise<LibopusModule> {
  modulePromise ??= createLibopusModule();
  return await modulePromise;
}

function formatOpusError(module: LibopusModule, code: number): string {
  const message = module.UTF8ToString(module._oc_strerror(code));
  return `libopus error ${code}: ${message}`;
}

function toUint8Array(input: Int16Array | Uint8Array): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function validateCodecOptions(options: CodecOptions): void {
  if (![8000, 12000, 16000, 24000, 48000].includes(options.sampleRate)) {
    throw new RangeError("sampleRate must be 8000, 12000, 16000, 24000, or 48000");
  }
  if (options.channels !== 1 && options.channels !== 2) {
    throw new RangeError("channels must be 1 or 2");
  }
}

function validateFrameSize(frameSize: number): void {
  if (!Number.isInteger(frameSize) || frameSize <= 0 || frameSize > 5760) {
    throw new RangeError("frameSize must be an integer from 1 to 5760");
  }
}
