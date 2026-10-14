import { describe, expect, it } from 'vitest';
import { localizeSyncError } from '../accountCopy';
import { localizeIntakeError, localizeLanguageName } from '../intakeCopy';

/** The server writes these in English; in Chinese none of them may reach the screen as sent. */
describe('profile words from the server, in Chinese', () => {
  it('names any language the intake read in Chinese', () => {
    expect(localizeLanguageName('Russian', 'zh')).toBe('俄语');
    expect(localizeLanguageName('Samoan', 'zh')).toBe('萨摩亚语');
    expect(localizeLanguageName('Mandarin', 'zh')).toBe('普通话');
    expect(localizeLanguageName('Klingon', 'zh')).toBe('你使用的语言');
    expect(localizeLanguageName('Russian', 'en')).toBe('Russian');
  });

  it('words an unknown intake failure with the page sentence', () => {
    expect(localizeIntakeError('Model timed out', 'zh')).toBe('没能读取这段描述。');
    expect(localizeIntakeError('Model timed out', 'en')).toBe('Model timed out');
  });

  it('words an unknown profile failure with a general sentence', () => {
    expect(localizeSyncError('Enter a valid phone number.', 'zh')).toBe('这一步没有完成，请重试。');
    expect(localizeSyncError('Could not add the pet', 'zh')).toBe('宠物没有添加成功');
  });
});
