import type { ReactElement } from 'react';
import { usePortalCopy, type PortalCopy } from '../i18n/portalLocale';
import type { ParentNote } from '../i18n/parentWrittenText';

interface ParentNoteCopy {
  translated: string;
  translating: string;
  untranslated: string;
}

// A Chinese page shows every note as written, so only English needs these words.
const PARENT_NOTE_COPY: PortalCopy<ParentNoteCopy> = {
  en: {
    translated: 'Translated',
    translating: 'Translating…',
    untranslated: 'You wrote this in Chinese. We could not translate it just now.',
  },
  zh: { translated: '', translating: '', untranslated: '' },
};

const TRANSLATED_CHIP =
  'type-meta ml-2 inline-flex items-center rounded-full border border-border-soft bg-surface-card px-2 py-0.5 text-notice-secondary';

/** One note a parent wrote, as `useParentWrittenText` decided to show it. */
export function ParentNoteText({ note }: { note: ParentNote }): ReactElement {
  const copy = usePortalCopy(PARENT_NOTE_COPY);
  if (note.kind === 'as-written') return <>{note.text}</>;
  if (note.kind === 'translating') return <>{copy.translating}</>;
  if (note.kind === 'untranslated') return <>{copy.untranslated}</>;
  return (
    <>
      {note.text}
      <span className={TRANSLATED_CHIP}>{copy.translated}</span>
    </>
  );
}
