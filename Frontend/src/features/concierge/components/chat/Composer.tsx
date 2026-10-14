import React, { useId, useState } from 'react';
import { DictationButton, useDictation } from '../../../../shared/dictation';
import type { ConciergeCopy } from '../../copy';
import type { SpeechProcessing } from '../../types';
import { MAX_MESSAGE_LENGTH } from '../../store/conciergeStore';
import { ERROR_TEXT, FIELD_FOCUS, PRIMARY_BUTTON } from '../conciergeStyles';

interface ComposerProps {
  copy: ConciergeCopy;
  /** Where voice-to-text runs, so the notice under the box names it; null until known. */
  speech: SpeechProcessing | null;
  /** A turn is in flight: nothing can be sent until it settles. */
  busy: boolean;
  /** The assistant is replying to the guest (not a quiet re-price). */
  replying: boolean;
  onSend: (text: string) => Promise<void>;
  /** The guest clicked into the box: the stay panel opens beside the chat once there is one. */
  onFocus: () => void;
}

/** Touch screens get Enter as a new line; a keyboard with a pointer gets Enter to send. */
const prefersEnterToSend = (): boolean =>
  typeof window === 'undefined' || !window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Where the guest types or speaks. Dictated words land in the box for the guest to check (they
 * are never sent on their behalf), and Enter is ignored while an input method is still composing,
 * so Chinese input never sends half a word.
 */
export const Composer: React.FC<ComposerProps> = ({
  copy,
  speech,
  busy,
  replying,
  onSend,
  onFocus,
}) => {
  const [draft, setDraftText] = useState('');
  // Typing is limited by maxLength; dictation is not, so every change is capped the same way.
  const setDraft = (text: string): void => setDraftText(text.slice(0, MAX_MESSAGE_LENGTH));
  const fieldId = useId();
  const hintId = useId();
  const dictation = useDictation({
    value: draft,
    onChange: setDraft,
    messages: { ...copy.chat.dictationErrors, streamFailed: copy.chat.dictationErrors.failed },
  });
  const listening = dictation.status === 'listening';

  const send = async (): Promise<void> => {
    if (busy || listening || !draft.trim()) return;
    const text = draft;
    setDraft('');
    await onSend(text);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (!prefersEnterToSend()) return;
    event.preventDefault();
    void send();
  };

  return (
    <form
      className="border-t border-border-soft px-4 pb-4 pt-3 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor={fieldId} className="sr-only">
        {copy.chat.title}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={fieldId}
          rows={2}
          value={dictation.displayText}
          readOnly={listening}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={copy.chat.placeholder}
          aria-describedby={hintId}
          /*
           * The resting tint is written as a colour mix, not as an opacity class on the cream
           * token. Under a theme, the rule that makes translucent panels opaque matches opacity
           * classes and outranks a focus-visible or read-only variant, which hid both states. The
           * box sits on the opaque chat card, so the tint has no photograph behind it to guard
           * against.
           */
          className={`block max-h-40 min-h-12 w-full min-w-0 resize-none rounded-2xl border border-field-border bg-[color-mix(in_srgb,var(--color-surface-cream)_60%,transparent)] px-4 py-3 type-body text-notice-primary placeholder:text-notice-muted ${FIELD_FOCUS} focus-visible:bg-surface-card read-only:bg-surface-card`}
        />
        <DictationButton
          status={dictation.status}
          onToggle={dictation.toggle}
          // Not disabled when unsupported: pressing it explains why, in the guest's language.
          disabled={busy}
          labels={copy.chat.dictation}
        />
        <button
          type="submit"
          disabled={busy || listening || !draft.trim()}
          className={`${PRIMARY_BUTTON} min-h-11 flex-shrink-0 whitespace-nowrap px-5`}
        >
          {replying ? copy.chat.sending : copy.chat.send}
        </button>
      </div>
      <div id={hintId} className="mt-2 flex flex-col gap-1">
        {listening ? (
          <p role="status" className="m-0 flex items-center gap-2 type-meta text-status-danger">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-status-danger motion-safe:animate-pulse"
            />
            {copy.chat.listening}
          </p>
        ) : (
          <p className="m-0 hidden type-meta sm:block">{copy.chat.enterHint}</p>
        )}
        <p className="m-0 type-meta">{copy.chat.voiceNotice(speech)}</p>
        {dictation.error && (
          <p role="alert" className={ERROR_TEXT}>
            {dictation.error.message}
          </p>
        )}
      </div>
    </form>
  );
};
