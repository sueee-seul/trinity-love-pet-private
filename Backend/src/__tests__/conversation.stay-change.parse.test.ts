import { describe, expect, it } from 'vitest';
import {
  isConfirmation,
  isDecline,
  parseDate,
  parseNights,
  parseStayChange,
  parseTime,
} from '../services/conversation.stay-change.parse.js';

/** A Wednesday in New Zealand. */
const TODAY = '2026-10-07';

describe('parseStayChange', () => {
  it.each([
    ['Can I extend the stay by one night?', 'extend', null, 1],
    ['Could Bella stay two more nights please', 'extend', null, 2],
    ['Please keep her another night', 'extend', null, 1],
    ['Can we extend until Friday?', 'extend', '2026-10-09', null],
    ['能不能多住两晚？', 'extend', null, 2],
    ['延长到10月12日', 'extend', '2026-10-12', null],
  ])('reads an extension: %s', (text, intent, date, nights) => {
    expect(parseStayChange(text, TODAY)).toMatchObject({ intent, date, nights });
  });

  it.each([
    ['I need to pick her up early, tomorrow at 10am', '2026-10-08', '10:00'],
    ['Could we do an early pickup on Friday?', '2026-10-09', null],
    ['我想明天下午3点提前接它', '2026-10-08', '15:00'],
    ['Can we check out early on Friday?', '2026-10-09', null],
    ['我想明天提前离店', '2026-10-08', null],
  ])(
    'reads a request to leave early, so the chat can point to the team: %s',
    (text, date, time) => {
      expect(parseStayChange(text, TODAY)).toMatchObject({ intent: 'early_check_out', date, time });
    },
  );

  it.each([
    ['Can I add a walk for Max tomorrow?', 'walk', '2026-10-08'],
    ['Please book her a bath today', 'bath', TODAY],
    ['I would like a grooming session for him', 'grooming', null],
    ['帮她加一次散步', 'walk', null],
    ['明天给他安排洗澡', 'bath', '2026-10-08'],
  ])('reads an add-on: %s', (text, addOn, date) => {
    expect(parseStayChange(text, TODAY)).toMatchObject({ intent: 'add_on', addOn, date });
  });

  it.each([
    ['Can I pick her up at 3pm instead?', null, '15:00'],
    ["I'll collect him on Friday at 11:30", '2026-10-09', '11:30'],
    ['接她的时间改到下午四点半', null, '16:30'],
    ['Can I change check-out to 2pm?', null, '14:00'],
    ['离店时间改到下午三点', null, '15:00'],
  ])('reads a check-out change: %s', (text, date, time) => {
    expect(parseStayChange(text, TODAY)).toMatchObject({ intent: 'pick_up', date, time });
  });

  // The sentences the chat page's quick actions send (inStayChangesCopy.ts) must read as requests.
  it.each([
    ["Can I extend Biscuit's stay by one night?", 'extend'],
    ['Can I add a walk for Biscuit?', 'add_on'],
    ['能不能让Biscuit多住一晚？', 'extend'],
    ['可以给Biscuit加一次散步吗？', 'add_on'],
  ])('reads the chat page quick action: %s', (text, intent) => {
    expect(parseStayChange(text, TODAY)?.intent).toBe(intent);
  });

  it.each([
    "How's Bella today?",
    'Did she have her walk this morning?',
    'What time is pick-up?',
    'Is the pickup at 11am?',
    'She is very friendly with other dogs',
    'Did he eat his breakfast?',
    '她今天吃饭了吗？',
    '我明天可以接受吗',
    '快一点回复我',
  ])('leaves an ordinary message alone: %s', (text) => {
    expect(parseStayChange(text, TODAY)).toBeNull();
  });
});

describe('parseDate', () => {
  it.each([
    ['today', TODAY],
    ['tomorrow', '2026-10-08'],
    ['the day after tomorrow', '2026-10-09'],
    ['on Friday', '2026-10-09'],
    // A weekday named on its own day means next week.
    ['next Wednesday', '2026-10-14'],
    ['16 Oct', '2026-10-16'],
    ['October 16th', '2026-10-16'],
    ['16/10', '2026-10-16'],
    ['3 January', '2027-01-03'],
    ['10月16日', '2026-10-16'],
    ['周五', '2026-10-09'],
    ['2026-10-20', '2026-10-20'],
  ])('%s', (text, expected) => {
    expect(parseDate(text, TODAY)).toBe(expected);
  });

  it('does not read a day out of an ordinary word or the verb "may"', () => {
    expect(parseDate('she is friendly', TODAY)).toBeNull();
    expect(parseDate('she sat in the sun', TODAY)).toBeNull();
    expect(parseDate('we may 2 more nights', TODAY)).toBeNull();
  });
});

describe('parseTime', () => {
  it.each([
    ['at 3pm', '15:00'],
    ['3:30 pm', '15:30'],
    ['12am', '00:00'],
    ['15:45', '15:45'],
    ['noon', '12:00'],
    ['下午3点', '15:00'],
    ['三点半', '03:30'],
    ['晚上七点', '19:00'],
  ])('%s', (text, expected) => {
    expect(parseTime(text)).toBe(expected);
  });

  it('does not read "a little" as one o\'clock', () => {
    expect(parseTime('早一点接她')).toBeNull();
  });
});

describe('parseNights', () => {
  it('reads English and Chinese counts', () => {
    expect(parseNights('three more nights')).toBe(3);
    expect(parseNights('another night')).toBe(1);
    expect(parseNights('多住3晚')).toBe(3);
    expect(parseNights('no count here')).toBeNull();
  });
});

describe('confirmation words', () => {
  it.each(['yes', 'Yes please', 'Confirm', 'ok', 'go ahead', '好的', '确认', '可以！'])(
    'reads "%s" as a yes',
    (text) => {
      expect(isConfirmation(text)).toBe(true);
    },
  );

  it.each(['yes, but can you also send a photo?', 'what does it cost?', '好的，那费用呢'])(
    'does not read "%s" as a plain yes',
    (text) => {
      expect(isConfirmation(text)).toBe(false);
    },
  );

  it.each(['no', 'Cancel', 'never mind', '不用了', '取消'])('reads "%s" as a no', (text) => {
    expect(isDecline(text)).toBe(true);
  });
});
