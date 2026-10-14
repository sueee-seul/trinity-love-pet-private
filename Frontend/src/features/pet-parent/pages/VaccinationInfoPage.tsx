import React, { useEffect, useState } from 'react';
import { VaccinationUploadGuide } from '../components/vaccination/VaccinationUploadGuide';
import { useParams } from 'react-router-dom';
import { ApiError } from '../api/bookingApi';
import { fetchVaccination } from '../api/vaccinationApi';
import { PRIMARY_BUTTON } from '../components/home/homeStyles';
import { PageHeader, PortalPage } from '../components/layout/PortalPage';
import { VaccinationAnswerPanel } from '../components/vaccination/VaccinationAnswerPanel';
import { VACCINATION_COPY, type VaccinationCopy } from '../components/vaccination/vaccinationCopy';
import {
  OtherPetsCard,
  RulesAccordion,
  SourceNote,
  WhyWeAsk,
} from '../components/vaccination/VaccinationSections';
import { serviceNameText } from '../../concierge/utils/serviceNames';
import { usePortalCopy, usePortalLocale } from '../i18n/portalLocale';
import type { VaccinationDetail } from '../types/vaccination';
import { formatCompactRange } from '../utils/home';

// The page is opened from the home page's checklist, so back goes home.
const HOME_PATH = '/parent';
const backHome = (copy: VaccinationCopy): { to: string; label: string } => ({
  to: HOME_PATH,
  label: copy.backHome,
});
const HTTP_NOT_FOUND = 404;

// The reason is kept, not its words, so the message follows the site language if it changes.
type Load =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'ready'; detail: VaccinationDetail };

// Opened from the homepage's "Vaccination information" checklist row. The parent gives this
// stay's proof here (Yes and the certificate, or No), sees what is on file and can replace it;
// the rest of the page explains why, which rules are the law and which are Wagstay's own.
export const VaccinationInfoPage: React.FC = () => {
  const { bookingPetId = '' } = useParams<{ bookingPetId: string }>();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  // Bumped by "Try again" to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0);
  const copy = usePortalCopy(VACCINATION_COPY);

  const retry = (): void => {
    setLoad({ status: 'loading' });
    setAttempt((n) => n + 1);
  };

  const showSaved = (detail: VaccinationDetail): void => setLoad({ status: 'ready', detail });

  useEffect(() => {
    let cancelled = false;
    fetchVaccination(bookingPetId).then(
      (detail) => {
        if (!cancelled) setLoad({ status: 'ready', detail });
      },
      (err: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          notFound: err instanceof ApiError && err.status === HTTP_NOT_FOUND,
        });
      },
    );
    return (): void => {
      cancelled = true;
    };
  }, [bookingPetId, attempt]);

  return (
    <PortalPage width="narrow">
      {load.status === 'ready' ? (
        // Keyed by the stay, so a link to another pet's page never carries this pet's chosen file.
        <VaccinationInfoContent
          key={load.detail.bookingPetId}
          detail={load.detail}
          onSaved={showSaved}
        />
      ) : (
        <>
          <PageHeader title={copy.pageTitle} back={backHome(copy)} />
          {load.status === 'loading' ? (
            <p role="status" className="m-0 type-meta">
              {copy.loading}
            </p>
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p role="alert" className="m-0 type-body font-semibold text-status-danger">
                {load.notFound ? copy.loadNotFound : copy.loadFailed}
              </p>
              <button type="button" onClick={retry} className={PRIMARY_BUTTON}>
                {copy.tryAgain}
              </button>
            </div>
          )}
        </>
      )}
    </PortalPage>
  );
};

function VaccinationInfoContent({
  detail,
  onSaved,
}: {
  detail: VaccinationDetail;
  onSaved: (detail: VaccinationDetail) => void;
}): React.ReactElement {
  const copy = usePortalCopy(VACCINATION_COPY);
  const locale = usePortalLocale();
  const meta = [
    copy.forPet(detail.petName),
    formatCompactRange(detail.dropOffAt, detail.pickUpAt, locale),
    detail.serviceType && serviceNameText(detail.serviceType, locale),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageHeader title={copy.pageTitle} lead={meta} back={backHome(copy)} />
      <VaccinationAnswerPanel detail={detail} onSaved={onSaved} />
      <VaccinationUploadGuide />
      <WhyWeAsk petName={detail.petName} />
      <RulesAccordion />
      <OtherPetsCard pets={detail.otherPets} />
      <SourceNote />
    </>
  );
}
