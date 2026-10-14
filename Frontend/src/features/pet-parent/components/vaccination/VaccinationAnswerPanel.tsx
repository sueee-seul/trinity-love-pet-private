import { type ReactElement } from 'react';
import { vaccinationCertificateUrl } from '../../api/vaccinationApi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { VaccinationDetail } from '../../types/vaccination';
import { formatDay } from '../../utils/home';
import {
  INNER_PANEL,
  PRIMARY_BUTTON,
  SECTION_ACTION,
  SECTION_TITLE,
  STATUS_PILL,
  STATUS_TONE,
} from '../home/homeStyles';
import { CertificateUpload } from './CertificateUpload';
import { type AnswerChoice, useVaccinationAnswer } from './useVaccinationAnswer';
import { SeparateHousingNotice } from './VaccinationSections';
import { VaccinationPrivacyNotice } from './VaccinationPrivacyNotice';
import { VACCINATION_COPY } from './vaccinationCopy';

// Yes first, the order the question reads in every language.
const CHOICES: readonly AnswerChoice[] = ['yes', 'no'];

interface VaccinationAnswerPanelProps {
  detail: VaccinationDetail;
  onSaved: (detail: VaccinationDetail) => void;
}

/** Where this stay's proof stands, and the one way to give it: answer, upload, Save. */
export function VaccinationAnswerPanel({
  detail,
  onSaved,
}: VaccinationAnswerPanelProps): ReactElement {
  const copy = usePortalCopy(VACCINATION_COPY);
  return (
    <section aria-labelledby="vaccination-proof" className={`${INNER_PANEL} flex flex-col gap-6`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="vaccination-proof" className={`m-0 ${SECTION_TITLE}`}>
            {copy.proofHeading}
          </h2>
          <CertificateStatus certificate={detail.certificate} />
        </div>
        {detail.certificate && (
          <a
            href={vaccinationCertificateUrl(detail.bookingPetId)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SECTION_ACTION} self-start`}
          >
            {copy.viewCertificate}
            <span className="sr-only">{copy.opensInNewTab}</span>
          </a>
        )}
      </div>

      {detail.canChange ? (
        <AnswerForm detail={detail} onSaved={onSaved} />
      ) : (
        <p className="m-0 type-body text-notice-secondary">{copy.locked(detail.petName)}</p>
      )}

      <VaccinationPrivacyNotice petName={detail.petName} canChange={detail.canChange} />
    </section>
  );
}

function CertificateStatus({
  certificate,
}: {
  certificate: VaccinationDetail['certificate'];
}): ReactElement {
  const copy = usePortalCopy(VACCINATION_COPY);
  const locale = usePortalLocale();
  if (!certificate) {
    return (
      <span className={`${STATUS_PILL} ${STATUS_TONE.attention}`}>{copy.statusNotProvided}</span>
    );
  }
  return (
    <span className={`${STATUS_PILL} ${STATUS_TONE.success}`}>
      {certificate.uploadedAt
        ? copy.statusUploadedOn(formatDay(certificate.uploadedAt, locale))
        : copy.statusUploaded}
    </span>
  );
}

function AnswerForm({ detail, onSaved }: VaccinationAnswerPanelProps): ReactElement {
  const answer = useVaccinationAnswer(detail, onSaved);
  const copy = usePortalCopy(VACCINATION_COPY);
  const { petName } = detail;
  // No has nothing to send unless it is taking back a certificate already on file.
  const showSave = answer.choice === 'yes' || detail.certificate !== null;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void answer.save();
      }}
    >
      <fieldset
        className="m-0 flex flex-col gap-3 border-0 p-0"
        aria-describedby="vaccination-question-help"
        disabled={answer.saving}
      >
        <legend className="p-0 type-normal text-body">
          {copy.question(petName)} <span aria-hidden="true">*</span>
        </legend>
        <p id="vaccination-question-help" className="m-0 type-meta">
          {copy.questionHelp(petName)}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {CHOICES.map((option) => {
            const selected = answer.choice === option;
            return (
              <label
                key={option}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-center transition-colors focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/20 ${
                  selected
                    ? 'border-action-dark bg-action-dark text-on-action-dark shadow-sm'
                    : 'border-control-border bg-surface-card text-notice-secondary hover:border-action-dark hover:text-notice-primary'
                }`}
              >
                <input
                  type="radio"
                  name="fully-vaccinated"
                  value={option}
                  checked={selected}
                  onChange={() => answer.choose(option)}
                  className="sr-only"
                />
                <span className="type-button">{copy.answerLabel[option]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {answer.choice === 'yes' ? (
        <CertificateUpload
          petName={petName}
          file={answer.file}
          fileProblem={answer.fileProblem}
          current={detail.certificate}
          onPick={answer.pickFile}
          onRemove={answer.removeFile}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <SeparateHousingNotice petName={petName} />
          {detail.certificate && <p className="m-0 type-meta">{copy.noRemovesCertificate}</p>}
        </div>
      )}

      {answer.saveError && (
        <p role="alert" className="m-0 type-body font-semibold text-status-danger">
          {copy.saveFailure(answer.saveError, petName)}
        </p>
      )}
      {answer.saved && (
        <p role="status" className="m-0 type-body font-semibold text-status-success">
          {copy.saved}
        </p>
      )}

      {showSave && (
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button type="submit" disabled={!answer.canSave} className={PRIMARY_BUTTON}>
            {answer.saving ? copy.saving : copy.save}
          </button>
          {answer.choice === 'yes' && !answer.file && !detail.certificate && (
            <p className="m-0 type-meta">{copy.uploadToSave}</p>
          )}
        </div>
      )}
    </form>
  );
}
