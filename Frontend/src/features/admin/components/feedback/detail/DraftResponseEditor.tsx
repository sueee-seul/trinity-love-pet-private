import React, { useState } from 'react';
import { DictationButton, useDictation } from '../../../../../shared/dictation';

export type DraftResponseStatus = 'replied' | 'not_replied';

interface DraftResponseEditorProps {
  onSend?: (emailBody: string) => void | Promise<void>;
  onSendError?: (error: unknown) => void;
  defaultEmail?: string;
  defaultMessage?: string;
  /** Optional status badge and sent-response read-only mode for external replies. */
  replyStatus?: DraftResponseStatus;
  enableVoiceInput?: boolean;
  submitLabel?: string;
  sendingLabel?: string;
}

export const DraftResponseEditor: React.FC<DraftResponseEditorProps> = ({
  onSend,
  onSendError,
  defaultEmail,
  defaultMessage = '',
  replyStatus,
  enableVoiceInput = true,
  submitLabel = 'Send Email',
  sendingLabel = 'Sending...',
}) => {
  const [emailBody, setEmailBody] = useState(defaultMessage);
  const [isSending, setIsSending] = useState(false);
  const {
    status: dictationStatus,
    displayText,
    error: dictationError,
    toggle: toggleDictation,
  } = useDictation({
    value: emailBody,
    onChange: setEmailBody,
  });
  const isVoiceInputBusy = dictationStatus !== 'idle';
  const isReadOnly = replyStatus === 'replied';
  const replyStatusLabel = replyStatus === 'replied' ? 'Replied' : 'Not replied yet';
  const replyStatusClassName =
    replyStatus === 'replied'
      ? 'border-status-success/30 bg-status-success/10 text-status-success'
      : 'border-status-danger/30 bg-status-danger/10 text-status-danger';

  const handleSend = async (): Promise<void> => {
    if (!onSend || isReadOnly || !emailBody.trim() || isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(emailBody);
      setEmailBody('');
    } catch (error: unknown) {
      onSendError?.(error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="border border-border-soft rounded-xl overflow-hidden shadow-sm mt-8">
      <div className="bg-surface-cream p-4 border-b border-border-soft flex flex-wrap justify-between items-center gap-3">
        <h3 className="type-eyebrow text-notice-secondary">Draft Response</h3>
        {replyStatus && (
          <span
            role="status"
            aria-label={`Reply status: ${replyStatusLabel}`}
            className={`rounded-full border px-3 py-1 type-meta font-bold ${replyStatusClassName}`}
          >
            {replyStatusLabel}
          </span>
        )}
      </div>
      <div className="p-6">
        <div className="mb-4">
          <label className="block type-meta font-bold text-notice-secondary mb-2">To:</label>
          <input
            type="text"
            readOnly
            value={defaultEmail || ''}
            placeholder="Recipient email will appear here"
            className="w-full type-body bg-surface-cream border border-field-border rounded-lg px-4 py-2 text-notice-secondary focus:outline-none"
          />
        </div>
        <div>
          <label className="block type-meta font-bold text-notice-secondary mb-2">Message:</label>
          <div className="relative">
            <textarea
              rows={6}
              value={displayText}
              onChange={(e) => setEmailBody(e.target.value)}
              readOnly={isReadOnly}
              disabled={isVoiceInputBusy || isSending}
              placeholder="Type your reply here..."
              className="w-full resize-none rounded-lg border border-field-border bg-surface-card px-4 py-3 pr-16 pb-16 type-body text-notice-primary transition-all focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20 read-only:cursor-default read-only:bg-surface-cream disabled:bg-surface-cream disabled:text-notice-muted"
            />
            {!isReadOnly && (
              <div className="absolute bottom-3 right-3">
                <DictationButton
                  status={dictationStatus}
                  onToggle={toggleDictation}
                  disabled={!enableVoiceInput || isSending}
                />
              </div>
            )}
          </div>
          {dictationError && (
            <div role="alert" className="mt-2 type-meta font-bold text-status-danger">
              ⚠️ {dictationError.message}
            </div>
          )}
        </div>

        {!isReadOnly && (
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              className="px-5 py-2 border border-control-border text-notice-secondary type-button rounded-lg hover:bg-surface-cream transition-colors"
              onClick={() => setEmailBody('')}
              disabled={isVoiceInputBusy || isSending}
            >
              Discard
            </button>
            <button
              type="button"
              className="px-5 py-2 bg-action-dark theme-gradient-action text-on-action-dark type-button rounded-lg hover:bg-action-dark-hover transition-colors shadow-sm disabled:opacity-50"
              onClick={() => void handleSend()}
              disabled={!emailBody.trim() || isVoiceInputBusy || isSending || !onSend}
            >
              {isSending ? sendingLabel : submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
