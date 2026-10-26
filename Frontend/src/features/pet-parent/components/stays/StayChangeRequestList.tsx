import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { fetchStayChangeRequests, withdrawStayChangeRequest } from '../../api/stayChangesApi';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { StayChangeRequest } from '../../types/stayChanges';
import { IN_STAY_CHANGES_COPY, type InStayChangesCopy } from './inStayChangesCopy';
import { aucklandDateOf, formatDay, formatMoney } from './stayChangeRules';

interface StayChangeRequestListProps {
  /** Changes when a request was just sent, so the list reads again. */
  refreshKey: number;
}

/** How long a decided request stays in the list, so its answer can be read. */
const DECIDED_SHOWN_DAYS = 14;
const DAY_MS = 86_400_000;

const STATUS_STYLE: Record<StayChangeRequest['status'], string> = {
  pending: 'bg-status-warning/15 text-notice-primary',
  approved: 'bg-status-success/15 text-notice-primary',
  refused: 'bg-status-danger/10 text-status-danger',
  cancelled: 'bg-surface-cream text-notice-secondary',
};

const describe = (
  request: StayChangeRequest,
  copy: InStayChangesCopy['requests'],
  locale: ReturnType<typeof usePortalLocale>,
): string => {
  const amount = request.quotedAmount ? formatMoney(request.quotedAmount) : null;
  const { details } = request;
  switch (details.kind) {
    case 'extend':
      return copy.extend(formatDay(details.endDate, locale), amount);
    case 'add_on':
      return copy.addOn(
        details.quantity,
        details.serviceName,
        formatDay(details.date, locale),
        amount,
      );
    case 'times':
      return copy.times(details.dropOffTime ?? null, details.pickUpTime ?? null);
    case 'early_check_out':
      return copy.earlyCheckOut;
  }
};

/**
 * The parent's requests to change a stay under way, with our manager's answer: waiting, approved,
 * or not approved with the reason. A waiting request can be withdrawn. Answers stay listed for two
 * weeks; the bell and the chat keep them for longer.
 */
export function StayChangeRequestList({
  refreshKey,
}: StayChangeRequestListProps): ReactElement | null {
  const locale = usePortalLocale();
  const { requests: copy } = usePortalCopy(IN_STAY_CHANGES_COPY);
  const [requests, setRequests] = useState<StayChangeRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Read once: a decided request drops off the list after two weeks, not mid-visit.
  const [now] = useState(() => Date.now());

  const load = useCallback((): void => {
    fetchStayChangeRequests()
      .then(setRequests)
      // The list is extra: a failed read leaves My stays as it was.
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const shown = requests.filter(
    (request) =>
      request.status === 'pending' ||
      now - new Date(request.decidedAt ?? request.createdAt).getTime() <
        DECIDED_SHOWN_DAYS * DAY_MS,
  );
  if (shown.length === 0) return null;

  const withdraw = async (requestId: string): Promise<void> => {
    setBusyId(requestId);
    setProblem(null);
    try {
      await withdrawStayChangeRequest(requestId);
      load();
    } catch {
      setProblem(copy.withdrawFailed);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="stay-change-requests-title" className="flex flex-col gap-3">
      <h2 id="stay-change-requests-title" className="type-card-title m-0">
        {copy.title}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((request) => (
          <li
            key={request.id}
            className="flex flex-col gap-1 rounded-2xl border border-border-soft bg-surface-card px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="type-body font-semibold text-notice-primary">
                {describe(request, copy, locale)}
              </span>
              <span
                className={`type-meta rounded-full px-2.5 py-0.5 font-semibold ${STATUS_STYLE[request.status]}`}
              >
                {copy.status[request.status]}
              </span>
            </div>
            <span className="type-meta text-notice-secondary">
              {copy.sentOn(formatDay(aucklandDateOf(request.createdAt), locale))}
            </span>
            {request.status === 'refused' && request.refusalReason && (
              <span className="type-meta text-notice-primary">
                {copy.reason(request.refusalReason)}
              </span>
            )}
            {request.status === 'pending' && (
              <button
                type="button"
                onClick={() => void withdraw(request.id)}
                aria-disabled={busyId === request.id}
                className="type-button self-start text-accent-foreground underline-offset-2 hover:underline aria-disabled:opacity-60"
              >
                {copy.withdraw}
              </button>
            )}
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" className="type-meta m-0 text-status-danger">
          {problem}
        </p>
      )}
    </section>
  );
}
