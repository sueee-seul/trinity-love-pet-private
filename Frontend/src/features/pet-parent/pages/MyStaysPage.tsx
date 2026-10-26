import { PortalIllustration as Illustration } from '../components/illustrations/PortalIllustration';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { MyStaysPageProps, PetStay, StaysTab } from '../types/stays';
import { fetchMyBookings } from '../api/bookingApi';
import { usePortalCopy, usePortalLocale } from '../i18n/portalLocale';
import { requestErrorText } from '../i18n/requestErrorText';
import { PageHeader, PortalPage } from '../components/layout/PortalPage';
import { PRIMARY_BUTTON } from '../components/home/homeStyles';
import { StaysTabs } from '../components/stays/StaysTabs';
import { STAYS_PANEL_ID, staysTabId } from '../components/stays/staysTabIds';
import { PetStayCard } from '../components/stays/PetStayCard';
import { BookingDetailsModal } from '../components/stays/BookingDetailsModal';
import { StayChangeDialogs } from '../components/stays/StayChangeDialogs';
import { StayChangeRequestList } from '../components/stays/StayChangeRequestList';
import {
  dialogFromUrl,
  type OpenStayDialog,
  type StayDialogKind,
} from '../components/stays/stayDialogs';
import type { StayChangeHandlers } from '../components/stays/StayChangeLinks';
import { IN_STAY_CHANGES_COPY } from '../components/stays/inStayChangesCopy';
import { STAY_CHANGES_COPY } from '../components/stays/stayChangesCopy';
import { stayChangeNoticeText, type StayChangeNotice } from '../components/stays/stayChangeNotice';
import { STAYS_COPY } from '../components/stays/staysCopy';
import { bookingHasArrivalOutcome, isOnBooking } from '../components/stays/stayChangeRules';
import { stayTab } from '../components/stays/stayStatus';

const BOOKING_PATH = '/parent/booking';

// The dashed box every non-list state of the panel uses: loading, error and empty.
const STATE_BOX =
  'flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-soft px-6 py-10 text-center';

// The server's words when the load failed with a message; null means the page writes its own.
/** Kept as thrown, so switching the language after a failure still changes the words. */
interface LoadFailure {
  cause: unknown;
}

export function MyStaysPage({
  stays,
  onViewCare,
  onViewBookingDetails,
}: MyStaysPageProps): ReactElement {
  const copy = usePortalCopy(STAYS_COPY).page;
  const noticeCopy = {
    changes: usePortalCopy(STAY_CHANGES_COPY).notice,
    inStay: usePortalCopy(IN_STAY_CHANGES_COPY).notice,
  };
  const locale = usePortalLocale();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<StaysTab>('upcoming');
  const [fetchedStays, setFetchedStays] = useState<PetStay[]>([]);
  const [loading, setLoading] = useState(stays === undefined);
  const [error, setError] = useState<LoadFailure | null>(null);
  const [detailsBookingPetId, setDetailsBookingPetId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenStayDialog | null>(null);
  const [notice, setNotice] = useState<StayChangeNotice | null>(null);
  // Bumped after a change request is sent, so the request list reads again.
  const [requestsVersion, setRequestsVersion] = useState(0);

  // `stays` overrides the fetch entirely (tests/previews). Otherwise load
  // the pet parent's real bookings once on mount.
  const load = useCallback((): void => {
    if (stays !== undefined) return;
    setLoading(true);
    setError(null);
    fetchMyBookings()
      .then(setFetchedStays)
      .catch((err: unknown) => {
        setError({ cause: err });
      })
      .finally(() => setLoading(false));
  }, [stays]);

  useEffect((): void => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const allStays = stays ?? fetchedStays;

  // A link from elsewhere (`?open=extend&stay=<bookingPetId>`) opens that dialog once the stays
  // are here, then drops the parameters so a refresh does not open it again.
  useEffect((): void => {
    if (loading || !searchParams.has('open')) return;
    const stayId = searchParams.get('stay');
    const stay = allStays.find((candidate) => candidate.bookingPetId === stayId);
    const opened = dialogFromUrl(searchParams.get('open'), stay);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (opened) setDialog(opened);
    const next = new URLSearchParams(searchParams);
    next.delete('open');
    next.delete('stay');
    setSearchParams(next, { replace: true });
  }, [loading, allStays, searchParams, setSearchParams]);

  const handleViewCare = (bookingPetId: string): void => {
    if (onViewCare) {
      onViewCare(bookingPetId);
    } else {
      navigate(`/parent/live-care/${bookingPetId}`);
    }
  };

  const handleViewBookingDetails = (bookingPetId: string): void => {
    if (onViewBookingDetails) {
      onViewBookingDetails(bookingPetId);
    } else {
      setDetailsBookingPetId(bookingPetId);
    }
  };

  // The tabs follow the status the server sent (see stayTab). Stays under way
  // float to the top of Upcoming.
  const isStayingNow = (stay: PetStay): number => Number(stay.status === 'staying_now');
  const upcomingCards = allStays
    .filter((stay) => stayTab(stay) === 'upcoming')
    .sort((a, b) => isStayingNow(b) - isStayingNow(a));
  const pastCards = allStays.filter((stay) => stayTab(stay) === 'past');
  const visibleCards = activeTab === 'upcoming' ? upcomingCards : pastCards;
  const selectedStay = allStays.find((stay) => stay.bookingPetId === detailsBookingPetId) ?? null;
  // A change covers the whole booking, so the dialogs name every pet still on it.
  const petNamesOf = (stay: PetStay): string[] =>
    allStays
      .filter((other) => other.bookingId === stay.bookingId && isOnBooking(other))
      .map((other) => other.pet.name);

  const open =
    (kind: StayDialogKind) =>
    (stay: PetStay): void =>
      setDialog({ kind, stay });

  // Once any pet on the booking has arrived (or not), the desk owns the dates: no cancelling or
  // moving online. The in-stay changes are for exactly that stay; the card's rules show them.
  const changeHandlersFor = (stay: PetStay): StayChangeHandlers => ({
    ...(bookingHasArrivalOutcome(stay, allStays)
      ? {}
      : { onCancel: open('cancel'), onChangeDates: open('move') }),
    onExtend: open('extend'),
    onAddOn: open('add-on'),
    onChangeTimes: open('times'),
  });

  // The details view offers the same changes as the card, and closes to make room for the dialog.
  const detailsChangeHandlers: StayChangeHandlers = selectedStay
    ? Object.fromEntries(
        Object.entries(changeHandlersFor(selectedStay)).map(([name, handler]) => [
          name,
          (stay: PetStay): void => {
            setDetailsBookingPetId(null);
            handler(stay);
          },
        ]),
      )
    : {};

  const handleChanged = (done: StayChangeNotice): void => {
    setDialog(null);
    setNotice(done);
    if (done.kind === 'requested') setRequestsVersion((version) => version + 1);
    load();
  };

  const errorText = error && requestErrorText(error.cause, locale, copy.loadError);

  const renderPanel = (): ReactElement => {
    if (loading) {
      return (
        <div className={STATE_BOX}>
          <p role="status" className="type-meta m-0">
            {copy.loading}
          </p>
        </div>
      );
    }
    if (errorText) {
      return (
        <div className={STATE_BOX}>
          <p role="alert" className="type-body m-0 font-bold text-status-danger">
            {errorText}
          </p>
          <button type="button" onClick={load} className={PRIMARY_BUTTON}>
            {copy.tryAgain}
          </button>
        </div>
      );
    }
    if (visibleCards.length === 0) {
      return (
        <div className={STATE_BOX}>
          <Illustration
            name="empty-stays"
            className="w-full max-w-xs"
            imageClassName="aspect-[4/3] w-full rounded-2xl object-contain"
          />
          <p className="type-body m-0 text-notice-secondary">
            {activeTab === 'upcoming' ? copy.emptyUpcoming : copy.emptyPast}
          </p>
          {activeTab === 'upcoming' && (
            <Link to={BOOKING_PATH} className={PRIMARY_BUTTON}>
              {copy.bookAStay}
            </Link>
          )}
        </div>
      );
    }
    return (
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {visibleCards.map((stay) => (
          <li key={stay.bookingPetId}>
            <PetStayCard
              stay={stay}
              onViewBookingDetails={handleViewBookingDetails}
              onViewCare={handleViewCare}
              {...changeHandlersFor(stay)}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <PortalPage width="narrow">
      <PageHeader title={copy.title} lead={copy.lead} />

      <div className="flex flex-col gap-5">
        <StaysTabs
          activeTab={activeTab}
          upcomingCount={upcomingCards.length}
          onTabChange={setActiveTab}
        />
        {notice && (
          <p
            role="status"
            className="type-body m-0 rounded-2xl bg-surface-cream px-4 py-3 font-semibold"
          >
            {stayChangeNoticeText(notice, noticeCopy, locale)}
          </p>
        )}
        {stays === undefined && <StayChangeRequestList refreshKey={requestsVersion} />}
        <div
          role="tabpanel"
          id={STAYS_PANEL_ID}
          aria-labelledby={staysTabId(activeTab)}
          className="rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
          tabIndex={0}
        >
          {renderPanel()}
        </div>
      </div>

      <BookingDetailsModal
        stay={selectedStay}
        onClose={(): void => setDetailsBookingPetId(null)}
        {...detailsChangeHandlers}
      />
      <StayChangeDialogs
        dialog={dialog}
        petNames={dialog ? petNamesOf(dialog.stay) : []}
        onClose={(): void => setDialog(null)}
        onChanged={handleChanged}
      />
    </PortalPage>
  );
}
