/**
 * Test helper for English mode, the mirror of englishWordsIn: every run of Chinese (Han)
 * characters a reader can see or hear (text, and the aria-label, title, placeholder and alt a
 * screen reader or tooltip reads). The owner's rule is that no Chinese character shows anywhere on
 * the parent pages or /book in English mode, so nothing is skipped: not even text marked
 * `lang="zh"`, such as a language switch that used to name Chinese in Chinese.
 *
 * Each test adds the names in its own fixtures that are written in Chinese (pets, people).
 */
const HAN_RUN = /\p{Script=Han}+/gu;
const READ_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

const runsOf = (text: string): string[] => text.match(HAN_RUN) ?? [];

export const hanCharactersIn = (root: HTMLElement, allowed: readonly string[] = []): string[] => {
  const allow = new Set(allowed);
  const found: string[] = [];

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style')) continue;
    found.push(...runsOf(node.textContent ?? ''));
  }

  [root, ...Array.from(root.querySelectorAll('*'))].forEach((element) => {
    READ_ATTRIBUTES.forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) found.push(...runsOf(value));
    });
  });

  return [...new Set(found)].filter((run) => !allow.has(run));
};
