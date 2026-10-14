import { describe, expect, it } from 'vitest';
import {
  describeLanguage,
  detectMessageLanguage,
  isBuiltInLanguage,
  parseLanguageTag,
  scriptLanguageOf,
} from '../common/language/detect.js';

describe('detectMessageLanguage', () => {
  it.each([
    ['Korean', '오늘 밥 잘 먹었어요?', 'ko'],
    ['Japanese in kana', 'ごはんはたべましたか', 'ja'],
    ['Japanese with kanji and kana', '今日は元気ですか？', 'ja'],
    ['Chinese', '今天吃饭了吗？', 'zh'],
    ['Thai', 'วันนี้กินข้าวหรือยัง', 'th'],
    ['Arabic', 'هل أكل اليوم؟', 'ar'],
    ['Russian', 'Как дела у Беллы сегодня?', 'ru'],
    ['Hindi', 'क्या उसने आज खाना खाया?', 'hi'],
  ])('reads %s from its script', (_name, text, language) => {
    expect(detectMessageLanguage(text, 'en')).toBe(language);
  });

  it('falls back to the page locale for Latin text', () => {
    expect(detectMessageLanguage('How is Bella today?', 'en')).toBe('en');
    expect(detectMessageLanguage('How is Bella today?', 'zh')).toBe('zh');
    expect(scriptLanguageOf('¿Cómo está Bella hoy?')).toBeNull();
  });

  it('keeps Korean when the message names a pet in Latin letters', () => {
    expect(detectMessageLanguage('Bella 오늘 어때요?', 'en')).toBe('ko');
    expect(detectMessageLanguage('Can Bella and Max have a walk at 3pm? 감사', 'en')).toBe('en');
  });

  it('ignores links, which are Latin in every language', () => {
    expect(detectMessageLanguage('https://example.com/photos/bella-today 사진', 'en')).toBe('ko');
  });

  it('falls back when there are no letters at all', () => {
    expect(detectMessageLanguage('🐶❤️', 'zh')).toBe('zh');
    expect(detectMessageLanguage('10:30?', 'en')).toBe('en');
  });
});

describe('language tags', () => {
  it('marks only English and Chinese as hand-written', () => {
    expect(isBuiltInLanguage('en')).toBe(true);
    expect(isBuiltInLanguage('zh')).toBe(true);
    expect(isBuiltInLanguage('ko')).toBe(false);
  });

  it('accepts primary language tags from a model and nothing else', () => {
    expect(parseLanguageTag(' KO ')).toBe('ko');
    expect(parseLanguageTag('fil')).toBe('fil');
    expect(parseLanguageTag('Korean')).toBeNull();
    expect(parseLanguageTag('pt-BR')).toBeNull();
    expect(parseLanguageTag(null)).toBeNull();
  });

  it('names a language for a prompt', () => {
    expect(describeLanguage('ko')).toBe('Korean (ko)');
  });
});
