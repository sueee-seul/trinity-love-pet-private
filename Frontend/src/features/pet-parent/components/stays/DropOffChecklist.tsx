import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { STAYS_COPY } from './staysCopy';

/**
 * The two things a pet cannot stay without, which the desk checks on drop-off day (Code of Welfare
 * for temporary housing of companion animals: vaccination, and a way to get vet care).
 */
export function DropOffChecklist(): ReactElement {
  const copy = usePortalCopy(STAYS_COPY).checklist;
  return (
    <div className="mt-3 rounded-xl bg-surface-cream px-3 py-2.5">
      <p className="m-0 type-meta font-semibold text-notice-primary">{copy.title}</p>
      <ul className="m-0 mt-1 list-disc pl-5 type-meta text-notice-secondary">
        <li>{copy.vaccination}</li>
        <li>{copy.vetConsent}</li>
      </ul>
    </div>
  );
}
