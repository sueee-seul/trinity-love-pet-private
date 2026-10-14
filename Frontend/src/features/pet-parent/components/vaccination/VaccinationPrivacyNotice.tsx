import { type ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { VACCINATION_COPY } from './vaccinationCopy';

/**
 * The notice at the point of collection (Privacy Act 2020, IPP 3): what we collect and why, who
 * sees it, where it is kept, what happens without it, and the parent's rights to see and correct
 * it. The file stays on Wagstay's own server and is never given a public link (see
 * Backend/src/services/vaccination.certificate.storage.ts), so no overseas storage is named here.
 *
 * Still missing before launch: Wagstay's address and a privacy contact (IPP 3(1)(d), s201). The
 * owner has not supplied them yet, so no contact is made up here; see Backend/README.md.
 */
export function VaccinationPrivacyNotice({
  petName,
  canChange,
}: {
  petName: string;
  /** Whether the parent can still replace the file on this page (only before drop-off). */
  canChange: boolean;
}): ReactElement {
  const copy = usePortalCopy(VACCINATION_COPY);
  return (
    <aside
      aria-labelledby="vaccination-privacy"
      className="rounded-xl border border-border-soft bg-surface-card p-4"
    >
      <h3 id="vaccination-privacy" className="m-0 type-normal text-body">
        {copy.privacyHeading}
      </h3>
      <ul className="m-0 mt-2 list-disc space-y-1 pl-5 type-meta">
        <li>{copy.privacyCollect(petName)}</li>
        <li>{copy.privacyAccess}</li>
        <li>{copy.privacyWithoutProof(petName)}</li>
        <li>{copy.privacyCorrect(canChange)}</li>
      </ul>
    </aside>
  );
}
