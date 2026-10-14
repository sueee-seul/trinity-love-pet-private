import React, { useId } from 'react';
import {
  type FeedbackRatings,
  type RatingCategory,
  RATING_CATEGORIES,
} from '../../../../shared/types/feedback';
import { usePortalCopy } from '../../i18n/portalLocale';
import { GROUPED_CARD, SECTION_TITLE } from '../home/homeStyles';
import { FEEDBACK_COPY } from './feedbackCopy';
import { FeedbackStarInput } from './FeedbackStarInput';

interface FeedbackRatingSectionProps {
  ratings: FeedbackRatings;
  onRatingChange: (category: RatingCategory, value: number) => void;
}

export const FeedbackRatingSection: React.FC<FeedbackRatingSectionProps> = ({
  ratings,
  onRatingChange,
}) => {
  const copy = usePortalCopy(FEEDBACK_COPY);
  const baseId = useId();
  return (
    <section aria-labelledby={`${baseId}-heading`} className="flex flex-col gap-3">
      <div>
        <h2 id={`${baseId}-heading`} className={SECTION_TITLE}>
          {copy.ratingTitle}
        </h2>
        <p className="m-0 mt-1 type-meta">{copy.ratingHint}</p>
      </div>
      <ul className={`${GROUPED_CARD} m-0 list-none p-0`}>
        {RATING_CATEGORIES.map((category: RatingCategory) => {
          const labelId = `${baseId}-${category}`;
          return (
            <li
              key={category}
              // Stacked on a phone: a label and five 44px stars do not fit on one 375px line.
              className="flex flex-col gap-1 border-b border-border-soft px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <span id={labelId} className="type-normal text-body capitalize">
                {copy.ratingLabels[category]}
              </span>
              <FeedbackStarInput
                labelId={labelId}
                value={ratings[category]}
                onChange={(value: number) => onRatingChange(category, value)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
};
