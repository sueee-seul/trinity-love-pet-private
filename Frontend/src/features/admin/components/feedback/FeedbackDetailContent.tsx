import React, { useState } from 'react';
import type { AdminFeedback, FeedbackProgressStep } from '../../types/feedback';
import { FeedbackDetailHeader } from './detail/FeedbackDetailHeader';
import { AIInsightsSummary } from './detail/AIInsightsSummary';
import { OriginalDetailsGrid } from './detail/OriginalDetailsGrid';
import { AudioTranscript } from './detail/AudioTranscript';
import { DraftResponseEditor } from './detail/DraftResponseEditor';
import { InteractionProgress } from './detail/InteractionProgress';
import { SuggestionReview } from './detail/SuggestionReview';
import type { UpdateSuggestionWorkflowInput } from '../../api/feedbackApi';

interface FeedbackDetailContentProps {
  feedback: AdminFeedback;
  onUpdateStatus?: (id: string, step: FeedbackProgressStep) => void;
  onSendReply?: (emailBody: string) => Promise<void>;
  onUpdateSuggestionWorkflow?: (input: UpdateSuggestionWorkflowInput) => Promise<void>;
  onBackToCards?: () => void;
}

export const FeedbackDetailContent: React.FC<FeedbackDetailContentProps> = ({
  feedback,
  onUpdateStatus,
  onSendReply,
  onUpdateSuggestionWorkflow,
  onBackToCards,
}) => {
  const [activeTab, setActiveTab] = useState<'Detail' | 'Progress' | 'Review'>('Detail');
  const [showOriginalDetails, setShowOriginalDetails] = useState(true);
  const [replyMessage, setReplyMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const isComplaint = feedback.category === 'Issue';
  const isSuggestion = feedback.category === 'Suggestion';
  const visibleTab = isComplaint || isSuggestion ? activeTab : 'Detail';

  const handleSendReply = async (emailBody: string): Promise<void> => {
    if (!onSendReply) {
      return;
    }

    try {
      await onSendReply(emailBody);
      setReplyMessage({ type: 'success', text: 'Reply sent successfully.' });
    } catch (error) {
      console.error('Failed to send reply', error);
      setReplyMessage({ type: 'error', text: 'Failed to send reply. Please try again.' });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-y-auto bg-surface-card">
      {onBackToCards && (
        <div className="border-b border-border-soft px-8 pt-5">
          <button
            type="button"
            onClick={onBackToCards}
            className="mb-4 flex items-center gap-2 type-button text-accent-foreground transition-colors hover:text-accent-foreground-hover"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Feedback Cards
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border-soft px-8 pt-4 flex gap-6">
        <button
          type="button"
          className={`pb-3 type-button border-b-2 transition-colors ${visibleTab === 'Detail' ? 'border-control-border text-accent-foreground' : 'border-transparent text-notice-secondary hover:text-notice-primary'}`}
          onClick={() => setActiveTab('Detail')}
        >
          Detail
        </button>
        {isComplaint && (
          <button
            type="button"
            className={`pb-3 type-button border-b-2 transition-colors ${visibleTab === 'Progress' ? 'border-control-border text-accent-foreground' : 'border-transparent text-notice-secondary hover:text-notice-primary'}`}
            onClick={() => setActiveTab('Progress')}
          >
            Progress
          </button>
        )}
        {isSuggestion && (
          <button
            type="button"
            className={`pb-3 type-button border-b-2 transition-colors ${visibleTab === 'Review' ? 'border-control-border text-accent-foreground' : 'border-transparent text-notice-secondary hover:text-notice-primary'}`}
            onClick={() => setActiveTab('Review')}
          >
            Review
          </button>
        )}
      </div>

      <div className="p-8 max-w-4xl mx-auto w-full">
        {visibleTab === 'Detail' && (
          <div className="animate-in fade-in duration-300">
            <FeedbackDetailHeader feedback={feedback} onUpdateStatus={onUpdateStatus} />
            <AIInsightsSummary summary={feedback.aiSummary} insights={feedback.ai_insights} />

            {/* Toggle Button */}
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={() => setShowOriginalDetails(!showOriginalDetails)}
                className="type-button text-accent-foreground hover:text-accent-foreground-hover transition-colors flex items-center gap-1"
              >
                {showOriginalDetails ? 'Hide Original Details' : 'Show Original Details'}
                <svg
                  className={`w-4 h-4 transform transition-transform ${showOriginalDetails ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {/* Original Details (Collapsible) */}
            {showOriginalDetails && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <OriginalDetailsGrid feedback={feedback} />
                <AudioTranscript
                  questions={feedback.questions}
                  answers={feedback.answers}
                  transcript={feedback.transcript}
                  audio_url={feedback.audio_url}
                />
              </div>
            )}

            {replyMessage && (
              <div
                role={replyMessage.type === 'error' ? 'alert' : 'status'}
                className={`mb-4 type-body ${replyMessage.type === 'error' ? 'text-status-danger' : 'text-status-success'}`}
              >
                {replyMessage.text}
              </div>
            )}
            <DraftResponseEditor
              defaultEmail={
                feedback.parentName
                  ? `${feedback.parentName.replace(/\s+/g, '.').toLowerCase()}@example.com`
                  : undefined
              }
              onSend={handleSendReply}
            />
          </div>
        )}

        {isComplaint && visibleTab === 'Progress' && (
          <div className="animate-in fade-in duration-300">
            <FeedbackDetailHeader feedback={feedback} onUpdateStatus={onUpdateStatus} />
            <InteractionProgress feedback={feedback} />
          </div>
        )}

        {isSuggestion && visibleTab === 'Review' && (
          <div className="animate-in fade-in duration-300">
            <FeedbackDetailHeader feedback={feedback} onUpdateStatus={onUpdateStatus} />
            <SuggestionReview feedback={feedback} onUpdate={onUpdateSuggestionWorkflow} />
          </div>
        )}
      </div>
    </div>
  );
};
