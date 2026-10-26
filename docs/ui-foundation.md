# Trinity UI Foundation

> Status: draft specification. This file describes the visual foundation to use when consolidating `Frontend/src/index.css`; it does not by itself mean that every rule has already been implemented.

## 1. Source of truth and scope

This foundation is based on:

1. The four UI reference screenshots supplied for this task.
2. The explicit Apricot Cream palette supplied by the product owner.
3. The product decision to replace Forte with Agbalumo. Forte must not be imported or added as a project dependency.

The foundation covers shared visual rules:

- color tokens and semantic color roles;
- typography roles, font families, sizes, weights, and tracking;
- phone and laptop layout behavior;
- buttons, status labels, care flags, navigation, and cards;
- the boundary between global foundation rules and page-specific layout.

It does not define page-specific copy, business state, API data, or interaction behavior that is not visible in the screenshots.

## 2. Color system

### 2.1 Raw palette

The following values are the only approved raw Apricot Cream palette for the shared theme:

```css
--color-apricot-cream-50: #fdf5e8;
--color-apricot-cream-100: #fbebd0;
--color-apricot-cream-200: #f7d7a1;
--color-apricot-cream-300: #f3c472;
--color-apricot-cream-400: #efb043;
--color-apricot-cream-500: #eb9c14;
--color-apricot-cream-600: #bc7d10;
--color-apricot-cream-700: #8d5e0c;
--color-apricot-cream-800: #5e3e08;
--color-apricot-cream-900: #2f1f04;
--color-apricot-cream-950: #211603;
```

Raw palette tokens and semantic roles have different jobs:

- Raw tokens describe the available color scale.
- Semantic tokens describe why a color is used, such as page background, card surface, primary action, or body text.
- Components should consume semantic roles. They should not repeatedly choose a raw shade directly in JSX.

### 2.2 UI color board

The latest color-board reference supplies the concrete UI colors below. The five core theme tones now come from the raw Apricot Cream scale rather than from five unrelated dark swatches:

```css
/* Core theme tones: resolved from the raw palette above. */
--color-theme-sun: var(--color-apricot-cream-500); /* #EB9C14 */
--color-theme-honey: var(--color-apricot-cream-400); /* #EFB043 */
--color-theme-apricot: var(--color-apricot-cream-300); /* #F3C472 */
--color-theme-peach: var(--color-apricot-cream-200); /* #F7D7A1 */
--color-theme-earth: var(--color-apricot-cream-700); /* #8D5E0C */
--color-theme-sun-hover: var(--color-apricot-cream-600); /* #BC7D10 */

/* Accessible foreground and control roles */
--color-accent-foreground: var(--color-theme-earth); /* #8D5E0C */
--color-accent-foreground-hover: var(--color-apricot-cream-800); /* #5E3E08 */
--color-control-border: var(--color-apricot-cream-600); /* #BC7D10 */
--color-focus: var(--color-theme-earth); /* #8D5E0C */
--color-rating-filled: var(--color-theme-earth); /* #8D5E0C */
--color-rating-empty: var(--color-apricot-cream-600); /* #BC7D10 */

/* Surface and background */
--color-surface-cream: #fff7ee;
--color-surface-deep: #fbebd8;
--color-surface-bubbles: #f9e2cb;
--color-surface-card: #ffffff;
--color-border-soft: #efe0cc;

/* Notice and state colors */
--color-notice-primary: #3a2a20;
--color-notice-secondary: #5a4a3f;
--color-notice-muted: #7d6959;
--color-action-dark: #54402f;
--color-status-warning: var(--color-theme-sun);
--color-status-success: #47703e;
--color-status-danger: #b3372a;

/* Soft status tints for chips, rows and notices: the status colour mixed into the card surface */
--color-status-warning-soft: color-mix(
  in srgb,
  var(--color-status-warning) 18%,
  var(--color-surface-card)
);
--color-status-success-soft: color-mix(
  in srgb,
  var(--color-status-success) 14%,
  var(--color-surface-card)
);
--color-status-danger-soft: color-mix(
  in srgb,
  var(--color-status-danger) 14%,
  var(--color-surface-card)
);
```

**No hard-coded colours (7 October 2026).** Every colour in `Frontend/src` outside
`shared/theme` is a semantic token class (`text-notice-*`, `bg-surface-*`, `border-border-soft`,
`bg-status-*-soft`, `bg-action-dark` with `text-on-action-dark`). A Tailwind arbitrary colour such
as `bg-[#f2eee9]` fails `shared/theme/__tests__/legacyColourCoverage.test.ts`. Chart series read
their colours through `features/admin/hooks/useChartThemeColors.ts` (`accent`, `danger`,
`warning`, `success`, `muted`), because a canvas cannot read CSS; SVG charts use `var(--color-*)`
directly. The generated override layer `brand-theme-legacy-colours.css` now covers stylesheet
rules only.

Rating states use both color and shape: filled stars use `rating-filled`, while unfilled stars
use `rating-empty` as an outline. This keeps the selected and unselected states distinguishable
at small sizes without relying on a low-contrast pale color.

The five core theme roles intentionally balance three light warm tones with one bright accent and one earth tone. This keeps the pet visual language warm and playful while reserving the darkest colors for text, navigation, and high-emphasis actions.

The color board's previous top-row values remain useful as visual references, but they are no longer the core theme scale:

- `#54402F` remains the dark action color.
- `#3A2A20` remains the primary notice/text color.
- `#9C6244` and `#6B4A33` are optional clay/earth accents, not required core tokens.
- `#E08A2B` is replaced as the main accent by raw palette `#EB9C14`.

The page background is now explicitly `#FFF7EE` because the latest color board labels it `Background: Cream`. Keep `--color-apricot-cream-50: #FDF5E8` as part of the raw Coolors scale, but do not silently substitute it for the page background. This prevents the raw scale and the UI semantic system from becoming two competing sources of truth.

### 2.3 Semantic roles

| Role                    | Target value                                 | Evidence                                          | Implementation status                                           |
| ----------------------- | -------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- |
| Page background         | `#FFF7EE` / `var(--color-surface-cream)`     | Latest color board: `Background: Cream`           | Foundation role                                                 |
| Card/surface background | `#FFFFFF`                                    | White cards in screenshots 2 and 4                | Foundation role                                                 |
| Main title text         | `#FFFFFF`                                    | Screenshot 1                                      | Agbalumo replacement for Forte                                  |
| Main title stroke       | `#000000`                                    | Screenshot 1                                      | Stroke width is not specified; verify visually before fixing it |
| Secondary title text    | `#E7CDB4`                                    | Screenshot 1                                      | Agbalumo replacement for Forte                                  |
| Normal/editorial text   | `#3A2A20` / `var(--color-notice-primary)`    | Screenshots 1 and latest color board              | Fraunces 700                                                    |
| Small/editorial text    | `#3A2A20` / `var(--color-notice-primary)`    | Screenshot 1                                      | Fraunces 400                                                    |
| Other decorative type   | `#5A4A3F` / `var(--color-notice-secondary)`  | Screenshots 1 and latest color board              | Freckle Face                                                    |
| Muted/supporting text   | `#7D6959` / `var(--color-notice-muted)`      | Latest color board                                | Supporting copy and update notes                                |
| Card title text         | `#3A2A20` / `var(--color-notice-primary)`    | Screenshot 1 and latest color board               | Agbalumo 700                                                    |
| Primary theme accent    | `#EB9C14` / `var(--color-theme-sun)`         | Raw palette 500                                   | Brand fills, decoration, warm surfaces                          |
| Soft theme accent       | `#F3C472` / `var(--color-theme-apricot)`     | Raw palette 300                                   | Borders, controls, warm decoration                              |
| Pale theme surface      | `#F7D7A1` / `var(--color-theme-peach)`       | Raw palette 200                                   | Bubbles and selected surfaces                                   |
| Earth theme accent      | `#8D5E0C` / `var(--color-theme-earth)`       | Raw palette 700                                   | Secondary emphasis; not a page background                       |
| Soft border/divider     | `#EFE0CC` / `var(--color-border-soft)`       | Latest color board: `Border`                      | Foundation role                                                 |
| Dark action/button      | `#54402F` / `var(--color-action-dark)`       | Latest color board and screenshot 4               | High-emphasis action only                                       |
| Warning/status chip     | `#EB9C14` / `var(--color-status-warning)`    | Raw palette 500 and screenshot 4                  | Warm warning/accent state                                       |
| Success/status chip     | `#47703E` / `var(--color-status-success)`    | Latest color board: `Success, verified, Finished` | Foundation role                                                 |
| Danger/status chip      | `#B3372A` / `var(--color-status-danger)`     | Latest color board: `Danger, urgent`              | Foundation role                                                 |
| Accessible accent text  | `#8D5E0C` / `var(--color-accent-foreground)` | Contrast against light surfaces                   | Links, active tabs, meaningful icons                            |
| Control/focus border    | `#BC7D10` / `var(--color-control-border)`    | Contrast against light surfaces                   | Inputs, selected cards, rating controls                         |

The screenshot-defined values such as `#3A2A20`, `#5A4A3F`, `#E7CDB4`, and `#FFFFFF` should remain explicit semantic roles. They should not be silently approximated by a nearby Apricot Cream shade.

`theme-sun` is reserved for warm fills, brand marks, and decorative accents. Functional text,
rating icons, selected states, focus indicators, and control borders use the darker accessible
foreground/control roles above. One bright accent cannot provide sufficient contrast in all of
those contexts at the same time.

The latest color board supplies exact values for the success and danger states, the notice text hierarchy, the border, the main surfaces, and the dark action. The five core theme tones are now resolved from the raw palette, so their semantic assignment is explicit rather than inferred from the old `Example` swatches.

### 2.4 Migration rule for existing aliases

Existing `--color-pet-*` names may remain temporarily as compatibility aliases, but new components should use the foundation roles. During the CSS consolidation, each old alias must either:

- point to an approved raw or semantic foundation token; or
- be removed after all consumers are migrated.

Do not keep two independent color systems in `index.css`.

## 3. Typography foundation

### 3.1 Font families

| Font role                     | Family         | Use                                                                   |
| ----------------------------- | -------------- | --------------------------------------------------------------------- |
| Display and card-title family | `Agbalumo`     | Main title, secondary title, card titles                              |
| Editorial family              | `Fraunces`     | Display values, numerals, normal/editorial text, small/editorial text |
| UI family                     | `Inter`        | Body copy, metadata, eyebrow labels, buttons                          |
| Decorative family             | `Freckle Face` | The screenshot's “other type” role                                    |

Forte is a design reference only. It is replaced by Agbalumo and must not appear as a font token, CSS import, or component dependency.

**Default text and Chinese text (product owner rule, 28 September 2026).**

- All four families above stay loaded, and every place that names one of them keeps it.
- Text that names no font of its own (the `body` default, bare paragraphs, `small` and bare
  buttons) uses `Times New Roman` through `--font-body`.
- Microsoft YaHei never renders. None of the four families has Chinese glyphs, so every stack in
  `index.css` ends with a Chinese serif: `Noto Serif SC` (loaded from Google Fonts), then Source
  Han Serif SC, Songti SC, STSong and SimSun. Chart text follows the same rule through
  `features/admin/utils/chartFont.ts`, because a canvas does not read CSS.
- Agbalumo has one weight, so weight synthesis is off wherever it is used. `card-title` roles that
  ask for 700 draw the real face, not a fake bold. In Chinese (`:lang(zh)`), `.font-agbalumo`
  titles are 700 so the Chinese serif uses its real bold.
- Customer-facing page and card titles (the booking page, the sign-in title) use Agbalumo;
  prices and other numbers stay in Fraunces.
- `shared/theme/__tests__/fontStacks.test.ts` fails if a stack loses its Chinese serif or any
  font declaration names YaHei or PingFang.

**Theme faces and the wordmark (product owner choice, 29 September 2026).**

- The Wagstay wordmark uses `--font-logo` (`font-logo`), which is Agbalumo and which no theme
  overrides. Use it for the wordmark, never `font-agbalumo`.
- Three themes change a face through `shared/theme/theme-fonts.css`: Strawberry Cream sets body text
  in Nunito (`--font-nunito`), Mint Secret Garden sets headings in Fraunces, and Maison Noir sets
  headings in Cormorant Garamond (`--font-cormorant`). Every other theme keeps the rules above.
- These stacks end with the same Chinese serif chain, and the test checks them too.

### 3.2 Named type roles

The role name is the source of truth for styling. HTML heading level and visual role are related but are not the same thing: an `h1` or `h2` should consume the role appropriate to the component instead of receiving an unrelated default size from each page.

| Role/class             | Family       | Weight                                   | Size                            | Tracking                | Color / notes                                                 |
| ---------------------- | ------------ | ---------------------------------------- | ------------------------------- | ----------------------- | ------------------------------------------------------------- |
| `type-display`         | Fraunces     | 700                                      | `27px` phone / `34px` desktop   | `-1.5%`                 | Display treatment from screenshot 2                           |
| `type-title`           | Agbalumo     | Source does not specify a numeric weight | Source does not specify         | Source does not specify | `#FFFFFF` with `#000000` stroke; stroke width needs visual QA |
| `type-title-secondary` | Agbalumo     | Source does not specify a numeric weight | Source does not specify         | Source does not specify | `#E7CDB4`                                                     |
| `type-card-title`      | Agbalumo     | 700                                      | `17px` phone / `21px` desktop   | Source does not specify | `#3A2A20`                                                     |
| `type-numeral`         | Fraunces     | 700                                      | Context-dependent KPI/stat size | Source does not specify | For KPI values, totals, and stat figures                      |
| `type-normal`          | Fraunces     | 700                                      | Context-dependent               | Source does not specify | `#3A2A20`; screenshot 1 normal-text role                      |
| `type-small`           | Fraunces     | 400                                      | Context-dependent               | Source does not specify | `#3A2A20`; screenshot 1 small-text role                       |
| `type-body`            | Inter        | 400                                      | `15px`                          | Source does not specify | Primary UI body copy from screenshot 2                        |
| `type-meta`            | Inter        | 400                                      | `12.5px`                        | Source does not specify | Metadata and supporting information                           |
| `type-eyebrow`         | Inter        | 700                                      | `9.5px`                         | `0.14em`; uppercase     | Small labels above sections                                   |
| `type-button`          | Inter        | 700                                      | `13.5px`                        | Source does not specify | All button labels and button-like actions                     |
| `type-other`           | Freckle Face | Source does not specify                  | Context-dependent               | Source does not specify | `#5A4A3F`; decorative type only                               |

The two screenshot typography groups are intentionally preserved as separate roles:

- `type-display` is the Fraunces display treatment described in screenshot 2.
- `type-title` and `type-title-secondary` are the stylized Agbalumo treatments derived from screenshot 1.
- `type-body` is Inter UI copy; it does not replace the screenshot 1 Fraunces `type-normal` and `type-small` roles.

This avoids forcing every `h1` to `h5`, paragraph, or label into one family and one size when the reference design clearly uses different roles.

### 3.3 Typography implementation rules

- Define font imports and font-family tokens once in `index.css`.
- Define the named type roles once and reuse them through semantic classes or component variants.
- Do not repeat arbitrary font family, weight, and size combinations in every page.
- Keep line-height values that are not supplied by the screenshots as implementation decisions subject to visual QA; do not present them as screenshot-derived facts.
- Do not create a `font-forte` token.

### 3.4 Staff console type

The staff console (`/admin`, the `admin-console` class on `AdminPortal`) keeps the sizes in the
table above and adds two rules of its own in `index.css`:

- its default face is the UI family (`--font-body: var(--font-inter)`), so a bare button, table
  cell or paragraph in the console reads in Inter like the typed text around it;
- paragraphs carry no base margin; the console sets its spacing on each element.

Console text names a role, never a pixel size: `type-meta` (12.5px) is the smallest text, used for
table cells, chips and small buttons; `type-eyebrow` (9.5px, uppercase) only for labels above a
value; `type-body` for notes and forms; `type-card-title` for every section and card title;
`type-display` for the one page title (`AdminPageHeader`); `type-numeral text-display` for KPI
figures. Weights stay at 400 and 700. Card radius is `rounded-2xl`, shadow `shadow-card`.

### 3.5 Pet parent type scale

The pet parent pages (the portal under `/parent` and the booking page) are read by customers,
often on a phone, so they set larger values for the same tokens with the `parent-type-scale`
class (`index.css`). The staff console keeps the sizes in the table above.

| Token / role                          | Pet parent size | Use                                           |
| ------------------------------------- | --------------- | --------------------------------------------- |
| `text-display` (page title)           | 28 to 36px      | The one `h1`, set by `PageHeader`             |
| `text-card-title` (`type-card-title`) | 18 to 22px      | Section and card titles, Agbalumo, weight 400 |
| `text-body` (`type-body`)             | 16px            | Body copy and form text                       |
| `text-btn` (`type-button`)            | 15px            | Buttons and button-like links                 |
| `text-meta` (`type-meta`)             | 14px            | Secondary text, dates, helper text            |
| `text-eyebrow` (`type-eyebrow`)       | 12px            | Small uppercase labels; nothing is smaller    |

Pet parent pages use these roles, not pixel sizes such as `text-[13px]`. The accessibility text
size control scales them too (`accessibility.css`). Agbalumo has one weight, so a title in it is
never set bold.

## 4. Responsive and layout foundation

### 4.1 Phone: 375 to 430px

- Use a single-column layout.
- The app shell fills the viewport using `100dvh`.
- The header is sticky.
- The main body scrolls independently where needed.
- The action bar remains pinned.
- The bottom tab/navigation height is `48px`.
- Cards use `14 to 15px` padding, `15px` radius, and `11px` gap.
- Respect safe-area insets at the top and bottom.

### 4.2 Laptop: 768px and up

- Use a two-pane shell: a `264px` rail plus the content area.
- The header and navigation merge into the left rail.
- The app shell has a maximum width of `1680px`.
- Cap the content column around `900 to 1240px` to preserve readable line length.
- At `1100px`, booking and profile cards may become a two-up layout.
- Sheets are centered as modals rather than rising from the bottom, following the screenshot reference.

### 4.3 Pet parent pages

Every page under `/parent` sits on the one translucent panel drawn by `PetParentPortal`, the
homepage included, and starts with `PortalPage` and `PageHeader`
(`features/pet-parent/components/layout/PortalPage.tsx`):

- `narrow` (768px): one reading column: My stays, Live care, Leave feedback, Vaccination.
- `standard` (1024px): a column with a sidebar: My account, a pet's page.
- `wide`: the whole panel: the homepage and the booking page.

Pages do not add a second bordered page card inside the panel. The portal uses a top bar on
laptops and five bottom tabs on phones (Home, Stays, Book, Chat, Profile) with the account menu
in the phone header, rather than the left rail in 4.2.

### 4.4 Staff console pages

Every page under `/admin` starts with `AdminPage`
(`features/admin/components/layout/AdminPage.tsx`), the console counterpart of `PortalPage`:

- `reading` (896px): one column of forms or a feed: Bookings.
- `standard` (1152px): a column with a sidebar: Pet list, a pet's dashboard, Feedback, the
  profile pages, Shifts, Team, a KPI report.
- `wide`: the whole console: Operation, Tasks, Staff management.

`AdminPortal` pads the console once (`p-4 sm:p-6 lg:p-8`); a page adds no side padding and no
top padding of its own. The page title is `AdminPageHeader` (`type-display`, optional eyebrow,
lead and actions); sidebars and rails use `type-card-title`, never a second `h1`. The two
full-height pages (Inquiries, the feedback and review detail pages) cancel the console padding
with negative margins and fill the viewport below the bar.

### 4.5 Layout ownership

`index.css` owns global tokens, base typography, semantic color roles, and reusable foundation utilities. Shared layout components own the shell, rail, tabs, card composition, and responsive arrangement. Page files own only page-specific composition.

Do not move every Tailwind utility or page-specific spacing rule into global CSS. The goal is one shared foundation, not one global stylesheet containing every page layout.

## 5. Component foundation

### 5.1 Buttons and action controls

All buttons use `type-button` unless a component has a documented exception.

| Variant          | Reference treatment               | Required behavior                                                           |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Primary action   | Dark brown filled pill            | High-emphasis action; use the approved dark-action semantic role            |
| Secondary action | Warm outlined pill                | Lower-emphasis action with visible border                                   |
| Completed/added  | Light beige filled pill           | Indicates an already-added or completed action                              |
| Text action      | Text link, underlined where shown | Use for actions such as “Change date”                                       |
| Field/control    | Neutral rectangular field         | Preserve the screenshot's simple control treatment until a form spec exists |

The variant name owns the visual meaning. Do not encode button meaning through ad-hoc color classes in each page.

### 5.2 Status and proof labels

The screenshot shows these semantic states:

- `Finished`: success/green;
- `Flagged`: warning/yellow;
- `Urgent`: danger/red;
- `Checked in`: neutral outlined state;
- `Cancel`: soft beige action/state.

Use `--color-status-success` for success states, `--color-status-danger` for danger states, and `--color-status-warning` for warning states. The neutral outlined and soft beige variants should use the surface and border roles until a more specific token is required.

### 5.3 Care flags

The pet register uses these semantic flags:

- `Allergy`: danger/pink-red;
- `Storm anxiety`: danger/pink-red;
- `Insulin ×2`: soft beige;
- `Slow eater`: pale orange.

These are compact chips, not paragraphs. Their text should use the shared UI type role. Use the danger, surface-deep, and surface-bubbles semantic roles as the initial mapping; do not add inline page-specific hex values.

### 5.4 Navigation

- Phone navigation uses a `48px` bottom tab treatment.
- Desktop navigation uses the `264px` left rail.
- The active phone item uses a warm beige surface; inactive items remain visually quiet.
- The desktop rail contains the header/navigation treatment rather than duplicating a separate top navigation.
- The night stepper uses a beige control group with white circular minus and plus buttons and a centered night value.
- “Space confirmed” is a success-state pill.

### 5.5 Cards

The reference card uses:

- a white surface;
- a dark brown top border;
- a rounded card shape;
- an Agbalumo card title;
- compact icon and bullet content;
- a divider before the update note;
- a small italic update note.

Use the responsive card spacing in section 4. Keep card composition shared when the structure and behavior are the same; keep page-specific content in the page or data layer.

Key cards on customer pages (package tiers, the assistant card, the pet parent home cards) also wear `theme-key-card`, and the package cards `theme-package-card`. Themes paint these with a gradient and their own decorations; admin cards, forms and tables do not wear them. See "Gradients" and "Decorations" in `docs/brand-themes.md` before adding the class to another card.

### 5.6 Date and time fields

Do not use `<input type="date">`, `type="time"` or `type="datetime-local"`. The browser draws them in its own language, and the `lang` attribute does not change that. An English page in a Chinese Chrome shows the Chinese "year/month/day".

Use the fields in `Frontend/src/shared/components/ui/date/` instead:

- `DateField`: a button that opens a calendar (react-day-picker) in a native `<dialog>`. It shows "Mon 12 Oct 2026" in English and year-month-day with the weekday in Chinese. Weeks start on Monday. Days outside `min` and `max` cannot be picked. Set `yearPicker` for dates far from today, such as a birth date.
- `TimeField`: a native `<select>` with our own labels, "9:00 am", or with the Chinese word for morning first. A current value that is not on the step grid stays as an extra option.
- `DateTimeField`: a `DateField` and a `TimeField` side by side, stacked on a phone.

The rules:

- The words follow the page language (`useSiteLanguage`), or the `locale` prop when it is given, never the browser language.
- Values keep the native formats: "YYYY-MM-DD", "HH:mm" and "YYYY-MM-DDTHH:mm". Empty is "". Dates are built from local parts, never with `toISOString()`, which moves an early New Zealand morning back a day.
- Pass `name` when a native form must submit the value. The field then renders a hidden input.
- Pass `className` to keep a page's own field look. The layout classes stay.
- The fields name no font family, so they use the default text font.
- In tests, use `chooseDate` and `chooseTime` from `date/testing.ts`. They work for both languages. `setupTests.ts` adds `showModal()` and `close()`, which jsdom lacks.

### Chinese mode

A visitor who picks Chinese must not see English on any customer page. Brand and pet names, NZ$,
GST, AI and kg may stay as they are. Staff pages under `/admin` are English only.

- **One language switch.** The concierge store holds the choice. Feature pages read it through
  `useConciergeLocale` or `usePortalCopy`. Shared components read it through `useSiteCopy`
  (`shared/i18n/siteLanguage.ts`), which `SiteLanguageProvider` (`Frontend/src/app/`) supplies.
- **Copy objects.** Every word a page writes is in an `{ en, zh }` object. TypeScript makes the
  Chinese half carry every key.
- **Server refusals.** The server writes its errors in English. English pages show them as sent.
  Chinese pages match the error code to their own sentence, or show the page's general message
  (`features/pet-parent/i18n/requestErrorText.ts`). A browser error such as "Failed to fetch" is
  never shown as thrown.
- **Fixed server words.** Some words come from the server in English, so the client keeps a
  Chinese map keyed by the English word. Service names are in `features/concierge/utils/serviceNames.ts`
  because the `services` table is English only and its ids differ between databases. The chat's
  quick replies, stay labels and statuses are in `features/pet-parent/ai-chat/chatServerWords.ts`.
  Live care task names, times and labels are in `features/pet-parent/components/live-care/liveCareWords.ts`;
  a task staff named themselves is shown as its kind of care, and a medicine keeps its name.
- **Staff notes.** Notes staff write on care tasks are free English. For a Chinese reader the live
  care request carries `lang=zh`, and the server adds a machine translation of each note
  (`Backend/src/services/care-note.translation.ts`, cached in memory, never failing the page). The
  page shows it labelled "Auto-translated" (in Chinese), with the original below the card on tap, the way booking sites
  show "Translated · Show original". A note that could not be translated says so in Chinese.
  Parent notices are said from the facts the server reads out of each sentence (`noticeWords.ts`).
  A quick reply is still sent in English, because the server matches it word for word. A word not
  in a map is shown as the server sent it, so a new service needs its Chinese name added.
- **Browser and Stripe words.** Forms set `noValidate` and check their own fields, because the
  browser writes its warnings in the browser's language. Stripe writes card and form errors in the
  card form's language; its other errors are English, so the page says its own sentence instead.
- **The guard.** `shared/i18n/testing/englishWordsIn.ts` lists every Latin word a Chinese reader can
  see or hear on a rendered page: text, and `aria-label`, `title`, `placeholder` and `alt`. Text marked
  `lang="en…"` on purpose (a "show original" panel, the language switch) is skipped, as are emails,
  the brand, NZ, GST, AI, kg, Stripe, Google, MetService, the Shift key and the providers the privacy
  notices name. The Chinese tests of the home, stays, live care, bell, vaccination, profile,
  feedback, chat, sign-in, landing and booking pages assert it finds nothing but their own names.
- **Messages that outlive a switch.** A notice raised now and read later (a price change, a failed
  turn, a checkout failure) is kept as what happened, a `LocalisedText` in the concierge, and worded
  when it shows, so switching language rewords it.

## 6. CSS and component boundaries

The intended consolidation is:

```text
index.css
├── raw palette tokens
├── semantic color roles
├── font imports and font-family tokens
├── typography role tokens/classes
└── minimal base element defaults

shared components
├── app shell / rail / bottom tabs
├── buttons and status chips
├── cards and card variants
└── reusable responsive layout pieces

feature/page files
└── page-specific composition, content, and state
```

`App.css` is not a second shared foundation and has been removed. `index.css` is the current
single source for global colors, semantic roles, font tokens, and typography utilities. The old
`--color-pet-*` aliases were removed after all Frontend consumers were migrated.

## 7. Evidence and open decisions

### Confirmed by the supplied screenshots or explicit product direction

- The Apricot Cream raw palette values in section 2.1.
- Agbalumo replaces Forte.
- The named font families and type roles shown in screenshots 1 and 2.
- The sizes and tracking explicitly shown in screenshot 2.
- The phone/laptop layout constraints in screenshot 3.
- The button, status, care-flag, navigation, and card treatments in screenshot 4.

### Confirmed in the current repository before this specification

- `Frontend/src/index.css` already contains the Apricot Cream scale.
- The repository already imports Agbalumo, Fraunces, Freckle Face, and Inter.
- Some screenshot 2 typography tokens already exist in `index.css`.
- `index.css` now represents the documented raw palette, semantic roles, accessible foreground and
  control roles, and typography utilities as one foundation contract.

### Must be resolved during implementation or visual QA

- Whether the optional clay colors `#9C6244` and `#6B4A33` are needed outside the core raw-driven theme scale.
- Final text/background contrast for each status and care-flag chip.
- The stroke width for the main title.
- Line-height values not stated in the screenshots.
- Browser visual QA for font loading, title treatment, and responsive spacing is still required.

## 8. Acceptance criteria for the CSS implementation and visual QA

- The raw Apricot Cream palette appears once as the shared raw color scale.
- No Forte import, token, or dependency remains.
- Agbalumo is used for the title roles that previously referenced Forte.
- The named typography roles are available without repeating arbitrary combinations across pages.
- `index.css` is the only global foundation source; no second `App.css` design system is introduced.
- The five core theme roles resolve from raw palette values: `#EB9C14`, `#EFB043`, `#F3C472`, `#F7D7A1`, and `#8D5E0C`.
- The semantic UI colors use the latest color board values, including `#FFF7EE`, `#FBEBD8`, `#F9E2CB`, `#FFFFFF`, `#EFE0CC`, `#47703E`, and `#B3372A`.
- Responsive shell rules match the phone and laptop constraints in section 4.
- Buttons, status labels, care flags, navigation, and cards consume semantic roles.
- Functional accent text, rating icons, selected states, focus indicators, and control borders use
  accessible semantic roles rather than the bright `theme-sun` foreground.
- Optional colors outside the raw-driven scale are documented as optional rather than silently becoming additional theme tokens.
- Visual verification is performed after the CSS migration, especially for title stroke, chip colors, and responsive spacing.
