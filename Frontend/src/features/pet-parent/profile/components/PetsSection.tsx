import { useId, type ReactElement } from 'react';
import { PortalIllustration as Illustration } from '../../components/illustrations/PortalIllustration';
import { Link } from 'react-router-dom';
import { HomeIcon } from '../../components/home/HomeIcons';
import { SECTION_TITLE } from '../../components/home/homeStyles';
import { isCurrentOrUpcoming } from '../stayStatus';
import type { Pet, Stay } from '../types';
import { petAge, speciesLabel } from '../utils';
import { breedText } from '../../utils/breedNames';
import { Badge, Button, CARD_CLASS, PetAvatar } from './ProfileUi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { ACCOUNT_COPY, type AccountCopy } from '../copy/accountCopy';

type PetsCopy = AccountCopy['pets'];

/**
 * The My pets tab: a heading, the add action, and one card per pet. The cards sit straight on the
 * portal panel; there is no second card around them.
 */
export function PetsSection({
  pets,
  onAddPet,
}: {
  pets: Pet[];
  onAddPet: () => void;
}): ReactElement {
  const headingId = useId();
  const copy = usePortalCopy(ACCOUNT_COPY).pets;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className={SECTION_TITLE}>
            {copy.heading}
          </h2>
          <p className="m-0 mt-1 type-meta">{copy.lead}</p>
        </div>
        <Button variant="soft" onClick={onAddPet}>
          <HomeIcon name="plus" className="h-4 w-4" />
          {copy.addPet}
        </Button>
      </div>

      {pets.length === 0 ? (
        <div className={`${CARD_CLASS} flex flex-col items-center gap-3 text-center`}>
          <Illustration
            name="empty-pets"
            className="mx-auto max-w-xs"
            imageClassName="aspect-[4/3] w-full rounded-2xl object-contain"
          />
          <p className="m-0 type-body text-notice-secondary">{copy.empty}</p>
          <Button onClick={onAddPet}>{copy.addFirstPet}</Button>
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
          {pets.map((pet) => (
            <li key={pet.id} className="min-w-0">
              <PetCard pet={pet} copy={copy} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The pet card's one line about its next stay, in the manager's terms. */
function nextStayLine(stay: Stay, copy: PetsCopy): string {
  const place = stay.facility?.name ?? 'Wagstay';
  if (stay.status === 'staying_now') return copy.stayingNow(place);
  if (stay.status === 'waiting_for_review') return copy.waitingForReview(place);
  return copy.upcoming(place);
}

function PetCard({ pet, copy }: { pet: Pet; copy: PetsCopy }): ReactElement {
  const locale = usePortalLocale();
  const activeMedicationCount = pet.medications.filter((medication) => medication.active).length;
  const nextStay = pet.stays.find((stay) => isCurrentOrUpcoming(stay));

  return (
    // A link, not a button: it goes to the pet's page, so it also opens in a new tab.
    <Link
      to={`/parent/pets/${pet.id}`}
      className="group flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border-soft bg-surface-card p-5 text-notice-primary no-underline shadow-card transition-colors hover:border-field-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <div className="flex items-center gap-4">
        <PetAvatar name={pet.name} photoUrl={pet.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate type-card-title font-normal">{pet.name}</p>
          <p className="m-0 truncate type-meta">
            {breedText(pet.breed, locale, speciesLabel(pet.species, locale))} ·{' '}
            {petAge(pet.birthDate, locale)}
          </p>
        </div>
        <HomeIcon
          name="chevron"
          className="h-5 w-5 shrink-0 text-notice-muted transition-colors group-hover:text-accent-foreground"
        />
      </div>

      {(pet.allergies.length > 0 || activeMedicationCount > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {pet.allergies.slice(0, 2).map((allergy) => (
            <Badge key={allergy} tone="danger">
              {copy.allergyBadge(allergy)}
            </Badge>
          ))}
          {activeMedicationCount > 0 && (
            <Badge tone="warning">{copy.activeMedicines(activeMedicationCount)}</Badge>
          )}
        </div>
      )}

      <p
        className={`m-0 mt-auto flex items-center gap-2 rounded-xl px-3 py-2 type-meta ${
          nextStay
            ? 'bg-surface-cream text-notice-secondary'
            : 'border border-dashed border-border-soft'
        }`}
      >
        {nextStay ? (
          <>
            <HomeIcon name="calendar" className="h-4 w-4 shrink-0 text-accent-foreground" />
            {nextStayLine(nextStay, copy)}
          </>
        ) : (
          copy.noUpcomingStay
        )}
      </p>
    </Link>
  );
}
