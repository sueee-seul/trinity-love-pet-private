# Website illustrations

The website uses 18 optimized WebP illustrations for booking and care explanations. Seven new image sheets were generated through the Topview Chrome interface on 7 October 2026 (Pacific/Auckland), then exported as 13 individual illustrations. Five daily-care images are reused from the earlier Topview set. The assets total about 1.2 MB.

| Page or section                           | Artwork                                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Landing page: booking steps               | Introduce a pet, choose a package, submit a booking, arrive                                    |
| Landing page: care updates                | Daily overview and four care-category pictures                                                 |
| Landing page: cats                        | Indoor play and quiet rest                                                                     |
| Booking suggested combo cards             | A labelled quiet-rest concept illustration                                                     |
| Booking example daily update              | Four care-category pictures                                                                    |
| Grooming option                           | Bath illustration when grooming is offered                                                     |
| Booking and parent AI assistant           | A fictional puppy-and-kitten mascot                                                            |
| Parent homepage and preparation checklist | Packing/preparation illustration                                                               |
| Empty pets, stays and care views          | Separate add-pet, plan-stay and waiting illustrations                                          |
| Sign-in and account-entry pages           | Welcome illustration at desktop widths                                                         |
| Vaccination upload                        | An expandable HTML document diagram with blank fields and bilingual photo-quality instructions |

`Frontend/public/illustrations/care/` contains the static assets. `Frontend/src/shared/illustrations/` defines dimensions and bilingual labels. Concierge and portal wrappers read their existing locale owners, so captions also work in standalone page renders. Illustrations are lazy-loaded, have explicit dimensions, and use editable captions. Decorative assistant avatars sit beside the existing AI identification.

Concept art is labelled **AI illustration** (in both languages). It does not describe actual room dimensions, prove care completion, or replace user-uploaded pet photos, vaccination evidence or staff care attachments. No verified facility photographs were found in the reviewed assets; suggested combo cards therefore use clearly labelled concept art. The existing decorative pet photographs remain in place.

The `concierge_combo_booking` integration keeps the newer `StayPanel`, `StayCombos` and `StayBuilder` flow. The three deleted legacy package components are not restored. Grooming art appears only when that pet's available add-ons include grooming or a bath; the care sample is an expandable section in the stay panel.

Generation prompts, Topview node/task references, durable media references and crop coordinates are in [visual-materials/site-illustrations-manifest.json](./visual-materials/site-illustrations-manifest.json). Temporary download URLs and account credentials are excluded.

Validation uses Frontend lint, TypeScript/build, changed-file ESLint/Prettier, the affected existing page tests, and a local browser check. The change adds presentation assets and a document-quality guide; pricing, booking submission, authentication and care data contracts are unchanged.
