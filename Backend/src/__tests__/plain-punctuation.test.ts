import { describe, expect, it } from 'vitest';
import { removeDashes, removeDashesFromEveryString } from '../common/utils/plain-punctuation.js';

// Written as escapes so the characters this helper removes never appear in source.
const EM = '\u2014';
const EN = '\u2013';
const HORIZONTAL_BAR = '\u2015';

describe('removeDashes', () => {
  it.each([
    [`The suite is quiet ${EM} and warm.`, 'The suite is quiet, and warm.'],
    [`The suite is quiet${EM}and warm.`, 'The suite is quiet, and warm.'],
    [`The suite is quiet ${EN} and warm.`, 'The suite is quiet, and warm.'],
    [`"Quiet" ${EM} that is the word.`, '"Quiet", that is the word.'],
  ])('turns a pause into a comma: %s', (text, expected) => {
    expect(removeDashes(text)).toBe(expected);
  });

  it.each([
    [`10${EN}12 Oct`, '10 to 12 Oct'],
    [`from 10 ${EM} 12 October`, 'from 10 to 12 October'],
    [`open 9:00 ${EN} 17:00`, 'open 9:00 to 17:00'],
    [`drop off 8am${EN}10am`, 'drop off 8am to 10am'],
    [`Oct 12 ${EM} Oct 15`, 'Oct 12 to Oct 15'],
    [`Monday${EN}Friday`, 'Monday to Friday'],
  ])('writes a range with "to": %s', (text, expected) => {
    expect(removeDashes(text)).toBe(expected);
  });

  it.each([
    [`A quiet room ${EM}.`, 'A quiet room.'],
    [`Yes, ${EM} of course.`, 'Yes, of course.'],
    [`A note (${EM}for staff).`, 'A note (for staff).'],
    [`Wait for it ${EM}`, 'Wait for it'],
    [`${EM} Walks\n${EM} Grooming`, 'Walks\nGrooming'],
  ])('drops a dash that adds nothing: %s', (text, expected) => {
    expect(removeDashes(text)).toBe(expected);
  });

  it('never leaves double spaces or a doubled comma', () => {
    expect(removeDashes(`a  ${EM}  b`)).toBe('a, b');
    expect(removeDashes(`a ${EM} ${EM} b`)).toBe('a, b');
  });

  it.each([
    [`我们有两种套餐${EM}${EM}舒适和豪华。`, '我们有两种套餐，舒适和豪华。'],
    [
      `我们有两种套餐${HORIZONTAL_BAR}${HORIZONTAL_BAR}舒适和豪华。`,
      '我们有两种套餐，舒适和豪华。',
    ],
    [`Mochi${EM}${EM}很乖。`, 'Mochi，很乖。'],
    [`好的，${EM}我们开始吧。`, '好的，我们开始吧。'],
    [`10月12日${EM}15日`, '10月12日至15日'],
    [`营业时间 9:00${EN}17:00。`, '营业时间 9:00至17:00。'],
  ])('uses Chinese punctuation in Chinese text: %s', (text, expected) => {
    expect(removeDashes(text)).toBe(expected);
  });

  it('leaves hyphens and text without dashes alone', () => {
    const text = 'Drop-off on 2026-10-12, for 3 nights.';

    expect(removeDashes(text)).toBe(text);
  });
});

describe('removeDashesFromEveryString', () => {
  it('cleans every nested string and keeps the shape', () => {
    const stored = {
      summary: `Happy stay ${EM} the dog came home relaxed.`,
      evidence: [{ title: `Walk ${EN} park`, description: `9:00${EN}10:00` }],
      count: 2,
      note: null,
    };

    expect(removeDashesFromEveryString(stored)).toEqual({
      summary: 'Happy stay, the dog came home relaxed.',
      evidence: [{ title: 'Walk, park', description: '9:00 to 10:00' }],
      count: 2,
      note: null,
    });
    expect(stored.summary).toContain(EM);
  });
});
