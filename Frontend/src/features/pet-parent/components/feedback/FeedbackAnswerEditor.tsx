import React from 'react';
import { DictationButton, type DictationStatus } from '../../../../shared/dictation';
import { LoadingSpinner } from '../../../../shared/components/ui/LoadingSpinner';
import { TextArea } from '../../../../shared/components/ui/TextArea';
import { usePortalCopy } from '../../i18n/portalLocale';
import { HomeIcon } from '../home/HomeIcons';
import { PRIMARY_BUTTON } from '../home/homeStyles';
import { FEEDBACK_COPY } from './feedbackCopy';

interface FeedbackAnswerEditorProps {
  feedbackPrompt: string;
  displayText: string;
  answerLength: number;
  dictationStatus: DictationStatus;
  dictationError: string | null;
  error: string | null;
  isSubmitting: boolean;
  successMessage: string | null;
  onAnswerChange: (text: string) => void;
  onToggleDictation: () => Promise<void>;
  onSubmit: () => void;
}

export const FeedbackAnswerEditor: React.FC<FeedbackAnswerEditorProps> = ({
  feedbackPrompt,
  displayText,
  answerLength,
  dictationStatus,
  dictationError,
  error,
  isSubmitting,
  successMessage,
  onAnswerChange,
  onToggleDictation,
  onSubmit,
}) => {
  const copy = usePortalCopy(FEEDBACK_COPY);
  const isDictationBusy = dictationStatus !== 'idle';

  return (
    <div className="flex flex-col">
      <label htmlFor="feedback-answer" className="type-normal mb-3 text-body leading-relaxed">
        {feedbackPrompt}
      </label>
      <div className="flex items-start gap-3">
        <TextArea
          id="feedback-answer"
          value={displayText}
          onValueChange={onAnswerChange}
          disabled={isSubmitting || isDictationBusy}
          maxLength={2000}
          className="min-w-0 flex-1 resize-none rounded-xl border border-field-border bg-surface-card p-4 type-body text-notice-primary transition-colors placeholder:text-notice-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 disabled:bg-surface-cream disabled:text-notice-muted"
          rows={6}
          placeholder={copy.answerPlaceholder}
        />

        <DictationButton
          status={dictationStatus}
          onToggle={onToggleDictation}
          labels={copy.dictationLabels}
          disabled={isSubmitting}
          className="mt-1"
        />
      </div>
      <div className="mt-1 type-meta text-right">{answerLength} / 2000</div>

      {(error || dictationError) && !isSubmitting && (
        <p
          role="alert"
          className="m-0 mt-4 flex items-start gap-2 type-meta font-bold text-status-danger"
        >
          <HomeIcon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {error || dictationError}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center justify-end gap-4 sm:flex-row">
        <button type="button" onClick={onSubmit} disabled={isSubmitting} className={PRIMARY_BUTTON}>
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" tone="inverse" />
              {copy.submitting}
            </span>
          ) : (
            copy.submit
          )}
        </button>
        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 type-meta font-semibold text-status-success sm:max-w-xs"
          >
            <svg
              className="h-5 w-5 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.707a1 1 0 00-1.414-1.414L9 10.172 7.707 8.879a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
