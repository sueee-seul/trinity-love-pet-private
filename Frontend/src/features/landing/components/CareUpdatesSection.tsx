import React from 'react';
import {
  ConciergeCareIllustrations as CareIllustrations,
  ConciergeIllustration as Illustration,
} from '../../concierge/components/ConciergeIllustration';
import { Link } from 'react-router-dom';
import careExampleVideo from '../../../assets/care-example-dog.mp4';
import careExamplePoster from '../../../assets/care-example-dog.jpg';
import careExampleBreakfast from '../../../assets/care-example-breakfast.webp';
import careExampleYard from '../../../assets/care-example-yard.webp';
import careExampleDinner from '../../../assets/care-example-dinner.webp';
import type { ConciergeCopy } from '../../concierge';
import type { LandingCopy } from '../copy';
import { CARD, LEAD, PAGE_COLUMN, SECONDARY_BUTTON, SECTION, SECTION_TITLE } from './landingStyles';

/**
 * A photo beside each entry of the example day, in the order of `sampleEntries`: breakfast, the
 * yard, play time (shown by the clip above, so no photo here) and dinner. The same golden retriever
 * as the clip, made with AI like it.
 */
const ENTRY_PHOTOS: readonly (string | null)[] = [
  careExampleBreakfast,
  careExampleYard,
  null,
  careExampleDinner,
];

interface CareUpdatesSectionProps {
  copy: LandingCopy;
  /** The /book copy, which holds the example care day both pages show. */
  conciergeCopy: ConciergeCopy;
  signedIn: boolean;
}

/**
 * What a parent sees during a stay, shown with the labelled example day from /book. It is marked
 * as an example twice (the label and the caption), because it is not a real pet.
 */
export const CareUpdatesSection: React.FC<CareUpdatesSectionProps> = ({
  copy,
  conciergeCopy,
  signedIn,
}) => {
  const { care } = copy;
  const sample = conciergeCopy.packages;
  return (
    <section id="care" aria-labelledby="landing-care-title" className={SECTION}>
      <div
        className={`${PAGE_COLUMN} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16`}
      >
        {/* From `lg` both columns are as tall as the taller one: the daily routine picture takes
            whatever height the words and the cats leave, so the two columns end level. */}
        <div className="flex min-w-0 flex-col gap-5">
          <h2 id="landing-care-title" className={SECTION_TITLE}>
            {care.title}
          </h2>
          <p className={LEAD}>{care.lead}</p>
          <Illustration
            name="daily-routine-overview"
            className="flex! min-h-0 flex-col lg:flex-1"
            imageClassName="aspect-square w-full rounded-2xl object-cover lg:aspect-auto lg:min-h-0 lg:flex-1"
          />
          {/* The cats' side of the daily routine: indoor play and a quiet place to rest. */}
          <div className="grid grid-cols-2 gap-5">
            <Illustration
              name="cat-play"
              imageClassName="aspect-[665/768] w-full rounded-2xl object-cover"
            />
            <Illustration
              name="cat-rest"
              imageClassName="aspect-[665/768] w-full rounded-2xl object-cover"
            />
          </div>
          {signedIn && (
            <Link to="/parent" className={`${SECONDARY_BUTTON} self-start`}>
              {care.openPetCentre}
            </Link>
          )}
        </div>
        <div className={`${CARD} min-w-0 p-6 sm:p-8`}>
          <CareIllustrations />
          <figure className="m-0 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="m-0 font-agbalumo text-[21px] font-normal leading-tight text-notice-primary">
                {sample.sampleTitle}
              </h3>
              {/* The page's one playful accent, on the word that matters most here. */}
              <span className="rounded-full border border-control-border px-3 py-0.5 font-freckle text-[17px] text-notice-primary">
                {care.exampleLabel}
              </span>
            </div>
            {/*
              An update can carry a short clip from the day. This one is AI-made, so it sits only in
              the labelled example and the caption says so. No autoplay: the parent starts it.
            */}
            <div className="relative mt-5">
              <video
                className="aspect-video w-full rounded-[18px] bg-surface-cream object-cover"
                src={careExampleVideo}
                poster={careExamplePoster}
                aria-label={care.exampleVideoLabel}
                controls
                muted
                playsInline
                preload="none"
              />
              <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-surface-card/90 px-3 py-1 type-meta font-semibold text-notice-primary">
                {care.exampleVideoTag}
              </span>
            </div>
            <ol className="m-0 mt-6 flex list-none flex-col gap-0 border-l border-border-soft p-0">
              {sample.sampleEntries.map((entry, index) => (
                <li key={entry.time} className="relative flex items-center gap-x-4 py-3 pl-6">
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -left-[5px] -translate-y-1/2 h-[9px] w-[9px] rounded-full border border-control-border bg-surface-card"
                  />
                  <span className="w-24 shrink-0 font-fraunces text-[16px] text-notice-muted tabular-nums">
                    {entry.time}
                  </span>
                  <span className="min-w-0 flex-1 text-[17px] leading-6 text-notice-primary">
                    {entry.text}
                  </span>
                  {ENTRY_PHOTOS[index] && (
                    // Decorative: the entry's words say what the photo shows.
                    <img
                      src={ENTRY_PHOTOS[index] ?? undefined}
                      alt=""
                      width={480}
                      height={357}
                      loading="lazy"
                      decoding="async"
                      className="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover"
                    />
                  )}
                </li>
              ))}
            </ol>
            <figcaption className="mt-4 font-inter text-[13.5px] leading-5 text-notice-muted">
              {care.caption}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};
