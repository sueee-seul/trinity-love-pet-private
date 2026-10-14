import { describe, expect, it } from 'vitest';
import { concatInt16, downsampleToPcm16, floatToInt16 } from '../pcm';

describe('floatToInt16', () => {
  it('scales the unit range to signed 16-bit and clamps outside it', () => {
    expect(floatToInt16(0)).toBe(0);
    expect(floatToInt16(1)).toBe(32767);
    expect(floatToInt16(-1)).toBe(-32768);
    expect(floatToInt16(0.5)).toBe(16384);
    expect(floatToInt16(2)).toBe(32767);
    expect(floatToInt16(-3)).toBe(-32768);
  });
});

describe('downsampleToPcm16', () => {
  it('keeps a constant signal constant while dividing the sample count by the rate ratio', () => {
    const input = new Float32Array(480).fill(0.25);

    const output = downsampleToPcm16(input, 48_000, 16_000);

    expect(output).toHaveLength(160);
    expect(Array.from(output).every((sample) => sample === floatToInt16(0.25))).toBe(true);
  });

  it('averages each window rather than picking one sample', () => {
    // Windows of three: [1, -1, 0] averages to zero; [1, 1, 1] stays at full scale.
    const input = new Float32Array([1, -1, 0, 1, 1, 1]);

    const output = downsampleToPcm16(input, 48_000, 16_000);

    expect(Array.from(output)).toEqual([0, 32767]);
  });

  it('handles a ratio that is not a whole number', () => {
    const input = new Float32Array(441).fill(-0.5);

    const output = downsampleToPcm16(input, 44_100, 16_000);

    expect(output).toHaveLength(160);
    expect(Array.from(output).every((sample) => sample === floatToInt16(-0.5))).toBe(true);
  });

  it('passes samples through at the target rate', () => {
    const output = downsampleToPcm16(new Float32Array([0.1, 0.2]), 16_000, 16_000);

    expect(Array.from(output)).toEqual([floatToInt16(0.1), floatToInt16(0.2)]);
  });

  it('refuses to upsample', () => {
    expect(() => downsampleToPcm16(new Float32Array(10), 8_000, 16_000)).toThrow(/upsample/);
  });
});

describe('concatInt16', () => {
  it('joins chunks in order', () => {
    const merged = concatInt16([new Int16Array([1, 2]), new Int16Array([]), new Int16Array([3])]);

    expect(Array.from(merged)).toEqual([1, 2, 3]);
  });
});
