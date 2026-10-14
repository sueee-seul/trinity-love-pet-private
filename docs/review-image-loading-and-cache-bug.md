# Review Image Loading and Repeated Download Bug

Status: Implemented in the current working tree; live S3 and Chrome checks passed on 2026-09-10; not committed
Severity: High (proposed; production frequency and affected-user count are not yet measured)
Scope: Public Google Review page, Manager Google Review index, and Manager Google Review detail image reads

## Summary

The same Google Review images were slow to display across the public review page, the Manager
review index, and the Manager review detail page. The initial symptom looked like three screens
reading the same image data repeatedly. Source inspection shows a more precise failure: the Manager
index and detail already share one Zustand review snapshot during the same SPA session, but each
Backend projection generated time-sensitive signed image URLs. When the URL changed, the browser
could treat the same S3 object as a new resource and download the image again.

The public page also rendered every review photo eagerly. The current database-linked review media
set is 10 images totalling 23,102,865 bytes, with individual PNG files around 2 to 3 MB. This made the
first public page load unnecessarily heavy.

The fix keeps the public and Manager API permission boundaries separate, but gives both projections
the same stable public S3 object URL. New uploads and existing database-linked objects now use the
same cache policy. Public review cards and Manager detail images defer loading until they are near
the viewport.

## Why this matters

| Impact area        | Observed or confirmed effect                                                                             | Why it matters                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public review load | The page can contain 10 review images, totalling about 23 MB, and previously rendered them eagerly.      | A visitor waits for image work that may be below the fold.                                 |
| Manager workflow   | A review image opened in the Manager index and then shown in detail could use a different signed URL.    | The same object can be requested again instead of using the browser cache.                 |
| Network transfer   | Repeated full-image downloads add avoidable S3 egress and contribute to the Neon Network Transfer quota. | The original quota problem is made worse by duplicate image reads.                         |
| Review continuity  | Index and detail should feel like two views of one loaded review snapshot.                               | Staff should not wait for the same review media again while navigating.                    |
| First-read latency | A cold S3 read can still be slow even when caching is correct.                                           | Stable caching removes duplicates but cannot remove the first provider/network round trip. |

There is no evidence that this bug corrupted review records, changed image bytes, or required
three independent Manager database list reads within one SPA session. The confirmed problem is
avoidable image transfer and eager initial image loading.

## Observed behavior

The user reported that image reading became extremely slow after the review images were moved to
Neon Object Storage, and clarified that the public review page, Manager index, and Manager detail
all need to read the same images.

The source and live checks establish the following pre-fix behavior:

1. The Backend returned a new signed URL when public or Manager review data was projected.
2. The public `ReviewCard` rendered every available review photo as a normal `<img>` without lazy
   loading.
3. The Manager detail rendered all photos for the selected review as normal `<img>` elements.
4. The Manager index used a click-triggered photo viewer, but its image URL still came from the
   per-response signed URL projection.
5. The Manager index and detail were already connected to the shared `googleReviewStore`; a ready
   snapshot prevents another Manager review-list request during normal SPA navigation.

The current Chrome verification after the fix showed the public review images using lazy loading,
the Manager index opening its image viewer on demand, and the Manager detail using the same stable
S3 URL for the selected review image.

## Confirmed current code path

The relevant flow before the cache fix was:

```text
Public page
  -> GET /api/google-reviews?placeSlug=PetHouse
  -> ReviewService projection
  -> signed URL per stored photo reference
  -> ReviewCard renders all photo <img> elements

Manager index
  -> GET /api/admin/google-reviews?placeSlug=PetHouse
  -> Admin Google Review projection
  -> signed URL per stored photo reference
  -> GoogleReviewPhotoViewer opens on demand

Manager detail
  -> shared googleReviewStore snapshot, or one list request on direct entry
  -> GoogleReviewDetailContent renders the selected review's photo <img> elements
```

The relevant sources are:

- [`review.photo.storage.ts`](../Backend/src/services/review.photo.storage.ts), which owns S3
  upload, deletion, legacy path resolution, and public media URL construction.
- [`review.service.ts`](../Backend/src/services/review.service.ts), which projects public review
  photos.
- [`admin.google.review.service.ts`](../Backend/src/services/admin.google.review.service.ts),
  which projects Manager review photos.
- [`googleReviewStore.ts`](../Frontend/src/features/admin/store/googleReviewStore.ts), which shares
  the Manager review snapshot and in-flight request across the Manager portal, index, and detail.
- [`PetHouseReviewPage.tsx`](../Frontend/src/features/maps-review/pages/PetHouseReviewPage.tsx),
  which owns the public page-local review snapshot.
- [`ReviewCard.tsx`](../Frontend/src/features/maps-review/components/ReviewCard.tsx), which
  renders public review photos.
- [`GoogleReviewPhotoViewer.tsx`](../Frontend/src/features/admin/components/feedback/GoogleReviewPhotoViewer.tsx),
  which opens Manager index photos only after the user requests them.
- [`GoogleReviewDetailContent.tsx`](../Frontend/src/features/admin/components/feedback/detail/GoogleReviewDetailContent.tsx),
  which renders Manager detail photos.

Public and Manager API reads remain separate because they have different actor and response
contracts. They share media caching through the identical stable S3 URL, not by merging the
permission boundaries or exposing Manager fields to public visitors.

## Root cause

### 1. The image cache key changed between page reads

Before the fix, `resolveReviewPhotoUrls()` generated a signed GET URL for every API projection.
The URL contained signing query parameters and an expiration. A later request could therefore
return a different full URL for the same object key. The browser cache key includes the URL, so
the browser could not reliably reuse the earlier image response across public, index, and detail
surfaces.

The signing work itself was not the dominant cost. The important problem was that the changing URL
allowed the multi-megabyte image transfer to happen again.

### 2. The public page eagerly requested full-size images

The public `ReviewCard` rendered every photo immediately. The current review media set is 10 PNG
objects totalling 23,102,865 bytes. Images below the first viewport were therefore eligible to
start loading before the visitor reached them.

### 3. Existing objects had no explicit cache policy

The existing database-linked S3 objects initially had no `Cache-Control` metadata. New uploads also
did not set a cache policy before this fix, so the browser did not have an explicit immutable-object
instruction.

### 4. The Manager database-read hypothesis was too broad

The Manager store already has two relevant protections:

- `activeGoogleReviewRequest` shares an in-flight list request.
- A ready `reviewPage` returns immediately without another list request.

Therefore, within one mounted Manager SPA session, index-to-detail navigation uses the cached
review snapshot. A direct browser reload, a new browser context, or the public-to-Manager actor
boundary can still require an independent API read. That is expected and is not the image-cache
bug.

## Expected behavior

When the same review image is available on more than one surface:

1. The DB media reference resolves to one stable object URL.
2. Public and Manager projections return the same URL for the same S3 object key.
3. The browser can reuse the previously loaded object when navigating between surfaces.
4. The public page does not eagerly download review images that are below the viewport.
5. The Manager index does not load the carousel image until the user opens the viewer.
6. The Manager detail uses the already-loaded review snapshot when navigation stays within the same
   SPA session.

“一次性讀取” means one transfer per browser cache context for a stable object URL. It does not
mean that every user, device, or clean browser profile shares one global download.

## Implemented solution

Implemented in the current working tree with the following changes:

1. Replaced per-response signed GET URLs with stable public object URLs derived from the configured
   S3 endpoint, bucket, and encoded object key. The Neon Object Storage bucket is currently public,
   matching the public review image behavior. Neon documents Object Storage as S3-compatible in its
   [official Object Storage announcement](https://neon.com/blog/building-neon-object-storage).
2. Kept the original filename as the final S3 key segment for new uploads. The upload-specific
   prefix still prevents different uploads with the same filename from overwriting one another.
3. Added `Cache-Control: public, max-age=86400, immutable` to new review photo uploads.
4. Applied the same cache policy through metadata-only in-bucket copies to the 10 S3 objects
   referenced by the current `google_review_media_logs` rows. Their object bytes and total size
   were preserved.
5. Added `loading="lazy"` and `decoding="async"` to public review card images and Manager detail
   images.
6. Removed the unused S3 presigner dependency from the Backend read path.
7. Left the Manager Zustand snapshot architecture unchanged because it already prevents a second
   Manager list read during normal index-to-detail navigation.

The following boundaries were intentionally not changed:

- `users.avatar_url` or `pets.image_url`.
- The teammate-owned avatar/pet image upload code.
- Google Review agent or investigation context.
- `Backend/database/neon.sql` or any database column.
- Local fixture restore behavior.
- The seven source asset names that were not present in the current `petown` bucket inventory.

## Verification of the solution

### Focused product tests

- Backend storage, public review service, and Manager review service:
  `npx vitest run src/__tests__/review.photo.storage.test.ts src/__tests__/review.service.test.ts src/__tests__/admin.google.review.service.test.ts`
  Result: 3 test files, 33 tests passed.
- Public review and Manager detail Frontend tests:
  `npx vitest run src/features/maps-review/pages/__tests__/PetHouseReviewPage.test.tsx src/features/admin/pages/__tests__/AdminGoogleReviewDetailPage.test.tsx`
  Result: 2 test files, 22 tests passed.
- Manager store, index panel, and image viewer tests:
  `npx vitest run src/features/admin/store/__tests__/googleReviewStore.test.ts src/features/admin/components/feedback/__tests__/GoogleReviewsPanel.test.tsx src/features/admin/components/feedback/__tests__/GoogleReviewPhotoViewer.test.tsx`
  Result: 3 test files, 35 tests passed.

### Quality checks

- `npm run build --prefix Backend`: passed.
- `npm run build --prefix Frontend`: passed. Vite still reports the existing advisory that one
  minified chunk is larger than 500 kB.
- Root ESLint: passed.
- Frontend Oxlint: passed.
- Prettier checks for changed Markdown, JSON, TypeScript, and TSX files: passed.
- `git diff --check`: passed.
- `.env.example` was checked as a text template because Prettier cannot infer a parser for that
  extensionless filename.

### Live Neon/S3 verification

- A new temporary image upload used the original filename, received a stable public URL, returned
  HTTP 206 for a range read, and was deleted after verification.
- The new upload was confirmed with
  `Cache-Control: public, max-age=86400, immutable`.
- The current DB contains 10 review media references; all 10 resolved to existing S3 objects.
- All 10 DB-linked objects now have the expected cache policy.
- Public and Manager service projections each returned 28 reviews and 10 photo URLs. The matching
  photo URLs were identical across both projections and contained no signing query string.

### Chrome verification

- The public review page displayed the review photos with `loading="lazy"` and
  `decoding="async"`.
- The Manager index opened its photo viewer only after the image action was selected.
- Navigating from the Manager index to the Manager detail used the same stable S3 URL for the
  selected review image.
- The Manager detail image also exposed `loading="lazy"` and `decoding="async"`.

## Acceptance criteria

- New review images are uploaded directly to Neon Object Storage and never written to the local
  review-photo directory by the runtime upload path.
- New images preserve the original filename as the final S3 key segment.
- New images receive the explicit immutable cache policy.
- Existing DB-linked review images resolve to stable public object URLs.
- Public and Manager projections return the same stable URL for the same object key.
- Public review images below the viewport are lazy-loaded.
- Manager index-to-detail navigation reuses the existing Manager review snapshot within one SPA
  session.
- A browser can reuse an already loaded image when the same stable URL appears on another review
  surface.
- Avatar, pet image, agent, schema, and unrelated fixture boundaries remain unchanged.

## Severity assessment

**High (proposed).** The problem affects a visible review workflow, can transfer the same multi-
megabyte objects repeatedly, and directly relates to the project’s Network Transfer quota.

It is not classified as P0 because there is no confirmed outage, data loss, authorization failure,
or corrupted persisted media. Production frequency, affected users, and exact quota contribution
still need runtime measurement.

## Verification gap

The source checks, focused tests, live S3 checks, and Chrome checks verify the stable URL and lazy
loading implementation. They do not yet provide:

- a formal Chrome DevTools waterfall proving the exact number of duplicate transfers before and
  after the fix;
- a production benchmark across different browsers, devices, or cache states;
- a quantified reduction in the Neon Network Transfer metric;
- a guarantee that the first cold full-image read is fast;
- a thumbnail or derivative-image pipeline for the original 2 to 3 MB PNGs;
- a decision to keep review media public if the product privacy policy changes;
- a completed Backend-wide unit runner after this final performance change. The broad runner was
  stopped when this performance issue was identified; the relevant focused suites passed.

The current `petown` inventory contained 11 image objects at the time of verification: 10 were
linked from the current review media rows, and `andrew-avatar.png` was left untouched because the
avatar path is outside this bug. Source assets absent from that current bucket snapshot were not
treated as present and were not modified.

If the first visible image remains slow after stable caching and lazy loading, the next change
should be a separate, explicitly scoped thumbnail/derivative-image plan. That would preserve the
original object and filename while serving a smaller card asset.

## Evidence boundary

### Confirmed by code

- Manager index and detail use the shared Google Review Zustand snapshot.
- The previous read projection generated signed URLs per response.
- Public cards and Manager detail rendered image elements without lazy loading before this fix.
- The new resolver builds stable object URLs, and new uploads include cache metadata.

### Confirmed by tests

- Storage upload, deletion, stable URL construction, legacy path handling, and cleanup behavior.
- Public and Manager service projection behavior.
- Public/detail lazy-loading attributes.
- Manager store request-sharing behavior.

### Confirmed by live provider/browser checks

- Neon S3 upload, public range read, cache metadata, and deletion for a temporary object.
- All current DB-linked review media objects exist in S3.
- Public and Manager projections return equal stable URLs.
- Chrome renders the public and Manager review image paths as expected.

### User-reported

- Review image reading was extremely slow after the S3 migration.
- Public Google Review, Manager index, and Manager detail all need to read the same image set.

### Inference

Stable URLs plus explicit cache policy explain why a browser can reuse the same image across the
three surfaces. The exact number of avoided transfers depends on browser cache state and has not
been measured with a formal network waterfall.

### Not verified

- Production-wide frequency and quota contribution.
- Cross-device or cross-browser cache reuse.
- The latency of a full cold download for every image.
- Future privacy requirements for public object URLs.

## Related boundary

The earlier [Admin Feedback Detail Switching Reload-Like Bug](./admin-feedback-detail-switching-bug.md)
describes how the feedback list/detail snapshot was centralized to prevent repeated detail and
sidebar reads. This document records the separate review-media problem: the Manager snapshot was
already shared, but the media URLs were not stable and the public page eagerly loaded large images.

The [Admin Google Review Cross-Browser Synchronization Bug](./admin-google-review-cross-browser-sync-bug.md)
records cross-browser invalidation and SSE behavior. It is related to review consistency but is not
the image-transfer root cause.

Evidence status: Confirmed unless explicitly labelled as user-reported, inferred, proposed, or not verified.
