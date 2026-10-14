import React from 'react';
import { CONCIERGE_MAX_PETS, MAX_ONLINE_NIGHTS } from '../../concierge';
import blackCatPhoto from '../assets/black-cat-window-lifestyle.webp';
import labradorPhoto from '../assets/golden-labrador-pikkle-resting.webp';
import type { LandingCopy, LandingIconPoint } from '../copy';
import { BODY, CARD_TITLE, PAGE_COLUMN, PHOTO, SECTION, SECTION_TITLE } from './landingStyles';

interface PetsSectionProps {
  copy: LandingCopy;
}

interface PetCardProps {
  point: LandingIconPoint;
  photo: string;
  photoAlt: string;
  /** The files' own size, so the browser reserves the space before the picture arrives. */
  width: number;
  height: number;
}

/**
 * A photo, a title and a line. The photos are decorative stock of well-kept pets: the alt text
 * describes the animal and never says the picture shows our rooms.
 */
const PetCard: React.FC<PetCardProps> = ({ point, photo, photoAlt, width, height }) => (
  <article className="flex min-w-0 flex-col gap-4">
    <div className="theme-photo-frame aspect-[4/3] overflow-hidden rounded-[28px] bg-surface-card">
      <img
        src={photo}
        alt={photoAlt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={PHOTO}
      />
    </div>
    <h3 className={CARD_TITLE}>{point.title}</h3>
    <p className={BODY}>{point.text}</p>
  </article>
);

/** Dogs and cats side by side, and the booking limits the assistant works within. */
export const PetsSection: React.FC<PetsSectionProps> = ({ copy }) => {
  const { pets } = copy;
  return (
    <section aria-labelledby="landing-pets-title" className={SECTION}>
      <div className={PAGE_COLUMN}>
        <h2 id="landing-pets-title" className={SECTION_TITLE}>
          {pets.title}
        </h2>
        <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-8">
          <PetCard
            point={pets.dogs}
            photo={labradorPhoto}
            photoAlt={pets.dogPhotoAlt}
            width={1200}
            height={800}
          />
          <PetCard
            point={pets.cats}
            photo={blackCatPhoto}
            photoAlt={pets.catPhotoAlt}
            width={1200}
            height={900}
          />
        </div>
        <p className="mt-10 mb-0 max-w-[62ch] border-t border-border-soft pt-6 text-[18px] leading-8 text-notice-primary">
          {pets.limits(CONCIERGE_MAX_PETS, MAX_ONLINE_NIGHTS)}
        </p>
      </div>
    </section>
  );
};
