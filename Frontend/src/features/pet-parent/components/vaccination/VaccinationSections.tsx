import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { VaccinationOtherPet } from '../../types/vaccination';
import { formatDay } from '../../utils/home';
import { HomeIcon } from '../home/HomeIcons';
import { GROUPED_CARD, INNER_PANEL, SECTION_TITLE } from '../home/homeStyles';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { VACCINATION_RULES_COPY } from './vaccinationRulesCopy';

// Every section heading on the page uses the one section title style.
const SECTION_HEADING = `${SECTION_TITLE} mb-3`;

// The explaining parts of the Vaccination information page; the answer and the upload live in
// VaccinationAnswerPanel. Their words, in every site language, are in vaccinationRulesCopy.ts.

// ── No proof: what happens to this pet ────────────────────────────────────

export function SeparateHousingNotice({ petName }: { petName: string }): ReactElement {
  const copy = usePortalCopy(VACCINATION_RULES_COPY);
  return (
    <div className="rounded-xl border border-theme-apricot bg-surface-deep p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-theme-sun/20 text-accent-foreground">
          <HomeIcon name="alert" className="h-4 w-4" />
        </span>
        <div>
          <h3 className="m-0 type-normal text-body">{copy.housingHeading(petName)}</h3>
          <p className="m-0 mt-1 type-body text-notice-secondary">{copy.housingBody(petName)}</p>
          <p className="m-0 mt-2 type-meta">{copy.housingDuration}</p>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-theme-apricot/60 border-t border-theme-apricot/60">
        {copy.housingRows.map(({ label, text }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 py-2.5 sm:grid sm:grid-cols-[190px_1fr] sm:gap-4"
          >
            <dt className="type-meta font-semibold text-notice-primary">{label}</dt>
            <dd className="m-0 type-meta text-notice-secondary">{text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── Why we ask ──────────────────────────────────────────────────────────────

export function WhyWeAsk({ petName }: { petName: string }): ReactElement {
  const copy = usePortalCopy(VACCINATION_RULES_COPY);
  return (
    <section aria-labelledby="vaccination-why" className={INNER_PANEL}>
      <h2 id="vaccination-why" className={SECTION_TITLE}>
        {copy.whyHeading}
      </h2>
      <p className="m-0 mt-2 type-body text-notice-secondary">{copy.whyProtects(petName)}</p>
      <p className="m-0 mt-2 type-body text-notice-secondary">{copy.whyOurRequirement}</p>
      <p className="m-0 mt-2 type-body text-notice-secondary">{copy.whyCode}</p>
    </section>
  );
}

// ── The rules we follow ──────────────────────────────────────────────────────

export function RulesAccordion(): ReactElement {
  const copy = usePortalCopy(VACCINATION_RULES_COPY);
  return (
    <section aria-labelledby="vaccination-rules">
      <h2 id="vaccination-rules" className={SECTION_HEADING}>
        {copy.rulesHeading}
      </h2>
      <div className={GROUPED_CARD}>
        {copy.rules.map((rule) => (
          <details key={rule.title} className="group border-b border-border-soft last:border-b-0">
            <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 type-body font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-6 [&::-webkit-details-marker]:hidden">
              {rule.title}
              <HomeIcon
                name="chevron"
                className="h-4 w-4 shrink-0 text-notice-muted transition-transform group-open:rotate-90"
              />
            </summary>
            <p className="m-0 px-4 pb-4 type-body text-notice-secondary sm:px-6">{rule.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Other pets on this booking ───────────────────────────────────────────────

export function OtherPetsCard({ pets }: { pets: VaccinationOtherPet[] }): ReactElement | null {
  const copy = usePortalCopy(VACCINATION_RULES_COPY);
  const locale = usePortalLocale();
  if (pets.length === 0) return null;
  return (
    <section aria-labelledby="other-pets">
      <h2 id="other-pets" className={SECTION_HEADING}>
        {copy.otherPetsHeading}
      </h2>
      <ul className={`${GROUPED_CARD} m-0 list-none p-0`}>
        {pets.map((pet) => {
          const receivedAt = pet.certificateUploadedAt;
          const row = (
            <>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  receivedAt
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-theme-sun/20 text-accent-foreground'
                }`}
              >
                <HomeIcon name={receivedAt ? 'check' : 'alert'} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 type-body">
                <span className="font-semibold">{pet.petName}</span>
                {copy.otherPetSeparator}
                {receivedAt
                  ? copy.certificateReceived(formatDay(receivedAt, locale))
                  : copy.certificateNeeded}
              </span>
            </>
          );
          return (
            <li key={pet.bookingPetId} className="border-b border-border-soft last:border-b-0">
              {receivedAt ? (
                <div className="flex min-h-11 items-center gap-3 px-4 py-2.5 sm:px-6">{row}</div>
              ) : (
                <Link
                  to={`/parent/vaccination/${pet.bookingPetId}`}
                  className="flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-cream/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-6"
                >
                  {row}
                  <HomeIcon name="chevron" className="h-4 w-4 shrink-0 text-notice-muted" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SourceNote(): ReactElement {
  const copy = usePortalCopy(VACCINATION_RULES_COPY);
  return (
    <aside className="flex items-start gap-3 rounded-xl bg-surface-cream p-4">
      <HomeIcon name="info" className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground" />
      <p className="m-0 type-meta">{copy.sourceNote}</p>
    </aside>
  );
}
