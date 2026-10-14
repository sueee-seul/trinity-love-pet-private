import { type ReactElement } from 'react';
import { usePortalLocale } from '../../i18n/portalLocale';
import type { HomeData } from '../../types/home';
import { greetingFor, resolveQuickActions } from '../../utils/home';
import { PageHeader } from '../layout/PortalPage';
import { AlsoComingUpSection } from './AlsoComingUp';
import { GetReadyCards } from './GetReadyCards';
import { BookStayHero, CreatePetHero, CurrentStayHero, UpcomingStayHero } from './HeroCards';
import { HOME_COPY } from './homeCopy';
import { SECTION_TITLE } from './homeStyles';
import { HowItWorks } from './HowItWorks';
import { NeedsAttention } from './NeedsAttention';
import { QuickActions } from './QuickActions';
import { useBookingDetailsModal } from './useBookingDetailsModal';
import { YourPets } from './YourPets';

// The homepage for one resolved state (A, B1, B2, C1, C2). The shell is fixed:
// greeting, hero, Also coming up, Your pets, Quick actions in the same
// place every time, and state only changes the hero and some copy.
//
// C1/C2's hero is always the soonest upcoming booking ("one clear next step");
// any other active bookings show as compact rows in Also coming up rather than
// each getting their own hero. A stay under way outranks every state: while
// pets are here, the hero is that stay and every upcoming booking is a row.
// From 48 hours before an approved pet's drop-off, its "Get ready" card follows
// the hero. A refused request whose dates are still ahead follows under "Needs
// your attention", with the manager's reason and a way to try other dates.
//
// The greeting is the page title and sits above the grid, so the side column
// lines up with the hero whatever the greeting's height. Below `lg` the two
// columns stack in reading order: the hero and its rows, then Your pets and
// Quick actions. From `lg` the side column has a fixed width (344px, 368px from
// `xl`) so a pet's name, breed and age fit on their lines, and the stay column
// takes the rest. The caller wraps this in the page's `PortalPage`.
export function HomeContent({ home }: { home: HomeData }): ReactElement {
  const { state, pets, upcomingStays } = home;
  const locale = usePortalLocale();
  const current = home.currentStays[0] ?? null;
  const greeting = greetingFor(state, home.owner.firstName, pets, current !== null, locale);
  const showPets = state !== 'A';
  // The hero is always the soonest upcoming booking, so it is deterministic
  // and predictable, never chosen by outstanding-task count.
  const hero = upcomingStays[0] ?? null;
  const upcomingHero = current === null && (state === 'C1' || state === 'C2') ? hero : null;
  const leadTitle =
    HOME_COPY[locale].leadTitles[
      current ? 'now' : upcomingHero ? 'next' : state === 'A' ? 'start' : 'plan'
    ];
  const hasHero =
    current !== null || upcomingHero !== null || state === 'A' || state === 'B1' || state === 'B2';
  // "View booking" opens the same details modal as My Stays instead of
  // navigating away.
  const showAlsoComingUp = upcomingStays.length > (upcomingHero ? 1 : 0);
  // With nothing to list beside it, Quick actions moves up under Your pets, so the side column
  // ends level with the stays instead of leaving the second row empty on the left.
  const secondRowEmpty =
    showPets && home.getReady.length === 0 && home.needsAttention.length === 0 && !showAlsoComingUp;
  const quickActions = (
    <QuickActions actions={resolveQuickActions(state, upcomingStays, current, locale)} />
  );
  const { openBookingDetails, modal: bookingDetailsModal } = useBookingDetailsModal(
    hero !== null || current !== null,
  );

  return (
    <>
      <PageHeader title={greeting.title} lead={greeting.subline} />

      {/*
       * From `lg` two rows: the hero beside Your pets, then the rest of the stays beside Quick
       * actions. Each row starts with a heading on both sides and its cards are stretched to the
       * taller one, so tops and bottoms line up. Below `lg` the cells stack in reading order.
       * A parent with no pet yet (state A) has no Your pets: Quick actions sits beside the hero
       * and How it works takes the whole second row, so no cell is left empty.
       */}
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_21.5rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          {hasHero && (
            <h2 id="home-lead-title" className={SECTION_TITLE}>
              {leadTitle}
            </h2>
          )}
          {/* Every stay under way gets its own card: two bookings can overlap. */}
          <div className="flex flex-1 flex-col gap-4 *:flex-1">
            {current ? (
              home.currentStays.map((stay) => (
                <CurrentStayHero
                  key={stay.bookingId}
                  stay={stay}
                  onViewBooking={() => openBookingDetails(stay.pets[0].bookingPetId)}
                />
              ))
            ) : (
              <>
                {state === 'A' && <CreatePetHero />}
                {(state === 'B1' || state === 'B2') && <BookStayHero state={state} pets={pets} />}
                {upcomingHero && (
                  <UpcomingStayHero
                    stay={upcomingHero}
                    onViewBooking={() => openBookingDetails(upcomingHero.pets[0].bookingPetId)}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {state === 'A' ? (
          <div className="min-w-0 lg:col-span-2 lg:row-start-2">
            <HowItWorks />
          </div>
        ) : secondRowEmpty ? null : (
          <div className="flex min-w-0 flex-col gap-6 sm:gap-8 lg:col-start-1 lg:row-start-2 lg:[&>:last-child]:flex-1">
            <GetReadyCards stays={home.getReady} />

            <NeedsAttention requests={home.needsAttention} />

            {showAlsoComingUp && (
              <AlsoComingUpSection
                upcomingStays={upcomingStays}
                pets={pets}
                heroShowsFirst={upcomingHero !== null}
              />
            )}
          </div>
        )}

        {secondRowEmpty ? (
          // Your pets takes the height the stays leave, its "Add a pet" row growing to fill it.
          <div className="flex min-w-0 flex-col gap-6 sm:gap-8 lg:col-start-2 lg:row-start-1">
            <div className="flex flex-1 flex-col *:flex-1">
              <YourPets pets={pets} />
            </div>
            <div>{quickActions}</div>
          </div>
        ) : (
          <>
            {showPets && (
              <div className="min-w-0 lg:col-start-2 lg:row-start-1">
                <YourPets pets={pets} />
              </div>
            )}
            <div
              className={`min-w-0 lg:col-start-2 ${showPets ? 'lg:row-start-2' : 'lg:row-start-1'}`}
            >
              {quickActions}
            </div>
          </>
        )}
      </div>

      {bookingDetailsModal}
    </>
  );
}
