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

export const Bitrate = {
  Auto: -1000,
  Max: -1,
} as const;

export const Bandwidth = {
  Narrowband: 1101,
  Mediumband: 1102,
  Wideband: 1103,
  Superwideband: 1104,
  Fullband: 1105,
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
export type Bitrate = number | "auto" | "max";
export type Bandwidth = (typeof Bandwidth)[keyof typeof Bandwidth];
export type SampleRate = 8000 | 12000 | 16000 | 24000 | 48000;
export type ChannelCount = 1 | 2;

export type CodecOptions = {
  channels?: ChannelCount;
  sampleRate?: SampleRate;
};

export type EncoderOptions = CodecOptions & {
  application?: Application;
  bitrate?: Bitrate;
  complexity?: number;
  dtx?: boolean;
  fec?: boolean;
  frameSize?: number;
  maxBandwidth?: Bandwidth;
  packetLossPercent?: number;
  signal?: Signal;
  vbr?: boolean;
  vbrConstraint?: boolean;
};

export type DecoderOptions = CodecOptions & {
  maxFrameSize?: number;
};

export type DecodeOptions = {
  decodeFec?: boolean;
  frameSize?: number;
  maxFrameSize?: number;
};

export type EncodeOptions = {
  frameSize?: number;
  maxPacketBytes?: number;
};

export type OpusEncoderHandle = {
  readonly application: Application;
  readonly channels: ChannelCount;
  readonly frameSize: number;
  readonly sampleRate: SampleRate;
  encode(pcm: Int16Array | Uint8Array, options?: EncodeOptions): Uint8Array;
  encodeFloat(pcm: Float32Array, options?: EncodeOptions): Uint8Array;
  encodeFrames(frames: readonly (Int16Array | Uint8Array)[], options?: EncodeOptions): Uint8Array[];
  encodeFloatFrames(frames: readonly Float32Array[], options?: EncodeOptions): Uint8Array[];
  encoderCtl(request: number, value: number): void;
  free(): void;
  getBitrate(): number;
  getInDtx(): boolean;
  getLookahead(): number;
  setBitrate(bitrate: Bitrate): void;
  setComplexity(complexity: number): void;
  setDtx(enabled: boolean): void;
  setFec(enabled: boolean): void;
  setMaxBandwidth(bandwidth: Bandwidth): void;
  setPacketLossPercent(percentage: number): void;
  setSignal(signal: Signal): void;
  setVbr(enabled: boolean): void;
  setVbrConstraint(enabled: boolean): void;
  [Symbol.dispose](): void;
};

export type OpusDecoderHandle = {
  readonly channels: ChannelCount;
  readonly maxFrameSize: number;
  readonly sampleRate: SampleRate;
  decode(packet: Uint8Array | null, options?: DecodeOptions): Int16Array;
  decodeFloat(packet: Uint8Array | null, options?: DecodeOptions): Float32Array;
  decodeFrames(packets: readonly (Uint8Array | null)[], options?: DecodeOptions): Int16Array[];
  decodeFloatFrames(packets: readonly (Uint8Array | null)[], options?: DecodeOptions): Float32Array[];
  decodePacketLoss(frameSize?: number): Int16Array;
  decodePacketLossFloat(frameSize?: number): Float32Array;
  decoderCtl(request: number, value: number): void;
  free(): void;
  [Symbol.dispose](): void;
};

const DEFAULT_CHANNELS = 2 satisfies ChannelCount;
const DEFAULT_FRAME_DURATION_MS = 20;
const MAX_PACKET_DURATION_MS = 120;
const DEFAULT_MAX_PACKET_BYTES = 4000;
const DEFAULT_SAMPLE_RATE = 48_000 satisfies SampleRate;
const DECODER_INTEGER_CTL_REQUESTS = new Set<number>(Object.values(DecoderCtl));
const ENCODER_INTEGER_CTL_REQUESTS = new Set<number>(Object.values(EncoderCtl));
const ENCODE_FRAME_DURATIONS_MS = [2.5, 5, 10, 20, 40, 60] as const;
const VALID_SAMPLE_RATES: readonly SampleRate[] = [8000, 12000, 16000, 24000, 48000];

type LibopusModule = Awaited<ReturnType<typeof createLibopusModule>>;
type NormalizedEncoderOptions = {
  application: Application;
  bitrate: number;
  channels: ChannelCount;
  complexity: number;
  dtx: boolean;
  fec: boolean;
  frameSize: number;
  maxBandwidth: Bandwidth | undefined;
  packetLossPercent: number;
  sampleRate: SampleRate;
  signal: Signal;
  vbr: boolean | undefined;
  vbrConstraint: boolean | undefined;
};

type NormalizedDecoderOptions = {
  channels: ChannelCount;
  maxFrameSize: number;
  sampleRate: SampleRate;
};

let modulePromise: Promise<LibopusModule> | undefined;

export async function loadLibopus(): Promise<{
  version: string;
}> {
  const module = await getModule();
  return { version: module.UTF8ToString(module._oc_get_version_string()) };
}

export async function createEncoder(options: EncoderOptions = {}): Promise<OpusEncoderHandle> {
  const module = await getModule();
  return new WasmOpusEncoder(module, normalizeEncoderOptions(options));
}

export async function createDecoder(options: DecoderOptions = {}): Promise<OpusDecoderHandle> {
  const module = await getModule();
  return new WasmOpusDecoder(module, normalizeDecoderOptions(options));
}

class WasmOpusEncoder implements OpusEncoderHandle {
  readonly application: Application;
  readonly channels: ChannelCount;
  readonly frameSize: number;
  readonly sampleRate: SampleRate;
  #freed = false;
  #module: LibopusModule;
  #packetBytes = 0;
  #packetPtr = 0;
  #pcmBytes = 0;
  #pcmPtr = 0;
  #ptr: number;

  constructor(module: LibopusModule, options: NormalizedEncoderOptions) {
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
    this.setFec(options.fec);
    if (options.maxBandwidth !== undefined) {
      this.setMaxBandwidth(options.maxBandwidth);
    }
    this.setPacketLossPercent(options.packetLossPercent);
    this.setSignal(options.signal);
    if (options.vbr !== undefined) {
      this.setVbr(options.vbr);
    }
    if (options.vbrConstraint !== undefined) {
      this.setVbrConstraint(options.vbrConstraint);
    }
  }

  encode(pcm: Int16Array | Uint8Array, options: EncodeOptions = {}): Uint8Array {
    this.#assertLive();
    const frameSize = options.frameSize ?? this.frameSize;
    validateEncodeFrameSize(frameSize, this.sampleRate, "frameSize");
    const pcmBytes = toUint8Array(pcm);
    const expectedBytes = frameSize * this.channels * 2;
    if (pcmBytes.byteLength !== expectedBytes) {
      throw new RangeError(
        `PCM frame has ${pcmBytes.byteLength} bytes; expected ${expectedBytes} for ${frameSize} samples and ${this.channels} channel(s)`,
      );
    }
    const maxPacketBytes = options.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES;
    validatePositiveInteger(maxPacketBytes, "maxPacketBytes");
    const pcmPtr = this.#ensurePcmBytes(pcmBytes.byteLength);
    const packetPtr = this.#ensurePacketBytes(maxPacketBytes);
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
  }

  encodeFloat(pcm: Float32Array, options: EncodeOptions = {}): Uint8Array {
    this.#assertLive();
    const frameSize = options.frameSize ?? this.frameSize;
    validateEncodeFrameSize(frameSize, this.sampleRate, "frameSize");
    const expectedSamples = frameSize * this.channels;
    if (pcm.length !== expectedSamples) {
      throw new RangeError(
        `Float32 PCM frame has ${pcm.length} samples; expected ${expectedSamples} for ${frameSize} samples and ${this.channels} channel(s)`,
      );
    }
    const maxPacketBytes = options.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES;
    validatePositiveInteger(maxPacketBytes, "maxPacketBytes");
    const pcmPtr = this.#ensurePcmBytes(pcm.byteLength);
    const packetPtr = this.#ensurePacketBytes(maxPacketBytes);
    this.#module.HEAPF32.set(pcm, pcmPtr >> 2);
    const encodedBytes = this.#module._oc_encode_float(
      this.#ptr,
      pcmPtr,
      frameSize,
      packetPtr,
      maxPacketBytes,
    );
    if (encodedBytes < 0) {
      throw createOpusError(this.#module, encodedBytes, "encodeFloat");
    }
    return this.#module.HEAPU8.slice(packetPtr, packetPtr + encodedBytes);
  }

  encodeFrames(frames: readonly (Int16Array | Uint8Array)[], options: EncodeOptions = {}): Uint8Array[] {
    return frames.map((frame) => this.encode(frame, options));
  }

  encodeFloatFrames(frames: readonly Float32Array[], options: EncodeOptions = {}): Uint8Array[] {
    return frames.map((frame) => this.encodeFloat(frame, options));
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

  setBitrate(bitrate: Bitrate): void {
    this.encoderCtl(EncoderCtl.SetBitrate, normalizeBitrate(bitrate));
  }

  getBitrate(): number {
    this.#assertLive();
    const bitrate = this.#module._oc_encoder_ctl_get_bitrate(this.#ptr);
    if (bitrate < 0) {
      throw createOpusError(this.#module, bitrate, "getBitrate");
    }
    return bitrate;
  }

  getLookahead(): number {
    this.#assertLive();
    const lookahead = this.#module._oc_encoder_ctl_get_lookahead(this.#ptr);
    if (lookahead < 0) {
      throw createOpusError(this.#module, lookahead, "getLookahead");
    }
    return lookahead;
  }

  getInDtx(): boolean {
    this.#assertLive();
    const inDtx = this.#module._oc_encoder_ctl_get_in_dtx(this.#ptr);
    if (inDtx < 0) {
      throw createOpusError(this.#module, inDtx, "getInDtx");
    }
    return inDtx !== 0;
  }

  setComplexity(complexity: number): void {
    validateIntegerRange(complexity, 0, 10, "complexity");
    this.encoderCtl(EncoderCtl.SetComplexity, complexity);
  }

  setDtx(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetDtx, enabled ? 1 : 0);
  }

  setFec(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetInBandFec, enabled ? 1 : 0);
  }

  setMaxBandwidth(bandwidth: Bandwidth): void {
    validateBandwidth(bandwidth, "maxBandwidth");
    this.encoderCtl(EncoderCtl.SetMaxBandwidth, bandwidth);
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

  setVbr(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetVbr, enabled ? 1 : 0);
  }

  setVbrConstraint(enabled: boolean): void {
    this.encoderCtl(EncoderCtl.SetVbrConstraint, enabled ? 1 : 0);
  }

  free(): void {
    if (this.#freed) {
      return;
    }
    this.#freeScratch();
    this.#module._oc_destroy_encoder(this.#ptr);
    this.#freed = true;
  }

  [Symbol.dispose](): void {
    this.free();
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

  #ensurePacketBytes(requiredBytes: number): number {
    if (this.#packetPtr !== 0 && this.#packetBytes >= requiredBytes) {
      return this.#packetPtr;
    }
    const nextPtr = checkedMalloc(this.#module, requiredBytes);
    if (this.#packetPtr !== 0) {
      this.#module._free(this.#packetPtr);
    }
    this.#packetPtr = nextPtr;
    this.#packetBytes = requiredBytes;
    return this.#packetPtr;
  }

  #ensurePcmBytes(requiredBytes: number): number {
    if (this.#pcmPtr !== 0 && this.#pcmBytes >= requiredBytes) {
      return this.#pcmPtr;
    }
    const nextPtr = checkedMalloc(this.#module, requiredBytes);
    if (this.#pcmPtr !== 0) {
      this.#module._free(this.#pcmPtr);
    }
    this.#pcmPtr = nextPtr;
    this.#pcmBytes = requiredBytes;
    return this.#pcmPtr;
  }

  #freeScratch(): void {
    if (this.#packetPtr !== 0) {
      this.#module._free(this.#packetPtr);
    }
    if (this.#pcmPtr !== 0) {
      this.#module._free(this.#pcmPtr);
    }
    this.#packetPtr = 0;
    this.#packetBytes = 0;
    this.#pcmPtr = 0;
    this.#pcmBytes = 0;
  }
}

class WasmOpusDecoder implements OpusDecoderHandle {
  readonly channels: ChannelCount;
  readonly maxFrameSize: number;
  readonly sampleRate: SampleRate;
  #freed = false;
  #module: LibopusModule;
  #packetBytes = 0;
  #packetPtr = 0;
  #pcmBytes = 0;
  #pcmPtr = 0;
  #ptr: number;

  constructor(module: LibopusModule, options: NormalizedDecoderOptions) {
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

  decode(packet: Uint8Array | null, options: DecodeOptions = {}): Int16Array {
    this.#assertLive();
    const frameSize = this.#resolveDecodeFrameSize(packet, options);
    const pcmBytes = frameSize * this.channels * 2;
    const pcmPtr = this.#ensurePcmBytes(pcmBytes);
    const { packetLength, packetPtr } = this.#copyPacket(packet, options.decodeFec);
    const decodedSamples = this.#module._oc_decode(
      this.#ptr,
      packetPtr,
      packetLength,
      pcmPtr,
      frameSize,
      options.decodeFec ? 1 : 0,
    );
    if (decodedSamples < 0) {
      throw createOpusError(this.#module, decodedSamples, packet === null ? "decodePacketLoss" : "decode");
    }
    const sampleCount = decodedSamples * this.channels;
    return this.#module.HEAP16.slice(pcmPtr >> 1, (pcmPtr >> 1) + sampleCount);
  }

  decodeFloat(packet: Uint8Array | null, options: DecodeOptions = {}): Float32Array {
    this.#assertLive();
    const frameSize = this.#resolveDecodeFrameSize(packet, options);
    const pcmBytes = frameSize * this.channels * 4;
    const pcmPtr = this.#ensurePcmBytes(pcmBytes);
    const { packetLength, packetPtr } = this.#copyPacket(packet, options.decodeFec);
    const decodedSamples = this.#module._oc_decode_float(
      this.#ptr,
      packetPtr,
      packetLength,
      pcmPtr,
      frameSize,
      options.decodeFec ? 1 : 0,
    );
    if (decodedSamples < 0) {
      throw createOpusError(
        this.#module,
        decodedSamples,
        packet === null ? "decodePacketLossFloat" : "decodeFloat",
      );
    }
    const sampleCount = decodedSamples * this.channels;
    return this.#module.HEAPF32.slice(pcmPtr >> 2, (pcmPtr >> 2) + sampleCount);
  }

  decodeFrames(packets: readonly (Uint8Array | null)[], options: DecodeOptions = {}): Int16Array[] {
    return packets.map((packet) => this.decode(packet, options));
  }

  decodeFloatFrames(packets: readonly (Uint8Array | null)[], options: DecodeOptions = {}): Float32Array[] {
    return packets.map((packet) => this.decodeFloat(packet, options));
  }

  decodePacketLoss(frameSize = samplesForDuration(this.sampleRate, DEFAULT_FRAME_DURATION_MS)): Int16Array {
    return this.decode(null, { frameSize });
  }

  decodePacketLossFloat(frameSize = samplesForDuration(this.sampleRate, DEFAULT_FRAME_DURATION_MS)): Float32Array {
    return this.decodeFloat(null, { frameSize });
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
    this.#freeScratch();
    this.#module._oc_destroy_decoder(this.#ptr);
    this.#freed = true;
  }

  [Symbol.dispose](): void {
    this.free();
  }

  #assertLive(): void {
    if (this.#freed) {
      throw new Error("OpusDecoder has been freed");
    }
  }

  #copyPacket(packet: Uint8Array | null, decodeFec: boolean | undefined): { packetLength: number; packetPtr: number } {
    if (packet === null) {
      if (decodeFec) {
        throw new RangeError("decodeFec requires a packet");
      }
      return { packetLength: 0, packetPtr: 0 };
    }
    if (packet.byteLength === 0) {
      throw new RangeError("packet must not be empty; use null or decodePacketLoss() for PLC");
    }
    const packetPtr = this.#ensurePacketBytes(packet.byteLength);
    this.#module.HEAPU8.set(packet, packetPtr);
    return { packetLength: packet.byteLength, packetPtr };
  }

  #ensurePacketBytes(requiredBytes: number): number {
    if (this.#packetPtr !== 0 && this.#packetBytes >= requiredBytes) {
      return this.#packetPtr;
    }
    const nextPtr = checkedMalloc(this.#module, requiredBytes);
    if (this.#packetPtr !== 0) {
      this.#module._free(this.#packetPtr);
    }
    this.#packetPtr = nextPtr;
    this.#packetBytes = requiredBytes;
    return this.#packetPtr;
  }

  #ensurePcmBytes(requiredBytes: number): number {
    if (this.#pcmPtr !== 0 && this.#pcmBytes >= requiredBytes) {
      return this.#pcmPtr;
    }
    const nextPtr = checkedMalloc(this.#module, requiredBytes);
    if (this.#pcmPtr !== 0) {
      this.#module._free(this.#pcmPtr);
    }
    this.#pcmPtr = nextPtr;
    this.#pcmBytes = requiredBytes;
    return this.#pcmPtr;
  }

  #freeScratch(): void {
    if (this.#packetPtr !== 0) {
      this.#module._free(this.#packetPtr);
    }
    if (this.#pcmPtr !== 0) {
      this.#module._free(this.#pcmPtr);
    }
    this.#packetPtr = 0;
    this.#packetBytes = 0;
    this.#pcmPtr = 0;
    this.#pcmBytes = 0;
  }

  #resolveDecodeFrameSize(packet: Uint8Array | null, options: DecodeOptions): number {
    const frameSize = packet === null || options.decodeFec
      ? (options.frameSize ?? options.maxFrameSize ?? samplesForDuration(this.sampleRate, DEFAULT_FRAME_DURATION_MS))
      : (options.maxFrameSize ?? this.maxFrameSize);
    if (packet === null || options.decodeFec) {
      validatePlcFrameSize(frameSize, this.sampleRate, "frameSize");
      return frameSize;
    }
    validateDecodeCapacity(frameSize, this.sampleRate, "maxFrameSize");
    return frameSize;
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

function normalizeEncoderOptions(options: EncoderOptions): NormalizedEncoderOptions {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = options.channels ?? DEFAULT_CHANNELS;
  validateCodecOptions({ channels, sampleRate });
  const frameSize = options.frameSize ?? samplesForDuration(sampleRate, DEFAULT_FRAME_DURATION_MS);
  validateEncodeFrameSize(frameSize, sampleRate, "frameSize");
  if (options.maxBandwidth !== undefined) {
    validateBandwidth(options.maxBandwidth, "maxBandwidth");
  }
  return {
    application: options.application ?? Application.Audio,
    bitrate: normalizeBitrate(options.bitrate ?? 64_000),
    channels,
    complexity: options.complexity ?? 10,
    dtx: options.dtx ?? false,
    fec: options.fec ?? false,
    frameSize,
    maxBandwidth: options.maxBandwidth,
    packetLossPercent: options.packetLossPercent ?? 0,
    sampleRate,
    signal: options.signal ?? Signal.Auto,
    vbr: options.vbr,
    vbrConstraint: options.vbrConstraint,
  };
}

function normalizeDecoderOptions(options: DecoderOptions): NormalizedDecoderOptions {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const channels = options.channels ?? DEFAULT_CHANNELS;
  validateCodecOptions({ channels, sampleRate });
  const maxFrameSize = options.maxFrameSize ?? samplesForDuration(sampleRate, MAX_PACKET_DURATION_MS);
  validateDecodeCapacity(maxFrameSize, sampleRate, "maxFrameSize");
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

function normalizeBitrate(bitrate: Bitrate): number {
  if (bitrate === "auto") {
    return Bitrate.Auto;
  }
  if (bitrate === "max") {
    return Bitrate.Max;
  }
  if (bitrate === Bitrate.Auto || bitrate === Bitrate.Max) {
    return bitrate;
  }
  validatePositiveInteger(bitrate, "bitrate");
  return bitrate;
}

function validateBandwidth(bandwidth: Bandwidth, name: string): void {
  if (!Object.values(Bandwidth).includes(bandwidth)) {
    throw new RangeError(
      `${name} must be Bandwidth.Narrowband, Bandwidth.Mediumband, Bandwidth.Wideband, Bandwidth.Superwideband, or Bandwidth.Fullband`,
    );
  }
}

function validateEncodeFrameSize(frameSize: number, sampleRate: SampleRate, name: string): void {
  validateFrameSizeForDurations(frameSize, sampleRate, name, ENCODE_FRAME_DURATIONS_MS);
}

function validateDecodeCapacity(frameSize: number, sampleRate: SampleRate, name: string): void {
  const maxFrameSize = samplesForDuration(sampleRate, MAX_PACKET_DURATION_MS);
  if (!Number.isInteger(frameSize) || frameSize <= 0 || frameSize > maxFrameSize) {
    throw new RangeError(`${name} must be an integer from 1 to ${maxFrameSize} samples at ${sampleRate} Hz`);
  }
}

function validatePlcFrameSize(frameSize: number, sampleRate: SampleRate, name: string): void {
  const minFrameSize = samplesForDuration(sampleRate, 2.5);
  const maxFrameSize = samplesForDuration(sampleRate, MAX_PACKET_DURATION_MS);
  if (
    !Number.isInteger(frameSize) ||
    frameSize < minFrameSize ||
    frameSize > maxFrameSize ||
    frameSize % minFrameSize !== 0
  ) {
    throw new RangeError(
      `${name} must be a multiple of ${minFrameSize} samples from ${minFrameSize} to ${maxFrameSize} at ${sampleRate} Hz`,
    );
  }
}

function validateFrameSizeForDurations(
  frameSize: number,
  sampleRate: SampleRate,
  name: string,
  durationsMs: readonly number[],
): void {
  const validFrameSizes = durationsMs.map((durationMs) => samplesForDuration(sampleRate, durationMs));
  if (!Number.isInteger(frameSize) || !validFrameSizes.includes(frameSize)) {
    throw new RangeError(`${name} must be one of ${validFrameSizes.join(", ")} samples at ${sampleRate} Hz`);
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

function checkedMalloc(module: LibopusModule, bytes: number): number {
  const ptr = module._malloc(bytes);
  if (ptr === 0) {
    throw new Error(`WASM malloc failed for ${bytes} bytes`);
  }
  return ptr;
}
