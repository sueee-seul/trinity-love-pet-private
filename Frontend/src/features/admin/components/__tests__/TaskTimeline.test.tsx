import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskTimeline } from '../TaskTimeline';
import type { Task } from '../../types/task.types';
import type { ManagerBookingRecord } from '../../types/booking';

// No DB, no server: every network call this component makes is mocked below.
// `useBookingStore` is mocked directly rather than driven through its real
// fetch, so each test controls exactly which approved bookings this pet has.

const PET_ID = 'pet-1';

const { mockBookingState } = vi.hoisted(() => ({
  mockBookingState: {
    bookingByUuid: {} as Record<string, ManagerBookingRecord>,
    bookingUuids: [] as string[],
  },
}));

vi.mock('../../store/bookingStore', () => ({
  useBookingStore: (
    selector: (state: typeof mockBookingState & { loadBookings: () => void }) => unknown,
  ): unknown => selector({ ...mockBookingState, loadBookings: vi.fn() }),
}));

function makeBooking(
  uuid: string,
  checkIn: string,
  checkOut: string,
  reviewStatus: ManagerBookingRecord['booking']['manager_review_status'] = 'approved',
): ManagerBookingRecord {
  return {
    booking_pets_uuid: uuid,
    booking_id: `booking-for-${uuid}`,
    customer: {
      id: 'owner-1',
      name: 'Jane Rivera',
      contact: { email: 'jane@example.com', phone: null },
    },
    pet: { id: PET_ID, name: 'Luna', type: 'cat' },
    booking: {
      dates: { check_in: checkIn, check_out: checkOut },
      booking_caring_info: {
        first_time_boarding: false,
        crate_trained: false,
        allows_socialization: false,
        fully_vaccinated: true,
        feeding_routine: 'as needed',
        medication_instructions: null,
        behavior_and_health_notes: null,
        other_notes: null,
        has_vaccination_certificate: false,
        vaccination_document_uploaded_at: null,
      },
      services: { boarding_rate: null, food: null, addons: [] },
      status: 'paid',
      manager_review_status: reviewStatus,
      refusal_reason: null,
      reviewer_name: null,
      check_in_outcome: null,
      drop_off_at: null,
      pet_price: 0,
      pet_nightly_rate: 0,
      card_guarantee: null,
      to_pay_at_check_out: 0,
    },
  };
}

function makeTask(id: string, title: string, dueDate: string): Task {
  return {
    id,
    task_type: 'pet',
    title,
    status: 'pending',
    priority: 'mid',
    due_datetime: `${dueDate}T09:00:00.000Z`,
    assignment_id: '',
    staff_id: '',
    staff_name: '',
    description: null,
    issue: null,
  };
}

function setBookings(bookings: ManagerBookingRecord[]): void {
  mockBookingState.bookingByUuid = Object.fromEntries(
    bookings.map((b) => [b.booking_pets_uuid, b]),
  );
  mockBookingState.bookingUuids = bookings.map((b) => b.booking_pets_uuid);
}

function jsonResponse(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchWithTasks(tasks: Task[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/tasks?range=')) return jsonResponse(tasks);
      if (typeof url === 'string' && url.includes('/task-templates')) return jsonResponse([]);
      if (typeof url === 'string' && url.includes('/free-staff')) return jsonResponse([]);
      return jsonResponse([]);
    }),
  );
}

function closestSection(element: HTMLElement): HTMLElement {
  const section = element.closest('div');
  if (!section) throw new Error('Expected a containing <div> for this element');
  return section;
}

function renderTimeline(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/admin/pets/pet-1']}>
      <TaskTimeline petId={PET_ID} />
    </MemoryRouter>,
  );
}

describe('TaskTimeline', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // TC-UNIT-01: groupTasksByBooking buckets tasks by date window.
  describe('grouping tasks by booking', () => {
    beforeEach(() => {
      setBookings([
        makeBooking('booking-recent', '2026-09-24', '2026-09-26'),
        makeBooking('booking-older', '2026-09-20', '2026-09-22'),
      ]);
      mockFetchWithTasks([
        makeTask('t1', 'Feeding (morning)', '2026-09-21'), // inside booking-older
        makeTask('t2', 'Outdoor Walk', '2026-09-25'), // inside booking-recent
        makeTask('t3', 'Grooming', '2026-09-30'), // matches neither -> Other tasks
      ]);
    });

    it('puts each task under the one booking section whose dates contain it, and leftovers under Other tasks', async () => {
      renderTimeline();

      await waitFor(() => expect(screen.getByText('Feeding (morning)')).toBeInTheDocument());

      const olderSection = closestSection(screen.getByText('2026-09-20 to 2026-09-22'));
      const recentSection = closestSection(screen.getByText('2026-09-24 to 2026-09-26'));
      const otherSection = closestSection(screen.getByText('Other tasks'));

      expect(within(olderSection).getByText('Feeding (morning)')).toBeInTheDocument();
      expect(within(olderSection).queryByText('Outdoor Walk')).not.toBeInTheDocument();

      expect(within(recentSection).getByText('Outdoor Walk')).toBeInTheDocument();
      expect(within(recentSection).queryByText('Feeding (morning)')).not.toBeInTheDocument();

      expect(within(otherSection).getByText('Grooming')).toBeInTheDocument();
    });

    it('never includes a pending or refused booking as a section', async () => {
      setBookings([
        makeBooking('booking-recent', '2026-09-24', '2026-09-26'),
        makeBooking('booking-pending', '2026-09-27', '2026-09-29', 'pending'),
        makeBooking('booking-refused', '2026-09-01', '2026-09-03', 'refused'),
      ]);
      mockFetchWithTasks([makeTask('t2', 'Outdoor Walk', '2026-09-25')]);

      renderTimeline();

      await waitFor(() => expect(screen.getByText('Outdoor Walk')).toBeInTheDocument());

      expect(screen.getByText('2026-09-24 to 2026-09-26')).toBeInTheDocument();
      expect(screen.queryByText('2026-09-27 to 2026-09-29')).not.toBeInTheDocument();
      expect(screen.queryByText('2026-09-01 to 2026-09-03')).not.toBeInTheDocument();
    });
  });

  // TC-UNIT-02: booking sections sort by check-in descending and page 3 at a time.
  describe('ordering and pagination of booking sections', () => {
    beforeEach(() => {
      setBookings([
        makeBooking('b-10', '2026-09-10', '2026-09-12'),
        makeBooking('b-15', '2026-09-15', '2026-09-17'),
        makeBooking('b-20', '2026-09-20', '2026-09-22'),
        makeBooking('b-25', '2026-09-25', '2026-09-27'),
      ]);
      mockFetchWithTasks([]);
    });

    it('shows the 3 most recent bookings first and pages the rest with Prev/Next', async () => {
      const user = userEvent.setup();
      renderTimeline();

      await waitFor(() => expect(screen.getByText('2026-09-25 to 2026-09-27')).toBeInTheDocument());

      // Page 1: newest 3, oldest one held back.
      expect(screen.getByText('2026-09-25 to 2026-09-27')).toBeInTheDocument();
      expect(screen.getByText('2026-09-20 to 2026-09-22')).toBeInTheDocument();
      expect(screen.getByText('2026-09-15 to 2026-09-17')).toBeInTheDocument();
      expect(screen.queryByText('2026-09-10 to 2026-09-12')).not.toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '‹ Prev' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next ›' })).toBeEnabled();

      await user.click(screen.getByRole('button', { name: 'Next ›' }));

      // Page 2: only the oldest one left.
      expect(screen.getByText('2026-09-10 to 2026-09-12')).toBeInTheDocument();
      expect(screen.queryByText('2026-09-25 to 2026-09-27')).not.toBeInTheDocument();
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next ›' })).toBeDisabled();
    });
  });

  // TC-UNIT-03: the task editor remounts per task instead of reusing stale state.
  describe('editing a different task while the editor is already open', () => {
    beforeEach(() => {
      setBookings([makeBooking('booking-a', '2026-09-20', '2026-09-24')]);
      mockFetchWithTasks([
        makeTask('t1', 'Feeding (morning)', '2026-09-21'),
        makeTask('t2', 'Outdoor Walk', '2026-09-22'),
      ]);
    });

    it("shows the newly-clicked task's own fields, not the previous task's", async () => {
      const user = userEvent.setup();
      renderTimeline();

      await waitFor(() => expect(screen.getByText('Feeding (morning)')).toBeInTheDocument());

      const editButtons = screen.getAllByRole('button', { name: 'Edit' });
      await user.click(editButtons[0]); // open task 1 ("Feeding (morning)")

      expect(screen.getByDisplayValue('Feeding (morning)')).toBeInTheDocument();

      await user.click(editButtons[1]); // switch straight to task 2 without closing

      expect(screen.getByDisplayValue('Outdoor Walk')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Feeding (morning)')).not.toBeInTheDocument();
    });
  });
});
