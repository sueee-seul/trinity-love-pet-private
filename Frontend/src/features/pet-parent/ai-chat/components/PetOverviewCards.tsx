import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { serviceNameText } from '../../../concierge/utils/serviceNames';
import { usePortalCopy, usePortalLocale, type PortalLocale } from '../../i18n/portalLocale';
import { speciesLabel } from '../../profile/utils';
import type { Species } from '../../profile/types';
import { stayLabelText, stayStatusText } from '../chatServerWords';
import { PET_OVERVIEW_COPY } from '../petOverviewCopy';
import { breedText } from '../../utils/breedNames';
import type { PetOverviewCard, PetOverviewStay } from '../types';
import { API_BASE_URL } from '../../../../shared/api';

interface PetOverviewCardsProps {
  pets: PetOverviewCard[];
}

const CARE_TEXT_FIELDS = [
  'feeding_routine',
  'medication_instructions',
  'behavior_and_health_notes',
  'other_notes',
] as const;

const CARE_YES_NO_FIELDS = [
  'first_time_boarding',
  'crate_trained',
  'allows_socialization',
  'fully_vaccinated',
] as const;

const DATE_TIME_LOCALES: Record<PortalLocale, string> = { en: 'en-NZ', zh: 'zh-CN' };

const SPECIES = ['DOG', 'CAT', 'OTHER'];

const formatDateTime = (value: string | null, locale: PortalLocale): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString(DATE_TIME_LOCALES[locale], { dateStyle: 'medium', timeStyle: 'short' });
};

/** The chat sends the species as stored ('dog' or 'DOG'); anything unexpected is shown as sent. */
const speciesText = (species: string, locale: PortalLocale): string => {
  const known = species.toUpperCase();
  return SPECIES.includes(known) ? speciesLabel(known as Species, locale) : species;
};

function StayCard({ stay }: { stay: PetOverviewStay }): ReactElement {
  const copy = usePortalCopy(PET_OVERVIEW_COPY);
  const locale = usePortalLocale();
  const careRows = CARE_TEXT_FIELDS.flatMap((field) => {
    const value = stay.care_information?.[field];
    return value ? [{ label: copy.careText[field], value }] : [];
  });
  const yesNoRows = CARE_YES_NO_FIELDS.flatMap((field) => {
    const value = stay.care_information?.[field];
    return value === null || value === undefined
      ? []
      : [{ label: copy.careYesNo[field], value: value ? copy.yes : copy.no }];
  });
  const dropOff = formatDateTime(stay.drop_off_time, locale);
  const pickUp = formatDateTime(stay.pick_up_time, locale);
  const careDetails = [...careRows, ...yesNoRows];
  const stayName = stayLabelText(stay.stay, locale);

  return (
    <section className="rounded-xl bg-surface-deep/60 p-3" aria-label={copy.stayDetails(stayName)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="type-eyebrow text-notice-primary">{stayName}</h3>
        {stay.booking_status && (
          <span className="rounded-full bg-surface-card px-2.5 py-1 type-meta text-notice-muted">
            {stayStatusText(stay.booking_status, locale)}
          </span>
        )}
      </div>
      {(dropOff || pickUp) && (
        <p className="mt-2 type-meta text-notice-muted">
          {dropOff && <span>{copy.dropOff(dropOff)}</span>}
          {dropOff && pickUp && (
            <span className="px-2" aria-hidden="true">
              ·
            </span>
          )}
          {pickUp && <span>{copy.pickUp(pickUp)}</span>}
        </p>
      )}
      {careDetails.length > 0 ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {careDetails.map(({ label, value }) => (
            <div key={label}>
              <dt className="type-meta text-notice-muted">{label}</dt>
              <dd className="type-body text-notice-primary">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 type-meta text-notice-muted">{copy.noCareInformation}</p>
      )}
      <div className="mt-3">
        <h4 className="type-meta font-semibold text-notice-primary">{copy.bookedServices}</h4>
        {stay.booked_services.length > 0 ? (
          <ul className="mt-1 list-inside list-disc type-body text-notice-primary">
            {stay.booked_services.map((service) => (
              <li key={`${service.category}-${service.name}`}>
                {serviceNameText(service.name, locale)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 type-meta text-notice-muted">{copy.noServices}</p>
        )}
      </div>
    </section>
  );
}

export function PetOverviewCards({ pets }: PetOverviewCardsProps): ReactElement {
  const copy = usePortalCopy(PET_OVERVIEW_COPY);
  const locale = usePortalLocale();

  return (
    <div className="grid w-full max-w-[80%] gap-3" aria-label={copy.listLabel}>
      {pets.map(({ profile, stays, answer, event_photos: eventPhotos = [] }) => (
        <article
          key={profile.name}
          className="overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-sm"
        >
          <header className="flex items-center gap-3 border-b border-border-soft bg-apricot-cream-100/60 px-4 py-3">
            {profile.image_url && (
              <img
                src={profile.image_url}
                alt={profile.name}
                className="h-12 w-12 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0">
              <h2 className="type-title text-notice-primary">{profile.name}</h2>
              <p className="mt-0.5 capitalize type-meta text-notice-muted">
                {[
                  speciesText(profile.species, locale),
                  profile.breed && breedText(profile.breed, locale, ''),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </header>
          <div className="space-y-4 p-4">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="type-meta text-notice-muted">{copy.age}</dt>
                <dd className="type-body text-notice-primary">
                  {profile.age === null ? copy.notRecorded : copy.years(profile.age)}
                </dd>
              </div>
              <div>
                <dt className="type-meta text-notice-muted">{copy.weight}</dt>
                <dd className="type-body text-notice-primary">
                  {profile.weight === null ? copy.notRecorded : copy.kilograms(profile.weight)}
                </dd>
              </div>
            </dl>
            {answer && (
              <section
                className="rounded-xl bg-surface-cream p-3"
                aria-label={copy.answerLabel(profile.name)}
              >
                <h3 className="type-eyebrow text-notice-primary">{copy.answer}</h3>
                <p className="mt-1 whitespace-pre-wrap type-body text-notice-primary">{answer}</p>
              </section>
            )}
            {eventPhotos.length > 0 && (
              <div className="grid grid-cols-2 gap-2" aria-label={`${profile.name} event photos`}>
                {eventPhotos.map((photo) => (
                  <img
                    key={photo.url}
                    src={`${API_BASE_URL}${photo.url}`}
                    alt={photo.alt}
                    className="max-h-56 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            {stays.length > 0 ? (
              <div>
                <h3 className="mb-2 type-body font-semibold text-notice-primary">{copy.stays}</h3>
                <div className="space-y-2">
                  {stays.map((stay) => (
                    <StayCard key={`${stay.stay}-${stay.drop_off_time ?? 'undated'}`} stay={stay} />
                  ))}
                </div>
              </div>
            ) : !answer ? (
              <p className="type-meta text-notice-muted">{copy.noStays}</p>
            ) : null}
            <Link
              to="/parent/stays"
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-control-border px-4 py-2 type-button text-accent-foreground transition-colors hover:bg-apricot-cream-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {copy.viewStays}
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
