import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FeedbackSidebarList } from '../components/feedback/FeedbackSidebarList';
import { FeedbackDetailContent } from '../components/feedback/FeedbackDetailContent';
import {
  markFeedbacksAsRead,
  replyToFeedback,
  updateSuggestionWorkflow,
  updateFeedbackStatus,
  type UpdateSuggestionWorkflowInput,
} from '../api/feedbackApi';
import { useAdminFeedbackSnapshot } from '../hooks/useAdminFeedbackSnapshot';
import { useFeedbackStore } from '../store/feedbackStore';
import type { FeedbackProgressStep } from '../types/feedback';
import { LoadingState } from '../../../shared/components/ui/LoadingState';

export const AdminFeedbackDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<{ feedbackUuid: string; message: string } | null>(null);

  useAdminFeedbackSnapshot();

  const snapshotStatus = useFeedbackStore((state) => state.snapshotStatus);
  const snapshotError = useFeedbackStore((state) => state.snapshotError);
  const activeFeedback = useFeedbackStore((state) => (id ? state.feedbackByUuid[id] : undefined));
  const replaceFeedback = useFeedbackStore((state) => state.replaceFeedback);
  const markFeedbacksReadInStore = useFeedbackStore((state) => state.markFeedbacksRead);

  const clearFeedbackError = (feedbackUuid: string): void => {
    setError((currentError) => (currentError?.feedbackUuid === feedbackUuid ? null : currentError));
  };

  useEffect(() => {
    if (snapshotStatus === 'ready' && id && !activeFeedback) {
      navigate('/admin/feedback', { replace: true });
    }
  }, [activeFeedback, id, navigate, snapshotStatus]);

  useEffect(() => {
    if (!id || !activeFeedback || activeFeedback.is_read) {
      return;
    }

    let cancelled = false;

    const markAsRead = async (): Promise<void> => {
      try {
        const result = await markFeedbacksAsRead([id]);
        if (!cancelled) {
          markFeedbacksReadInStore(result.updatedUuids);
          setError((currentError) => (currentError?.feedbackUuid === id ? null : currentError));
        }
      } catch (requestError) {
        console.error('Failed to mark feedback as read', requestError);
        if (!cancelled) {
          setError({
            feedbackUuid: id,
            message: 'Unable to mark feedback as read. Please try again.',
          });
        }
      }
    };

    void markAsRead();

    return (): void => {
      cancelled = true;
    };
  }, [activeFeedback, id, markFeedbacksReadInStore]);

  const handleUpdateStatus = async (
    feedbackUuid: string,
    step: FeedbackProgressStep,
  ): Promise<void> => {
    try {
      const updated = await updateFeedbackStatus(feedbackUuid, step);
      replaceFeedback(updated);
      clearFeedbackError(feedbackUuid);
    } catch (requestError) {
      console.error('Failed to update status', requestError);
      setError({
        feedbackUuid,
        message: 'Failed to update feedback status. Please try again.',
      });
    }
  };

  const handleSendReply = async (emailBody: string): Promise<void> => {
    if (!activeFeedback) {
      return;
    }

    const updated = await replyToFeedback(activeFeedback.uuid, emailBody);
    replaceFeedback(updated);
    clearFeedbackError(activeFeedback.uuid);
  };

  const handleUpdateSuggestionWorkflow = async (
    input: UpdateSuggestionWorkflowInput,
  ): Promise<void> => {
    if (!activeFeedback) {
      return;
    }

    const updated = await updateSuggestionWorkflow(activeFeedback.uuid, {
      ...input,
    });
    replaceFeedback(updated);
    clearFeedbackError(activeFeedback.uuid);
  };

  if (!activeFeedback && (snapshotStatus === 'idle' || snapshotStatus === 'loading')) {
    return <LoadingState label="Loading feedback…" variant="page" className="h-screen" />;
  }

  if (!activeFeedback && snapshotStatus === 'error') {
    return (
      <div
        role="alert"
        className="type-body flex h-screen items-center justify-center text-status-danger"
      >
        {snapshotError ?? 'Unable to load feedback. Please try again.'}
      </div>
    );
  }

  if (!activeFeedback) {
    return null;
  }

  return (
    <div className="relative -m-4 flex h-[calc(100vh-64px)] overflow-hidden animate-in fade-in duration-300 sm:-m-6 lg:-m-8">
      {error?.feedbackUuid === activeFeedback.uuid && (
        <div
          role="alert"
          className="absolute left-1/2 top-4 z-30 -translate-x-1/2 type-body text-status-danger"
        >
          {error.message}
        </div>
      )}
      <FeedbackSidebarList />
      <FeedbackDetailContent
        key={activeFeedback.uuid}
        feedback={activeFeedback}
        onUpdateStatus={handleUpdateStatus}
        onSendReply={handleSendReply}
        onUpdateSuggestionWorkflow={handleUpdateSuggestionWorkflow}
        onBackToCards={() => navigate('/admin/feedback?source=internal&view=card')}
      />
    </div>
  );
};
