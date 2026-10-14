import type { ReactElement } from 'react';
import type { SiteLanguage } from '../i18n/siteLanguage';
import { Illustration } from './Illustration';
import type { IllustrationName } from './illustrationAssets';

const CARE_SCENES: readonly IllustrationName[] = [
  'meals-and-water',
  'walk-and-activity',
  'supervised-play',
  'quiet-rest',
];

/** Explains care categories; times and service entitlements remain in the surrounding copy. */
export function CareIllustrations({ language }: { language?: SiteLanguage }): ReactElement {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3">
      {CARE_SCENES.map((name) => (
        <Illustration
          key={name}
          name={name}
          language={language}
          imageClassName="aspect-[4/3] w-full rounded-xl object-cover"
        />
      ))}
    </div>
  );
}
