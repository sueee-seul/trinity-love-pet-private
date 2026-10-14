# Brand themes

There are nine themes in three families. A visitor picks one in Account Settings, on the landing
page, or from the accessibility toolbar. Every picker shows the families in the same order:
romantic, luxury, then minimal (`BRAND_THEME_FAMILIES` and `BRAND_THEMES` in `constants.ts`).

A visitor who has not picked one sees **Strawberry Cream**, on customer pages and on the staff
console under `/admin` alike. See [Choosing the default](#choosing-the-default). The original apricot palette used to be the default
and was called Default. It is now called Simple.

| Family   | Themes                                                                |
| -------- | --------------------------------------------------------------------- |
| Romantic | Strawberry Cream, Milk Cream, Mint Secret Garden, Moonlight Sleepover |
| Luxury   | Le Petit Palais, Maison Noir                                          |
| Minimal  | Simple, Paper, Slate                                                  |

**Romantic** and **luxury** are the four palettes from the "四季宠爱" design package, plus Milk
Cream and Maison Noir, added in September 2026. Each has its own illustration and motif, and no two
share a picture. See [Theme pictures](#theme-pictures) for which picture each theme has and where
it shows.

**Minimal** is plain colours with no motif, no pattern and **no picture**: Simple, Paper and Slate.
It exists because the other themes are decorative by design, and a workspace someone stares at all
day is not always the place for that. The product owner removed the minimal pictures in September 2026.

**Night mode.** The pickers tag Slate and Moonlight Sleepover as night mode
(`NIGHT_MODE_BRAND_THEMES`) and put each last in its group. The product owner chose these two.
Maison Noir also has a dark colour scheme, but it is shown as a luxury look, not as a night mode.

**Default tag.** The pickers tag the page's default theme as "Default" (默认 on the landing page):
Strawberry Cream everywhere, the Account Settings picker on staff pages included.

**The pickers.** The landing page and Account Settings (`ThemeSettingsPicker`, also in the
toolbar's appearance panel and the staff and manager settings) show the same picture cards,
`ThemeCard`, in the same three rows. In Account Settings a preview on top names the chosen theme
once and says what it is; below it each group is a row with its name and one line, and the cards
come four to a row where the picker has room and two where it does not (a container query on the
picker's own width). It replaced a three-column list that broke names and blurbs a word to a
line inside the dialog. Two pickers open at once keep separate radio groups (`useId`).

Since September 2026 the themes also carry [gradients](#gradients), [their own faces](#theme-faces)
and [decorations](#decorations), all chosen by the product owner from a mockup.

## Where the palettes live

`src/shared/theme/palettes.ts`, in TypeScript, and the stylesheet is generated from it:

```
node scripts/generate-brand-theme-palettes.mjs
```

They started out written directly in CSS, which meant nothing checked them. Adding a theme left
its palette silently missing, and that is exactly what happened when the minimal family was added.
`Record<Exclude<BrandTheme, 'simple'>, BrandPalette>` now makes an incomplete palette a type error.
Simple is left out because it is the absence of a theme, so it has no palette of its own.

It also gives the contrast test something it can read. Vite's stylesheet pipeline intercepts `?raw`
on a CSS file and hands back an empty string, so a test that imports the CSS asserts against
nothing and passes no matter what. Anything a test needs to check has to start in TypeScript.

The package's own names are recorded here for provenance. The interface shows the name in the
site language: the English names below, or the Chinese names in `shared/theme/themeCopy.ts`, which
also holds every blurb, group name and picker label. The landing page reads its names from there
too, so a theme is never called two things.

| Theme (key)                     | Package name         | Character                                                           |
| ------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Simple (`simple`)               | 蜜桃奶油             | The apricot palette the product already had. Was named Default      |
| Strawberry Cream (`strawberry`) | 奶油草莓             | Strawberry cream, bows, soft hand-drawn edges. The customer default |
| Moonlight Sleepover             | 月光晚安             | Indigo night and lavender. A dark theme                             |
| Mint Secret Garden              | 薄荷花园             | Sage green, daisies, plant-journal feel                             |
| Le Petit Palais                 | 皇家宠爱             | Champagne gold and emerald, pearl and rose detailing                |
| Milk Cream (`milk-cream`)       | (not in the package) | Milk white and gold, with a gilded frame                            |
| Maison Noir (`noir`)            | (not in the package) | Black velvet and champagne gold in art deco lines. A dark theme     |

Milk Cream started as the solid colours Strawberry Cream shipped with. When Strawberry Cream
became the default and gained its gradients and decorations, the product owner kept the old look
under its own name rather than lose it. Later in September 2026 the product owner asked for it to
be milk white and gold all through, so the pink went: the accent is now an antique gold,
`#86621d` (5.2:1 on the page, so it can carry text), and the soft ground (`#f5ead8`), the border
(`#a8844a`, 3.3:1) and the card shadow are gold tints. The accessibility launcher, links, focus
rings and the heart motif all follow the accent.

## How a theme reaches the interface

`shared/theme/brand-themes.css` states each palette once as `--brand-*`, then a single mapping
block points the project's semantic tokens at those variables.

It works because Tailwind v4 emits `@theme` entries as real custom properties and keeps the
`var()` chains intact. Redefining one ramp stop flows through everything built on it: overriding
`--color-apricot-cream-700` carries `--color-theme-earth`, `--color-accent-foreground`,
`--color-focus` and the rating colours with it. So the semantic part of the mapping is 28
declarations, not one per token.

Hover steps mix toward `--brand-ink` rather than black, so Moonlight's hover states get lighter
instead of disappearing into the background.

`html[data-theme]` outranks the `:root` block Tailwind emits, so source order does not matter.
Simple **removes** the attribute rather than setting `data-theme="simple"`, because the mapping
block matches on the attribute's presence. `UNTHEMED_BRAND_THEME` in `constants.ts` names it.

## Choosing the default

Every page opens in Strawberry Cream, the staff console under `/admin` included, since 7 October
2026: the owner wants the three portals to read as one product, and the console now paints with
the same tokens, panel and plate as the pet parent pages. `defaultThemeForPath` in
`shared/theme/themeDefaults.ts` still knows which paths are the console
(`STAFF_DEFAULT_BRAND_THEME`, equal to the customer default today), so a different staff default
is one constant away; a path that only starts with the same letters, such as `/administration`,
is not a staff page. Staff who want a plain workspace pick Simple in Account Settings, and the
choice sticks.

- **First load.** The store reads the saved choice. With none, it uses the default for
  `window.location.pathname`. It applies the theme before React renders, so the page does not flash
  another palette first.
- **Moving between pages.** `BrandThemeRouteSync`, inside the router in `App.tsx`, applies the new
  route's default when the route changes. It does nothing once the visitor has chosen a theme.
  A manager who signs in on `/login` and lands on `/admin` keeps Strawberry Cream.
- **Choosing.** `setTheme` saves the choice under `tlp.brandTheme.v1`. From then on it applies on
  every page, `/admin` included.
- **The old stored value.** Before the rename, the apricot palette was saved as `default`. The
  product owner chose to move those visitors to Strawberry Cream, so `themeFromStoredValue` reads
  `default` as `strawberry`. An unknown value reads as no choice, so the route default applies.
- **Reset.** The toolbar's Reset calls `resetToRouteDefault`. It removes the saved choice and
  applies the current page's default.

## Filled controls and dark themes

Primary buttons, checked pills, the boarding pass header and similar filled controls use
`bg-action-dark`. That token used to follow `--brand-ink`. Ink is near white on a dark theme, so on
Slate and Moonlight every filled control became a white block, and `text-surface-card` on top of it
turned dark. The rule now:

**Never put a fixed light colour on a filled control. Use the token made for that fill.**

| Token (utility)                                  | Simple       | Light themes | Dark themes |
| ------------------------------------------------ | ------------ | ------------ | ----------- |
| `--color-action-dark` (`bg-action-dark`)         | `#54402f`    | `ink`        | `accent`    |
| `--color-on-action-dark` (`text-on-action-dark`) | card surface | `surface`    | `on-accent` |
| `--color-on-sun` (`text-on-sun`)                 | apricot 950  | `on-accent`  | `on-accent` |
| `--color-shadow-tint`                            | `#3a2a20`    | `ink`        | `#000000`   |
| `--color-field-border` (`border-field-border`)   | `#a48a68`    | `border`     | `border`    |
| `color-scheme`                                   | `light`      | `light`      | `dark`      |

- `on-action-dark` is the text and icon colour on `bg-action-dark`, with the same variant prefix
  (`hover:`, `aria-checked:` and so on). The WAG monogram uses it at 75% opacity.
- `on-sun` is the icon colour on `bg-theme-sun`, such as the accessibility launcher. Its old
  `text-apricot-cream-950` followed ink and fell to 1.5:1 to 2.2:1 under every theme.
- `shadow-tint` is what a shadow mixes in, for example
  `color-mix(in srgb, var(--color-shadow-tint) 14%, transparent)`. A shadow made from the text
  colour glows on a dark theme.
- `field-border` is for input and select edges. `border-soft` is 1.3:1 on white, so a field had no
  visible end. The Simple value keeps the warm hue and clears 3:1 on white and on the cream page.
- `color-scheme` makes the browser draw date pickers, scrollbars and other native controls dark on
  Slate and Moonlight. `:root` sets `light` in `index.css`; the palette file overrides it.

Each palette carries `action`, `on-action`, `shadow-tint` and `color-scheme` in `palettes.ts`. The
contrast test measures the new pairs in every theme, Simple included, by following the real
`var()` chains in `index.css` and `brand-themes.css`. `actionDarkText.test.ts` fails when any class
string puts `bg-action-dark` together with `text-surface-card` or `text-white`.

The rule that makes translucent surfaces opaque under a theme matches only the plain utility
(`bg-white/80` at the start of the class list or after a space). It used to match `hover:bg-white/10`
as well, which painted the hover colour all the time.

## Precedence

Three layers paint the same pixels, in this order:

1. Tailwind's own `.bg-\[\#f1ece7\]` - the hard-coded colour.
2. `html[data-theme] .bg-\[\#f1ece7\]` - the theme override. Higher specificity, so it wins.
3. `accessibility.css` under `#root`, with `!important` - the reading aids. They win over both.

The override layer carries **no `!important`** for exactly this reason. Specificity is enough to beat
Tailwind, and staying non-important is what leaves the high-contrast modes on top, where a visitor
who needs them has to be able to put them. A test asserts the generated file never gains one.

## Relationship to the accessibility toolbar

Two separate systems, deliberately:

- **Theme** is a look-and-feel choice. All nine live in Account Settings and on the landing page.
- **Reading colours** are reading aids: high contrast dark, high contrast light, yellow on black and
  greyscale. They live in Account Settings.

The toolbar has one Theme control for both. A pet parent goes to Account Settings, a staff member
to the Settings tab of their profile, and anyone else opens a panel under the bar with both
pickers (`useAppearanceDestination`). The toolbar's Reset also forgets the chosen theme and goes
back to the page's default (see [Choosing the default](#choosing-the-default)).

The reading aids win. `accessibility.css` is imported after this file and applies its colours with
`!important` under `#root`, so a visitor who needs high contrast gets it whatever theme is set. They
also take away every gradient and decoration: see [Gradients](#gradients) and
[Decorations](#decorations).

## Coverage

Every page follows the theme. It takes three layers to get there.

**1. Semantic utilities** - about 1940 uses of `bg-surface-card`, `text-notice-primary` and the
rest. These follow the theme for free, because the tokens they read are what a theme redefines.

**2. The generated override layer** - `brand-theme-legacy-colours.css`, built by
`scripts/generate-theme-legacy-colours.mjs`:

| Source                                      | Rules | Reach                                        |
| ------------------------------------------- | ----- | -------------------------------------------- |
| Tailwind arbitrary classes (`bg-[#f1ece7]`) | 0     | none left since 7 October 2026               |
| Plain stylesheets (maps-review, etc.)       | 31    | declarations and `--maps-review-*` variables |
| Inline SVG attributes (chart gridlines)     | 4     | matched by attribute value                   |

The value in `bg-[#f1ece7]` _is_ the class name, so a token cannot reach it - but a CSS rule on that
same class can. The generator used to map 134 such classes (476 call sites, almost all in the
staff console) onto the token closest to the role each filled. On 7 October 2026 every call site
was rewritten to that token (the mapping the generator had chosen, plus `bg-status-*-soft` for
the pale status panels it had expressed as `color-mix`), so the console now follows a theme the
same way the pet parent pages do and looks the same on the default palette. The generator keeps
the classification for the day someone adds a class again; the test below then fails.

The generator reads hex, `rgb()`, `rgba()`, `hsl()` and `hsla()` arbitrary classes. An alpha inside
the colour is folded into the token the same way as an opacity modifier. The class pattern is
exported from `legacyColourManifest.ts`, so the drift test looks for exactly what the generator does.

Stylesheet comments are stripped before rules are read, so a comment above a rule no longer ends up
in its selector. The reading colours in `accessibility.css` are skipped on purpose: they must never
follow a theme. The generator used to re-emit them as `html[data-theme] html[data-a11y-theme=...]`,
which can never match, and mapping them would have put reading colour Dark onto `action-dark`.
Any other rule that starts at `html` or `:root` is reported and left out for the same reason.

Do not add a hard-coded colour class: `legacyColourCoverage.test.ts` fails and names the class
and the file, and the fix is a semantic token. Rerun the generator after changing a plain
stylesheet colour.

**3. Deliberately left alone**

- The default apricot palette in `index.css`, which is what "no theme" means.
- The accessibility high-contrast colours, which must not follow a theme.
- The puppy and kitten avatar artwork, and the picker's swatches.
- Third-party brand marks. The Google "G" keeps `#4285F4`, `#34A853`, `#FBBC05` and `#EA4335`
  on every theme - a logo's colours identify someone else's product. The generator holds these
  in a named list rather than deciding by eye.

### How the override layer classifies a colour

By chroma and lightness, never by name. Near-neutrals fall onto the surface, text or border scale by
lightness. Saturated colours keep their meaning through the status tokens. A pale off-axis panel
stays a tint, by mixing its status colour into the card surface rather than becoming a solid block.

The discriminator worth knowing: **this product's palette is warm, so a warm cast is not evidence of
intent.** Body text at `#756452` (39 call sites) is a warm grey-brown, not an accent, and needs a
much higher chroma before it counts as one - while a green, blue or pink is deliberate at a fraction
of that. An earlier pass that used HLS saturation got this backwards and read every off-white as a
warning banner.

Variants and opacity modifiers are part of a Tailwind class name, so they are reproduced too: a
`hover:` rule carries `:hover`, and `/15` is folded into the token with `color-mix`. Class names are
case-sensitive, so `#0CA30C` and `#0ca30c` are two selectors for one colour and both are emitted.

### Known rounding

Two single-use dusty terracottas, `#9b6b5d` and `#a66e60`, sit on the boundary between the red and
warm bands and come out as the theme's danger colour rather than a brown. Under a theme the whole
palette shifts anyway, so this was left rather than special-cased.

The maps-review page deliberately imitates Google Maps, down to Google's own greys. It now follows
the theme like everything else. If it should stay looking like Google instead, add
`src/features/maps-review` to `SKIP` in the generator and rerun - one line.

## Contrast when the package themes were added

This table records the four package themes and the apricot palette (now Simple) when they were
added. It is not updated by hand. The tests in [Contrast tests](#contrast-tests) measure every
theme, Milk Cream and Maison Noir included, on every run. Every text pairing below clears WCAG AA
for normal text (4.5:1):

| Theme      | Body on page | Body on card | Secondary on card | Accent on card | On filled accent |
| ---------- | ------------ | ------------ | ----------------- | -------------- | ---------------- |
| Strawberry | 10.23        | 10.61        | 5.98              | 6.03           | 6.17             |
| Moonlight  | 15.54        | 12.87        | 8.33              | 8.35           | 8.79             |
| Garden     | 8.87         | 9.62         | 5.28              | 6.58           | 6.73             |
| Royal      | 9.24         | 10.65        | 5.27              | 6.13           | 6.95             |
| Apricot    | 12.92        | 13.71        | 8.45              | 5.62           | 5.62             |

Card borders sit between 1.5:1 and 2.2:1 and do not reach the 3:1 guidance for UI boundaries. That
is true of the existing apricot palette as well, at 1.30:1. The new themes are all better than
what ships today. Borders are decorative here rather than the only cue, and the high contrast modes
force a solid border when a visitor needs one. Input edges have their own token,
`--color-field-border`, which clears 3:1 in every theme including Simple.

## The shell token, and how Royal got its emerald

Royal is the package's dark emerald shell holding cream cards. A literal port printed dark brown
text on dark green, because the project has one `--color-notice-primary` for both regions.

The first attempt lifted the surfaces to cream and kept the emerald only as a faint tint, which is
why it looked grey rather than green. The real fix was the missing token: `--brand-shell` and
`--brand-shell-ink`.

The shell is read only by the page chrome: the top bar, the hero panel, the accessibility toolbar
and its lace. It could not simply borrow `--color-surface-deep`, because 55 badges and table
headers across 44 files wear that token with dark text on top; turning it emerald would have made
every one of them unreadable. With its own token the emerald reaches the chrome, the light gold
goes on top of it, and cards and badges stay on the cream side.

That is also what puts gold lace on Royal's emerald bar: the lace body is the shell colour and its
stroke is the shell ink.

A filled control in the bar keeps its own text colour. The Sign up link is `bg-action-dark`, and on
Paper, Strawberry and Garden that fill is the shell ink itself, so the bar's text rule used to put
the label at 1:1. The bar rules now skip `.bg-action-dark` and everything inside it, and
`headerFilledControls.test.ts` checks that against the parsed stylesheet.

## Contrast tests

`contrast.test.ts` measures the palette pairs and the semantic token pairs in every theme,
including borders at 3:1, the hero band pair and text over a picture. `gradientContrast.test.ts`
measures the text on both stops of every gradient, and on the phone veil at both stops. Both share
their colour maths and stylesheet reading through `__tests__/themeContrastKit.ts`, which is a
helper, not a test.

### What the test cannot catch

It measures whether the **palette's own pairs** are legible. Four real defects got past it, and all
four were the same shape: a colour meeting something the palette never paired it with:

- A rule painting the top bar's shell ink onto the account menu's own cream surface.
- The same rule painting every `<header>` in the codebase, 20 of which are section headings inside
  page content, not top bars.
- The same rule painting the shell ink onto the Sign up link, whose fill is that same colour on
  three light themes.
- A translucent panel taking its effective contrast from a photograph behind it.

Catching this class needs visual regression in a real browser. The palette test is necessary and
not sufficient, and it is worth knowing which of the two it is.

Borders had to be moved to get there. The package's own border values sit between 1.5:1 and 2.2:1
against their surfaces, which reads as decorative but fails the guidance for a UI boundary, and a
border is often the only thing saying where an input ends. Each one was darkened (or lightened, on
a dark theme) to the lightness that clears 3:1 against both `surface` and `bg`, keeping the hue the
package chose. The apricot palette the product already ships sits at 1.30:1, so every theme is now
better than the default on this axis.

## Theme pictures

| Theme               | Picture                | Size   | Where it came from                       |
| ------------------- | ---------------------- | ------ | ---------------------------------------- |
| Strawberry Cream    | `strawberry-hero.webp` | 309 KB | Design package                           |
| Moonlight Sleepover | `moonlight-hero.webp`  | 321 KB | Design package                           |
| Mint Secret Garden  | `garden-hero.webp`     | 286 KB | Design package                           |
| Le Petit Palais     | `royal-hero.webp`      | 458 KB | Design package                           |
| Milk Cream          | `milk-hero.webp`       | 123 KB | AI illustration, Topview, September 2026 |
| Maison Noir         | `noir-hero.webp`       | 135 KB | AI illustration, Topview, September 2026 |

All six live in `src/shared/theme/assets/` and are mapped in `assets/pageImages.ts` as
`THEME_PAGE_IMAGES`, a `Record<BrandTheme, string | null>`. The three minimal themes map to `null`.
`pageImages.test.ts` fails if a minimal theme gets a picture, if a romantic or luxury theme has
none, or if two of them share a URL or the same bytes.

The two AI illustrations follow the package's hand-drawn style. Milk Cream is a toy poodle and a
blue-eyed cat among cream desserts; Maison Noir is a dog and a cat on a black velvet chaise under a
gold art deco fan. They are illustrations, not photographs of the real rooms or staff, so a visitor
cannot mistake them for the service they are buying (NZ Fair Trading Act).

Until September 2026 the minimal themes had pictures too: the product's calico cat and husky for
Simple, and a generated pencil and chalk sketch for Paper and Slate. The files and the sketch script
were removed with them; git history has them.

Each picture keeps its animals on the right and leaves the left side empty in the theme's own
ground colour, so text can go on the left.

### How a picture reaches the page

`themeStore` writes the active theme's URL onto `<html>` as `--theme-page-image`, or `none` for a
minimal theme, so the classes below paint only their colour. It has to come from JavaScript
because the pictures are Vite-hashed imports, and a stylesheet cannot name their URLs. Four
classes in `index.css` read it, all in the `components` layer:

| Class              | Used for                                           | What it paints                                      |
| ------------------ | -------------------------------------------------- | --------------------------------------------------- |
| `.bg-theme-page`   | Pet parent portal (every page), admin portal       | The picture on a fixed, window-sized layer, `cover` |
| `.bg-theme-image`  | The theme preview, the landing page's phone copy   | The picture filling its box, `cover`                |
| `.theme-hero-band` | The top of `/book` and of the landing page at `/`  | Hero colour, picture on the right                   |
| `.theme-page-art`  | Sign-in, sign-up and password pages (`AuthLayout`) | Page colour, picture in the bottom right            |

`.bg-theme-page` replaced `.bg-theme-image` on the portal pages in September 2026. As a background
of the page, the picture was scaled to the page's height, so a long page such as `/parent/booking`
blew it up several times over. The fixed layer (`::before`, `position: fixed`, `z-index: -1` in an
isolated page) keeps it one screen in size and still while the page scrolls. It is a fixed
element, not `background-attachment: fixed`, which would repaint the picture on every scroll
frame. `pageImages.test.ts` checks both.

A Tailwind utility on the same element wins over these classes. A colour utility such as
`bg-surface-cream` only sets `background-color`, so it leaves the picture alone. A background-image
utility (`bg-none`, `bg-linear-*`, `bg-[url(...)]`) would replace the picture, so never put one on
an element that wears these classes. None of them uses `background-attachment: fixed`, which
repaints the whole picture on every scroll frame.

### The hero band

`.theme-hero-band` is where the picture is meant to be seen: large, at the top of the page, with no
body text on it.

- It paints `--color-hero` and sets `color: var(--color-hero-ink)`.
- The picture is the band's `::before`, the full height of the band. It fills the space between
  the solid line (45% of the band) and the page column's right edge (`--theme-hero-inset`), with
  `cover` and `right center`. On a wide screen that moves it in from the window edge, under the
  header's last link.
- A mask fades the picture in over its left third and out over its last eighth, so it melts into
  the hero gradient. Until September 2026 the picture was a background layer of the band; a mask
  cannot reach one layer, and the picture's square edge showed as a line down the band.
- **Keep the band's copy inside the left 45%** and it sits on plain hero colour. The 45 lives in
  one place, the `--theme-hero-solid` property on the band, as a plain number. Band copy inherits
  it and can turn it into a width: `.concierge-hero-copy` in `concierge.css` stops the `/book` copy
  at `calc(var(--theme-hero-solid) * 1vw)`, less the page column's margin and gutter.
- Below 768px the copy takes the full width, so the picture covers the whole band under a hero
  colour veil. It is 93%, the lowest whole step at which secondary text clears 4.5:1 over a pure
  black or white pixel in every theme. At 88% Garden's secondary text fell to 4.13:1.
- The band gets no `z-index` and no `isolation`: that stacking context would trap a popover opened
  in the band under the content that follows it. The band's children are `position: relative`
  instead, which paints them over the picture by source order.

| Token (utility)                      | Simple                   | Under a theme      |
| ------------------------------------ | ------------------------ | ------------------ |
| `--color-hero` (`bg-hero`)           | `--color-surface-cream`  | `--brand-hero`     |
| `--color-hero-ink` (`text-hero-ink`) | `--color-notice-primary` | `--brand-hero-ink` |

Text straight on the band uses `text-hero-ink`, or `text-hero-ink/80` for secondary text. Headings
need the utility, because the base layer gives them `text-notice-primary`, and on Royal's emerald or
Moonlight's navy that is unreadable. Cards, panels, popovers and buttons inside the band keep their
own surfaces and normal tokens. `contrast.test.ts` measures the pair, the 80% secondary text, and
both on the phone veil, in every theme.

On `/book` the band holds the header, the title, the lead, the price line and the handoff notice.
The step rail, the chat and the packages sit below it on the page colour. The links and buttons on
the band use `HERO_BAND_TEXT_BUTTON` from `conciergeStyles.ts`: hero ink, always underlined, with a
hero ink focus ring. The rate card that opens on the band is an opaque card with the normal tokens.
`ThemeLaceEdge` hangs under the band with its scallops filled in the band colour; it is hidden
under the dark, light and yellow reading colours and in forced colours. The portal booking page
(`/parent/booking`) has no band: the portal draws its own background.

### The page art class

`.theme-page-art` is for a page that is one card on a ground, such as sign-in. It paints the page
colour, the picture anchored bottom right, and a veil in the page colour that thickens towards the
top left. The card on it must be opaque: it is the only place for text. The picture is at most one
viewport tall, so a long page keeps it at its real size in the corner.

`AuthLayout` wears it, so the sign-in, sign-up, forgot password, reset password and first login
pages all show the theme's picture behind one opaque card. The card is centred below 1024px and moves left from
1024px, which keeps the animals in view.

### Text over a picture

A translucent panel takes its contrast from whatever is under it, and over a picture that can be
anything. The measured floor for keeping 4.5:1 over any backdrop is **94% opacity**:

| Panel opacity | Worst-case contrast |                   |
| ------------- | ------------------- | ----------------- |
| 100%          | 5.27:1              | passes            |
| 96%           | 4.83:1              | passes            |
| 94%           | 4.62:1              | passes, the floor |
| 92%           | 4.41:1              | fails             |

The pet parent content panel (`.parent-content-panel`) was 94% opaque for that reason, with text
straight on it.

Since September 2026 it is frosted glass instead, **62%** with a blur, because the product owner
asked for the picture to show through. At 62% no text can promise 4.5:1 on the panel, so no text
sits on it:

- Cards carry their own text on their own opaque surface.
- What a page used to write straight onto the panel sits on a `.parent-plate`, an opaque card
  surface (`--color-surface-card`): the My Stays column, the `/parent/booking` intro, the classic
  booking header, the Live Care column and the profile's loading line. The profile's error box
  mixes its red tint into the card colour instead of laying it over the glass.
- Under `prefers-reduced-transparency: reduce` the panel is opaque again.
- `contrast.test.ts` checks that the panel stays glass with that fallback and that every panel
  text colour clears 4.5:1 on the plate in every theme. The pages that got a plate check it in
  their own tests. A browser audit (every inner page, looking for text whose nearest opaque
  ancestor is the panel) found none left.

That is also the design package's own intent: its note says the artwork is a hero with the animals
gathered right, and that forms and tables should keep a clean ground.

### Reading colours show no picture

Under every reading colour (dark, light, yellow and greyscale) `accessibility.css` sets
`--theme-page-image: none !important` on `<html>`. An `!important` rule in a stylesheet beats the
inline value the theme store writes, so all three classes go flat whatever theme is set. It also
reaches the places the flattening rule does not: greyscale, and the theme preview in the toolbar
panel, which is outside `#root`. `pageImages.test.ts` checks the rule matches all four modes and
does not match when no reading colour is on.

Forced colours (a Windows contrast theme) get the same rule inside
`@media (forced-colors: active)`. The system takes over text and surface colours but keeps a
background that holds a url() image, so without the rule the picture and the band's gradient would
stay under text in the system's colour. `pageImages.test.ts` checks that rule is present too.

## Hero preview

`ThemedHero` is the preview at the top of the theme picker, and it shows the active theme's
picture for every theme, the minimal ones included. It sits on `bg-hero` with `text-hero-ink`, the
same pair as the hero band.

The picture is a CSS background from `.bg-theme-image`, anchored right, not an `<img>`. That is what
lets the reading colours remove it: their flattening rule skips `<img>` on purpose. A gradient in
the hero colour sits under the copy: left to right on wider screens, and top to bottom on phones,
where the picture gets room below the copy. The picture layers are `aria-hidden`, because the
picture repeats what the heading already says.

WebP only. The package also ships each illustration as a 2.5 to 3MB PNG; the WebP is 286 to 458KB
for the same image, and every browser the product supports reads WebP. The nine pictures are
separate static imports, so Vite emits nine URLs and a visitor downloads only the one their theme
uses.

## Icons: 24, not 96

The package ships 96 icon SVGs and describes them as 24 shapes in four palettes. Opening them shows
the geometry is byte-identical across themes and every file already strokes with `currentColor`;
the only difference is a `style="color:#..."` attribute overriding it.

So `ThemeIcon` carries the 24 shapes with that attribute dropped. The icon inherits `color` from the
surrounding text, which means one set of shapes follows the brand theme _and_ the accessibility
high-contrast modes, where four baked-colour sets would have fought them. A test asserts no hex
literal survives in the rendered output.

`ThemeIcon` is decorative by default and only announces itself when given a `label`, matching the
package's rule that state must never be carried by an icon alone.

Each theme also has a motif, and the picker marks the selected theme with it. The four package
themes take theirs from `design-tokens.json` (bow, moon, flower, crown). Milk Cream uses the heart
and Maison Noir the star, both from the same 24 shapes, so the icon set did not grow.

## Gradients

The flat themes read flat, so every theme except Paper and Slate now runs its main surfaces as a
gradient. The product owner chose to keep Paper and Slate flat.

Each palette in `palettes.ts` carries two stops per surface (`BrandGradientStops`). Simple has no
palette, so its stops are on `:root` in `shared/theme/theme-gradients.css`. `brand-themes.css` maps
the palette stops to `--theme-<surface>-from` and `--theme-<surface>-to`.

| Surface | Class                                     | Where                                                                          |
| ------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| hero    | `.theme-gradient-hero`, and the hero band | Landing header, landing final call to action, the hero band on `/` and `/book` |
| shell   | `.theme-gradient-shell`                   | The sticky top bars of the pet parent portal and `/admin`                      |
| action  | `.theme-gradient-action`                  | Every primary button: landing, `/book`, sign-in, pet parent and staff pages    |
| card    | `.theme-key-card`                         | Package tiers, the assistant card, `/book` package cards, portal home cards    |
| feature | `.theme-feature-card`                     | The Signature package, on the landing page and `/book`                         |

- Only `background-image` is set. The flat colour stays underneath, as the fallback and as what the
  reading colours and forced colours see.
- Paper and Slate have no stops, and the mapping has no fallback. So their gradients are invalid,
  compute to `none`, and the flat colours and hover colours work as before.
- The hero band is the exception. Its stops fall back to the flat hero colour, because an invalid
  gradient there would take the picture with it.
- Primary buttons flip the gradient on hover instead of mixing in a new colour, so their text only
  ever sits on the two measured stops. They keep `bg-action-dark` underneath.
- Forced colours remove the gradients. The reading colours already clear background images.
- `gradientContrast.test.ts` measures the text on both stops of every surface in every theme, and
  hero text on the phone veil over a black and a white pixel. It found two stops too weak on the
  phone veil, so Strawberry Cream's hero end was made lighter and Garden's hero ink is a little
  darker (`#263f32`). In September 2026 the product owner asked for Strawberry Cream's hero end to
  be cream like its start, not pink, because the hero picture fades out into it: it is `#fdf0ea`.
  Its shell end, the signed-in bar, stays `#fbe4e2`.

## Theme faces

| Theme              | What changes            | Stack                                   |
| ------------------ | ----------------------- | --------------------------------------- |
| Strawberry Cream   | Body text               | `--font-nunito` (Nunito)                |
| Mint Secret Garden | Headings                | `--font-fraunces`                       |
| Maison Noir        | Headings, at weight 600 | `--font-cormorant` (Cormorant Garamond) |

`shared/theme/theme-fonts.css` points `--font-body` or `--font-agbalumo` at the chosen stack.
Headings across the product use `font-agbalumo` or `.type-title`, so they follow. The Wagstay
wordmark uses `font-logo`, which no theme overrides, so the logo is Agbalumo in every theme. Seven
places carry it: the landing header and footer, the `/book` header, the portal bars on desktop and
phone, the admin bar and the sign-in pages.

Nunito and Cormorant Garamond are in the one Google Fonts import in `index.css`. Google serves a
font file only when a glyph is drawn in it, so a visitor on another theme downloads a few lines of
CSS and no font file. Every stack ends with Noto Serif SC, so Chinese text never falls back to
Microsoft YaHei. `fontStacks.test.ts` checks the stacks, that the logo stays Agbalumo, and that the
theme file only points at declared stacks.

Strawberry Cream is the customer default, so most visitors now see Nunito body text rather than
Times New Roman.

## Decorations

The product owner chose them per theme from a mockup. They appear only on the customer-facing
shell and key cards: the landing page, `/book` and the pet parent home cards. Admin pages, forms
and tables carry no marker class, so no decoration reaches them.

| Theme                | Decorations                                                                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strawberry Cream     | Paw and heart confetti on the page, a stitched edge in key cards, washi tape on package cards, a bow on the Signature card, polaroid photos, a honey wave under "happy", paw dividers, a wiggle on the promise icons |
| Mint Secret Garden   | Leaf sprigs on key cards, wave dividers with a leaf, pebble-shaped photos, a daisy before section titles, a slow breathing glow over the hero picture                                                                |
| Maison Noir          | An art deco fan on the page, gold corners and a fine inner line on key cards, arched gold photo frames, a gold rule with a diamond, "happy" in gold italics, spaced capitals on buttons                              |
| Le Petit Palais      | Pearl dividers, gold corners on key cards, a crown on the Signature card                                                                                                                                             |
| Moonlight Sleepover  | Stars on the page, crescent dividers, a lavender glow round the Signature card, twinkling stars over the hero picture                                                                                                |
| Milk Cream           | A gilded Louis XV rococo frame on key cards                                                                                                                                                                          |
| Simple, Paper, Slate | None                                                                                                                                                                                                                 |

How it is built:

- Components wear marker classes: `.theme-pattern` on the landing and `/book` `<main>`,
  `.theme-key-card`, `.theme-package-card`, `.theme-feature-card`, `.theme-photo-frame`,
  `.theme-accent-word`, `.theme-section-title`, `.theme-wiggle-host` and `.theme-wiggle-icon`, and
  `.theme-gradient-action` on buttons. The full list is at the top of `decor/decor-base.css`.
- Three components give an element to the decorations that need one: `ThemeDivider` between
  landing sections, `ThemeSignatureBadge` on Signature cards and `ThemeHeroOrnament` in the landing
  hero.
- Everything else is CSS in `shared/theme/decor/`: `decor-base.css` for the shared rules, and one
  file per decorated theme. Pictures are small inline SVGs.
- Milk Cream's frame is a nine-slice `border-image` from a 132 px SVG with 44 px corners, so the
  corners never stretch. The SVG must declare its width and height, or the slices land in the
  wrong place.
- The hero glow and stars sit over the picture half of the band, never under the copy. Putting them
  under the copy would need a stacking context on the band, which would trap the rate card popover.
- The decorated title word is `hero.titleAccent` in the landing copy (`happy`, and `开心` in
  Chinese). `AccentedTitle` wraps it, and a screen reader still hears the whole title.

### Press and impact

Since September 2026 the six decorated themes share one tactile motion, in `decor-press.css`. The
product owner asked for a press and a hit that can be felt; Simple, Paper and Slate keep their
plain buttons and cards.

- **Primary buttons** (`.theme-gradient-action`) rest on a solid 4 px edge, a darker shade of the
  button's own gradient end. Hover lifts the face 1 px and sends the Maison Noir sheen across it.
  A press drops the face 3 px onto the edge in 30 ms, squashes it to 97% and flashes a white wash
  under the label. The release takes 420 ms on `cubic-bezier(0.3, 0.7, 0.4, 1.5)`, which springs
  past the rest height before it settles. The timings follow Josh Comeau's 3D button, where the
  press lands in about 30 ms and the release takes several hundred.
- **Package cards** on `/book` sink 2 px and to 98.5% while pressed. Choosing one lands the card
  with a small bounce (to 101.5%), pops its check from 60% to 120% and back, and sends one ring
  out from its edge (`.theme-select-ring`, drawn by `PackageCard`). The lasting border and filled
  check still show the choice; the motion only adds to it.
- Every primary action on the site carries `.theme-gradient-action`: the sign-in, sign-up and
  password pages, the pet parent pages, `/book` and the staff pages. A new primary button must
  add it too, or it stays still. Selected tabs, chips, badges and chat bubbles share the
  `bg-action-dark` fill but are not buttons to press, so they do not carry it.
- Disabled buttons, including `aria-disabled` ones, never lift or press.
- Only `translate`, `scale` and `opacity` animate, plus the button's own edge shadow.
  `decorPress.test.ts` checks that every rule is scoped to the six decorated themes, that the
  press lands within 100 ms and the release overshoots, and that disabled buttons are left alone.

Guards, all in `decor-base.css`:

- The reading colours hide every decoration, including the pseudo-elements that their flattening
  rule does not reach. Forced colours hide them too.
- Reduced motion stops every animation. Animations only move `rotate`, `scale`, `translate` and
  `opacity`, and no decoration uses a filter. For the press motion it removes the sheen, the lift,
  the press, the card landing, the check pop and the ring, and keeps only the flash, which fades
  (WCAG 2.3.3 counts size changes as motion).
- The reading colours also remove the button edge, the flash and the ring.
- `decorGuards.test.ts` checks these rules and the nine-slice frame. `decorations.test.tsx` checks
  the three components.

## Not integrated

Still unused from the design package: its 4 background patterns, its 4 dividers, the puppy and
kitten avatars (`ThemePetAvatar` is exported but not rendered) and the royal corner ornament. The
[decorations](#decorations) are drawn for this product instead, in the package's style.
`ThemeIcon` renders on the landing page as well as in the picker.

The package's app tiles were the browser tab icon until September 2026, one per theme. They are
gone: the product owner decided the brand must not change with the look. See
[The Wagstay mark](#the-wagstay-mark).

## The Wagstay mark

One mark in every theme: the apricot tile with a cream paw, `public/favicon.svg`.

- It is the tab icon, and `BrandMark` (`src/shared/brand/BrandMark.tsx`) shows the same file beside
  every "Wagstay" wordmark: the landing header and footer, `/book`, the sign-in pages and both
  signed-in bars. It keeps its own colours in every theme and reading colour.
- It is decorative (`alt=""`): the wordmark beside it already names the link or heading.
- `public/favicon.ico` (32 px) and `public/apple-touch-icon.png` (180 px, square corners) are made
  from the SVG by `node scripts/generate-brand-icons.mjs`. Google Search does not show SVG
  favicons, and iOS uses the PNG for a home screen shortcut. Run the script again whenever the SVG
  changes; `brandIcons.test.ts` checks the files and the links in `index.html`.
- The icon addresses carry a version (`?v=2`, `BRAND_ICON_VERSION` in `BrandMark.tsx`).
  `/favicon.svg` once held Vite's logo, and a browser keeps a tab icon by its address, so without
  the version a returning visitor still saw the purple bolt. Raise the version in `BrandMark.tsx`
  and `index.html` whenever the icon files change.

## Navigation

One style for every bar since September 2026: the landing header, the pet parent bar and phone
tab bar, and the admin bar with its phone menu. The product owner asked for it, with the current
tab as a solid block. The styles are in `src/shared/navigation/navigation.css`.

- The links sit in one rounded track (`.nav-pills`), each a pill at least 44 px tall
  (`.nav-pill`). The current one is solid.
- The solid pill is the bar's own text colour, lettered in the bar's colour: dark on a light bar,
  light on a dark one (Moonlight, Maison Noir, Slate, the emerald Le Petit Palais header). The
  landing header uses the hero pair (`.nav-pills--hero`), the signed-in bars the shell pair
  (`.nav-pills--shell`), and the phone menu and tab bar the card surface. Because it is the bar's
  text pair reversed, the contrast the palette tests measure for that pair is the pill's contrast.
- The current item is whatever has `aria-current`: `NavLink` sets `page` in the signed-in bars and
  keeps it on nested pages (a pet under `/admin/pets`), and the landing scroll-spy sets `true`,
  the value for a place within a page.
- Only colour changes, in 150 ms. Nothing slides: people switch sections often, and NN/g advises
  against motion in a sticky header.
- The signed-in bars force their text colour onto every link (`header.sticky` in
  `brand-themes.css`). The pills are left out of that rule, or the current one would be lettered
  in the bar's ink on the bar's ink. The old underline and Fraunces rules for the active link are
  gone.
- The admin bar's seven manager links use the compact size below 1280 px and fit from about
  900 px. At 768 px the last one sits in the track's own scroll; the account controls keep their
  size. The phone menu is a disclosure (`aria-expanded`, `aria-controls`).
- `navigationStyles.test.ts` checks the colour pairs, the colour-only change and the exclusion
  from the forced text colour.

## Bundle cost

|          | Before     | After                 | Delta                   |
| -------- | ---------- | --------------------- | ----------------------- |
| CSS      | 115.78 kB  | 121.71 kB             | +5.93 kB                |
| JS       | 1056.77 kB | 1065.16 kB            | +8.39 kB                |
| Pictures | none       | 7 files, 49 to 458 kB | one fetched per visitor |

The table above is from when the package themes were added. The September 2026 work, measured with
`npm run build`:

|          | After the two new palettes | After gradients, faces and decorations | Delta                   |
| -------- | -------------------------- | -------------------------------------- | ----------------------- |
| CSS      | 175.04 kB (27.78 kB gzip)  | 195.19 kB (31.78 kB gzip)              | +20.15 kB (+4 kB gzip)  |
| Pictures | 7 files                    | 9 files, the new ones 123 and 135 kB   | one fetched per visitor |

## Verified

- `npx vitest run src/shared/theme`: 54 tests pass in 9 files (28 September 2026).
- Coverage checked against the built stylesheet: 117 of 117 arbitrary-colour classes have an
  override, 0 unthemed.
- `npx tsc --noEmit`, `oxlint`, `prettier --check src` clean.
- `npx vite build`: all four theme blocks present in the emitted CSS, with the `@supports`
  fallback for `color-mix`; the four hero images emit as separate fingerprinted assets.
- The only package accent hex values left in the bundle are the picker's four swatches, which are
  deliberately literal so they preview a palette the page is not currently wearing.
- Contrast ratios above computed from the emitted values.
- Full `npx vitest run`: 924 tests pass in 151 files (28 September 2026, after the filled control
  work).
- Theme pictures (28 September 2026): `npx vitest run src/shared/theme src/shared/accessibility`
  passes 98 tests in 17 files, and `npx tsc -p tsconfig.app.json --noEmit` is clean. The compiled
  stylesheet keeps all four picture classes in the `components` layer. In a browser at 1280 and 390
  wide, the booking page band showed the picture for Default, Paper, Slate, Royal and Garden, and
  the sign-in page for Default and Moonlight; greyscale set `--theme-page-image` to `none`.
  `generate-theme-sketch-backgrounds.py` reproduced both committed sketches byte for byte.
- New themes, gradients, faces and decorations (29 September 2026):
  - Full `npx vitest run --maxWorkers=4`: 996 tests pass in 162 files. With the default worker
    count on a busy machine, a few unrelated timing tests (date pickers, the concierge form) timed
    out; each passes on its own and with four workers.
  - `npx tsc -p tsconfig.app.json --noEmit`, `oxlint`, ESLint on the changed files and
    `prettier --check` are clean, and `npm run build` succeeds.
  - In the browser at 1280 wide: a new visitor on `/` gets Strawberry Cream with nothing saved;
    each decorated theme shows its decorations on the landing page; Paper and Slate show no
    gradients; the heading and body faces and the Agbalumo wordmark are as listed in
    [Theme faces](#theme-faces); the dark reading colour removes every decoration, pattern and
    button gradient.
  - Not checked in a browser: the `/admin` default (it needs a signed-in manager; the theme store
    tests cover it), `/book` package cards with live packages, and the pet parent home cards.
