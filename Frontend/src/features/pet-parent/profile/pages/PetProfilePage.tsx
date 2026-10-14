import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deletePet, updatePet } from '../repository';
import { useProfileState } from '../useProfileState';
import { useProfileSync } from '../useProfileSync';
import type { Pet, PetFormInput } from '../types';
import { formatDate, petAge, speciesLabel } from '../utils';
import { STAY_STATUS_COPY } from '../../components/stays/stayStatus';
import { STAY_STATUS_TONES } from '../stayStatus';
import { PARENT_STAYS_PATH } from '../parentProfileTabs';
import { ProfileSyncNotice } from '../components/ProfileSyncNotice';
import {
  Badge,
  Button,
  CARD_CLASS,
  DetailList,
  PetAvatar,
  PRIMARY_BUTTON_LINK,
  SectionCard,
} from '../components/ProfileUi';
import { Modal } from '../components/ProfileModal';
import { PetForm } from '../components/ProfileForms';
import { PageHeader, PortalPage } from '../../components/layout/PortalPage';
import { SECTION_ACTION } from '../../components/home/homeStyles';
import { PETS_TAB_LINK, bookingLinkForPet } from '../../utils/home';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { PET_PAGE_COPY, type PetPageCopy } from '../copy/petPageCopy';
import { ParentNoteText } from '../../components/ParentNoteText';
import { breedText } from '../../utils/breedNames';
import { useParentWrittenText } from '../../i18n/parentWrittenText';

export function PetProfilePage(): React.ReactElement {
  const { id = '' } = useParams<{ id: string }>();
  const profile = useProfileState();
  // This page can be opened straight from a link, and its saves report failures through the
  // notice, so it asks for the profile itself instead of relying on another screen to.
  const sync = useProfileSync();
  const navigate = useNavigate();
  const pet = profile?.pets.find((item) => item.id === id) ?? null;
  const [editingPet, setEditingPet] = useState(false);
  const locale = usePortalLocale();
  const copy = usePortalCopy(PET_PAGE_COPY);
  // What the parent typed about the pet, shown in the page's language.
  const shownNote = useParentWrittenText(
    pet
      ? [pet.colour, pet.dietNotes, pet.behaviourNotes, ...pet.allergies].filter(
          (note): note is string => Boolean(note),
        )
      : [],
  );
  const typed = (value: string | null | undefined, blank: string): ReactNode =>
    value ? <ParentNoteText note={shownNote(value)} /> : blank;
  // Back, and the page a deleted pet leaves you on, is the pets tab this page was opened from.
  const backToPets = { to: PETS_TAB_LINK, label: copy.backToPets };

  // Not loaded yet is not the same as not found. Saying "Pet not found"
  // before the profile has arrived would be a lie.
  if (!profile) {
    return (
      <PortalPage width="standard">
        <PageHeader title={copy.yourPet} back={backToPets} />
        {sync.error ? (
          <div className="flex flex-col items-start gap-4">
            <ProfileSyncNotice sync={sync} title={copy.loadFailedTitle} />
            <Button onClick={sync.retry}>{copy.tryAgain}</Button>
          </div>
        ) : (
          <p role="status" className="m-0 type-meta">
            {copy.loadingPet}
          </p>
        )}
      </PortalPage>
    );
  }

  if (!pet) {
    return (
      <PortalPage width="standard">
        <PageHeader title={copy.notFoundTitle} lead={copy.notFoundLead} back={backToPets} />
      </PortalPage>
    );
  }

  const savePet = (value: PetFormInput): void => {
    void updatePet(pet.id, value).catch(() => undefined);
    setEditingPet(false);
  };

  const removePet = (): void => {
    if (!window.confirm(copy.confirmDelete(pet.name))) return;
    void deletePet(pet.id)
      .then(() => navigate(backToPets.to))
      .catch(() => undefined);
  };

  const activeMedications = pet.medications.filter((medication) => medication.active);

  return (
    <PortalPage width="standard">
      <PageHeader
        title={pet.name}
        lead={[
          breedText(pet.breed, locale, speciesLabel(pet.species, locale)),
          copy.sexLabels[pet.sex ?? ''],
          petAge(pet.birthDate, locale),
        ].join(' · ')}
        back={backToPets}
        actions={
          <>
            {/* The booking page opens with this pet already chosen, so it is not named again. */}
            <Link to={bookingLinkForPet(pet.id)} className={PRIMARY_BUTTON_LINK}>
              {copy.bookAStay}
            </Link>
            <Button variant="outline" onClick={() => setEditingPet(true)}>
              {copy.editPet}
            </Button>
            <Button variant="danger" onClick={removePet}>
              {copy.deletePet}
            </Button>
          </>
        }
      />

      <ProfileSyncNotice sync={sync} />

      <section
        aria-label={copy.photoAndHealthLabel(pet.name)}
        className={`${CARD_CLASS} flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left`}
      >
        <PetAvatar name={pet.name} photoUrl={pet.photoUrl} size="xl" />
        {pet.allergies.length === 0 && activeMedications.length === 0 ? (
          <p className="m-0 type-body text-notice-secondary">
            {copy.noAllergiesOrMedicines(pet.name)}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0 sm:justify-start">
            {pet.allergies.map((allergy) => {
              const shown = shownNote(allergy);
              return (
                <li key={allergy}>
                  <Badge tone="danger">
                    {shown.kind === 'as-written' || shown.kind === 'translated' ? (
                      copy.allergyBadge(shown.text)
                    ) : (
                      <ParentNoteText note={shown} />
                    )}
                  </Badge>
                </li>
              );
            })}
            {activeMedications.map((medication) => (
              <li key={medication.id}>
                <Badge tone="warning">{medication.name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
        <SectionCard title={copy.detailsTitle}>
          <DetailList
            items={[
              {
                label: copy.born,
                value: pet.birthDate ? formatDate(pet.birthDate, locale) : copy.missingDetail,
              },
              {
                label: copy.weight,
                value: pet.weightKg ? copy.weightValue(pet.weightKg) : copy.missingDetail,
              },
              { label: copy.colour, value: typed(pet.colour, copy.missingDetail) },
              { label: copy.microchip, value: pet.microchip || copy.missingDetail },
              { label: copy.desexed, value: pet.desexed ? copy.yes : copy.no },
            ]}
          />
        </SectionCard>
        <SectionCard title={copy.vetTitle}>
          <DetailList
            items={[
              { label: copy.vet, value: pet.vetName || copy.missingDetail },
              { label: copy.vetPhone, value: pet.vetPhone || copy.missingDetail },
              { label: copy.emergencyContact, value: pet.emergencyContact || copy.missingDetail },
            ]}
          />
        </SectionCard>
        {/* The third card spans the row, so it never sits alone in half of it. */}
        <SectionCard title={copy.dietTitle} className="md:col-span-2">
          <DetailList
            items={[
              { label: copy.diet, value: typed(pet.dietNotes, copy.noDietNotes) },
              { label: copy.behaviour, value: typed(pet.behaviourNotes, copy.noBehaviourNotes) },
            ]}
          />
        </SectionCard>
        {/* Read-only: medications are recorded by the facility, and the
            parent API has no write endpoint for them. */}
        <SectionCard title={copy.medicationsTitle}>
          <MedicationList pet={pet} copy={copy} />
        </SectionCard>
      </div>

      <SectionCard
        title={copy.stayHistoryTitle}
        meta={
          pet.stays.length > 0 && (
            <Link to={PARENT_STAYS_PATH} className={SECTION_ACTION}>
              {copy.allStays}
            </Link>
          )
        }
      >
        <StayHistory pet={pet} copy={copy} />
      </SectionCard>

      {editingPet && (
        <Modal title={copy.editTitle(pet.name)} wide onClose={() => setEditingPet(false)}>
          <PetForm pet={pet} onSave={savePet} onCancel={() => setEditingPet(false)} />
        </Modal>
      )}
    </PortalPage>
  );
}

function MedicationList({ pet, copy }: { pet: Pet; copy: PetPageCopy }): React.ReactElement {
  if (pet.medications.length === 0) {
    return <p className="m-0 type-body text-notice-secondary">{copy.noMedications}</p>;
  }
  return (
    <ul className="m-0 list-none divide-y divide-border-soft p-0">
      {pet.medications.map((medication) => (
        <li key={medication.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 type-body font-semibold">{medication.name}</p>
              <p className="m-0 type-meta">
                {medication.dose}{' '}
                {copy.medicationUnits[medication.unit.toLowerCase()] ?? medication.unit} ·{' '}
                {copy.medicationRoutes[medication.route.toUpperCase()] ??
                  medication.route.toLowerCase()}{' '}
                · {medication.schedule.join(copy.scheduleSeparator) || copy.asNeeded}
              </p>
            </div>
            <Badge tone={medication.active ? 'success' : 'muted'} nowrap>
              {medication.active ? copy.active : copy.notActive}
            </Badge>
          </div>
          {medication.instructions && (
            <p className="m-0 mt-1 type-meta">{medication.instructions}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Each row opens the stays list, where the full booking lives. */
function StayHistory({ pet, copy }: { pet: Pet; copy: PetPageCopy }): React.ReactElement {
  const locale = usePortalLocale();
  const statusLabels = usePortalCopy(STAY_STATUS_COPY);
  if (pet.stays.length === 0) {
    return <p className="m-0 type-body text-notice-secondary">{copy.noStays}</p>;
  }
  return (
    <ul className="m-0 list-none divide-y divide-border-soft p-0">
      {pet.stays.map((stay) => (
        <li key={stay.id}>
          <Link
            to={PARENT_STAYS_PATH}
            className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-3 text-notice-primary no-underline transition-colors hover:bg-surface-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span className="min-w-0">
              <span className="block type-body font-semibold">
                {stay.facility?.name || 'Wagstay'}
              </span>
              <span className="block type-meta">
                {copy.stayDates(formatDate(stay.startAt, locale), formatDate(stay.endAt, locale))}
                {stay.runName ? ` · ${stay.runName}` : ''}
              </span>
            </span>
            <Badge tone={STAY_STATUS_TONES[stay.status]} nowrap>
              {statusLabels[stay.status]}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}
