import { listStayPhotos, onePhotoPerDay } from '../repositories/stay-photos.repository.js';
import { taskMediaKey } from './task.photo.storage.js';
import type { JWTPayload } from 'jose';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from '../common/utils/signed-session.js';
import { formatNewZealandDay, formatNewZealandTime } from '../common/utils/new-zealand-time.js';
import { readBusinessIdentity } from '../config/business-identity.js';
import { pool } from '../config/database.js';
import { countCareByDay, listSummariesForStay } from '../repositories/daily-summary.repository.js';
import { listAdministrationsForDay } from '../repositories/medication.administration.repository.js';
import { findStayById } from '../repositories/petparent.livecare.repository.js';
import { readConciergeSigningSecret } from './concierge/concierge.tokens.js';
import { toDoseRecord } from './medication.record.service.js';
import { stayMemoryFor } from './stay-memory.service.js';

/**
 * The stay report the parent can hand to their vet (Scenario 11 stretch goal 3): a signed link, good
 * for 30 days, that opens a plain printable page with no sign-in. The page carries the report, the
 * dose record day by day, the stay's memory notes and one care photo per day (served through this
 * same signed link, and only photos of this pet's own care tasks during this stay), and nothing
 * else: no contact details of the parent. The link is signed with the concierge
 * secret, so it cannot be forged or edited to point at another stay.
 */

/** Photos on the vet page: one per day, the newest days first. */
const SHARED_PHOTOS = 6;

export const SHARE_LINK_TTL_SECONDS = 30 * 24 * 60 * 60;
const SHARE_TOKEN_TYPE = 'stay_report_share';

const secret = (): Uint8Array => new TextEncoder().encode(readConciergeSigningSecret());

export interface ShareLink {
  /** The path on this API; the page builds the absolute URL from its own API base. */
  path: string;
  token: string;
  expiresAt: string;
}

const isShareClaims = (payload: JWTPayload): payload is JWTPayload & { sub: string } =>
  payload.typ === SHARE_TOKEN_TYPE && typeof payload.sub === 'string';

export const signStayReportShare = async (
  bookingPetId: string,
  issuedAt: Date = new Date(),
): Promise<ShareLink> => {
  const token = await createSignedSessionToken({
    subject: bookingPetId,
    secret: secret(),
    ttlSeconds: SHARE_LINK_TTL_SECONDS,
    claims: { typ: SHARE_TOKEN_TYPE },
    issuedAt,
  });
  return {
    path: `/api/share/stay-report/${token}`,
    token,
    expiresAt: new Date(issuedAt.getTime() + SHARE_LINK_TTL_SECONDS * 1000).toISOString(),
  };
};

const linkInvalid = (): AppError =>
  new AppError(
    'This report link has expired or is not valid. Ask the pet parent for a new one.',
    'SHARE_LINK_INVALID',
    410,
  );

export const verifyStayReportShare = async (token: string): Promise<string> => {
  try {
    const claims = await verifySignedSessionToken({
      token,
      secret: secret(),
      requiredClaims: ['typ', 'sub', 'exp'],
      invalidClaimsMessage: 'Invalid stay report share token',
      isValidClaims: isShareClaims,
    });
    return claims.sub;
  } catch (error: unknown) {
    if (error instanceof AppError && error.code === 'CONCIERGE_NOT_CONFIGURED') throw error;
    throw linkInvalid();
  }
};

/** Only the stay's own parent may make a link; 404 exactly like a stay that does not exist. */
export const shareLinkForOwner = async (
  ownerId: string,
  bookingPetId: string,
  now: Date = new Date(),
): Promise<ShareLink> => {
  const stay = await findStayById(bookingPetId);
  if (!stay || stay.petOwnersUuid !== ownerId) {
    throw new AppError('Stay not found', 'NOT_FOUND', 404);
  }
  return signStayReportShare(bookingPetId, now);
};

export interface SharedDose {
  day: string;
  medicine: string;
  slot: string;
  dueAt: string;
  status: string;
  givenAt: string | null;
  reason: string | null;
}

export interface SharedStayReport {
  petName: string;
  stayDates: string;
  report: string | null;
  dailyUpdates: { day: string; body: string }[];
  doses: SharedDose[];
  memory: { day: string; body: string }[];
  /** One care photo per day, newest day first; each url works only with this link's token. */
  photos: { day: string; caption: string; url: string }[];
  business: { legalName: string; address: string | null };
  expiresAt: string;
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  given: 'Given',
  not_given: 'Not given',
  due: 'Not yet recorded',
  overdue: 'Not recorded',
  not_recorded: 'No record',
};

/** Everything the page shows, from the stay's records; nothing a vet does not need. */
export const sharedStayReport = async (
  token: string,
  now: Date = new Date(),
): Promise<SharedStayReport> => {
  const bookingPetId = await verifyStayReportShare(token);
  const stay = await findStayById(bookingPetId);
  if (!stay || !stay.dropOffTime || !stay.pickUpTime) throw linkInvalid();
  const { dropOffTime, pickUpTime } = stay;
  const [summaries, days, memory, photos] = await Promise.all([
    listSummariesForStay(bookingPetId, pool),
    countCareByDay(stay.petId, dropOffTime, pickUpTime),
    stayMemoryFor(bookingPetId, 60),
    listStayPhotos(stay.petId, dropOffTime, pickUpTime),
  ]);
  const doses: SharedDose[] = [];
  for (const day of days) {
    for (const row of await listAdministrationsForDay(bookingPetId, day.day)) {
      const record = toDoseRecord(row, now);
      doses.push({
        day: day.day,
        medicine: `${record.medicineName} ${record.dose} ${record.unit}`,
        slot: record.slot,
        dueAt: formatNewZealandTime(new Date(record.dueAt)),
        status: STATUS_WORDS[record.status] ?? record.status,
        givenAt: record.givenAt ? formatNewZealandTime(new Date(record.givenAt)) : null,
        reason: record.reason,
      });
    }
  }
  const identity = readBusinessIdentity();
  return {
    petName: stay.petName,
    stayDates: `${formatNewZealandDay(dropOffTime)} to ${formatNewZealandDay(pickUpTime)}`,
    report: summaries.find((summary) => summary.kind === 'stay_report')?.body ?? null,
    dailyUpdates: summaries
      .filter((summary) => summary.kind === 'daily')
      .map((summary) => ({ day: summary.date, body: summary.body }))
      .reverse(),
    doses,
    memory: [...memory].reverse().map((note) => ({ day: note.date, body: note.body })),
    photos: onePhotoPerDay(photos, SHARED_PHOTOS).map((photo) => ({
      day: photo.day,
      caption: photo.taskTitle,
      url: `/api/share/stay-report/${token}/photos/${photo.taskId}/${encodeURIComponent(photo.storedName)}`,
    })),
    business: { legalName: identity.legalName, address: identity.address },
    expiresAt: new Date(now.getTime() + SHARE_LINK_TTL_SECONDS * 1000).toISOString(),
  };
};

/**
 * The stored name of one of the page's photos. The token must be valid, and the photo must be one
 * of this stay's own care photos, so the link can never be edited into a way to read another pet's.
 */
export const sharedStayPhotoName = async (
  token: string,
  taskId: string,
  storedName: string,
): Promise<string> => {
  const bookingPetId = await verifyStayReportShare(token);
  const stay = await findStayById(bookingPetId);
  if (!stay || !stay.dropOffTime || !stay.pickUpTime) throw linkInvalid();
  const photos = await listStayPhotos(stay.petId, stay.dropOffTime, stay.pickUpTime);
  const owned = photos.some((photo) => photo.taskId === taskId && photo.storedName === storedName);
  if (!owned || !taskMediaKey(storedName)) throw new AppError('Photo not found', 'NOT_FOUND', 404);
  return storedName;
};

const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const section = (title: string, body: string): string =>
  `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;

/** A printable page with no scripts: the vet opens it on any device and can print it to PDF. */
export const renderSharedStayReport = (report: SharedStayReport): string => {
  const doseRows = report.doses
    .map(
      (dose) =>
        `<tr><td>${escapeHtml(dose.day)}</td><td>${escapeHtml(dose.medicine)}</td><td>${escapeHtml(dose.slot)}</td><td>${escapeHtml(dose.dueAt)}</td><td>${escapeHtml(dose.status)}${dose.givenAt ? ` at ${escapeHtml(dose.givenAt)}` : ''}${dose.reason ? ` (${escapeHtml(dose.reason)})` : ''}</td></tr>`,
    )
    .join('');
  const list = (items: { day: string; body: string }[]): string =>
    items.length === 0
      ? '<p>None recorded.</p>'
      : `<ul>${items.map((item) => `<li><strong>${escapeHtml(item.day)}</strong>: ${escapeHtml(item.body)}</li>`).join('')}</ul>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Stay report for ${escapeHtml(report.petName)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #222; line-height: 1.5; }
  h1 { font-size: 1.6rem; margin-bottom: 0.25rem; } h2 { font-size: 1.15rem; margin-top: 1.75rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.95rem; } th, td { border-bottom: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  footer { margin-top: 2.5rem; font-size: 0.85rem; color: #555; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
<h1>Stay report for ${escapeHtml(report.petName)}</h1>
<p>${escapeHtml(report.stayDates)}. Prepared by ${escapeHtml(report.business.legalName)} from the care record. Everything below was recorded by staff at the time; nothing is estimated.</p>
${section('How the stay went', report.report ? `<p>${escapeHtml(report.report)}</p>` : '<p>The stay report is written on the check-out day.</p>')}
${section(
  'Medication record',
  report.doses.length === 0
    ? '<p>No medication was recorded for this stay.</p>'
    : `<table><thead><tr><th>Day</th><th>Medicine</th><th>Slot</th><th>Due</th><th>Record</th></tr></thead><tbody>${doseRows}</tbody></table>`,
)}
${section('Photos', report.photos.length === 0 ? '<p>No photos were taken.</p>' : `<div class="photos">${report.photos.map((photo) => `<figure><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(`${report.petName}: ${photo.caption}`)}" loading="lazy"><figcaption>${escapeHtml(photo.day)}: ${escapeHtml(photo.caption)}</figcaption></figure>`).join('')}</div>`)}
${section('Day by day', list(report.memory))}
${section('Daily updates sent to the parent', list(report.dailyUpdates))}
<footer>${escapeHtml(report.business.legalName)}${report.business.address ? `, ${escapeHtml(report.business.address)}` : ''}. This link was made by the pet's parent and stops working on ${escapeHtml(report.expiresAt.slice(0, 10))}.</footer>
</body>
</html>`;
};
