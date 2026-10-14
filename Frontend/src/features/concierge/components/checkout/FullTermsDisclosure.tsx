import React, { useState } from 'react';
import { conciergeApi } from '../../api/conciergeApi';
import type { ConciergeCopy } from '../../copy';
import { useConciergeLocale } from '../../hooks/useConciergeLocale';
import { termsInChinese } from '../../terms/termsInChinese';
import { ERROR_TEXT, INLINE_TEXT_BUTTON } from '../conciergeStyles';

type TermsState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'ready'; version: string; content: string }
  | { status: 'failed' };

interface FullTermsDisclosureProps {
  copy: ConciergeCopy['details']['fullTerms'];
}

/**
 * Every clause the checkbox agrees to, not only the summary, readable before agreeing. The text is
 * fetched from the server the first time it is opened, so it is always the version checkout
 * records; the parent also gets a copy with the request receipt email. A Chinese reader gets the
 * Chinese translation of that version when there is one, with the English one tap away, because
 * the English is what is agreed to.
 */
export const FullTermsDisclosure: React.FC<FullTermsDisclosureProps> = ({ copy }) => {
  const [terms, setTerms] = useState<TermsState>({ status: 'closed' });
  const { locale } = useConciergeLocale();
  const chinese =
    terms.status === 'ready' && locale === 'zh' ? termsInChinese(terms.version) : null;
  const note = chinese ? copy.translationNote : copy.languageNote;

  const load = async (): Promise<void> => {
    setTerms({ status: 'loading' });
    try {
      const { version, content } = await conciergeApi.terms();
      setTerms({ status: 'ready', version, content });
    } catch {
      setTerms({ status: 'failed' });
    }
  };

  const onToggle = (event: React.SyntheticEvent<HTMLDetailsElement>): void => {
    if (event.currentTarget.open && terms.status === 'closed') void load();
  };

  return (
    <details
      className="rounded-xl border border-border-soft bg-surface-cream/50"
      onToggle={onToggle}
    >
      <summary className="flex min-h-11 cursor-pointer items-center rounded-xl px-4 py-2 type-button text-notice-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus">
        {copy.show}
      </summary>
      <div className="px-4 pb-4">
        {note && <p className="m-0 mb-2 type-meta text-notice-secondary">{note}</p>}
        {terms.status === 'loading' && (
          <p role="status" className="m-0 type-meta text-notice-secondary">
            {copy.loading}
          </p>
        )}
        {terms.status === 'failed' && (
          <p role="alert" className={ERROR_TEXT}>
            {copy.failed}{' '}
            <button type="button" className={INLINE_TEXT_BUTTON} onClick={() => void load()}>
              {copy.retry}
            </button>
          </p>
        )}
        {terms.status === 'ready' && chinese && (
          <>
            <div
              lang="zh-Hans"
              className="max-h-80 overflow-y-auto whitespace-pre-line type-meta text-notice-primary"
              tabIndex={0}
              aria-label={copy.show}
            >
              {chinese}
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer type-meta font-semibold text-accent-foreground">
                {copy.showOriginal}
              </summary>
              <div
                lang="en"
                className="mt-2 max-h-80 overflow-y-auto whitespace-pre-line type-meta text-notice-primary"
                tabIndex={0}
              >
                {terms.content}
              </div>
            </details>
          </>
        )}
        {terms.status === 'ready' && !chinese && (
          <div
            lang="en"
            className="max-h-80 overflow-y-auto whitespace-pre-line type-meta text-notice-primary"
            tabIndex={0}
            aria-label={copy.show}
          >
            {terms.content}
          </div>
        )}
      </div>
    </details>
  );
};
