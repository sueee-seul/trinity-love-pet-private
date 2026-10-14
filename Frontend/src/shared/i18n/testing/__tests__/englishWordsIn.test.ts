import { describe, expect, it } from 'vitest';
import { englishWordsIn } from '../englishWordsIn';

const page = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

describe('englishWordsIn', () => {
  it('finds English in text and in what a screen reader or tooltip reads', () => {
    const root = page(
      '<p>预约 Confirmed</p><button aria-label="Close dialog">×</button><img alt="Photo 1" src="x" />',
    );

    expect(englishWordsIn(root)).toEqual(['Confirmed', 'Close', 'dialog', 'Photo']);
  });

  it('skips text marked English on purpose, emails, brands and allowed names', () => {
    const root = page(
      '<p>Biscuit 的住宿由 Amazon Web Services 处理，联系 team@wagstay.test</p>' +
        '<details><summary>查看原文</summary><p lang="en-NZ">Ate everything.</p></details>' +
        '<button lang="en" aria-label="Switch to English">English</button>',
    );

    expect(englishWordsIn(root, ['Biscuit'])).toEqual([]);
  });
});
