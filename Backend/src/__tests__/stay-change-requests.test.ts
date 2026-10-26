import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StayChangeRequestRow } from '../repositories/stay-change-request.repository.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const repo = vi.hoisted(() => ({
  insertStayChangeRequest: vi.fn(),
  findStayChangeRequest: vi.fn(),
  listOwnerStayChangeRequests: vi.fn(),
  listManagerStayChangeRequests: vi.fn(),
  decideStayChangeRequest: vi.fn(),
  reopenStayChangeRequest: vi.fn(),
  findBookingOwnerForPet: vi.fn(),
}));
vi.mock('../repositories/stay-change-request.repository.js', () => repo);

const notices = vi.hoisted(() => ({
  findBookingRequestSubject: vi.fn(),
  insertManagerNotice: vi.fn(),
  recordParentNotice: vi.fn(),
}));
vi.mock('../repositories/booking.notification.repository.js', () => notices);

const charges = vi.hoisted(() => ({ readPetNamesForBooking: vi.fn() }));
vi.mock('../repositories/booking.charges.repository.js', () => charges);

const chat = vi.hoisted(() => ({ postBookingNoticeToChat: vi.fn() }));
vi.mock('../services/booking.chat-notices.js', () => chat);

const extend = vi.hoisted(() => ({ previewExtension: vi.fn(), extendStay: vi.fn() }));
vi.mock('../services/booking.guest-extend.js', () => extend);

const addOn = vi.hoisted(() => ({ listAddOns: vi.fn(), bookAddOn: vi.fn() }));
vi.mock('../services/booking.guest-addon.js', () => addOn);

const times = vi.hoisted(() => ({ changeStayTimes: vi.fn() }));
vi.mock('../services/booking.guest-times.js', () => times);

import {
  approveStayChangeRequest,
  refuseStayChangeRequest,
  requestAddOn,
  requestExtension,
  requestTimes,
  withdrawStayChangeRequest,
} from '../services/stay-change-requests.js';

const OWNER = '00000000-0000-4000-8000-000000000301';
const BOOKING = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PET = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const MANAGER = '00000000-0000-4000-8000-000000000999';

const row = (overrides: Partial<StayChangeRequestRow> = {}): StayChangeRequestRow => ({
  uuid: 'request-1',
  bookings_uuid: BOOKING,
  booking_pets_uuid: null,
  pet_owners_uuid: OWNER,
  kind: 'extend',
  details: { endDate: '2026-10-17' },
  quoted_amount: '55.00',
  status: 'pending',
  refusal_reason: null,
  decided_by_uuid: null,
  decided_at: null,
  created_at: new Date('2026-10-14T01:00:00.000Z'),
  ...overrides,
});

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  charges.readPetNamesForBooking.mockResolvedValue(new Map([[PET, 'Max']]));
  notices.findBookingRequestSubject.mockResolvedValue({ ownerId: OWNER, petNames: ['Max'] });
  notices.recordParentNotice.mockResolvedValue(undefined);
  notices.insertManagerNotice.mockResolvedValue(undefined);
  repo.insertStayChangeRequest.mockImplementation(async (request) =>
    row({
      booking_pets_uuid: request.bookingPetId,
      kind: request.details.kind,
      details: { ...request.details, kind: undefined },
      quoted_amount: request.quotedAmount === null ? null : request.quotedAmount.toFixed(2),
    }),
  );
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('a parent asking to change a stay under way', () => {
  it('saves more nights as a request at the previewed price, and changes nothing yet', async () => {
    extend.previewExtension.mockResolvedValue({ newEndDate: '2026-10-17', amount: 55 });

    const view = await requestExtension(OWNER, BOOKING, {
      endDate: '2026-10-17',
      expectedAmount: 55,
    });

    expect(repo.insertStayChangeRequest).toHaveBeenCalledWith({
      bookingId: BOOKING,
      bookingPetId: null,
      ownerId: OWNER,
      details: { kind: 'extend', endDate: '2026-10-17' },
      quotedAmount: 55,
    });
    expect(extend.extendStay).not.toHaveBeenCalled();
    expect(view).toMatchObject({ status: 'pending', quotedAmount: 55 });
    expect(view.summary).toBe("extend Max's stay to 17 Oct 2026 ($55.00)");
  });

  it('tells the parent in the bell and the chat, and every manager in theirs', async () => {
    extend.previewExtension.mockResolvedValue({ newEndDate: '2026-10-17', amount: 55 });

    await requestExtension(OWNER, BOOKING, { endDate: '2026-10-17' });

    const notice = expect.objectContaining({
      ownerId: OWNER,
      kind: 'booking_change_requested',
      body: expect.stringContaining("We got your request to extend Max's stay"),
    });
    expect(notices.recordParentNotice).toHaveBeenCalledWith(notice);
    expect(chat.postBookingNoticeToChat).toHaveBeenCalledWith(notice);
    expect(notices.insertManagerNotice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ setting: 'booking_change_requested', bookingId: BOOKING }),
    );
  });

  it('leaves the chat to write its own receipt when the request came from the chat', async () => {
    extend.previewExtension.mockResolvedValue({ newEndDate: '2026-10-17', amount: 55 });

    await requestExtension(OWNER, BOOKING, { endDate: '2026-10-17' }, { announceInChat: false });

    expect(chat.postBookingNoticeToChat).not.toHaveBeenCalled();
    expect(notices.recordParentNotice).toHaveBeenCalled();
  });

  it('refuses to save a price the parent did not see', async () => {
    extend.previewExtension.mockResolvedValue({ newEndDate: '2026-10-17', amount: 60 });

    await expect(
      requestExtension(OWNER, BOOKING, { endDate: '2026-10-17', expectedAmount: 55 }),
    ).rejects.toMatchObject({ code: 'EXTENSION_PRICE_CHANGED' });
    expect(repo.insertStayChangeRequest).not.toHaveBeenCalled();
  });

  it('prices an add-on the stay offers, and refuses one it does not', async () => {
    repo.findBookingOwnerForPet.mockResolvedValue(OWNER);
    addOn.listAddOns.mockResolvedValue({
      offers: [
        {
          serviceId: 'svc-walk',
          name: 'Outdoor Walk',
          description: null,
          price: 15,
          priceUnit: 'per day',
        },
      ],
      days: ['2026-10-15'],
      settlement: 'desk',
    });

    const view = await requestAddOn(OWNER, BOOKING, PET, {
      serviceId: 'svc-walk',
      date: '2026-10-15',
      quantity: 2,
      expectedAmount: 30,
    });
    expect(view.summary).toBe('Outdoor Walk x2 for Max on 15 Oct 2026 ($30.00)');

    await expect(
      requestAddOn(OWNER, BOOKING, PET, {
        serviceId: 'svc-other',
        date: '2026-10-15',
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: 'ADD_ON_NOT_OFFERED' });
  });

  it("never saves a request for another owner's pet", async () => {
    repo.findBookingOwnerForPet.mockResolvedValue('someone-else');

    await expect(requestTimes(OWNER, BOOKING, PET, { pickUpTime: '11:00' })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.insertStayChangeRequest).not.toHaveBeenCalled();
  });

  it('lets the parent withdraw only their own waiting request', async () => {
    repo.findStayChangeRequest.mockResolvedValue(row());
    repo.decideStayChangeRequest.mockResolvedValue(row({ status: 'cancelled' }));
    await withdrawStayChangeRequest(OWNER, 'request-1');
    expect(repo.decideStayChangeRequest).toHaveBeenCalledWith('request-1', {
      status: 'cancelled',
      deciderId: null,
    });

    await expect(withdrawStayChangeRequest('someone-else', 'request-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('a manager deciding a change request', () => {
  it('approves it and makes the change as the parent, then tells the chat', async () => {
    repo.decideStayChangeRequest.mockResolvedValue(row({ status: 'approved' }));
    extend.extendStay.mockResolvedValue({});

    await approveStayChangeRequest('request-1', MANAGER);

    expect(repo.decideStayChangeRequest).toHaveBeenCalledWith('request-1', {
      status: 'approved',
      deciderId: MANAGER,
    });
    expect(extend.extendStay).toHaveBeenCalledWith(OWNER, BOOKING, { endDate: '2026-10-17' });
    expect(chat.postBookingNoticeToChat).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'booking_change_approved' }),
    );
  });

  it('puts the request back to waiting when the change can no longer be made', async () => {
    repo.decideStayChangeRequest.mockResolvedValue(row({ status: 'approved' }));
    extend.extendStay.mockRejectedValue(new Error('full'));

    await expect(approveStayChangeRequest('request-1', MANAGER)).rejects.toThrow('full');

    expect(repo.reopenStayChangeRequest).toHaveBeenCalledWith('request-1');
    expect(chat.postBookingNoticeToChat).not.toHaveBeenCalled();
  });

  it('applies an add-on and a time change to the pet they were asked for', async () => {
    repo.decideStayChangeRequest.mockResolvedValueOnce(
      row({
        kind: 'add_on',
        booking_pets_uuid: PET,
        details: {
          serviceId: 'svc-walk',
          serviceName: 'Outdoor Walk',
          date: '2026-10-15',
          quantity: 1,
        },
      }),
    );
    await approveStayChangeRequest('request-1', MANAGER);
    expect(addOn.bookAddOn).toHaveBeenCalledWith(OWNER, BOOKING, PET, {
      serviceId: 'svc-walk',
      date: '2026-10-15',
      quantity: 1,
    });

    repo.decideStayChangeRequest.mockResolvedValueOnce(
      row({
        kind: 'times',
        booking_pets_uuid: PET,
        details: { pickUpTime: '11:00' },
        quoted_amount: null,
      }),
    );
    await approveStayChangeRequest('request-2', MANAGER);
    expect(times.changeStayTimes).toHaveBeenCalledWith(OWNER, BOOKING, PET, {
      pickUpTime: '11:00',
    });
  });

  it('says so when the request was already decided', async () => {
    repo.decideStayChangeRequest.mockResolvedValue(null);
    repo.findStayChangeRequest.mockResolvedValue(row({ status: 'refused' }));

    await expect(approveStayChangeRequest('request-1', MANAGER)).rejects.toMatchObject({
      code: 'STAY_CHANGE_REQUEST_DECIDED',
    });
    expect(extend.extendStay).not.toHaveBeenCalled();
  });

  it("refuses it with the manager's reason, in the bell and the chat", async () => {
    repo.decideStayChangeRequest.mockResolvedValue(
      row({ status: 'refused', refusal_reason: 'We are fully booked on those dates.' }),
    );

    await refuseStayChangeRequest('request-1', MANAGER, ' We are fully booked on those dates. ');

    const notice = expect.objectContaining({
      kind: 'booking_change_refused',
      body: "We can't extend Max's stay to 17 Oct 2026 ($55.00). Reason: We are fully booked on those dates.",
    });
    expect(notices.recordParentNotice).toHaveBeenCalledWith(notice);
    expect(chat.postBookingNoticeToChat).toHaveBeenCalledWith(notice);
    expect(extend.extendStay).not.toHaveBeenCalled();
  });
});
