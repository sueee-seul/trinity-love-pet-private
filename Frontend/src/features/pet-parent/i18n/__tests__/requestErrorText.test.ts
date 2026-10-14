import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/apiError';
import { errorCodeOf, requestErrorText } from '../requestErrorText';

const refusal = new ApiError('This stay was cancelled.', 409, {
  error: { code: 'BOOKING_NOT_ACTIVE' },
});
const words = { BOOKING_NOT_ACTIVE: '这次住宿已经取消了。' };

describe('requestErrorText', () => {
  it('reads the code the server put on a refusal', () => {
    expect(errorCodeOf(refusal)).toBe('BOOKING_NOT_ACTIVE');
    expect(errorCodeOf(new Error('offline'))).toBeNull();
  });

  it("shows the server's own words in English", () => {
    expect(requestErrorText(refusal, 'en', 'Please try again.')).toBe('This stay was cancelled.');
  });

  it('words a known refusal in Chinese and anything else with the fallback', () => {
    expect(requestErrorText(refusal, 'zh', '请重试。', words)).toBe('这次住宿已经取消了。');
    expect(requestErrorText(refusal, 'zh', '请重试。')).toBe('请重试。');
  });

  // "Failed to fetch" is the browser's message, not a sentence for a parent.
  it('never shows a network failure as it was thrown', () => {
    const offline = new TypeError('Failed to fetch');

    expect(requestErrorText(offline, 'en', 'Please try again.')).toBe('Please try again.');
    expect(requestErrorText(offline, 'zh', '请重试。')).toBe('请重试。');
  });
});
