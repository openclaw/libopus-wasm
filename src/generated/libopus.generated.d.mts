type LibopusModule = {
  HEAP32: Int32Array;
  HEAP16: Int16Array;
  HEAPF32: Float32Array;
  HEAPU8: Uint8Array;
  UTF8ToString: (ptr: number) => string;
  _free: (ptr: number) => void;
  _malloc: (size: number) => number;
  _oc_create_decoder: (sampleRate: number, channels: number, errorPtr: number) => number;
  _oc_create_encoder: (
    sampleRate: number,
    channels: number,
    application: number,
    errorPtr: number,
  ) => number;
  _oc_decode: (
    decoderPtr: number,
    packetPtr: number,
    packetLength: number,
    pcmPtr: number,
    frameSize: number,
    decodeFec: number,
  ) => number;
  _oc_decode_float: (
    decoderPtr: number,
    packetPtr: number,
    packetLength: number,
    pcmPtr: number,
    frameSize: number,
    decodeFec: number,
  ) => number;
  _oc_destroy_decoder: (decoderPtr: number) => void;
  _oc_destroy_encoder: (encoderPtr: number) => void;
  _oc_decoder_ctl: (decoderPtr: number, request: number, value: number) => number;
  _oc_encode: (
    encoderPtr: number,
    pcmPtr: number,
    frameSize: number,
    packetPtr: number,
    maxPacketBytes: number,
  ) => number;
  _oc_encode_float: (
    encoderPtr: number,
    pcmPtr: number,
    frameSize: number,
    packetPtr: number,
    maxPacketBytes: number,
  ) => number;
  _oc_encoder_ctl: (encoderPtr: number, request: number, value: number) => number;
  _oc_encoder_ctl_get_bitrate: (encoderPtr: number) => number;
  _oc_encoder_ctl_get_in_dtx: (encoderPtr: number) => number;
  _oc_encoder_ctl_get_lookahead: (encoderPtr: number) => number;
  _oc_get_version_string: () => number;
  _oc_packet_get_bandwidth: (packetPtr: number) => number;
  _oc_packet_get_nb_channels: (packetPtr: number) => number;
  _oc_packet_get_nb_frames: (packetPtr: number, packetLength: number) => number;
  _oc_packet_get_nb_samples: (
    packetPtr: number,
    packetLength: number,
    sampleRate: number,
  ) => number;
  _oc_packet_get_samples_per_frame: (packetPtr: number, sampleRate: number) => number;
  _oc_packet_parse: (packetPtr: number, packetLength: number) => number;
  _oc_packet_validate_decode: (
    packetPtr: number,
    packetLength: number,
    sampleRate: number,
  ) => number;
  _oc_strerror: (code: number) => number;
};

export default function createLibopusModule(): Promise<LibopusModule>;
