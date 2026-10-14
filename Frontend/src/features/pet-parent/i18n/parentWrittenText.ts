import { useEffect, useMemo, useState } from 'react';
import { request } from '../api/bookingApi';
import { usePortalLocale } from './portalLocale';

/*
 * Notes a parent wrote themselves, on a page in the reader's language. A page in English shows
 * no Chinese, so a note written in Chinese is shown in English, machine-translated and labelled
 * as one: the same rule Live care uses for staff notes on a Chinese page. The parent wrote the
 * original, so it is not offered again. A Chinese page shows every note as written.
 */

/** How one note is shown. */
export type ParentNote =
  | { kind: 'as-written'; text: string }
  | { kind: 'translated'; text: string }
  | { kind: 'translating' }
  | { kind: 'untranslated' };

const CHINESE = /[㐀-鿿豈-﫿]/;
/** What the server takes in one request. */
const NOTES_PER_REQUEST = 12;

/** Translations already asked for, kept for the visit: null means it could not be translated. */
const englishOf = new Map<string, string | null>();

export const hasChinese = (text: string): boolean => CHINESE.test(text);

const askForEnglish = async (notes: string[]): Promise<void> => {
  for (let start = 0; start < notes.length; start += NOTES_PER_REQUEST) {
    const batch = notes.slice(start, start + NOTES_PER_REQUEST);
    try {
      const { translations } = await request<{ translations: (string | null)[] }>(
        '/petparent/translations/english',
        { method: 'POST', body: JSON.stringify({ texts: batch }) },
      );
      batch.forEach((note, index) => englishOf.set(note, translations[index] ?? null));
    } catch {
      batch.forEach((note) => englishOf.set(note, null));
    }
  }
};

/**
 * Reads the given notes in the page's language and returns how to show each one. On an English
 * page the Chinese ones are translated once, together, when the notes first appear.
 */
export function useParentWrittenText(notes: readonly string[]): (note: string) => ParentNote {
  const locale = usePortalLocale();
  // A re-render once the translations arrive; the answers themselves live in `englishOf`.
  const [, setAnswered] = useState(0);
  // The notes are compared by content, so a new array of the same notes asks nothing again.
  const noteKey = notes.join('\u0000');
  const missing = useMemo(
    () =>
      locale === 'en'
        ? [...new Set(noteKey.split('\u0000'))].filter(
            (note) => hasChinese(note) && !englishOf.has(note),
          )
        : [],
    [locale, noteKey],
  );

  useEffect((): (() => void) => {
    let current = true;
    if (missing.length > 0) {
      void askForEnglish(missing).then(() => {
        if (current) setAnswered((count) => count + 1);
      });
    }
    return (): void => {
      current = false;
    };
  }, [missing]);

  return (note: string): ParentNote => {
    if (locale === 'zh' || !hasChinese(note)) return { kind: 'as-written', text: note };
    if (!englishOf.has(note)) return { kind: 'translating' };
    const english = englishOf.get(note);
    return english ? { kind: 'translated', text: english } : { kind: 'untranslated' };
  };
}

/** For tests: forget every translation. */
export const clearParentWrittenText = (): void => englishOf.clear();
