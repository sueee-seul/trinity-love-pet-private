import React, { useId, useState } from 'react';
import { DateField } from '../../../../shared/components/ui/date';
import type { ConciergeCopy } from '../../copy';
import type { ConciergeLocale, ConciergeNeeds } from '../../types';
import {
  addDays,
  dateProblem,
  formatDateRange,
  nightsBetween,
  todayInNewZealand,
} from '../../utils/format';
import { withDates } from '../../utils/needsEdit';
import type { QuickReply, QuickReplyGroup } from '../../utils/quickReplies';
import { ERROR_TEXT, FIELD_BOX, FIELD_LABEL, PRIMARY_BUTTON } from '../conciergeStyles';

interface QuickRepliesProps {
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  needs: ConciergeNeeds;
  group: QuickReplyGroup;
  disabled: boolean;
  onAnswer: (message: string, apply: (needs: ConciergeNeeds) => ConciergeNeeds) => void;
  /** A chip that is spoken to the assistant as a message. */
  onSay: (message: string) => void;
  onOpenChecklist: () => void;
  onTalkToPerson: () => void;
  onSeeOptions: () => void;
}

export const CHIP =
  'inline-flex min-h-11 items-center justify-center rounded-full border border-control-border bg-surface-card px-4 type-body font-semibold text-notice-primary transition-[background-color,border-color] duration-200 hover:border-action-dark hover:bg-surface-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

/** Two date fields and a live preview, inside the chat, so dates are never misread. */
const DatesCard: React.FC<{
  copy: ConciergeCopy;
  locale: ConciergeLocale;
  needs: ConciergeNeeds;
  disabled: boolean;
  onUse: (startDate: string, endDate: string) => void;
}> = ({ copy, locale, needs, disabled, onUse }) => {
  const today = todayInNewZealand();
  const [start, setStart] = useState(needs.startDate ?? '');
  const [end, setEnd] = useState(needs.endDate ?? '');
  const startId = useId();
  const endId = useId();
  const problem = start && end ? dateProblem(start, end, today) : null;
  const ready = Boolean(start && end && !problem);

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-surface-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !disabled) onUse(start, end);
      }}
    >
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={startId} className={FIELD_LABEL}>
            {copy.checklist.startDate}
          </label>
          <DateField
            id={startId}
            locale={locale}
            min={today}
            value={start}
            onChange={(next) => {
              // Keep the stay length when the drop-off moves; never leave pick-up before it.
              if (next && end && start && end > start) {
                setEnd(addDays(next, nightsBetween(start, end)));
              } else if (next && (!end || end <= next)) {
                setEnd(addDays(next, 1));
              }
              setStart(next);
            }}
            dialogLabel={copy.checklist.startDate}
            className={FIELD_BOX}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={endId} className={FIELD_LABEL}>
            {copy.checklist.endDate}
          </label>
          <DateField
            id={endId}
            locale={locale}
            min={start ? addDays(start, 1) : addDays(today, 1)}
            // With no pick-up yet, open on the drop-off month rather than today's.
            defaultMonth={start || undefined}
            value={end}
            onChange={setEnd}
            dialogLabel={copy.checklist.endDate}
            className={FIELD_BOX}
          />
        </div>
      </div>
      {ready && (
        <p className="m-0 type-body font-semibold">
          {copy.answers.datesPreview(
            formatDateRange(start, end, locale, today),
            copy.stay.nights(nightsBetween(start, end)),
          )}
        </p>
      )}
      {problem && (
        <p role="alert" className={ERROR_TEXT}>
          {copy.stay.dateProblem[problem]}
        </p>
      )}
      <button
        type="submit"
        aria-disabled={!ready || disabled}
        className={`${PRIMARY_BUTTON} self-start aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
      >
        {copy.answers.useDates}
      </button>
    </form>
  );
};

/**
 * Tap-to-answer buttons for whatever the plan still needs. Each tap is a structured change (no
 * text to misread) that also shows as the guest's own message, so the chat still reads naturally.
 */
export const QuickReplies: React.FC<QuickRepliesProps> = ({
  copy,
  locale,
  needs,
  group,
  disabled,
  onAnswer,
  onSay,
  onOpenChecklist,
  onTalkToPerson,
  onSeeOptions,
}) => {
  const [datesOpen, setDatesOpen] = useState(false);
  const labelId = useId();

  const press = (reply: QuickReply): void => {
    if (disabled) return;
    if (reply.kind === 'answer') onAnswer(reply.message, reply.apply);
    else if (reply.kind === 'say') onSay(reply.message);
    else if (reply.kind === 'dates') setDatesOpen(true);
    else if (reply.kind === 'checklist') onOpenChecklist();
    else if (reply.kind === 'person') onTalkToPerson();
    else onSeeOptions();
  };

  const onlyDates = group.replies.length === 1 && group.replies[0]?.kind === 'dates';

  return (
    <div id="concierge-quick-replies" className="border-t border-border-soft px-4 py-3 sm:px-6">
      <p id={labelId} className="m-0 mb-2 type-meta font-semibold">
        {group.label}
      </p>
      {onlyDates || datesOpen ? (
        <DatesCard
          copy={copy}
          locale={locale}
          needs={needs}
          disabled={disabled}
          onUse={(startDate, endDate) => {
            setDatesOpen(false);
            onAnswer(
              copy.answers.chipMessage.dates(formatDateRange(startDate, endDate, locale)),
              (current) => withDates(current, startDate, endDate),
            );
          }}
        />
      ) : (
        <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {group.replies.map((reply) => (
            <button
              key={reply.id}
              type="button"
              onClick={() => press(reply)}
              aria-disabled={disabled}
              className={CHIP}
            >
              {reply.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
