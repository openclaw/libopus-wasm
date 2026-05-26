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

int oc_encoder_ctl_set_bitrate(OpusEncoder *encoder, int bitrate) {
  return opus_encoder_ctl(encoder, OPUS_SET_BITRATE(bitrate));
}

int oc_encoder_ctl_set_fec(OpusEncoder *encoder, int enabled) {
  return opus_encoder_ctl(encoder, OPUS_SET_INBAND_FEC(enabled));
}

int oc_encoder_ctl_set_packet_loss_percent(OpusEncoder *encoder, int percentage) {
  return opus_encoder_ctl(encoder, OPUS_SET_PACKET_LOSS_PERC(percentage));
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

const char *oc_strerror(int code) {
  return opus_strerror(code);
}

const char *oc_get_version_string(void) {
  return opus_get_version_string();
}
