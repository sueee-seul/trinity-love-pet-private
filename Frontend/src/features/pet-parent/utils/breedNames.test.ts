import { describe, expect, it } from 'vitest';
import { breedText } from './breedNames';

// A page never mixes its languages, even in a breed the parent typed.
describe('breedText', () => {
  it('names a known breed in the page language, whichever language it was typed in', () => {
    expect(breedText('Domestic Shorthair', 'zh', '猫')).toBe('家养短毛猫');
    expect(breedText('labrador  retriever', 'zh', '狗')).toBe('拉布拉多寻回犬');
    expect(breedText('金毛寻回犬', 'en', 'Dog')).toBe('Golden Retriever');
  });

  it('keeps a breed already in the page language as typed', () => {
    expect(breedText('Lab cross', 'en', 'Dog')).toBe('Lab cross');
    expect(breedText('中华田园犬', 'zh', '狗')).toBe('中华田园犬');
  });

  it('falls back to the species for an unknown breed in the other language, or none', () => {
    expect(breedText('Lab cross', 'zh', '狗')).toBe('狗');
    expect(breedText('中华田园犬', 'en', 'Dog')).toBe('Dog');
    expect(breedText(null, 'en', 'Cat')).toBe('Cat');
  });
});
