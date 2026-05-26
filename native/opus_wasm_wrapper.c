#include <opus.h>

OpusEncoder *oc_create_encoder(int sample_rate, int channels, int application, int *error) {
  return opus_encoder_create(sample_rate, channels, application, error);
}

void oc_destroy_encoder(OpusEncoder *encoder) {
  opus_encoder_destroy(encoder);
}

int oc_encode(
  OpusEncoder *encoder,
  const opus_int16 *pcm,
  int frame_size,
  unsigned char *data,
  opus_int32 max_data_bytes
) {
  return opus_encode(encoder, pcm, frame_size, data, max_data_bytes);
}

int oc_encode_float(
  OpusEncoder *encoder,
  const float *pcm,
  int frame_size,
  unsigned char *data,
  opus_int32 max_data_bytes
) {
  return opus_encode_float(encoder, pcm, frame_size, data, max_data_bytes);
}

int oc_encoder_ctl(OpusEncoder *encoder, int request, int value) {
  switch (request) {
    case OPUS_SET_APPLICATION_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_APPLICATION(value));
    case OPUS_SET_BITRATE_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_BITRATE(value));
    case OPUS_SET_MAX_BANDWIDTH_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_MAX_BANDWIDTH(value));
    case OPUS_SET_VBR_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_VBR(value));
    case OPUS_SET_BANDWIDTH_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_BANDWIDTH(value));
    case OPUS_SET_COMPLEXITY_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_COMPLEXITY(value));
    case OPUS_SET_INBAND_FEC_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_INBAND_FEC(value));
    case OPUS_SET_PACKET_LOSS_PERC_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_PACKET_LOSS_PERC(value));
    case OPUS_SET_DTX_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_DTX(value));
    case OPUS_SET_VBR_CONSTRAINT_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_VBR_CONSTRAINT(value));
    case OPUS_SET_FORCE_CHANNELS_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_FORCE_CHANNELS(value));
    case OPUS_SET_SIGNAL_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_SIGNAL(value));
    case OPUS_SET_LSB_DEPTH_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_LSB_DEPTH(value));
    case OPUS_SET_EXPERT_FRAME_DURATION_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_EXPERT_FRAME_DURATION(value));
    case OPUS_SET_PREDICTION_DISABLED_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_PREDICTION_DISABLED(value));
    case OPUS_SET_PHASE_INVERSION_DISABLED_REQUEST:
      return opus_encoder_ctl(encoder, OPUS_SET_PHASE_INVERSION_DISABLED(value));
    default:
      return OPUS_UNIMPLEMENTED;
  }
}

int oc_encoder_ctl_get_bitrate(OpusEncoder *encoder) {
  opus_int32 bitrate = 0;
  int error = opus_encoder_ctl(encoder, OPUS_GET_BITRATE(&bitrate));
  if (error != OPUS_OK) {
    return error;
  }
  return bitrate;
}

int oc_encoder_ctl_get_lookahead(OpusEncoder *encoder) {
  int lookahead = 0;
  int error = opus_encoder_ctl(encoder, OPUS_GET_LOOKAHEAD(&lookahead));
  if (error != OPUS_OK) {
    return error;
  }
  return lookahead;
}

int oc_encoder_ctl_get_in_dtx(OpusEncoder *encoder) {
  int in_dtx = 0;
  int error = opus_encoder_ctl(encoder, OPUS_GET_IN_DTX(&in_dtx));
  if (error != OPUS_OK) {
    return error;
  }
  return in_dtx;
}

OpusDecoder *oc_create_decoder(int sample_rate, int channels, int *error) {
  return opus_decoder_create(sample_rate, channels, error);
}

void oc_destroy_decoder(OpusDecoder *decoder) {
  opus_decoder_destroy(decoder);
}

int oc_decode(
  OpusDecoder *decoder,
  const unsigned char *data,
  opus_int32 len,
  opus_int16 *pcm,
  int frame_size,
  int decode_fec
) {
  return opus_decode(decoder, data, len, pcm, frame_size, decode_fec);
}

int oc_decode_float(
  OpusDecoder *decoder,
  const unsigned char *data,
  opus_int32 len,
  float *pcm,
  int frame_size,
  int decode_fec
) {
  return opus_decode_float(decoder, data, len, pcm, frame_size, decode_fec);
}

int oc_packet_get_bandwidth(const unsigned char *data) {
  return opus_packet_get_bandwidth(data);
}

int oc_packet_get_nb_channels(const unsigned char *data) {
  return opus_packet_get_nb_channels(data);
}

int oc_packet_get_nb_frames(const unsigned char *data, opus_int32 len) {
  return opus_packet_get_nb_frames(data, len);
}

int oc_packet_get_nb_samples(const unsigned char *data, opus_int32 len, opus_int32 sample_rate) {
  return opus_packet_get_nb_samples(data, len, sample_rate);
}

int oc_packet_get_samples_per_frame(const unsigned char *data, opus_int32 sample_rate) {
  return opus_packet_get_samples_per_frame(data, sample_rate);
}

int oc_packet_parse(const unsigned char *data, opus_int32 len) {
  unsigned char toc = 0;
  const unsigned char *frames[48] = {0};
  opus_int16 frame_sizes[48] = {0};
  int payload_offset = 0;
  return opus_packet_parse(data, len, &toc, frames, frame_sizes, &payload_offset);
}

int oc_packet_validate_decode(const unsigned char *data, opus_int32 len, opus_int32 sample_rate) {
  int channels = opus_packet_get_nb_channels(data);
  if (channels != 1 && channels != 2) {
    return OPUS_INVALID_PACKET;
  }
  int error = OPUS_OK;
  OpusDecoder *decoder = opus_decoder_create(sample_rate, channels, &error);
  if (error != OPUS_OK || decoder == 0) {
    return error;
  }
  opus_int16 pcm[5760 * 2] = {0};
  int max_frame_size = (sample_rate / 1000) * 120;
  int decoded = opus_decode(decoder, data, len, pcm, max_frame_size, 0);
  opus_decoder_destroy(decoder);
  return decoded;
}

int oc_decoder_ctl(OpusDecoder *decoder, int request, int value) {
  switch (request) {
    case OPUS_SET_GAIN_REQUEST:
      return opus_decoder_ctl(decoder, OPUS_SET_GAIN(value));
    case OPUS_SET_PHASE_INVERSION_DISABLED_REQUEST:
      return opus_decoder_ctl(decoder, OPUS_SET_PHASE_INVERSION_DISABLED(value));
    default:
      return OPUS_UNIMPLEMENTED;
  }
}

const char *oc_strerror(int code) {
  return opus_strerror(code);
}

const char *oc_get_version_string(void) {
  return opus_get_version_string();
}
