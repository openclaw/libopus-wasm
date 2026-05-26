type LibopusModule = {
  HEAP16: Int16Array;
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
  _oc_destroy_decoder: (decoderPtr: number) => void;
  _oc_destroy_encoder: (encoderPtr: number) => void;
  _oc_encode: (
    encoderPtr: number,
    pcmPtr: number,
    frameSize: number,
    packetPtr: number,
    maxPacketBytes: number,
  ) => number;
  _oc_encoder_ctl_set_bitrate: (encoderPtr: number, bitrate: number) => number;
  _oc_encoder_ctl_set_fec: (encoderPtr: number, enabled: number) => number;
  _oc_encoder_ctl_set_packet_loss_percent: (encoderPtr: number, percentage: number) => number;
  _oc_get_version_string: () => number;
  _oc_strerror: (code: number) => number;
};

export default function createLibopusModule(): Promise<LibopusModule>;
