import createLibopusModule from "./generated/libopus.generated.mjs";

export const Application = {
  Voip: 2048,
  Audio: 2049,
  RestrictedLowDelay: 2051,
} as const;

export const Signal = {
  Auto: -1000,
  Voice: 3001,
  Music: 3002,
} as const;

export const EncoderCtl = {
  SetApplication: 4000,
  SetBitrate: 4002,
  SetMaxBandwidth: 4004,
  SetVbr: 4006,
  SetBandwidth: 4008,
  SetComplexity: 4010,
  SetInBandFec: 4012,
  SetPacketLossPercent: 4014,
  SetDtx: 4016,
  SetVbrConstraint: 4020,
  SetForceChannels: 4022,
  SetSignal: 4024,
  SetLsbDepth: 4036,
  SetExpertFrameDuration: 4040,
  SetPredictionDisabled: 4042,
  SetPhaseInversionDisabled: 4046,
} as const;

export const DecoderCtl = {
  SetGain: 4034,
  SetPhaseInversionDisabled: 4046,
} as const;

export type Application = (typeof Application)[keyof typeof Application];
export type Signal = (typeof Signal)[keyof typeof Signal];
export type SampleRate = 8000 | 12000 | 16000 | 24000 | 48000;
export type ChannelCount = 1 | 2;

export type CodecOptions = {
  channels?: ChannelCount;
  sampleRate?: SampleRate;
};

export type EncoderOptions = CodecOptions & {
  application?: Application;
  bitrate?: number;
  complexity?: number;
  dtx?: boolean;
  fec?: boolean;
  frameSize?: number;
  inBandFec?: boolean;
  packetLossPercent?: number;
  signal?: Signal;
};

export type DecoderOptions = CodecOptions & {
  maxFrameSize?: number;
};

export type DecodeOptions = {
  decodeFec?: boolean;
  maxFrameSize?: number;
};

export type EncodeOptions = {
  frameSize?: number;
  maxPacketBytes?: number;
};

export type OpusEncoder = {
  readonly application: Application;
  readonly channels: ChannelCount;
  readonly frameSize: number;
  readonly sampleRate: SampleRate;
  encode(pcm: Int16Array | Uint8Array, options?: EncodeOptions): Uint8Array;
  encodeFrames(frames: readonly (Int16Array | Uint8Array)[], options?: EncodeOptions): Uint8Array[];
  encoderCtl(request: number, value: number): void;
  free(): void;
  getBitrate(): number;
  setBitrate(bitrate: number): void;
  setComplexity(complexity: number): void;
  setDtx(enabled: boolean): void;
  setFec(enabled: boolean): void;
  setInBandFec(enabled: boolean): void;
  setPacketLossPercent(percentage: number): void;
  setSignal(signal: Signal): void;
};

export type OpusDecoder = {
  readonly channels: ChannelCount;
  readonly maxFrameSize: number;
  readonly sampleRate: SampleRate;
  decode(packet: Uint8Array, options?: DecodeOptions): Int16Array;
  decodeFrames(packets: readonly Uint8Array[], options?: DecodeOptions): Int16Array[];
  decoderCtl(request: number, value: number): void;
  free(): void;
};

const DEFAULT_CHANNELS = 2 satisfies ChannelCount;
const DEFAULT_FRAME_DURATION_MS = 20;
const MAX_PACKET_DURATION_MS = 120;
const DEFAULT_MAX_PACKET_BYTES = 4000;
const DEFAULT_SAMPLE_RATE = 48_000 satisfies SampleRate;
const DECODER_INTEGER_CTL_REQUESTS = new Set<number>(Object.values(DecoderCtl));
const ENCODER_INTEGER_CTL_REQUESTS = new Set<number>(Object.values(EncoderCtl));
const VALID_SAMPLE_RATES: readonly SampleRate[] = [8000, 12000, 16000, 24000, 48000];

type LibopusModule = Awaited<ReturnType<typeof createLibopusModule>>;

let modulePromise: Promise<LibopusModule> | undefined;

export async function loadLibopus(): Promise<{
  version: string;
}> {
  const module = await getModule();
  return { version: module.UTF8ToString(module._oc_get_version_string()) };
}

export async function createEncoder(options: EncoderOptions = {}): Promise<OpusEncoder> {
  const module = await getModule();
  return new WasmOpusEncoder(module, normalizeEncoderOptions(options));
}

export async function createDecoder(options: DecoderOptions = {}): Promise<OpusDecoder> {
  const module = await getModule();
  return new WasmOpusDecoder(module, normalizeDecoderOptions(options));
}

class WasmOpusEncoder implements OpusEncoder {
  readonly application: Application;
  readonly channels: ChannelCount;
  readonly frameSize: number;
  readonly sampleRate: SampleRate;
  #freed = false;
  #module: LibopusModule;
  #ptr: number;

  constructor(module: LibopusModule, options: Required<EncoderOptions>) {
    this.#module = module;
    this.application = options.application;
    this.channels = options.channels;
    this.frameSize = options.frameSize;
    this.sampleRate = options.sampleRate;
    const errorPtr = module._malloc(4);
    try {
      const ptr = module._oc_create_encoder(
        options.sampleRate,
        options.channels,
        options.application,
        errorPtr,
      );
      const error = module.HEAP32[errorPtr >> 2] ?? 0;
      if (!ptr || error !== 0) {
        throw createOpusError(module, error, "createEncoder");
      }
      this.#ptr = ptr;
    } finally {
      module._free(errorPtr);
    }
    this.setBitrate(options.bitrate);
    this.setComplexity(options.complexity);
    this.setDtx(options.dtx);
    this.setInBandFec(options.inBandFec);
    this.setPacketLossPercent(options.packetLossPercent);
    this.setSignal(options.signal);
  }

  encode(pcm: Int16Array | Uint8Array, options: EncodeOptions = {}): Uint8Array {
    this.#assertLive();
    const frameSize = options.frameSize ?? this.frameSize;
    validateFrameSize(frameSize, "frameSize");
    const pcmBytes = toUint8Array(pcm);
    const expectedBytes = frameSize * this.channels * 2;
    if (pcmBytes.byteLength !== expectedBytes) {
      throw new RangeError(
        `PCM frame has ${pcmBytes.byteLength} bytes; expected ${expectedBytes} for ${frameSize} samples and ${this.channels} channel(s)`,
      );
    }
    const maxPacketBytes = options.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES;
    validatePositiveInteger(maxPacketBytes, "maxPacketBytes");
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
        throw createOpusError(this.#module, encodedBytes, "encode");
      }
      return this.#module.HEAPU8.slice(packetPtr, packetPtr + encodedBytes);
    } finally {
      this.#module._free(packetPtr);
      this.#module._free(pcmPtr);
    }
  }

  encodeFrames(frames: readonly (Int16Array | Uint8Array)[], options: EncodeOptions = {}): Uint8Array[] {
    return frames.map((frame) => this.encode(frame, options));
  }

  encoderCtl(request: number, value: number): void {
    this.#assertLive();
    validateInteger(request, "request");
    validateInteger(value, "value");
    if (!ENCODER_INTEGER_CTL_REQUESTS.has(request)) {
      throw new RangeError("encoderCtl only supports integer setter requests");
    }
    this.#check(this.#module._oc_encoder_ctl(this.#ptr, request, value), "encoderCtl");
  }

  setBitrate(bitrate: number): void {
    validatePositiveInteger(bitrate, "bitrate");
    this.encoderCtl(EncoderCtl.SetBitrate, bitrate);
  }

  getBitrate(): number {
    this.#assertLive();
    const bitrate = this.#module._oc_encoder_ctl_get_bitrate(this.#ptr);
    if (bitrate < 0) {
      throw createOpusError(this.#module, bitrate, "getBitrate");
    }
    return bitrate;
  }

  setComplexity(complexity: number): void {
    validateIntegerRange(complexity, 0, 10, "complexity");
    this.encoderCtl(EncoderCtl.SetComplexity, complexity);
  }

  setDtx(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetDtx, enabled ? 1 : 0);
  }

  setFec(enabled: boolean): void {
    this.setInBandFec(enabled);
  }

  setInBandFec(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetInBandFec, enabled ? 1 : 0);
  }

  setPacketLossPercent(percentage: number): void {
    validateIntegerRange(percentage, 0, 100, "packetLossPercent");
    this.encoderCtl(EncoderCtl.SetPacketLossPercent, percentage);
  }

  setSignal(signal: Signal): void {
    if (!Object.values(Signal).includes(signal)) {
      throw new RangeError("signal must be Signal.Auto, Signal.Voice, or Signal.Music");
    }
    this.encoderCtl(EncoderCtl.SetSignal, signal);
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

  #check(code: number, operation: string): void {
    if (code < 0) {
      throw createOpusError(this.#module, code, operation);
    }
  }
}

class WasmOpusDecoder implements OpusDecoder {
  readonly channels: ChannelCount;
  readonly maxFrameSize: number;
  readonly sampleRate: SampleRate;
  #freed = false;
  #module: LibopusModule;
  #ptr: number;

  constructor(module: LibopusModule, options: Required<DecoderOptions>) {
    this.#module = module;
    this.channels = options.channels;
    this.maxFrameSize = options.maxFrameSize;
    this.sampleRate = options.sampleRate;
    const errorPtr = module._malloc(4);
    try {
      const ptr = module._oc_create_decoder(options.sampleRate, options.channels, errorPtr);
      const error = module.HEAP32[errorPtr >> 2] ?? 0;
      if (!ptr || error !== 0) {
        throw createOpusError(module, error, "createDecoder");
      }
      this.#ptr = ptr;
    } finally {
      module._free(errorPtr);
    }
  }

  decode(packet: Uint8Array, options: DecodeOptions = {}): Int16Array {
    this.#assertLive();
    const maxFrameSize = options.maxFrameSize ?? this.maxFrameSize;
    validateFrameSize(maxFrameSize, "maxFrameSize");
    if (packet.byteLength === 0) {
      throw new RangeError("packet must not be empty");
    }
    const packetPtr = this.#module._malloc(packet.byteLength);
    const pcmBytes = maxFrameSize * this.channels * 2;
    const pcmPtr = this.#module._malloc(pcmBytes);
    try {
      this.#module.HEAPU8.set(packet, packetPtr);
      const decodedSamples = this.#module._oc_decode(
        this.#ptr,
        packetPtr,
        packet.byteLength,
        pcmPtr,
        maxFrameSize,
        options.decodeFec ? 1 : 0,
      );
      if (decodedSamples < 0) {
        throw createOpusError(this.#module, decodedSamples, "decode");
      }
      const sampleCount = decodedSamples * this.channels;
      return this.#module.HEAP16.slice(pcmPtr >> 1, (pcmPtr >> 1) + sampleCount);
    } finally {
      this.#module._free(pcmPtr);
      this.#module._free(packetPtr);
    }
  }

  decodeFrames(packets: readonly Uint8Array[], options: DecodeOptions = {}): Int16Array[] {
    return packets.map((packet) => this.decode(packet, options));
  }

  decoderCtl(request: number, value: number): void {
    this.#assertLive();
    validateInteger(request, "request");
    validateInteger(value, "value");
    if (!DECODER_INTEGER_CTL_REQUESTS.has(request)) {
      throw new RangeError("decoderCtl only supports integer setter requests");
    }
    const code = this.#module._oc_decoder_ctl(this.#ptr, request, value);
    if (code < 0) {
      throw createOpusError(this.#module, code, "decoderCtl");
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
  readonly operation: string | undefined;

  constructor(code: number, message: string, operation?: string) {
    super(message);
    this.name = "OpusError";
    this.code = code;
    this.operation = operation;
  }
}

async function getModule(): Promise<LibopusModule> {
  modulePromise ??= createLibopusModule();
  return await modulePromise;
}

function createOpusError(module: LibopusModule, code: number, operation: string): OpusError {
  const message = module.UTF8ToString(module._oc_strerror(code));
  return new OpusError(code, `libopus ${operation} failed (${code}): ${message}`, operation);
}

function toUint8Array(input: Int16Array | Uint8Array): Uint8Array {
  return input instanceof Uint8Array
    ? input
    : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function normalizeEncoderOptions(options: EncoderOptions): Required<EncoderOptions> {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = options.channels ?? DEFAULT_CHANNELS;
  validateCodecOptions({ channels, sampleRate });
  const frameSize = options.frameSize ?? samplesForDuration(sampleRate, DEFAULT_FRAME_DURATION_MS);
  validateFrameSize(frameSize, "frameSize");
  return {
    application: options.application ?? Application.Audio,
    bitrate: options.bitrate ?? 64_000,
    channels,
    complexity: options.complexity ?? 10,
    dtx: options.dtx ?? false,
    fec: options.fec ?? options.inBandFec ?? false,
    frameSize,
    inBandFec: options.inBandFec ?? options.fec ?? false,
    packetLossPercent: options.packetLossPercent ?? 0,
    sampleRate,
    signal: options.signal ?? Signal.Auto,
  };
}

function normalizeDecoderOptions(options: DecoderOptions): Required<DecoderOptions> {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = options.channels ?? DEFAULT_CHANNELS;
  validateCodecOptions({ channels, sampleRate });
  const maxFrameSize = options.maxFrameSize ?? samplesForDuration(sampleRate, MAX_PACKET_DURATION_MS);
  validateFrameSize(maxFrameSize, "maxFrameSize");
  return { channels, maxFrameSize, sampleRate };
}

function samplesForDuration(sampleRate: SampleRate, durationMs: number): number {
  return (sampleRate / 1000) * durationMs;
}

function validateCodecOptions(options: Required<CodecOptions>): void {
  if (!VALID_SAMPLE_RATES.includes(options.sampleRate)) {
    throw new RangeError("sampleRate must be 8000, 12000, 16000, 24000, or 48000");
  }
  if (options.channels !== 1 && options.channels !== 2) {
    throw new RangeError("channels must be 1 or 2");
  }
}

function validateFrameSize(frameSize: number, name: string): void {
  const maxFrameSize = samplesForDuration(DEFAULT_SAMPLE_RATE, MAX_PACKET_DURATION_MS);
  if (!Number.isInteger(frameSize) || frameSize <= 0 || frameSize > maxFrameSize) {
    throw new RangeError(`${name} must be an integer from 1 to ${maxFrameSize}`);
  }
}

function validateInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${name} must be an integer`);
  }
}

function validatePositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function validateIntegerRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer from ${min} to ${max}`);
  }
}
