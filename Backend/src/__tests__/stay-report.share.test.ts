import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../common/middlewares/error.middleware.js';
import shareRoutes from '../routes/share.routes.js';
import { countCareByDay, listSummariesForStay } from '../repositories/daily-summary.repository.js';
import { listAdministrationsForDay } from '../repositories/medication.administration.repository.js';
import { findStayById } from '../repositories/petparent.livecare.repository.js';
import {
  renderSharedStayReport,
  shareLinkForOwner,
  sharedStayPhotoName,
  sharedStayReport,
  signStayReportShare,
  verifyStayReportShare,
} from '../services/stay-report.share.service.js';
import { stayMemoryFor } from '../services/stay-memory.service.js';
import { TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../repositories/stay-photos.repository.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../repositories/stay-photos.repository.js')>()),
  listStayPhotos: vi.fn(async () => [
    {
      taskId: '11111111-1111-4111-8111-111111111111',
      taskTitle: 'Afternoon walk',
      storedName: 'walk-2.jpg',
      takenAt: new Date('2026-12-12T02:00:00Z'),
      day: '2026-12-12',
    },
    {
      taskId: '11111111-1111-4111-8111-111111111111',
      taskTitle: 'Afternoon walk',
      storedName: 'walk-1.jpg',
      takenAt: new Date('2026-12-12T01:00:00Z'),
      day: '2026-12-12',
    },
    {
      taskId: '22222222-2222-4222-8222-222222222222',
      taskTitle: 'Playtime',
      storedName: 'play.jpg',
      takenAt: new Date('2026-12-11T02:00:00Z'),
      day: '2026-12-11',
    },
  ]),
}));

vi.mock('../repositories/petparent.livecare.repository.js', () => ({
  findStayById: vi.fn(async () => ({
    bookingPetId: 'bp-1',
    petOwnersUuid: 'owner-1',
    petId: 'pet-1',
    petName: 'Bella <3',
    dropOffTime: new Date('2026-12-10T21:30:00Z'),
    pickUpTime: new Date('2026-12-13T03:00:00Z'),
  })),
}));
vi.mock('../repositories/daily-summary.repository.js', () => ({
  listSummariesForStay: vi.fn(async () => [
    {
      id: 's2',
      bookingPetId: 'bp-1',
      date: '2026-12-13',
      kind: 'stay_report',
      body: 'Bella stayed with us for 2 nights. Every planned meal was given (4 in all).',
      locale: 'en',
      photoPath: null,
      facts: {},
      generatedAt: new Date('2026-12-13T04:05:00Z'),
    },
    {
      id: 's1',
      bookingPetId: 'bp-1',
      date: '2026-12-12',
      kind: 'daily',
      body: "Here is how Bella's day went on Sat 12 Dec.",
      locale: 'en',
      photoPath: null,
      facts: {},
      generatedAt: new Date('2026-12-12T04:05:00Z'),
    },
  ]),
  countCareByDay: vi.fn(async () => [
    { day: '2026-12-12', feedsDone: 2, feedsPlanned: 2, walks: 1, play: 0, photos: 1 },
  ]),
}));
vi.mock('../repositories/medication.administration.repository.js', () => ({
  listAdministrationsForDay: vi.fn(async () => [
    {
      id: 'adm-1',
      bookingPetsUuid: 'bp-1',
      medicationId: 'med-1',
      medicineName: 'Apoquel',
      dose: 1,
      unit: 'tablet',
      slot: 'evening',
      scheduledFor: new Date('2026-12-12T05:00:00Z'),
      taskStatus: 'completed',
      completedAt: new Date('2026-12-12T05:05:00Z'),
      staffName: 'Sam',
      issue: null,
      alertedAt: null,
    },
  ]),
}));
vi.mock('../services/stay-memory.service.js', () => ({
  stayMemoryFor: vi.fn(async () => [
    {
      id: 'n1',
      bookingPetId: 'bp-1',
      date: '2026-12-12',
      locale: 'en',
      body: "Day 2 of Bella's 2-night stay (Sat 12 Dec). Appetite: ate every planned meal.",
      facts: {},
      generatedAt: new Date('2026-12-12T04:10:00Z'),
    },
  ]),
}));

const NOW = new Date('2026-12-13T05:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
});

describe('the share link', () => {
  it('is signed for one stay and lasts 30 days', async () => {
    const link = await signStayReportShare('bp-1', NOW);
    expect(link.path).toBe(`/api/share/stay-report/${link.token}`);
    expect(link.expiresAt).toBe('2027-01-12T05:00:00.000Z');
    await expect(verifyStayReportShare(link.token)).resolves.toBe('bp-1');
  });

  it('refuses a forged or expired token with 410', async () => {
    await expect(verifyStayReportShare('not-a-token')).rejects.toMatchObject({ statusCode: 410 });
    const old = await signStayReportShare('bp-1', new Date('2026-01-01T00:00:00Z'));
    await expect(verifyStayReportShare(old.token)).rejects.toMatchObject({ statusCode: 410 });
  });

  it('is made only by the stay’s own parent', async () => {
    await expect(shareLinkForOwner('owner-1', 'bp-1', NOW)).resolves.toMatchObject({
      path: expect.stringContaining('/api/share/stay-report/'),
    });
    await expect(shareLinkForOwner('someone-else', 'bp-1', NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
    vi.mocked(findStayById).mockResolvedValueOnce(null);
    await expect(shareLinkForOwner('owner-1', 'bp-9', NOW)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('the shared report', () => {
  it('gathers the report, the dose record and the memory notes, and nothing about the parent', async () => {
    const { token } = await signStayReportShare('bp-1', NOW);
    const report = await sharedStayReport(token, NOW);
    expect(report.petName).toBe('Bella <3');
    expect(report.stayDates).toBe('Fri 11 Dec to Sun 13 Dec');
    expect(report.report).toContain('Every planned meal was given');
    expect(report.doses).toEqual([
      {
        day: '2026-12-12',
        medicine: 'Apoquel 1 tablet',
        slot: 'evening',
        dueAt: '18:00',
        status: 'Given',
        givenAt: '18:05',
        reason: null,
      },
    ]);
    expect(report.memory[0]?.body).toContain('Day 2 of');
    expect(report.dailyUpdates).toEqual([
      { day: '2026-12-12', body: "Here is how Bella's day went on Sat 12 Dec." },
    ]);
    expect(JSON.stringify(report)).not.toContain('owner-1');
    expect(listSummariesForStay).toHaveBeenCalled();
    expect(countCareByDay).toHaveBeenCalled();
    expect(listAdministrationsForDay).toHaveBeenCalledWith('bp-1', '2026-12-12');
    expect(stayMemoryFor).toHaveBeenCalledWith('bp-1', 60);
  });

  it('carries one care photo per day, each behind this link only', async () => {
    const { token } = await signStayReportShare('bp-1', NOW);
    const report = await sharedStayReport(token, NOW);

    expect(report.photos).toEqual([
      {
        day: '2026-12-12',
        caption: 'Afternoon walk',
        url: `/api/share/stay-report/${token}/photos/11111111-1111-4111-8111-111111111111/walk-2.jpg`,
      },
      {
        day: '2026-12-11',
        caption: 'Playtime',
        url: `/api/share/stay-report/${token}/photos/22222222-2222-4222-8222-222222222222/play.jpg`,
      },
    ]);
    expect(renderSharedStayReport(report)).toContain(
      `<img src="/api/share/stay-report/${token}/photos/22222222-2222-4222-8222-222222222222/play.jpg"`,
    );
  });

  it("serves only this stay's own photos through the link", async () => {
    const { token } = await signStayReportShare('bp-1', NOW);

    await expect(
      sharedStayPhotoName(token, '22222222-2222-4222-8222-222222222222', 'play.jpg'),
    ).resolves.toBe('play.jpg');
    await expect(
      sharedStayPhotoName(token, '33333333-3333-4333-8333-333333333333', 'play.jpg'),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      sharedStayPhotoName(token, '22222222-2222-4222-8222-222222222222', '../secret.jpg'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('renders a printable page that escapes what staff and parents typed', async () => {
    const { token } = await signStayReportShare('bp-1', NOW);
    const html = renderSharedStayReport(await sharedStayReport(token, NOW));
    expect(html).toContain('<title>Stay report for Bella &lt;3</title>');
    expect(html).toContain('<td>Apoquel 1 tablet</td>');
    expect(html).toContain('Given at 18:05');
    expect(html).not.toContain('<script');
    expect(html).not.toMatch(/[–—]/);
  });
});

describe('the public route', () => {
  const app = express();
  app.use('/api/share', shareRoutes);
  app.use(errorHandler);

  it('serves the page for a good link and a short page for a bad one', async () => {
    const { token } = await signStayReportShare('bp-1', NOW);
    const ok = await request(app).get(`/api/share/stay-report/${token}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toContain('text/html');
    expect(ok.text).toContain('Medication record');

    const bad = await request(app).get('/api/share/stay-report/this-token-is-not-real-at-all');
    expect(bad.status).toBe(410);
    expect(bad.text).toContain('expired or is not valid');
  });
});
