import React from 'react';
import type { FeedbackType } from '../../../../shared/types/feedback';
import { useDictation } from '../../../../shared/dictation';
import { usePortalCopy } from '../../i18n/portalLocale';
import { INNER_PANEL } from '../home/homeStyles';
import { FeedbackAnswerEditor } from './FeedbackAnswerEditor';
import { FeedbackTypeSelector } from './FeedbackTypeSelector';
import { FEEDBACK_COPY } from './feedbackCopy';

interface FeedbackQuestionSectionProps {
  category: FeedbackType | null;
  onCategoryChange: (category: FeedbackType) => void;
  answer: string;
  onAnswerChange: (text: string) => void;
  onAudioRecorded?: (blob: Blob) => void;
  onSubmit: () => void;
  error: string | null;
  isSubmitting: boolean;
  successMessage: string | null;
}

export const FeedbackQuestionSection: React.FC<FeedbackQuestionSectionProps> = ({
  category,
  onCategoryChange,
  answer,
  onAnswerChange,
  onAudioRecorded,
  onSubmit,
  error,
  isSubmitting,
  successMessage,
}) => {
  const copy = usePortalCopy(FEEDBACK_COPY);
  const {
    status: dictationStatus,
    displayText,
    error: dictationError,
    toggle: toggleDictation,
  } = useDictation({
    value: answer,
    onChange: onAnswerChange,
    onAudioRecorded,
    messages: copy.dictationMessages,
  });
  const feedbackPrompt = category ? copy.typePrompts[category] : copy.defaultPrompt;

  return (
    <div className={`${INNER_PANEL} w-full`}>
      <div className="space-y-6">
        <FeedbackTypeSelector
          category={category}
          onCategoryChange={onCategoryChange}
          isSubmitting={isSubmitting}
        />
        <FeedbackAnswerEditor
          feedbackPrompt={feedbackPrompt}
          displayText={displayText}
          answerLength={answer.length}
          dictationStatus={dictationStatus}
          dictationError={dictationError?.message ?? null}
          error={error}
          isSubmitting={isSubmitting}
          successMessage={successMessage}
          onAnswerChange={onAnswerChange}
          onToggleDictation={toggleDictation}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
};
