# Landing page

The public front page at `/`. It tells a first-time visitor what Wagstay is, what a stay costs and
how booking works, then sends them to the booking assistant at `/book`. Signed-in pet parents see
the same page, with a "My pet centre" link to `/parent` instead of "Sign in".

- Code: `Frontend/src/features/landing/` (`LandingPage.tsx` and one component per section).
- Words: `Frontend/src/features/landing/copy.ts`, in English and Chinese.
- Tests: `Frontend/src/features/landing/__tests__/LandingPage.test.tsx`.

## How routing works

`/` renders `PortalRedirect` from `Frontend/src/shared/auth/AccountRoute.tsx`, and `App.tsx` passes
it the landing page as `publicPage`. The shared auth layer never imports a feature this way.

| Who opens `/`                             | What they get                          |
| ----------------------------------------- | -------------------------------------- |
| A guest (no session)                      | The landing page, with "Sign in"       |
| A signed-in pet parent                    | The landing page, with "My pet centre" |
| Staff, first sign-in not finished         | Redirect to `/first-login-password`    |
| Staff                                     | Redirect to `/admin`                   |
| An account that is neither of the above   | Redirect to `/login`                   |
| Anyone, while the session is still loaded | The landing page, with the guest bar   |

While the session is being read the landing page is shown instead of a blank screen. It is the same
element before and after, so it is not remounted when the session arrives. Staff see it only for
that loading moment, then the redirect runs.

On `/book` the Wagstay wordmark links back to `/`, and a signed-in pet parent sees "My pet centre"
there too (`ConciergeHeader.tsx`).

## Sections, in order

1. **Header**: the Wagstay paw and wordmark, the anchor links (Prices, How it works, Care
   updates, FAQ) as navigation pills, 中文/English, Sign in or My pet centre, and "Plan a stay".
   It is in the hero colour. From 1024px it stays at the top, and the section being read shows as
   the solid pill: `useActiveSection` watches the four sections with an IntersectionObserver and
   the link gets `aria-current="true"`. `scroll-padding-top` keeps anchor jumps and keyboard
   focus clear of the bar. Phones keep it in the flow. See "Navigation" in
   `docs/brand-themes.md`.
2. **Hero** on `.theme-hero-band` with the current theme's picture, ending in `ThemeLaceEdge`.
3. **Promise strip**: four short facts.
4. **Prices** (`#prices`): the live "from" price, the published price list, the three packages.
5. **How booking works** (`#how-it-works`): four numbered steps.
6. **Care updates** (`#care`): the labelled example day.
7. **Dogs and cats**, with two photos, and the booking limits.
8. **Safe for every guest**: what we ask for before drop-off.
9. **Meet our booking assistant**, quoting its real greeting.
10. **Make Wagstay yours**: the nine themes as a native radio group (the page's signature moment).
11. **FAQ** (`#faq`) with native `details` and `summary`.
12. **Final call to action**: "Plan a stay" and "Talk to a person".
13. **Footer**.

## Where each fact comes from

The page states only what the code does today. It has no reviews, ratings, visitor numbers, address,
opening hours, webcams, cancellation terms or vet claims. Add one only when the business has it.

| Claim on the page                                    | Backed by                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The "from" price                                     | `GET /api/concierge/rates` through `useConciergeRatesResult` (the server's Essential total for one pet, one night)                       |
| The price list, grouped as rooms, food and extras    | `GET /api/concierge/catalogue` through `useConciergeCatalogue` and `rateCardGroups` (the same grouping as the `/book` rate card)         |
| Room, food and GST in one total; no booking/card fee | The concierge pricing and the `/book` promises in `features/concierge/copy.ts` (`packages.promises`)                                     |
| Only charged once we confirm your stay               | Pay at request: the full price is held when the booking is sent and charged once the stay is confirmed (`docs/ai-booking-concierge.md`)  |
| No account needed to plan                            | `/book` is public; the account is made at checkout after an email code                                                                   |
| Three packages and their descriptions                | `CONCIERGE_COPY[locale].packages.tiers`, the same words `/book` shows                                                                    |
| The example care day                                 | `CONCIERGE_COPY[locale].packages.sampleEntries`, labelled "Example" and captioned as not a real pet                                      |
| What to bring on drop-off day                        | The two drop-off items the confirmation names (`ConciergeSafetyTask` in `features/concierge/types.ts`)                                   |
| Up to 4 pets, up to 60 nights                        | `CONCIERGE_MAX_PETS` and `MAX_ONLINE_NIGHTS`, which mirror the Backend limits; the page reads the constants, so the numbers cannot drift |
| The assistant is an AI and says so                   | Its greeting and label (`chat.greeting`, `aiBadge`), quoted from the concierge copy                                                      |
| Talk to a person                                     | `HandoffPanel`, the same hand-off `/book` opens; it shows only a real configured email or phone from `GET /api/concierge/status`         |
| Works in English and 中文                            | The shared locale in the concierge store                                                                                                 |
| Reading help at the bottom left                      | The accessibility launcher (`shared/accessibility`)                                                                                      |

The three photos in `features/landing/assets/` are decorative pictures of pets. Their alt text
describes the animal and never says the picture shows our rooms. They are 1200px wide WebP copies
(quality 80, made with Pillow) of the PNGs in `Frontend/src/assets/`.

If the rates or the catalogue cannot be read, the page leaves the numbers out instead of guessing.
The price card then says "See your price in the booking assistant." and keeps its button.

## Language

English is the default, even when the browser prefers Chinese. The page uses the concierge store's
locale (`useConciergeLocale`), so it follows `?lang=zh` or `?lang=en` in the link, then the saved
choice under `trinity-concierge-locale`. The 中文/English button saves the choice, so `/book` opens
in the same language. While the page is shown it sets the tab title, and it restores it when the
visitor leaves (`useDocumentTitle`). `<html lang>` (`en-NZ` or `zh-Hans`) is set for the whole app by
`SiteLanguageProvider`, described in `docs/accessibility-toolbar.md`.

`index.html` already carries the site's meta description, and no page sets its own, so the landing
page adds none.

## Themes and the swatch pictures

Choosing a look calls `useBrandThemeStore.setTheme`, which changes the whole site at once, and turns
off any reading colour, as the Account Settings picker does. Where the browser supports view
transitions the change cross-fades; with reduced motion it is instant.

The looks are in three groups, each with a heading: romantic, luxury, then minimal. Each card is
`ThemeCard` (`src/shared/theme/components`), the same card Account Settings uses, so a theme looks
the same wherever it is chosen. A romantic or luxury card shows that theme's own picture from
`THEME_PAGE_IMAGES`. A
minimal card has no picture: it shows the theme's page colour with "Aa" in its accent. Strawberry
Cream, the customer default, carries a "Default" tag (默认 in Chinese). Slate and Moonlight
Sleepover carry a "Night mode" tag (夜间模式) and come last in their groups.

Showing the pictures is a trade-off with `docs/brand-themes.md`, where a visitor normally downloads
only their own theme's picture: this section downloads all six (about 120KB to 460KB each). They
load lazily, only when the section comes near the screen, so a visitor who never scrolls that far
pays nothing.

A visitor who has not picked a look sees Strawberry Cream, the customer default (see "Choosing the
default" in `docs/brand-themes.md`). Every group uses the same grid, so a card is the same size in
each: three columns, four from `sm` and six from `lg`.

## Fonts and colours

- The Wagstay wordmark in the header and footer: `font-logo`, Agbalumo in every theme.
- Titles and card titles: `font-agbalumo`, never bold (Agbalumo has one weight). Garden sets them
  in Fraunces and Maison Noir in Cormorant Garamond, through the theme, not the component.
- Prices and step numbers: `font-fraunces`.
- Buttons and small labels: `font-inter`.
- The "Example" label on the care card: `font-freckle`, the page's one playful accent.
- Body text names no font, so it takes the site's Times New Roman stack, or Nunito under
  Strawberry Cream.
- Every colour is a theme token. Text on the hero band and the final call to action uses
  `text-hero-ink`. The only accent fill is `bg-action-dark`, used for "Plan a stay" and the other
  primary actions. Those buttons also wear `theme-gradient-action`, so most themes paint them as a
  gradient.

## Theme decorations on this page

The page carries the marker classes the themes decorate (see "Decorations" in
`docs/brand-themes.md`):

- `<main>` wears `theme-pattern`, the page ground a theme may pattern.
- `ThemeDivider` sits before Prices, How booking works, Dogs and cats, the assistant and the FAQ.
  Only some themes draw it.
- The hero title wraps `hero.titleAccent` ("happy", "开心") in `theme-accent-word`, and the hero
  holds `ThemeHeroOrnament`.
- The package tiers are `theme-key-card theme-package-card`, and Signature adds
  `theme-feature-card` and `ThemeSignatureBadge`. The assistant card is a key card too.
- The two photos are `theme-photo-frame`, the section titles `theme-section-title`, and the promise
  items and icons `theme-wiggle-host` and `theme-wiggle-icon`.
