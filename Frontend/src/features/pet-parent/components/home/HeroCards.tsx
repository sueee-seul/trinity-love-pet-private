import { type ReactElement, type ReactNode, useId } from 'react';
import { PortalIllustration as Illustration } from '../illustrations/PortalIllustration';
import type { IllustrationName } from '../../../../shared/illustrations/illustrationAssets';
import { Link } from 'react-router-dom';
import { serviceNameText } from '../../../concierge/utils/serviceNames';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { CurrentStay, HomePet, StayGroupSummary, UpcomingStay } from '../../types/home';
import {
  PETS_TAB_LINK,
  bookHeroFor,
  daysToGoLabel,
  formatStayRange,
  liveCareLink,
  nightsLabel,
  pickUpLabel,
  prepareLink,
  stayingTitle,
  upcomingTitle,
} from '../../utils/home';
import { STAY_STATUS_COPY, hasBoardingPass } from '../stays/stayStatus';
import { BeforeTheStay } from './BeforeTheStay';
import { HOME_COPY } from './homeCopy';
import { HomeIcon, type HomeIconName } from './HomeIcons';
import {
  ICON_TILE,
  INNER_PANEL,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  STATUS_PILL,
  STATUS_TONE,
} from './homeStyles';
import { TodaysUpdateLine } from './TodaysUpdateLine';

const BOOKING = '/parent/booking';
const STAYS = '/parent/stays';

const HERO_TITLE = 'type-card-title m-0 font-normal';
const HERO_ACTIONS = 'mt-6 flex flex-col gap-3 sm:flex-row';

// The status chip on the left and how long is left on the right; they wrap onto two lines on a
// narrow phone rather than squeeze.
function HeroStatusRow({
  status,
  tone,
  timing,
}: {
  status: string;
  tone: keyof typeof STATUS_TONE;
  timing: string;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <span className={`${STATUS_PILL} ${STATUS_TONE[tone]}`}>{status}</span>
      <span className="type-meta font-bold text-accent-foreground">{timing}</span>
    </div>
  );
}

/** "12 Sep to 16 Sep · 4 nights · Overnight boarding" */
function StayFacts({ stay }: { stay: StayGroupSummary }): ReactElement {
  const locale = usePortalLocale();
  return (
    <p className="type-meta m-0 mt-1">
      {formatStayRange(stay.dropOffAt, stay.pickUpAt, locale)} · {nightsLabel(stay.nights, locale)}{' '}
      · {serviceNameText(stay.serviceType, locale)}
    </p>
  );
}

// Icon tile on the left and text + buttons to its right from `lg`; stacked on mobile.
function IconHero({
  icon,
  title,
  body,
  children,
  illustration,
}: {
  icon: HomeIconName;
  title: string;
  body: string;
  children: ReactNode;
  illustration?: IllustrationName;
}): ReactElement {
  return (
    <section
      className={`${INNER_PANEL} theme-key-card flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5`}
    >
      {illustration ? (
        <Illustration
          name={illustration}
          className="w-40 shrink-0"
          imageClassName="aspect-[4/3] w-full rounded-xl object-contain"
        />
      ) : (
        <span className={ICON_TILE}>
          <HomeIcon name={icon} className="h-6 w-6" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className={HERO_TITLE}>{title}</h2>
        <p className="type-body m-0 mt-1.5 max-w-[52ch] text-notice-secondary">{body}</p>
        <div className={HERO_ACTIONS}>{children}</div>
      </div>
    </section>
  );
}

// State A: nothing to show yet, so the one action is to add a pet.
export function CreatePetHero(): ReactElement {
  const copy = usePortalCopy(HOME_COPY);
  return (
    <IconHero
      icon="paw"
      illustration="empty-pets"
      title={copy.createPetTitle}
      body={copy.createPetBody}
    >
      <Link to={PETS_TAB_LINK} className={PRIMARY_BUTTON}>
        {copy.addYourPet}
      </Link>
    </IconHero>
  );
}

// States B1 / B2: no upcoming stay.
export function BookStayHero({
  state,
  pets,
}: {
  state: 'B1' | 'B2';
  pets: HomePet[];
}): ReactElement {
  const locale = usePortalLocale();
  const copy = HOME_COPY[locale];
  const hero = bookHeroFor(state, pets, locale);
  return (
    <IconHero icon="calendar" illustration="empty-stays" title={hero.title} body={hero.body}>
      <Link to={BOOKING} className={PRIMARY_BUTTON}>
        {copy.startBooking}
      </Link>
      {hero.showPastBookings && (
        <Link to={STAYS} className={SECONDARY_BUTTON}>
          {copy.viewPastBookings}
        </Link>
      )}
    </IconHero>
  );
}

// States C1 / C2: the soonest upcoming stay and what is left to do before it. The chip says where
// the manager's review stands, since a request is not a booked place until it is approved. Once it
// is approved the stay has a boarding pass, so the details button names it; the pass itself sits
// at the top of the same details modal.
export function UpcomingStayHero({
  stay,
  onViewBooking,
}: {
  stay: UpcomingStay;
  /** Opens the booking-details modal (shared with My Stays) instead of navigating away. */
  onViewBooking: () => void;
}): ReactElement {
  const locale = usePortalLocale();
  const copy = HOME_COPY[locale];
  const prepare = prepareLink(stay.checklist);
  const viewLabel = hasBoardingPass(stay) ? copy.viewBoardingPass : copy.viewBooking;
  return (
    <section className={`${INNER_PANEL} theme-key-card`} aria-labelledby="upcoming-stay-title">
      <HeroStatusRow
        status={STAY_STATUS_COPY[locale][stay.status]}
        tone={stay.status === 'approved' ? 'success' : 'neutral'}
        timing={daysToGoLabel(stay.daysToGo, locale)}
      />

      <h2 id="upcoming-stay-title" className={`${HERO_TITLE} mt-4`}>
        {upcomingTitle(stay, locale)}
      </h2>
      <StayFacts stay={stay} />

      <BeforeTheStay checklist={stay.checklist} />

      <div className={HERO_ACTIONS}>
        {prepare ? (
          <Link to={prepare} className={PRIMARY_BUTTON}>
            {copy.prepareForStay}
          </Link>
        ) : (
          // Nothing left to fix: the primary action is to review the booking.
          <button type="button" onClick={onViewBooking} className={PRIMARY_BUTTON}>
            {viewLabel}
          </button>
        )}
        {prepare && (
          <button type="button" onClick={onViewBooking} className={SECONDARY_BUTTON}>
            {viewLabel}
          </button>
        )}
      </div>
    </section>
  );
}

// A stay under way: the pets are here now, so the one clear next step is their updates.
export function CurrentStayHero({
  stay,
  onViewBooking,
}: {
  stay: CurrentStay;
  /** Opens the booking-details modal (shared with My Stays) instead of navigating away. */
  onViewBooking: () => void;
}): ReactElement {
  const locale = usePortalLocale();
  const copy = HOME_COPY[locale];
  const firstPet = stay.pets[0];
  // Two bookings can be under way at once, so each card names its own heading.
  const titleId = useId();
  return (
    <section className={`${INNER_PANEL} theme-key-card`} aria-labelledby={titleId}>
      <HeroStatusRow
        status={STAY_STATUS_COPY[locale].staying_now}
        tone="success"
        timing={pickUpLabel(stay.daysUntilPickUp, locale)}
      />

      <h2 id={titleId} className={`${HERO_TITLE} mt-4`}>
        {stayingTitle(stay, locale)}
      </h2>
      <StayFacts stay={stay} />
      {/* Today's update for the first pet, the one Live care opens on. */}
      {firstPet && (
        <TodaysUpdateLine bookingPetId={firstPet.bookingPetId} to={liveCareLink(stay)} />
      )}

      <div className={HERO_ACTIONS}>
        <Link to={liveCareLink(stay)} className={PRIMARY_BUTTON}>
          {copy.seeTodaysUpdates}
        </Link>
        <button type="button" onClick={onViewBooking} className={SECONDARY_BUTTON}>
          {copy.viewBooking}
        </button>
      </div>
    </section>
  );
}
