import { useId, useState, type ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { FEEDBACK_COPY } from './feedbackCopy';

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

const STAR_PATH =
  'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z';

/**
 * One row of stars to rate an area of the stay.
 *
 * The stars are native radio buttons, so a keyboard or screen reader user can rate too: Tab
 * reaches the row and the arrow keys move between stars. The shared StarRating draws clickable
 * pictures only, which left the form impossible to finish without a mouse. Each star is a 44px
 * target for a thumb.
 */
export function FeedbackStarInput({
  labelId,
  value,
  onChange,
}: {
  /** The id of the visible text that names this row. */
  labelId: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  const copy = usePortalCopy(FEEDBACK_COPY);
  const groupName = useId();
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const shownValue = previewValue ?? value;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="-mx-2 flex"
      onMouseLeave={() => setPreviewValue(null)}
    >
      {STAR_VALUES.map((star) => {
        const isFilled = star <= shownValue;
        return (
          <label
            key={star}
            onMouseEnter={() => setPreviewValue(star)}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
          >
            <input
              type="radio"
              name={groupName}
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              aria-label={copy.starLabel(star)}
              className="sr-only"
            />
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              fill={isFilled ? 'currentColor' : 'none'}
              stroke={isFilled ? 'none' : 'currentColor'}
              strokeWidth={isFilled ? undefined : 1.5}
              strokeLinejoin="round"
              className={`h-7 w-7 transition-colors ${isFilled ? 'text-rating-filled' : 'text-rating-empty'}`}
            >
              <path d={STAR_PATH} />
            </svg>
          </label>
        );
      })}
    </div>
  );
}
