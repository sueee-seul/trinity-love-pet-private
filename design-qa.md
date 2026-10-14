# PetHouse Review Page Design QA

- Reference: `/Users/heminghan/Downloads/ChatGPT Image Aug 31, 2026 at 01_28_39 PM.png`
- Modal reference: `/Users/heminghan/Downloads/ChatGPT Image Aug 31, 2026 at 01_39_08 PM.png`
- Target: `http://localhost:5173/maps/place/PetHouse/`
- Viewport: `941 × 1672` desktop viewport, initial static state
- final result: passed

## Visual checks

- The page renders as a standalone white review surface and does not use the parent or admin navigation.
- The PetHouse identity row, circular business mark, verified badge and service/location line follow the reference hierarchy.
- The rating breakdown, gold stars, overall score, review count and write-review CTA align with the reference composition.
- The rating breakdown rows show only the 5-to-1 labels, bars and counts; the overall score and review-card stars remain visible.
- The search/sort controls and topic chips appear before the review list with the intended spacing.
- Response cards and the compact truncated card use separate heights to match the reference rhythm.
- The standalone header uses the Google Maps wordmark, while local PetHouse visual assets remain in the business identity and review cards.
- Browser console inspection reported no warnings or errors.

## Frontend image selection

- The `Add photos` control opens the native file picker through one `multiple` input.
- The input accepts JPEG, PNG and GIF images only; video is not supported.
- Single selection creates one preview, and later selections append in order up to nine total previews.
- Each thumbnail has an individual remove control; removing a thumbnail only removes that local item.
- Selected files and temporary preview URLs stay in modal memory only. No fetch, FormData, API, photoUri or database write is performed.
- Closing the modal unmounts the picker and clears its temporary preview URLs.
- Each preview shows the supplied `loading_image.png` spinner until its image load completes, then fades in the image.
- Removing one loaded preview does not reset other loaded previews back to the spinner state.

## CSS organization

- The former 854-line `pages/maps-review.css` is now a small entry manifest that imports responsibility-scoped styles.
- Header, summary, review cards, modal, photo picker and modal footer styles are separated under `features/maps-review/styles/`.
- Browser measurements remained stable after the split: three cards, 820px content width, and a 640px modal at the desktop QA viewport.

## Write a review modal

- The `Write a review` CTA opens a centered dialog over the review page.
- The dialog includes a reviewer avatar initial, reviewer name, and Google Maps public-posting note.
- The dialog starts with five empty rating stars, uses the shared rating control for local selection, and includes an editable local-draft textarea, `Add photos & videos`, `Cancel`, `Post`, and a close button.
- No `Speak` or voice-input control is rendered.
- The dialog closes through the close button, Cancel, backdrop click and Escape.
- Selecting a rating fills the expected number of stars; closing and reopening resets the rating to zero.
- Textarea changes stay local and are cleared on close; `Post` and photo controls have no submission, persistence or API behavior.
- Parent feedback and the review modal consume the shared textarea component; parent feedback retains its separate voice-input and submission behavior.

## Deliberately deferred

- Mobile layout polish.
- Search, sort, topic filtering, like, draft persistence, server upload, photoUri persistence and review submission behavior.
- Backend, database, persistence and Google Maps API integration.
