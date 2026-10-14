import { useId, type ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { VaccinationDetail } from '../../types/vaccination';
import { formatDay } from '../../utils/home';
import { HomeIcon } from '../home/HomeIcons';
import { SECTION_ACTION, SECTION_EYEBROW, STATUS_PILL, STATUS_TONE } from '../home/homeStyles';
import { CERTIFICATE_ACCEPT, formatFileSize, type CertificateProblem } from './certificateFile';
import { VACCINATION_COPY } from './vaccinationCopy';

interface CertificateUploadProps {
  petName: string;
  /** The file chosen on this visit, not yet saved. */
  file: File | null;
  fileProblem: CertificateProblem | null;
  /** The certificate already on file for this stay, if there is one. */
  current: VaccinationDetail['certificate'];
  onPick: (file: File | null) => void;
  onRemove: () => void;
}

/** The Yes answer: the required certificate, chosen from the parent's device. */
export function CertificateUpload({
  petName,
  file,
  fileProblem,
  current,
  onPick,
  onRemove,
}: CertificateUploadProps): ReactElement {
  const inputId = useId();
  const copy = usePortalCopy(VACCINATION_COPY);
  const locale = usePortalLocale();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 type-normal text-body">{copy.certificateHeading}</h3>
          <span className={`${STATUS_PILL} ${STATUS_TONE.attention}`}>{copy.required}</span>
        </div>
        <p className="m-0 mt-1 type-meta">{copy.uploadPrompt(petName)}</p>
        {current && !file && (
          <p className="m-0 mt-2 type-body text-notice-secondary">
            {copy.currentCertificate(
              current.uploadedAt ? formatDay(current.uploadedAt, locale) : null,
            )}
          </p>
        )}
      </div>

      <div>
        {/*
         * Visually hidden rather than display:none, so Tab still reaches the file picker; the
         * zone or the chosen-file row after it draws the focus ring through `peer`.
         */}
        <input
          id={inputId}
          type="file"
          accept={CERTIFICATE_ACCEPT}
          className="peer sr-only"
          onChange={(event) => {
            onPick(event.target.files?.[0] ?? null);
            // Cleared so choosing the same file again after Remove still fires a change.
            event.target.value = '';
          }}
        />
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-control-border bg-surface-card px-4 py-3 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-success/10 text-status-success">
              <HomeIcon name="check" className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate type-body font-semibold">{file.name}</span>
              <span className="block type-meta">{formatFileSize(file.size)}</span>
            </span>
            <label htmlFor={inputId} className={`${SECTION_ACTION} cursor-pointer`}>
              {copy.replace}
            </label>
            <button type="button" onClick={onRemove} className={SECTION_ACTION}>
              {copy.remove}
            </button>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-control-border bg-surface-card p-4 text-center transition-colors hover:border-action-dark peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-bubbles text-accent-foreground">
              <HomeIcon name="upload" className="h-5 w-5" />
            </span>
            <span className="type-button text-accent-foreground">
              {current ? copy.uploadNew : copy.upload}
            </span>
            <span className="type-meta">{copy.formatsLabel}</span>
          </label>
        )}
        <p className="m-0 mt-2 type-meta">{copy.formatsHelp}</p>
        {fileProblem && (
          <p role="alert" className="m-0 mt-2 type-meta font-semibold text-status-danger">
            {copy.fileProblem[fileProblem]}
          </p>
        )}
      </div>

      <div>
        <p className={`m-0 ${SECTION_EYEBROW}`}>{copy.mustShowHeading}</p>
        <ul className="m-0 mt-3 grid list-none gap-3 p-0 md:grid-cols-3">
          {copy.mustShow(petName).map(({ title, source }) => (
            <li key={title} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-bubbles text-accent-foreground">
                <HomeIcon name="check" className="h-3 w-3" />
              </span>
              <span>
                <span className="block type-normal text-body">{title}</span>
                <span className="block type-meta">{source}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-3 type-meta">{copy.staffCheck(petName)}</p>
      </div>
    </div>
  );
}
