import React from 'react';
import { type FeedbackType, FEEDBACK_TYPE_OPTIONS } from '../../../../shared/types/feedback';
import { usePortalCopy } from '../../i18n/portalLocale';
import { FEEDBACK_COPY } from './feedbackCopy';

interface FeedbackTypeSelectorProps {
  category: FeedbackType | null;
  onCategoryChange: (category: FeedbackType) => void;
  isSubmitting: boolean;
}

export const FeedbackTypeSelector: React.FC<FeedbackTypeSelectorProps> = ({
  category,
  onCategoryChange,
  isSubmitting,
}) => {
  const copy = usePortalCopy(FEEDBACK_COPY);
  return (
    <fieldset className="space-y-3">
      <legend className="type-normal text-body">
        {copy.typeQuestion} <span aria-hidden="true">*</span>
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {FEEDBACK_TYPE_OPTIONS.map((option) => {
          const isSelected = category === option.value;

          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-center transition-colors focus-within:border-focus focus-within:outline-none focus-within:ring-2 focus-within:ring-focus/20 ${
                isSelected
                  ? 'border-action-dark bg-action-dark text-on-action-dark shadow-sm'
                  : 'border-control-border bg-surface-card text-notice-secondary hover:border-action-dark hover:text-notice-primary'
              } ${isSubmitting ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="feedback-category"
                value={option.value}
                checked={isSelected}
                onChange={() => onCategoryChange(option.value)}
                disabled={isSubmitting}
                required
                className="sr-only"
              />
              <span className="type-button">{copy.typeLabels[option.value]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
