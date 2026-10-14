# Accessibility toolbar

A floating button that opens a toolbar of reading aids, modelled on the assistive toolbars used by
NZ healthcare sites such as Auckland Eye. It is built in-house rather than licensed, so there is no
third-party script, no subscription, and no visitor data leaving the application.

## Where it appears

`AccessibilityWidget` is mounted once in `Frontend/src/App.tsx`, inside `BrowserRouter` and outside
`Routes`. Every surface therefore has it: login and signup, the pet parent portal, the admin portal,
and the standalone Google Maps review page.

The launcher sits bottom-**left**. The bottom-right corner is already occupied by the AI chat panel,
and on mobile the launcher is raised to clear the 48px tab bar.

## Controls

| Control                       | Effect                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Read / previous / next / stop | Reads the page aloud with the browser's `speechSynthesis` voice, one sentence at a time            |
| − / +                         | Page zoom in five steps, 100% to 160%                                                              |
| Spacing                       | Widens letter, word, and line spacing                                                              |
| Ruler                         | A band that follows the pointer so the current line stays isolated                                 |
| Theme                         | Every theme and every reading colour mode, behind one control (see below)                          |
| Language                      | Switches the whole site between English and Chinese; the button names the other language in itself |
| Reset                         | Returns every reading setting to its default, and the theme to the page's default                  |

### The language switch lives here

The English and Chinese switch used to sit in four headers (landing, booking, pet parent portal,
sign-in card). It now has one home, this bar, so a visitor finds it in the same place on every page
and the headers keep their room for the page's own actions. The button shows the other language in
that language ("中文" on the English site, "English" on the Chinese site), so a visitor who cannot
read the current language still recognises it. The choice is the same site setting as before: it
is remembered, `?lang=` still works, and staff pages stay English.

### One theme control

The bar is the widest thing on the page and already wraps on a laptop, so every control it holds
costs the ones beside it. Nine themes and four reading colour modes will not fit, and a control
that cycles is worse: it forces a visitor to step through every option and never shows the
choices. So the bar has one Theme control, and where it goes depends on who is using it
(`useAppearanceDestination`):

- A pet parent goes to Account Settings, where the theme picker and the reading colours sit with
  the rest of their preferences.
- A staff member goes to the Settings tab of their profile.
- Anyone else, including a signed-out visitor, opens the sheet below the bar with both pickers.

The bar used to carry two theme shortcuts, Paper and Moonlight Sleepover, beside this control. They
cost two slots of the widest row to show two of the options, and the sheet already shows all of
them with their names and pictures, so they were removed.

The reading colour modes are set once and left, unlike text size or the ruler, which a reader
reaches for again and again. They still override whatever theme is chosen, and take away its
gradients and decorations (see `docs/brand-themes.md`).

Reset forgets the chosen theme and applies the page's own default: Strawberry Cream on customer
pages and Simple under `/admin`. It does not save a theme, so the default keeps following the route.

### The sheet belongs to the bar, not to a page

"Other theme" used to call `navigate('/parent/profile?settings=open')`. That worked for exactly one
kind of visitor. The widget is mounted in `App.tsx` for **every** surface, and `/parent/profile` sits
behind `AccountRoute identity="pet_owner"`, so pressing it as a staff or manager account bounced
straight to `/admin`, and as a signed-out visitor on the login page to `/login`. From the outside it
looked like the app crashed and threw you somewhere.

It was worse than a dead button. The reading colour modes are only in Account Settings, and the
admin side has no settings surface at all, so routing there was the only way an employee could reach
high contrast, and it never arrived.

`AppearancePanel` now renders inside the bar and the bar owns it, so there is no route to get wrong
and no role to be. It renders the same `ThemeSettingsPicker` and `ContrastSettingsSection` that
Account Settings does, against the same stores, so there is no second copy to keep in step. It is
absolutely positioned: the widget sizes the page offset from the bar's `offsetHeight`, and a panel
in the flow would shove the page down on open and yank it back on close.

Escape closes the panel before it closes the bar.

The application's own typefaces are never swapped. Replacing them changes the metrics of every
label, which reflows the layout. That is the opposite of what a reading aid should do. Larger text comes
from the zoom steps, in the faces the product already uses.

Choices persist in `localStorage` under `tlp.accessibility.v1` and survive a reload. Stored values
are validated on read, so an old or hand-edited entry falls back to the default rather than applying
a nonsense setting.

## Reading aloud

The reader speaks `<main>` first, so it starts on page content rather than the navigation. It then
announces `End of page content. This is the top navigation bar.` and reads the top bar: the brand,
the links, and finally what the avatar opens: `Profile`, `Account Settings`, and `Log out`. A
sighted visitor takes that chrome in at a glance; someone listening has to be told it is there.

If the account menu happens to be open, its real items are read instead of the fixed hint.

## Language

The toolbar, the theme picker, the reading colours, the notification bell and the photo viewer
speak the site language. `SiteLanguageProvider` (`Frontend/src/app/`) wraps the routes in
`App.tsx`: it reads the visitor's choice from the concierge store, the same switch the landing page,
/book and the pet parent pages use, and gives it to `useSiteCopy` in `shared/i18n/siteLanguage.ts`.
Staff pages under `/admin` are English only, so there the tools stay English.

The provider is also the only code that sets `<html lang>` (`en-NZ` or `zh-Hans`). The reader
speaks in that language, and it ends a sentence at a Chinese full stop even though Chinese puts no
space after it. Every word lives in `shared/accessibility/accessibilityCopy.ts`.

## The lace edge

The bar's bottom edge is a scalloped trim rather than a border, drawn in the active theme's motif:
a knot for Strawberry, a star for Moonlight, a leaf for Garden, the draped swag from the package's
own divider for Royal, a small heart for Milk Cream, and a crisp art deco chevron with a gold bead
for Maison Noir. Simple has a plain scallop with a bead, and Paper and Slate a plain scallop with
no picot.

Two layers per tile: the scallop body is filled in the bar's own shell colour, so the bar looks cut
into scallops rather than having a strip stuck underneath it, and the outline and picot are stroked
in the shell's ink. Both come from theme tokens, which is what puts gold lace on Royal's emerald.

The trim is **padding inside the bar**, not a strip hanging below it. The widget measures
`offsetHeight` to size the page offset, so anything positioned outside that box would sit on top of
the first rows of the page.

## Performance

Two things in this feature were making the page stutter, and both are fixed:

- **The ruler re-rendered on every `pointermove`.** Holding the pointer position in React state
  meant a render for every event the browser fired, well over a hundred a second while the mouse
  moved. The position is now written straight to the node through a ref inside a single queued
  animation frame. Nothing else needs to know where the pointer is.
- **`.bg-pet-theme` used `background-attachment: fixed`** over a 1.4MB PNG. A fixed background
  cannot be composited on the scrolling layer, so the browser repainted a full-viewport image every
  scroll frame. That rule is in `index.css`; the attachment is gone and `background-size` is now
  `cover` rather than a stretched `100% 100%`.

The PNG itself is still 1.4MB and is worth converting to WebP. The theme illustrations are
286-458KB for a larger image.

## Settings switch

Account Settings (`PetParentSettingsModal`) carries a switch that hides or shows the floating button.

Switching it **off also resets every reading setting**. Without that, a visitor who had zoomed to
160% and then hid the button would have no visible way to undo the zoom.

## Why the overrides are broad

The application carries roughly 172 hard-coded `text-[Npx]` sizes and 380 literal hex colours, with
only 11 uses of the semantic typography tokens. Redefining Tailwind theme tokens would leave almost
the entire interface unchanged, so `shared/accessibility/accessibility.css` instead applies broad
`!important` rules scoped under `#root`.

Two consequences follow from that design:

- **Type scales, the layout does not.** An earlier version scaled `zoom` on `#root`, which enlarged
  padding, cards and the grid along with the words: the page kept its shape, ran out of room, and
  the top bar collapsed. Redefining the size tokens instead grows the text and leaves the structure
  alone.

  Three groups have to move together, because the product sizes type three ways: this project's own
  `--text-*` tokens, Tailwind's built-in scale, and ~200 one-off `text-[Npx]` classes. The last
  group cannot be reached by a token (the number is part of the class name), so
  `accessibility-text-sizes.css` is generated from the source with
  `node scripts/generate-a11y-text-sizes.mjs`. Without it, the smallest labels in the product, the
  ones a visitor most needs enlarged, would be the only ones that never grow.

- **The toolbar, launcher, and ruler render through a portal onto `document.body`,** outside `#root`.
  That is what keeps the controls themselves at normal size and normal colours while the page behind
  them is zoomed or inverted.

## Not included yet

Magnifier, dictionary, and a general dictation control.

Dictation is worth stating precisely, because the product does have it: the shared dictation
module in `shared/dictation/` powers the feedback form and the pet intake assistant, and the intake
assistant also accepts any language and fills the form in English (`docs/ai-features.md`). What the
toolbar does not have is a control that dictates into _whatever_ field is focused. That is a
different problem: it needs a target, and the bar has no way to know which one.

The five reading colour modes (now in Account Settings) are the plain high-contrast set. They are
correctness-first, not designed, and are expected to be replaced with a chosen palette; only
`accessibility.css` changes when they are.

## Verified

- `npx vitest run`: 128 files, 719 tests pass, including 20 for this feature.
- `npx tsc -p tsconfig.app.json`, `oxlint` and `prettier --check src` are clean.

  Note that plain `npx tsc --noEmit` checks **nothing** here: the root `tsconfig.json` is a
  solution file (`files: []` plus references), so it has no inputs of its own. The real check is
  the project config, which is also what `tsc -b` in `npm run build` uses.

- Two failures in `OperationSidebar.test.tsx` and `AdminProfilePage.test.tsx` are present on
  `origin/main` without this branch's changes; they arrived with PR #360.
- `npx tsc -b` fails on `KpiBarChart.tsx` for an undefined `KpiBarChartDataset` type, also present on
  `origin/main`.
