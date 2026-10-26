import { useCallback, useEffect, useState, type ReactElement } from 'react';
import {
  approveStayChangeRequest,
  fetchStayChangeRequests,
  refuseStayChangeRequest,
} from '../../api/bookingApi';
import { BOOKING_LIST_REFRESH_MS } from '../../hooks/useBookingListData';
import type { ManagerStayChangeRequest } from '../../types/booking';
import { RefuseForm } from './RefuseForm';

interface StayChangeRequestsPanelProps {
  /** Staff see the requests; only a manager decides them. */
  canDecide: boolean;
  /** After a decision the booking itself changed, so the bookings list reads again. */
  onDecided: () => void;
}

const KIND_LABELS: Record<ManagerStayChangeRequest['details']['kind'], string> = {
  extend: 'More nights',
  add_on: 'Add-on',
  times: 'New time',
  early_check_out: 'Early pick-up',
};

const sentAt = (iso: string): string =>
  new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * Parents' requests to change a stay under way (more nights, an add-on, a new time), waiting for a
 * manager. Approving makes the change at once: the booking, the bill (paid at the desk) and the
 * care tasks staff see. Refusing sends the reason to the parent. Read again every few seconds, so a
 * new request appears without a reload.
 */
export function StayChangeRequestsPanel({
  canDecide,
  onDecided,
}: StayChangeRequestsPanelProps): ReactElement | null {
  const [requests, setRequests] = useState<ManagerStayChangeRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refusingId, setRefusingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'done' | 'problem'; text: string } | null>(null);

  const load = useCallback(
    (): Promise<void> =>
      fetchStayChangeRequests()
        .then(setRequests)
        // The next read tries again; the list on screen stays.
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    void load();
    const refreshWhileVisible = (): void => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(refreshWhileVisible, BOOKING_LIST_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshWhileVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
    };
  }, [load]);

  if (requests.length === 0 && !message) return null;

  const decide = async (
    request: ManagerStayChangeRequest,
    run: () => Promise<void>,
    done: string,
  ): Promise<void> => {
    setBusyId(request.id);
    setMessage(null);
    try {
      await run();
      setRefusingId(null);
      setMessage({ tone: 'done', text: done });
      onDecided();
    } catch (error) {
      setMessage({
        tone: 'problem',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setBusyId(null);
      await load();
    }
  };

  return (
    <section
      aria-labelledby="change-requests-title"
      className="space-y-3 rounded-2xl border border-status-warning/40 bg-status-warning/5 p-4"
    >
      <h2 id="change-requests-title" className="m-0 type-card-title">
        Change requests{requests.length > 0 ? ` (${requests.length})` : ''}
      </h2>
      {message && (
        <p
          role={message.tone === 'problem' ? 'alert' : 'status'}
          className={`m-0 rounded-lg px-3 py-2 text-[13px] ${
            message.tone === 'problem'
              ? 'bg-status-danger-soft text-status-danger'
              : 'bg-status-success-soft text-status-success'
          }`}
        >
          {message.text}
        </p>
      )}
      <ul className="m-0 list-none space-y-2 p-0">
        {requests.map((request) => (
          <li key={request.id} className="space-y-2 rounded-xl bg-surface-card p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="type-body font-semibold text-notice-primary">
                {KIND_LABELS[request.details.kind]}: {request.petNames.join(', ')}
              </span>
              <span className="type-meta text-notice-secondary">
                {request.reference} · {request.ownerName} · {sentAt(request.createdAt)}
              </span>
            </div>
            <p className="m-0 type-meta text-notice-primary">
              The parent asks to {request.summary}.
              {request.quotedAmount ? ' Paid at the desk at check-out.' : ''}
            </p>
            {canDecide &&
              (refusingId === request.id ? (
                <RefuseForm
                  releasesHold={false}
                  isBusy={busyId === request.id}
                  onRefuse={(reason) =>
                    void decide(
                      request,
                      () => refuseStayChangeRequest(request.id, reason),
                      'Refused. The parent has the reason.',
                    )
                  }
                  onCancel={() => setRefusingId(null)}
                />
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() =>
                      void decide(
                        request,
                        () => approveStayChangeRequest(request.id),
                        'Approved. The stay, the bill and the care tasks are updated.',
                      )
                    }
                    className="rounded-lg bg-action-dark px-4 py-2 type-meta font-semibold text-on-action-dark transition hover:bg-action-dark-hover disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() => setRefusingId(request.id)}
                    className="rounded-lg border border-status-danger px-4 py-2 type-meta font-semibold text-status-danger transition hover:bg-status-danger-soft disabled:opacity-50"
                  >
                    Refuse
                  </button>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
