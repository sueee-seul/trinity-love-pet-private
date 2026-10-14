/**
 * Sample-format helpers for streaming microphone audio.
 *
 * The browser hands out 32-bit floats at whatever rate the audio hardware runs (44.1 or 48 kHz);
 * the speech service wants 16-bit integers at 16 kHz. Everything here is pure so it can be checked
 * without an audio context.
 */

export const SPEECH_SAMPLE_RATE_HERTZ = 16_000;

/** Clamps to [-1, 1] and scales to the signed 16-bit range. */
export const floatToInt16 = (value: number): number => {
  const clamped = Math.max(-1, Math.min(1, value));
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
};

/**
 * Reduces the sample rate by averaging each output sample's window of input samples. Averaging is
 * a crude low-pass filter, which is enough for speech: the energy above 8 kHz that aliasing would
 * fold down is already faint in a voice recording.
 */
export const downsampleToPcm16 = (
  samples: Float32Array,
  inputRate: number,
  outputRate: number,
): Int16Array => {
  if (inputRate < outputRate) {
    throw new Error(`Cannot upsample from ${inputRate} Hz to ${outputRate} Hz`);
  }

  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(samples.length / ratio);
  const output = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(samples.length, Math.max(start + 1, Math.floor((index + 1) * ratio)));
    let sum = 0;
    for (let cursor = start; cursor < end; cursor += 1) {
      sum += samples[cursor];
    }
    output[index] = floatToInt16(sum / (end - start));
  }

  return output;
};

export const concatInt16 = (chunks: Int16Array[]): Int16Array => {
  const total = chunks.reduce((length, chunk) => length + chunk.length, 0);
  const merged = new Int16Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
};
