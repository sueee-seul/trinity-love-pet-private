import { describe, expect, it } from 'vitest';
import { hanCharactersIn } from '../hanCharactersIn';

const page = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

describe('hanCharactersIn', () => {
  it('finds Chinese in text and in what a screen reader or tooltip reads', () => {
    const root = page(
      '<p>Booking 预约 confirmed</p><button aria-label="切换到中文">×</button><img alt="照片" src="x" />',
    );

    expect(hanCharactersIn(root)).toEqual(['预约', '切换到中文', '照片']);
  });

  it('counts text marked Chinese too, and skips only the names a test allows', () => {
    const root = page('<button lang="zh-Hans">中文</button><p>Pet: 小白</p>');

    expect(hanCharactersIn(root, ['小白'])).toEqual(['中文']);
  });

  it('finds nothing on an English page', () => {
    expect(hanCharactersIn(page('<p>Check-in · NZ$15.00 ✓</p>'))).toEqual([]);
  });
});
