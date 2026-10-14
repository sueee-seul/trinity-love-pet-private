import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalLocale } from '../../i18n/portalLocale';
import type { HomePet } from '../../types/home';
import { PETS_TAB_LINK, bookingLinkForPet, petMeta, petMetaParts } from '../../utils/home';
import { HOME_COPY } from './homeCopy';
import { HomeIcon } from './HomeIcons';
import { PetAvatarCircle } from './PetAvatarCircle';
import { GROUPED_CARD, SECTION_ACTION, SECTION_TITLE } from './homeStyles';

// The desktop list is used with a pointer, so its row action is a compact text link: 32px tall,
// above the 24px minimum, so each row stays one avatar high plus one line.
const ROW_ACTION =
  'type-button inline-flex min-h-8 items-center text-accent-foreground transition-colors hover:text-accent-foreground-hover';

// Opens the booking page with this pet already chosen, so the parent names it only once. Every
// card shows the same words, so the link's name adds which pet it books for.
function BookStayLink({ pet, className }: { pet: HomePet; className: string }): ReactElement {
  const copy = HOME_COPY[usePortalLocale()];
  return (
    <Link
      to={bookingLinkForPet(pet.id)}
      aria-label={copy.bookAStayFor(pet.name)}
      className={className}
    >
      {copy.bookAStay}
    </Link>
  );
}

// States B and C. A horizontal row of pet cards on mobile; one bordered list
// (a row per pet) with a dashed "Add a pet" row beneath it from `lg`. "See all"
// opens the pets tab, where every pet lives, rather than the profile's first tab.
// Each pet has two links, never one inside the other: its page, and "Book a stay".
// In the side column the booking link sits under the pet's details, so the name,
// breed and age keep the row's full width and a long breed ends in an ellipsis
// (its full text in the title) rather than breaking mid-word.
// The phone row runs to the panel's edges, so its negative margin matches the
// panel's padding (1rem, 1.5rem from `sm`).
export function YourPets({ pets }: { pets: HomePet[] }): ReactElement {
  const locale = usePortalLocale();
  const copy = HOME_COPY[locale];
  return (
    <section aria-labelledby="your-pets" className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="your-pets" className={SECTION_TITLE}>
          {copy.yourPets}
        </h2>
        <Link to={PETS_TAB_LINK} className={`${SECTION_ACTION} lg:hidden`}>
          {copy.seeAll}
        </Link>
      </div>

      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:hidden">
        {pets.map((pet) => (
          <li
            key={pet.id}
            className="flex w-36 shrink-0 flex-col rounded-2xl border border-border-soft bg-surface-card p-3.5"
          >
            <PhonePetLink pet={pet} />
            <BookStayLink pet={pet} className={`${SECTION_ACTION} mt-auto`} />
          </li>
        ))}
        <li className="shrink-0">
          <Link
            to={PETS_TAB_LINK}
            aria-label={copy.addAPet}
            className="flex h-full min-h-32 w-24 items-center justify-center rounded-2xl border border-dashed border-control-border bg-surface-card text-accent-foreground transition-colors hover:border-action-dark"
          >
            <HomeIcon name="plus" className="h-6 w-6" />
          </Link>
        </li>
      </ul>

      {/* The list keeps its own height; the add tile takes whatever the row leaves, so a short
          list never leaves an empty card beside the stay. */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col">
        <ul className={GROUPED_CARD}>
          {pets.map((pet) => (
            <li
              key={pet.id}
              className="flex flex-col border-b border-border-soft px-4 pb-1.5 pt-3 last:border-b-0"
            >
              <Link
                to={`/parent/pets/${pet.id}`}
                className="group flex min-w-0 items-center gap-3 rounded-xl"
              >
                <PetAvatarCircle name={pet.name} photoUrl={pet.photoUrl} sizeClass="h-11 w-11" />
                <span className="min-w-0 flex-1">
                  <span className="type-normal block truncate text-body transition-colors group-hover:text-action-dark">
                    {pet.name}
                  </span>
                  <span className="type-meta block truncate" title={petMeta(pet, locale)}>
                    {petMeta(pet, locale)}
                  </span>
                </span>
                <HomeIcon
                  name="chevron"
                  className="h-4 w-4 shrink-0 text-notice-muted transition-colors group-hover:text-action-dark"
                />
              </Link>
              {/* Indented by the avatar and its gap, so it lines up with the name. */}
              <BookStayLink pet={pet} className={`${ROW_ACTION} ml-14 self-start`} />
            </li>
          ))}
        </ul>
        <Link
          to={PETS_TAB_LINK}
          className="type-button mt-2 flex min-h-11 w-full flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-control-border text-accent-foreground transition-colors hover:border-action-dark"
        >
          <HomeIcon name="plus" className="h-4 w-4" />
          {copy.addAPet}
        </Link>
      </div>
    </section>
  );
}

/** A phone card's link: breed and age on their own lines, so neither leaves a stray separator. */
function PhonePetLink({ pet }: { pet: HomePet }): ReactElement {
  const { kind, age } = petMetaParts(pet, usePortalLocale());
  return (
    <Link
      to={`/parent/pets/${pet.id}`}
      className="flex flex-col gap-2 rounded-xl transition-colors hover:text-action-dark"
    >
      <PetAvatarCircle name={pet.name} photoUrl={pet.photoUrl} sizeClass="h-12 w-12" />
      <span className="type-normal break-words text-body">{pet.name}</span>
      <span className="type-meta flex flex-col">
        <span className="break-words">{kind}</span>
        {age && <span>{age}</span>}
      </span>
    </Link>
  );
}
