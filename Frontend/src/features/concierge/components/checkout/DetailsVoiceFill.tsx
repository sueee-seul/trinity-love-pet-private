import React, { useId, useState } from 'react';
import { DictationButton, useDictation } from '../../../../shared/dictation';
import { conciergeApi } from '../../api/conciergeApi';
import type { ConciergeCopy } from '../../copy';
import { DETAILS_FILL_COPY } from '../../detailsFillCopy';
import { useConciergeStore } from '../../store/conciergeStore';
import type { ConciergeDetailsDraft } from '../../types';
import { saidFields } from '../../utils/applyDetailsDraft';
import { ERROR_TEXT, FIELD_FOCUS, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../conciergeStyles';

const MAX_TEXT = 2000;

interface DetailsVoiceFillProps {
  copy: ConciergeCopy;
  /** Called only when the guest presses "Use these details", never by the reading itself. */
  onUse: (read: ConciergeDetailsDraft) => void;
}

/**
 * The details step's "say it once" box, like the pet form's describe-your-pet helper: speak or type,
 * see what was understood, and only then let it fill the empty fields. Nothing reaches the form
 * without the guest's press, so a misheard number is caught before it is sent.
 */
export const DetailsVoiceFill: React.FC<DetailsVoiceFillProps> = ({ copy, onUse }) => {
  const locale = useConciergeStore((state) => state.locale);
  const words = DETAILS_FILL_COPY[locale];
  const [text, setTextValue] = useState('');
  const setText = (value: string): void => setTextValue(value.slice(0, MAX_TEXT));
  const [status, setStatus] = useState<'idle' | 'reading' | 'review' | 'failed'>('idle');
  const [read, setRead] = useState<ConciergeDetailsDraft | null>(null);
  const fieldId = useId();
  const dictation = useDictation({
    value: text,
    onChange: setText,
    messages: { ...copy.chat.dictationErrors, streamFailed: copy.chat.dictationErrors.failed },
  });
  const listening = dictation.status === 'listening';
  const lines = read ? saidFields(read) : [];

  const readText = async (): Promise<void> => {
    if (!text.trim() || listening) return;
    setStatus('reading');
    try {
      const { draft } = await conciergeApi.readDetails(text.trim());
      setRead(draft);
      setStatus('review');
    } catch {
      setStatus('failed');
    }
  };

  const label = (key: string): string => {
    const pet = /^pet(\d+)$/.exec(key);
    return pet ? words.pet(Number(pet[1])) : (words.fieldNames[key] ?? key);
  };

  return (
    <section
      aria-labelledby={`${fieldId}-title`}
      className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface-cream/60 p-4 sm:p-5"
    >
      <h3 id={`${fieldId}-title`} className="m-0 type-card-title font-normal">
        {words.title}
      </h3>
      <p className="m-0 type-meta text-notice-secondary">{words.lead}</p>
      <label htmlFor={fieldId} className="sr-only">
        {words.label}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={fieldId}
          rows={3}
          value={dictation.displayText}
          readOnly={listening}
          maxLength={MAX_TEXT}
          placeholder={words.placeholder}
          onChange={(event) => setText(event.target.value)}
          className={`block min-h-20 w-full min-w-0 resize-y rounded-2xl border border-field-border bg-surface-card px-4 py-3 type-body text-notice-primary placeholder:text-notice-muted ${FIELD_FOCUS}`}
        />
        <DictationButton
          status={dictation.status}
          onToggle={dictation.toggle}
          disabled={status === 'reading'}
          labels={copy.chat.dictation}
        />
      </div>
      {dictation.error && (
        <p role="alert" className={ERROR_TEXT}>
          {dictation.error.message}
        </p>
      )}
      <button
        type="button"
        onClick={() => void readText()}
        disabled={!text.trim() || listening || status === 'reading'}
        className={`${SECONDARY_BUTTON} self-start`}
      >
        {status === 'reading' ? words.reading : words.read}
      </button>
      {status === 'failed' && (
        <p role="alert" className={ERROR_TEXT}>
          {words.failed}
        </p>
      )}
      {status === 'review' && read && (
        <div role="status" className="flex flex-col gap-3">
          {lines.length === 0 ? (
            <p className="m-0 type-meta">{words.nothingFound}</p>
          ) : (
            <>
              <p className="m-0 type-body font-semibold">{words.foundTitle}</p>
              <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 type-meta">
                {lines.map(([key, value]) => (
                  <React.Fragment key={key}>
                    <dt className="text-notice-muted">{label(key)}</dt>
                    <dd className="m-0 text-notice-primary">{value}</dd>
                  </React.Fragment>
                ))}
              </dl>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  onClick={() => {
                    onUse(read);
                    setStatus('idle');
                    setRead(null);
                  }}
                >
                  {words.use}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON}
                  onClick={() => {
                    setStatus('idle');
                    setRead(null);
                  }}
                >
                  {words.discard}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
