import { describe, expect, it } from 'vitest';
import { serviceNameText } from '../utils/serviceNames';

describe('serviceNameText', () => {
  it('names a service in Chinese whatever case staff wrote it in', () => {
    expect(serviceNameText('Garden suite', 'zh')).toBe('花园套房');
    expect(serviceNameText('Outdoor Walk', 'zh')).toBe('户外散步');
    expect(serviceNameText(' grooming: bath and brush ', 'zh')).toBe('美容：洗澡和梳毛');
  });

  it('keeps the English name in English, and a service it does not know as written', () => {
    expect(serviceNameText('Garden suite', 'en')).toBe('Garden suite');
    expect(serviceNameText('Cat cuddles', 'zh')).toBe('Cat cuddles');
  });
});
