import type { ReactElement } from 'react';
import { refusalReasonIn } from '../../../../shared/booking/refusalReasons';
import { usePortalCopy, usePortalLocale, type PortalCopy } from '../../i18n/portalLocale';

interface ManagerReasonCopy {
  /** Stands in for a reason typed in English before the preset reasons existed. */
  notTranslated: string;
  showOriginal: string;
}

const MANAGER_REASON_COPY: PortalCopy<ManagerReasonCopy> = {
  en: { notTranslated: '', showOriginal: '' },
  zh: { notTranslated: '原因是用英文写的。', showOriginal: '查看原文' },
};

interface ManagerReasonTextProps {
  /** The reason as stored: a preset's English sentence, or older words a manager typed. */
  reason: string;
  /** Puts the reason into the page's own sentence, such as "Our manager said: …". */
  sentence: (reason: string) => string;
}

/**
 * Why a manager refused a stay, in the reader's language. A preset reason is translated. Older
 * reasons were typed in English and have no translation, so Chinese says so and keeps the
 * manager's words one tap away, the way booking sites offer "show original" on a review.
 */
export function ManagerReasonText({ reason, sentence }: ManagerReasonTextProps): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(MANAGER_REASON_COPY);
  const translated = refusalReasonIn(reason, locale);

  if (translated !== null) return <>{sentence(translated)}</>;
  return (
    <>
      {sentence(copy.notTranslated)}{' '}
      <details className="inline">
        <summary className="inline cursor-pointer text-accent-foreground underline-offset-4 hover:underline">
          {copy.showOriginal}
        </summary>
        <span lang="en-NZ">{reason}</span>
      </details>
    </>
  );
}
