/**
 * Test helper for Chinese mode: every Latin word a Chinese reader can see or hear (text, and the
 * aria-label, title, placeholder and alt a screen reader or tooltip reads), so a test can fail on
 * English that slipped through.
 *
 * Text marked as English on purpose (`lang="en…"`, such as a "show original" panel) is skipped.
 * Brand names, units and codes the product keeps in every language are allowed, and each test adds
 * the names in its own fixtures (pets, people). Email addresses are skipped.
 */
// The brand and its boarding-pass monogram, the currency and tax, and named services.
const ALWAYS_ALLOWED = [
  'wagstay',
  'wag',
  'nz',
  'gst',
  'ai',
  'kg',
  'stripe',
  'google',
  'metservice',
  // The key cap a Chinese keyboard carries too.
  'shift',
];

/** Providers the privacy notices must name as they are; matched as whole names only. */
const BRAND_PHRASES = [
  'Amazon Web Services',
  'Amazon Transcribe',
  'Amazon Bedrock',
  'Amazon SES',
  'Anthropic Claude',
];

const LATIN_WORD = /[A-Za-z][A-Za-z'’]+/g;
const EMAIL = /\S+@\S+\.\S+/g;
const READ_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

const isMarkedEnglish = (element: Element | null): boolean =>
  Boolean(element?.closest('[lang^="en"]'));

const wordsOf = (text: string): string[] =>
  BRAND_PHRASES.reduce(
    (rest, brand) => rest.split(brand).join(' '),
    text.replace(EMAIL, ' '),
  ).match(LATIN_WORD) ?? [];

export const englishWordsIn = (root: HTMLElement, allowed: readonly string[] = []): string[] => {
  const allow = new Set([...ALWAYS_ALLOWED, ...allowed.map((word) => word.toLowerCase())]);
  const found: string[] = [];

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || parent.closest('script, style') || isMarkedEnglish(parent)) continue;
    found.push(...wordsOf(node.textContent ?? ''));
  }

  [root, ...Array.from(root.querySelectorAll('*'))].forEach((element) => {
    if (isMarkedEnglish(element)) return;
    READ_ATTRIBUTES.forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (value) found.push(...wordsOf(value));
    });
  });

  return [...new Set(found)].filter((word) => !allow.has(word.toLowerCase()));
};
