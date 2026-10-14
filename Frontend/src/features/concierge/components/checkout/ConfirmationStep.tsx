import React from 'react';
import { Link } from 'react-router-dom';
import type { ConciergeCopy } from '../../copy';
import { useConciergeStore } from '../../store/conciergeStore';
import type { ConciergeCheckoutResponse, ConciergeSafetyTask } from '../../types';
import { newZealandDateOf } from '../../utils/cardHold';
import { formatClockTime, formatNzd, formatShortDate } from '../../utils/format';
import { buildStayCalendar, downloadCalendar } from '../../utils/ics';
import {
  CARD_TITLE,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SURFACE_CARD,
  TEXT_BUTTON,
} from '../conciergeStyles';
import { RequestReceipt } from './RequestReceipt';

interface ConfirmationStepProps {
  copy: ConciergeCopy;
  result: ConciergeCheckoutResponse;
  email: string | null;
}

/**
 * Where a safety task can be done online today. Only vaccination has a page (one per booked pet);
 * the others are gone through with the team, and the page says so rather than linking to a page
 * that cannot do them.
 */
const taskLinks = (
  task: ConciergeSafetyTask,
  bookingPetIds: string[],
): Array<{ to: string; petIndex: number | null }> =>
  task === 'vaccination_certificate'
    ? bookingPetIds.map((id, petIndex) => ({
        to: `/parent/vaccination/${id}`,
        petIndex: bookingPetIds.length > 1 ? petIndex : null,
      }))
    : [];

/**
 * The request is in. The page says plainly that it is a request waiting for review, that no email
 * went out and nothing was charged (the card is only saved), and hands over a plain receipt: the
 * reference (kept in this tab through a reload), each pet's review status, dates, times, the stay
 * and the add-ons its price covers, and the total. The boarding pass comes later, in My stays, once our manager approves a pet. Then
 * the page shows where each safety task is done and offers a calendar reminder that needs no email.
 */
export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({ copy, result, email }) => {
  const locale = useConciergeStore((state) => state.locale);
  const needs = useConciergeStore((state) => state.needs);
  const booked = useConciergeStore((state) => state.booked);
  const draft = useConciergeStore((state) => state.detailsDraft);
  const startOver = useConciergeStore((state) => state.startOver);
  const { done } = copy;
  const calendarTitle = done.calendarTitles[result.status];
  const canAddToCalendar = Boolean(needs.startDate && needs.endDate && draft);

  const addToCalendar = (): void => {
    if (!needs.startDate || !needs.endDate || !draft) return;
    downloadCalendar(
      `wagstay-${result.confirmationNumber}.ics`,
      buildStayCalendar({
        title: calendarTitle,
        reference: result.confirmationNumber,
        startDate: needs.startDate,
        endDate: needs.endDate,
        dropOffTime: draft.dropOffTime,
        pickUpTime: draft.pickUpTime,
        // Unless every stay is confirmed, the events lead with "not yet confirmed", so a calendar
        // never shows a waiting stay as booked.
        dropOffLabel: `${calendarTitle} · ${done.dropOff}`,
        pickUpLabel: `${calendarTitle} · ${done.pickUp}`,
        dropOffReminder: done.calendarDropOffReminder,
      }),
    );
  };

  return (
    <section
      aria-labelledby="concierge-step-title"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-status-success/10 font-fraunces text-card-title text-status-success"
        >
          ✓
        </span>
        <div className="min-w-0">
          <h2
            id="concierge-step-title"
            tabIndex={-1}
            className={`${CARD_TITLE} focus:outline-none`}
          >
            {done.titles[result.status]}
          </h2>
          <p className="mb-0 mt-2 type-body text-notice-secondary">{done.leads[result.status]}</p>
        </div>
      </div>

      <RequestReceipt
        copy={copy}
        locale={locale}
        result={result}
        needs={needs}
        booked={booked}
        times={draft ? { dropOffTime: draft.dropOffTime, pickUpTime: draft.pickUpTime } : null}
      />
      <p className="m-0 type-body font-semibold">
        {result.payment.status === 'charged' || !result.payment.reviewBy
          ? done.payment.charged(formatNzd(result.payment.amount))
          : done.payment.held(
              formatNzd(result.payment.amount),
              `${formatShortDate(newZealandDateOf(result.payment.reviewBy), locale)} ${formatClockTime(
                result.payment.reviewBy,
                locale,
              )}`,
            )}
      </p>
      {result.payment.testMode && (
        <p className="m-0 type-meta text-notice-secondary">{done.payment.testMode}</p>
      )}
      {result.accountCreated && email && (
        <p className="m-0 type-body [overflow-wrap:anywhere]">{done.accountCreated(email)}</p>
      )}

      <div className={`${SURFACE_CARD} p-5 sm:p-7 print:border-0 print:shadow-none`}>
        <h3 className="m-0 type-card-title font-normal">{done.whatNextTitle}</h3>
        <ol className="mb-0 mt-3 list-decimal space-y-1.5 pl-5 type-body">
          {done.whatNext.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>

        <h3 className="m-0 mt-8 type-card-title font-normal">{done.tasksTitle}</h3>
        <p className="mb-0 mt-1 type-meta text-notice-secondary">{done.tasksLead}</p>
        <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {result.safetyTasks.map((task, index) => (
            <li
              key={task}
              className="flex items-start gap-3 rounded-2xl border border-border-soft p-4"
            >
              <span
                aria-hidden="true"
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-control-border type-meta font-bold tabular-nums text-notice-primary"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block type-body font-semibold">{done.tasks[task].title}</span>
                <span className="block type-meta text-notice-secondary">
                  {done.tasks[task].detail}
                </span>
                {taskLinks(task, result.bookingPetIds).length > 0 ? (
                  <span className="mt-1 flex flex-wrap gap-x-3 print:hidden">
                    {taskLinks(task, result.bookingPetIds).map((link) => (
                      <Link key={link.to} to={link.to} className={`${TEXT_BUTTON} px-0`}>
                        {done.doItNow}
                        {link.petIndex !== null ? ` · ${done.forPet(link.petIndex)}` : ''}
                        <span className="sr-only">: {done.tasks[task].title}</span>
                      </Link>
                    ))}
                  </span>
                ) : (
                  <span className="mt-1 block type-meta text-notice-secondary">
                    {done.teamCollects}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>

        <p className="mb-0 mt-6 type-meta text-notice-secondary">{done.comeBackBySigningIn}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
        <Link to="/parent/stays" className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>
          {done.myStays}
        </Link>
        {canAddToCalendar && (
          <button type="button" onClick={addToCalendar} className={SECONDARY_BUTTON}>
            {done.addToCalendar}
          </button>
        )}
        <button type="button" onClick={() => window.print()} className={SECONDARY_BUTTON}>
          {done.print}
        </button>
        <button type="button" onClick={startOver} className={`${TEXT_BUTTON} justify-center`}>
          {done.planAnother}
        </button>
      </div>
    </section>
  );
};
