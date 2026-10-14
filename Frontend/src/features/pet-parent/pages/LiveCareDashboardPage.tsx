import { PortalIllustration as Illustration } from '../components/illustrations/PortalIllustration';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { LiveCareData } from '../types/liveCare';
import type { PetStay } from '../types/stays';
import { usePortalCopy, usePortalLocale, type PortalLocale } from '../i18n/portalLocale';
import { requestErrorText } from '../i18n/requestErrorText';
import { PageHeader, PortalPage } from '../components/layout/PortalPage';
import { PRIMARY_BUTTON } from '../components/home/homeStyles';
import { RING_AND_CONNECTOR_CSS } from '../components/live-care/ringConnectorStyles';
import { CareHeroCard } from '../components/live-care/CareHeroCard';
import { CareDaySection } from '../components/live-care/CareDaySection';
import { PetSwitcher } from '../components/live-care/PetSwitcher';
import { formatStayDates } from '../components/live-care/liveCareDates';
import { LIVE_CARE_COPY, type LiveCareCopy } from '../components/live-care/liveCareCopy';
import {
  defaultLiveCareStay,
  stayPhase,
  staysInProgress,
  type StayPhase,
} from '../components/live-care/liveCareStatus';
import { useLiveCare, type LiveCareLoadError } from '../components/live-care/useLiveCare';
import { useMyStays } from '../components/live-care/useMyStays';
import { liveCareIn } from '../components/live-care/liveCareWords';

const STAYS_PATH = '/parent/stays';
const SECONDS_PER_MINUTE = 60;

// The dashed box the loading, empty and error states share.
const STATE_BOX =
  'flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-soft px-6 py-10 text-center';

function LiveCareHeader({ lead }: { lead?: ReactNode }): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).page;
  return (
    <PageHeader title={copy.title} lead={lead} back={{ to: STAYS_PATH, label: copy.backToStays }} />
  );
}

function StatePage({ children }: { children: ReactNode }): ReactElement {
  return (
    <PortalPage width="narrow">
      <LiveCareHeader />
      <div className={STATE_BOX}>{children}</div>
    </PortalPage>
  );
}

function lastUpdatedLabel(secondsSinceUpdate: number, copy: LiveCareCopy['footnote']): string {
  return secondsSinceUpdate < SECONDS_PER_MINUTE
    ? copy.justNow
    : copy.minutesAgo(Math.floor(secondsSinceUpdate / SECONDS_PER_MINUTE));
}

function loadErrorText(
  error: LiveCareLoadError | null,
  copy: LiveCareCopy['page'],
  locale: PortalLocale,
): string {
  if (error === null) return copy.somethingWentWrong;
  return requestErrorText(error.cause, locale, copy.loadFailed);
}

/** The line under the day's care. Only a stay under way is live, so only then does the page
 * promise updates; otherwise it says what the page is showing instead. */
function StayFootnote({
  phase,
  petName,
  secondsSinceUpdate,
}: {
  phase: StayPhase;
  petName: string;
  secondsSinceUpdate: number;
}): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).footnote;
  const text: Record<StayPhase, string> = {
    'in-progress': copy.live(lastUpdatedLabel(secondsSinceUpdate, copy)),
    ended: copy.ended(petName),
    upcoming: copy.upcoming(petName),
  };
  return <p className="type-meta m-0 text-center">{text[phase]}</p>;
}

function LoadingPage(): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).page;
  return (
    <StatePage>
      <p role="status" className="type-meta m-0">
        {copy.loading}
      </p>
    </StatePage>
  );
}

function LiveCareView({
  data,
  myStays,
  currentBookingPetId,
  switchingToPet,
  selectedDate,
  onSelectDate,
  secondsSinceUpdate,
}: {
  data: LiveCareData;
  myStays: PetStay[];
  /** The stay the address asks for, which the switcher marks even before its updates arrive. */
  currentBookingPetId: string;
  /** Set while another pet's updates load: `data` still holds the pet before it. The name is
   * undefined when the parent's stays did not load. */
  switchingToPet: { name: string | undefined } | null;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  secondsSinceUpdate: number;
}): ReactElement {
  const locale = usePortalLocale();
  const copy = usePortalCopy(LIVE_CARE_COPY).page;
  const booking = myStays.find((stay) => stay.bookingPetId === data.bookingPetId);
  const phase = stayPhase(data, booking);
  const switching = switchingToPet !== null;
  const stayLead = copy.stayLead(
    data.petName,
    formatStayDates(data.dropOffDate, data.pickUpDate, locale),
  );
  const loadingLead = switchingToPet?.name ? copy.loadingPet(switchingToPet.name) : copy.loading;

  return (
    <PortalPage width="narrow">
      <style>{RING_AND_CONNECTOR_CSS}</style>
      <LiveCareHeader
        // A live region, so a screen reader hears the switch start and then the stay it lands on.
        lead={<span role="status">{switching ? loadingLead : stayLead}</span>}
      />
      <PetSwitcher stays={staysInProgress(myStays)} currentBookingPetId={currentBookingPetId} />
      {/* The pet before stays up, dimmed, while the next one loads, so the switcher keeps its
          place and its focus instead of the page falling back to the loading box. */}
      <div
        aria-busy={switching}
        className={`flex flex-col gap-6 motion-safe:transition-opacity sm:gap-8 ${switching ? 'opacity-60' : ''}`}
      >
        <CareHeroCard
          petName={data.petName}
          petPhotoUrl={data.petPhotoUrl}
          sitterName={data.sitterName}
          location={data.location}
          phase={phase}
        />
        <CareDaySection data={data} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        <StayFootnote
          phase={phase}
          petName={data.petName}
          secondsSinceUpdate={secondsSinceUpdate}
        />
      </div>
    </PortalPage>
  );
}

/** One stay's live care. `bookingPetId` undefined leaves the choice to the server. */
function LiveCareForStay({
  bookingPetId,
  myStays,
}: {
  bookingPetId: string | undefined;
  myStays: PetStay[];
}): ReactElement {
  const liveCare = useLiveCare(bookingPetId);
  const locale = usePortalLocale();
  const copy = usePortalCopy(LIVE_CARE_COPY).page;
  const { data, loading, notFound, error } = liveCare;
  // Task names, times and labels arrive in English; the view shows them in the page language.
  const shownData = useMemo(() => (data ? liveCareIn(data, locale) : null), [data, locale]);
  const isAskedStay = data !== null && (!bookingPetId || data.bookingPetId === bookingPetId);
  // After a switch, `data` holds the pet before until the next answer arrives.
  const isSwitching = data !== null && !isAskedStay && loading;

  if (shownData && (isAskedStay || isSwitching)) {
    return (
      <LiveCareView
        data={shownData}
        myStays={myStays}
        currentBookingPetId={bookingPetId ?? data.bookingPetId}
        switchingToPet={
          isSwitching
            ? { name: myStays.find((stay) => stay.bookingPetId === bookingPetId)?.pet.name }
            : null
        }
        selectedDate={liveCare.selectedDate ?? data.selectedDate}
        onSelectDate={liveCare.selectDate}
        secondsSinceUpdate={liveCare.secondsSinceUpdate}
      />
    );
  }

  if (loading) return <LoadingPage />;

  if (notFound) {
    return (
      <StatePage>
        <Illustration
          name="empty-care"
          className="w-full max-w-xs"
          imageClassName="aspect-[4/3] w-full rounded-2xl object-contain"
        />
        <div>
          <p className="type-body m-0 font-bold">{copy.notFoundTitle}</p>
          <p className="type-meta m-0 mt-1.5">{copy.notFoundBody}</p>
        </div>
        <Link to={STAYS_PATH} className={PRIMARY_BUTTON}>
          {copy.viewMyStays}
        </Link>
      </StatePage>
    );
  }

  return (
    <StatePage>
      <p role="alert" className="type-body m-0 font-bold text-status-danger">
        {loadErrorText(error, copy, locale)}
      </p>
      <button type="button" onClick={liveCare.retry} className={PRIMARY_BUTTON}>
        {copy.tryAgain}
      </button>
    </StatePage>
  );
}

/**
 * /parent/live-care/:bookingPetId shows that stay. /parent/live-care with no id opens the stay
 * under way, else the one that ended last (see defaultLiveCareStay), and moves the address to it
 * so the pet switcher and a reload stay on that stay. When the parent's stays cannot tell (none
 * under way or ended, or the list failed to load), the server picks.
 */
export function LiveCareDashboardPage(): ReactElement {
  const { bookingPetId } = useParams<{ bookingPetId?: string }>();
  const myStays = useMyStays();

  if (bookingPetId) {
    return <LiveCareForStay bookingPetId={bookingPetId} myStays={myStays.stays} />;
  }

  if (myStays.status === 'loading') return <LoadingPage />;

  const stay = defaultLiveCareStay(myStays.stays);
  if (stay) return <Navigate replace to={`/parent/live-care/${stay.bookingPetId}`} />;

  return <LiveCareForStay bookingPetId={undefined} myStays={myStays.stays} />;
}
