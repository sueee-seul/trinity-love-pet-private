# Prompt: Pet Parent Homepage UI/UX Design

Use this prompt with a design tool, a front-end AI assistant, or a developer to reproduce or extend the pet-parent Homepage. It describes the design principle, the visual system (shared with the Leave Feedback page), the state model that decides what the page shows, every state on mobile and desktop, the "Before the stay" checklist, and the Vaccination information page that the checklist links to.

> **Status:** _Stay stories_ (§6, and every other reference to it below) was implemented and has since been removed. It is not being built yet. Where this doc still describes it, treat that as historical only; it no longer matches the live homepage. The homepage also now shows the soonest upcoming booking as the hero plus any others in a compact "Also coming up" list, which this doc predates and does not describe.

---

## 1. Context and design principle

You are designing the **Homepage** a pet parent sees after signing in to a pet-boarding platform (overnight boarding, cattery, daycare). The homepage is not a menu of features. **It tells the user what they should do next.** The most important thing for this user right now always sits at the top in a single hero card with one primary action; everything else is secondary.

Two layers make this work, and both are required:

- **A fixed shell that never changes.** Header, navigation, the _Your pets_ section and the _Quick actions_ grid appear in the same place in every state, so users always know where to find Stays, Booking, Feedback, chat and their Profile. The shell is the existing pet-parent portal shell, the same one the Leave Feedback page sits in.
- **State-driven content inside that shell.** The hero card, its copy, and one or two Quick-action labels all change with the user's state.

Terminology to use everywhere, exactly: _Your pets_, _Book a stay_, _Upcoming stay_, _Before the stay_, _Quick actions_, _Live Care_, _Vaccination information_, _Admission verification_.

---

## 2. State model

The page resolves to exactly one of three states, each with a B/C sub-case driven by whether the user has any past stays.

| State  | Condition                                    | Hero                                        |
| ------ | -------------------------------------------- | ------------------------------------------- |
| **A**  | No pets                                      | Create your first pet                       |
| **B1** | Has pets · no upcoming stay · no past stays  | Book a stay                                 |
| **B2** | Has pets · no upcoming stay · has past stays | Book another stay                           |
| **C1** | At least one upcoming stay · no past stays   | Upcoming stay + _Before the stay_ checklist |
| **C2** | At least one upcoming stay · has past stays  | Upcoming stay + _Before the stay_ checklist |

Rules:

- **B1 and B2 share one layout.** They differ only in greeting sub-line, hero title/body, and one Quick-action slot. The same is true of C1 and C2. The page must never jump or reflow between the two cases.
- State A has no _Your pets_ section (there is nothing to show) and a reduced Quick-actions grid.

---

## 3. Visual system (match the pet-parent portal and the Feedback page exactly)

The homepage is a screen of the existing pet-parent portal, so it uses the portal's design system, the same one the **Leave Feedback** page uses. Do not introduce a separate look. Where this document and the Feedback page ever disagree, the Feedback page wins.

**Direction.** Warm and friendly: a cream page ground, white cards, an apricot / earth-brown palette, thin soft borders, generous whitespace. No gradients, no emoji, no left-border accent cards, no colour outside the tokens below. Shadows are limited to what the Feedback page already uses: `shadow-sm` on grouped cards and primary buttons.

**Typography.** Three families, loaded from Google Fonts: **Fraunces** (headings and emphasised labels), **Inter** (body, meta, buttons), **Agbalumo** (brand wordmark and card titles). Use the portal's type classes, not ad-hoc sizes.

| Role                                                               | Class                             | Spec                                                                   |
| ------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------- |
| Greeting (h1)                                                      | `type-display`                    | Fraunces 700, `clamp(27px, 4vw, 34px)`, line-height 1.1, −0.015em, ink |
| Greeting sub-line                                                  | `type-body` in muted              | Inter 15 / 22px, muted                                                 |
| Hero title / vaccination question                                  | `type-card-title`                 | Agbalumo 700, `clamp(17px, 3vw, 21px)`, line-height 1.2, ink           |
| Hero body                                                          | `type-body` in muted              | Inter 15 / 22px, muted, max 520px wide                                 |
| Sub-headings inside cards (card question, row labels, step titles) | `type-normal`                     | Fraunces 700, ink                                                      |
| Card / pet name                                                    | `type-normal`                     | Fraunces 700                                                           |
| Section eyebrow                                                    | `type-eyebrow` + `tracking-wider` | Inter 9.5px, 700, uppercase, 0.14em tracking, muted                    |
| Meta text                                                          | `type-meta`                       | Inter 12.5 / 19px, muted                                               |
| Buttons                                                            | `type-button`                     | Inter 13.5px, 700                                                      |

**Colours (tokens).**

| Token                           | Value                 | Use                                                                                                                   |
| ------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `surface-cream`                 | `#FFF7EE`             | page ground, hero-card / inner-panel fill (at 50% opacity), avatar and photo-placeholder backgrounds, disabled fields |
| `surface-card`                  | `#FFFFFF`             | page card, content cards, secondary buttons                                                                           |
| `surface-deep`                  | `#FBEBD8`             | header background, warning-card fill                                                                                  |
| `surface-bubbles`               | `#F9E2CB`             | icon tiles, avatar-initial backgrounds                                                                                |
| `notice-primary`                | `#3A2A20`             | headings, primary text, inactive nav                                                                                  |
| `notice-secondary`              | `#5A4A3F`             | secondary text, body text inside warning cards                                                                        |
| `notice-muted`                  | `#7D6959`             | sub-lines, meta, eyebrows, completed checklist labels                                                                 |
| `border-soft`                   | `#EFE0CC`             | every 1px card border and divider                                                                                     |
| `control-border`                | `#BC7D10`             | borders of interactive controls: unselected options, secondary buttons, dashed upload zone                            |
| `action-dark`                   | `#54402F`             | primary buttons, selected option fill                                                                                 |
| `theme-earth`                   | `#8D5E0C`             | active nav, links, icons, section actions, focus ring (`accent-foreground`)                                           |
| `accent-foreground-hover`       | `#5E3E08`             | link and nav hover                                                                                                    |
| `theme-sun`                     | `#EB9C14`             | logo disc, user avatar, "Required" and outstanding-item accents                                                       |
| `theme-apricot` / `theme-peach` | `#F3C472` / `#F7D7A1` | header divider, warning-card border                                                                                   |
| `status-success`                | `#47703E`             | completed checklist items, "Booking confirmed" pill, success messages                                                 |
| `status-danger`                 | `#B3372A`             | validation errors                                                                                                     |

Tints are these colours at low opacity: a success tint is `status-success` at 10 to 12%, a "Required" / outstanding tint is `theme-sun` at 20%.

**Shape and spacing (copy the Feedback page).**

- **Page card:** white (`surface-card`), 1px `border-soft`, **15px radius**, padding 24px (mobile) / 32px (`md`), centred with `max-w-3xl`. Sections inside it are separated by 40px (`space-y-10`).
- **Grouped list card** (pets list, checklist, stay-story cards): white, 1px `border-soft`, 15px radius, `shadow-sm`, rows 16px padding (24px side on `sm+`) separated by 1px `border-soft` dividers. This is the pattern of the Feedback rating card.
- **Inner panel** (the hero card, the vaccination question and certificate panels): `surface-cream` at 50% opacity, 1px `border-soft`, 16px radius (`rounded-2xl`), padding 24 / 32px. This is the pattern of the Feedback question panel.
- **Selectable options:** 12px radius (`rounded-xl`), 1px border, padding 12px 16px, centred `type-button` label. Unselected: white fill, `control-border`, `notice-secondary` text, hover border `action-dark`. Selected: `action-dark` fill and border, white text. No radio dots: the real input is visually hidden and the whole tile is the control.
- **Buttons:** fully rounded (pill). Primary: `action-dark` fill, white text, `shadow-sm`, hover `theme-earth`, minimum width 160px, 12px vertical padding, **full width on mobile and auto width from `sm`**. Secondary: white fill, 1px `control-border`, `notice-primary` text. Disabled: 50% opacity, `not-allowed` cursor.
- **Form fields:** 12px radius, 1px `control-border`, white fill, 16px padding, `focus:border-focus` with a 2px `focus/20` ring.
- **Messages:** validation errors and warnings are `type-meta`, bold, `status-danger`, with `role="alert"`; success messages are `type-meta`, semibold, `status-success` with a 20px check icon.
- **Pills:** fully rounded, 12px / 700, tinted fill (e.g. `status-success` text on its tint).
- **Icon tiles:** rounded squares on `surface-bubbles` in `theme-earth`: 44px / 12px radius on mobile, 52px / 14px radius on desktop.
- **Avatars:** circles with the pet's initial in `theme-earth` on `surface-bubbles` (48px pet cards, 44px pet rows, 34 to 36px stories). The user avatar is a 36px circle of initials on `theme-sun` with white bold text, as the navbar renders it.
- **Icons:** stroke-based outline icons only (Heroicons outline style), 2px stroke, rounded caps and joins, 16 to 24px. Set: home, paw, calendar, heart, bell, user, plus, chevron, check, alert triangle, list, photo, upload, back arrow, info, chat.
- **Every tap target is at least 44px.**
- **Page gutters** come from the portal (16px mobile, 24px `sm`, 32px `lg`); vertical gap between homepage sections is 28px (mobile) and 32px (desktop).

---

## 4. The fixed shell

The shell is the existing pet-parent portal shell, unchanged. Draw it exactly as the Feedback page shows it. Do not invent a different header, tab bar or navigation set.

### 4.1 Page frame (same as Leave Feedback)

- The portal provides the ground: `surface-cream` with the active theme's own page picture, painted one screen in size by `.bg-theme-page` (see [Theme pictures](brand-themes.md#theme-pictures)). Every other pet-parent page sits in a rounded panel around the page content (`parent-content-panel`, white at 94%, backdrop blur, 24px radius, `shadow-sm`, 16 / 24 / 32px padding). The homepage is the one page without this panel: it sits directly on the picture.
- Content is capped at a 1240px column.
- **Page header, identical to the Feedback page:** the greeting (`type-display`) with the sub-line beneath it (`type-body`, muted, 8px gap), centred on mobile and left-aligned from `sm`. The homepage's hero and sections follow inside the same page card language described in §3.

### 4.2 Mobile (390px wide)

**Top header.** 64px tall, `surface-deep` with a 1px `border-soft` bottom border and `shadow-sm`, with the brand wordmark **"WagStay LiveCare"** (Agbalumo, 20px, `notice-primary`) centred. There is no bell or avatar in the mobile header.

**Bottom tab bar.** Fixed, 48px tall, white with a 1px `border-soft` top border, four equal tabs, each a 20px icon above a 12.5px bold label: **Chat · Daily · feedback · Profile** (labels exactly as implemented). The homepage is the **Daily** tab. The active tab is `theme-earth`; inactive tabs are `notice-primary`. Leave 96px of bottom padding on the page so content clears the bar.

Do not draw a fake iOS status bar or keyboard.

### 4.3 Desktop (1240px content column)

**Header.** 80px tall, `surface-deep`, 1px `border-soft` bottom border, `shadow-sm`, sticky. Left: a 40px `theme-sun` circle holding a white paw glyph, then the wordmark **"WagStay"** (Agbalumo, 24px, `notice-primary`, hover `accent-foreground-hover`). Centre: text nav, 32px apart, `type-button`: **Homepage · Stays · Booking · Internal Feedback**. The active link is `theme-earth`; inactive links are `notice-primary` with hover to `accent-foreground-hover`; there is no underline. Right: the AI-chat icon button, the notification bell, a 1px divider in `theme-apricot`, then a 36px circular user avatar that opens a menu (**Profile · Account Settings · Log out**). Profile has no top-level tab; it is reached only from this menu.

**Layout.** A 3-column grid with 32px gaps. The main column spans two columns and holds the greeting and hero. The right column holds _Your pets_ and _Quick actions_, and has top padding so it lines up with the top of the hero card rather than the greeting. Below the `md` breakpoint everything collapses to a single column in the order given in §5.

### 4.4 Your pets (states B and C)

- **Mobile:** section eyebrow "YOUR PETS" (`type-eyebrow`, muted) with a `theme-earth` "See all" action on the right. Beneath it, a horizontal row of pet cards (132px wide, 14px padding, 15px radius, white, 1px `border-soft`): 48px initial avatar, name (`type-normal`), meta "Labrador · 4 yrs" (`type-meta`). The row ends with a 96px dashed-border ("control-border") "Add pet" card containing a `theme-earth` plus icon.
- **Desktop:** the same eyebrow, then a single grouped list card (§3) with one 68px row per pet: 44px avatar, name and "Breed · age" meta, chevron on the right, with `border-soft` dividers between rows. Beneath it, a 44px full-width dashed row "+ Add a pet" in `theme-earth`.

Sample pets: **Max** (Labrador, 4 yrs) and **Luna** (Cat, 2 yrs).

### 4.5 Quick actions

Eyebrow "QUICK ACTIONS", then a **fixed 2 × 2 grid** (10px gaps) of 56px cells (white, 1px `border-soft`, 12px radius, hover border `action-dark`), each with a 20px `theme-earth` icon and a `type-button` label in `notice-primary`. The grid never changes shape; only the labels change by state. Never show an action that has nothing behind it: no Live Care unless a stay is active. State A shows only two cells.

| State | Slot 1                 | Slot 2                  | Slot 3            | Slot 4            |
| ----- | ---------------------- | ----------------------- | ----------------- | ----------------- |
| A     | Add your pet (plus)    | Profile (user)          | None              | None              |
| B1    | Book a stay (calendar) | Manage pets (paw)       | Add pet (plus)    | Profile (user)    |
| B2    | Book a stay (calendar) | Manage pets (paw)       | Add pet (plus)    | Past stays (list) |
| C1    | Prepare (list)         | View booking (calendar) | Manage pets (paw) | Add pet (plus)    |
| C2    | Prepare (list)         | View booking (calendar) | Manage pets (paw) | Add pet (plus)    |

---

## 5. States

Sample user: **Phuong**. Sample upcoming stay: Max, 12 Sep to 16 Sep, 4 nights, Overnight boarding, 5 days away.

Every hero is an **inner panel** (§3: `surface-cream` at 50%, `border-soft`, 16px radius, 24 / 32px padding) placed directly under the greeting, exactly where the Feedback page places its question panel. Hero titles use `type-card-title`, hero body uses `type-body` in muted, and each hero has one primary pill button (§3).

### 5.1 State A: New pet parent

- Greeting **"Welcome, Phuong"**, sub-line _"Let's get your pet ready for their first stay."_
- **Hero:** paw icon tile; title **"Create your first pet"**; body _"Tell us about your pet so we can provide personalised care during their stay."_; primary button **Add your pet**.
- **How it works**, 4 steps. Each step has a 28px circle with a 1.5px `theme-earth` outline and a `theme-earth` number (`type-numeral`, 13px), a title (`type-normal`) and a description (`type-meta`):
  1. **Create a pet profile:** Breed, age, diet and anything we should know.
  2. **Book a stay:** Pick your dates and the services you want.
  3. **Prepare for the visit:** Sign the agreement and confirm vaccinations.
  4. **Follow their care:** Photos and updates while they're with us.
  - Mobile: a vertical stepper with a 2px `border-soft` connector line between circles.
  - Desktop: four equal grouped-style cards (white, 1px `border-soft`, 15px radius) in a row inside the main column.
- **Quick actions:** Add your pet, Profile. No _Your pets_ section.
- Desktop sidebar holds only Quick actions.

### 5.2 State B1: Has pets, no upcoming stay, no past stays

- Greeting **"Welcome back, Phuong"**, sub-line _"Ready to plan your pet's first stay?"_
- **Hero:** calendar icon tile; title **"Book a stay"**; body _"Choose your dates and services for Max or Luna."_; primary button **Start a booking**.
- Your pets → Quick actions (B1 row).
- On desktop the hero is horizontal: icon tile on the left, text and buttons to its right.

### 5.3 State B2: Has pets, no upcoming stay, has past stays

Identical layout to B1, with these differences only:

- Sub-line _"Ready for Max and Luna's next stay?"_
- Hero title **"Book another stay"**; body _"Same pets, same easy setup. Choose your dates and services."_; primary **Start a booking**. Desktop adds a secondary button **View past bookings**.
- Quick actions use the B2 row.

### 5.4 State C1: Upcoming stay, no past stays

- Greeting **"Welcome back, Phuong"** (no sub-line, because the hero carries the message).
- **Hero (Upcoming stay):**
  - Top row: a status pill on the left and **"5 days to go"** (`type-button`, `theme-earth`) on the right. The pill follows the manager's decision: **"Waiting for review"** until every pet on the booking is approved, then **"Approved"** (`status-success`). It never says "Booking confirmed" before approval.
  - Title **"Max's stay is coming up"**; meta _"12 Sep to 16 Sep · 4 nights · Overnight boarding"_.
  - The **Before the stay** checklist (§7).
  - Buttons **Prepare for stay** (primary) and **View booking** (secondary). They stack full width on mobile and sit inline on desktop. _Prepare for stay_ takes the user to the first outstanding checklist item. Once the stay is approved, **View booking** reads **View boarding pass**; both open the booking details dialog, which leads with the boarding pass for an approved stay (see docs/ai-booking-concierge.md).
- Your pets → Quick actions (C1 row).

### 5.5 State C2: Upcoming stay, has past stays

Identical to C1, using the C2 Quick actions row. The checklist and hero are unchanged.

If a booking covers several pets, name them all in the hero ("Max and Luna's stay is coming up"). If the user has more than one upcoming stay, the soonest one owns the hero; any others show as compact rows in an "Also coming up" list below it (not described in this doc; see the current homepage code).

---

## 6. Stay stories: removed, not currently planned

This section described a short, warm, AI-written summary of each completed
stay with photos. It was implemented and has since been removed; it is not
being built yet. If this is revisited, see git history around commit
`6bdc86a` for the original design.

- **Mobile:** a horizontal scroll row of 274px cards (16px padding). The second card peeks in from the right edge to signal that the row scrolls. Photos are 72 × 54px.
- **Desktop:** a 2-column grid of cards (18px padding) with 88 × 66px photos.

Sample content:

- **Max** (_Overnight boarding · 3 nights · Aug 2026_): "Settled in within the hour and ate every meal. Two long walks a day, a favourite spot by the window, and a new friend called Bella from the next room."
- **Luna** (_Cattery · 5 nights · Jun 2026_): "Took a day to warm up, then claimed the top shelf. Ate well throughout, medication given on schedule, and plenty of afternoon play sessions."

---

## 7. Before the stay checklist

Shown inside the Upcoming-stay hero (states C1 and C2). **Always all four items, always in this order**, so the list never reorders or changes length as items are completed.

1. **Agreement signed**
2. **Booking payment completed**
3. **Vaccination information**
4. **Admission verification**

**Row states (there are exactly two):**

| State       | Badge                                                       | Label                           | Trailing | Tappable                   |
| ----------- | ----------------------------------------------------------- | ------------------------------- | -------- | -------------------------- |
| Done        | 24px circle, `status-success` tint, `status-success` check  | `notice-muted`, `type-normal`   | none     | No                         |
| Outstanding | 24px circle, `theme-sun` tint, `theme-earth` alert triangle | `notice-primary`, `type-normal` | chevron  | Yes, opens the item's page |

**Container.**

- **Mobile:** a grouped list card (§3: white, 1px `border-soft`, 15px radius, `shadow-sm`) inside the hero, with the eyebrow "BEFORE THE STAY" above it and rows at least 44px tall separated by `border-soft` dividers.
- **Desktop:** the eyebrow, then a 2 × 2 grid (8px gaps) of individually bordered rows (white, 1px `border-soft`), each 44px tall with a 12px radius.

**Vaccination information rule:** the item is **Done** when the booking records the pet as fully vaccinated, and **Outstanding** when it does not. It becomes Done only after the parent answers Yes and uploads a certificate on the Vaccination information page (§8).

The sample mockup shows items 1 and 2 Done and items 3 and 4 Outstanding.

### 7.1 Get ready card (from 48 hours before drop-off)

From exactly 48 hours before an approved pet's drop-off until drop-off, Home shows a **Get ready** card for that pet under the hero, one card per pet, soonest first. The server works the window out when Home is read, so nothing is scheduled and the bell gets no notice for it (Backend/README.md, "Get ready before drop-off").

- Inner panel (§3). Top row: a status pill with the count (**"3 of 4 done"**, `theme-sun` tint while a task is open, `status-success` once all are done) and **"Drop-off 12 Oct 2026, 9:00 am"** on the right. Title **"Get ready for Max's stay"** (`type-card-title`, never bold).
- The task list is a grouped list card in the GOV.UK task list pattern: the tasks can be done in any order, each row is a link to the page that holds the detail, with a one-line hint and its status in words, **Completed** or **Not started**. The tasks are Vaccination proof (links to §8 for this stay), Feeding, Medication, and Emergency contact and vet (all three link to the pet's page). An open Medication task is not a link: parents cannot record medicines, so its hint says our team goes through the medicines, doses and times with them by drop-off. The IPP 3A line asking the parent to tell a new contact or vet that we keep their details sits next to those fields on the profile forms, where they are collected.
- Under the list, the eyebrow **"At drop-off"** and plain lines: staff check the vaccination proof and give the pet a health check; staff go through the temperament and any bite history with the parent; without proof the pet is kept apart from other pets; the parent signs the consent to emergency vet treatment there.

The same list opens from **"Get ready, 2 of 4 done"** on an approved My stays card and sits under the boarding pass in the booking details dialog, from approval until drop-off.

---

## 8. Linked page: Vaccination information

Opened from the _Vaccination information_ checklist row. It uses **the same page layout as Leave Feedback**: the portal shell (§4), one centred page card, a title block, then one inner panel holding the task. **Action first, regulation second:** the parent's task sits at the top, and the legal detail is collapsed below it.

### 8.1 Layout

- The portal header and bottom tab bar stay in place (nothing is hidden on this page). The page content is a single white page card (`max-w-3xl`, 15px radius, 1px `border-soft`, 24 / 32px padding), centred, with 40px between its sections. There is no side column at any width.
- Above the title, a small back link (`type-button`, `theme-earth`, 44px hit area) with a back arrow: **← Prepare for stay**.
- Title block as on the Feedback page: **"Vaccination information"** (`type-display`) with the meta line beneath it (`type-body`, muted): _"For Max · 12 to 16 Sep · Overnight boarding"_. Centred on mobile, left-aligned from `sm`.
- If the booking covers several pets, a **Which pet?** select appears under the title block, exactly as on the Feedback page (eyebrow label, 40px tall select, 12px radius, `border-soft`, max width 320px).

### 8.2 The question

An inner panel (§3) containing:

- **"Is Max fully vaccinated?"** (`type-normal`) followed by a `*` in the label colour, as on the Feedback selector.
- Helper text _"Select Yes if Max's vaccinations are up to date. You'll need to upload the certificate."_ (`type-meta`, muted).
- **Yes / No** as two equal selectable options in a two-column grid (§3 selectable options, the same component style as the Feedback category selector). The selected option is `action-dark` with white text; the unselected option is white with a `control-border`. Real radio inputs, visually hidden.

**The default is always No** every time the page opens.

### 8.3 Default state: No selected

- Directly under the question, inside the same inner panel, a warning block (`surface-deep` fill, 1px `theme-apricot` border, 12px radius, 16px padding). It has a 26px `theme-sun` alert disc with a `theme-earth` triangle, the heading **"Max will be housed separately"** (`type-normal`, `notice-primary`) and the body _"Pets who aren't fully vaccinated are kept apart from the other animals until their immune status is established. This is a legal requirement, not a facility preference. It means a quieter, less sociable stay for Max."_ (`type-body`, `notice-secondary`). A footnote follows (`type-meta`): _"There is no fixed number of days: the Code requires quarantine for 'an appropriate amount of time'."_
- Inside that block, a three-row table (label column 190px on `sm+`, stacked label-above-text on mobile): _Not vaccinated_ → quarantined for an appropriate period; _Vaccination status unknown_ → quarantined until immune status is established; _Suspected infectious disease_ → supervised closely and securely isolated. Rows are separated by `border-soft` dividers.
- **There is no Save button in this state.** Nothing is submitted, and the checklist item stays Outstanding.

### 8.4 After selecting Yes

- The warning block is replaced by a **Vaccination certificate** block in the same panel: the title (`type-normal`) and a **Required** pill (`theme-sun` tint, `theme-earth` text) on one row, then the helper _"Please upload your pet's vaccination certificate or vaccination record."_
- Below is a dashed upload zone (1.5px dashed `control-border`, white fill, 12px radius, 136px tall on mobile / 150px on `sm+`). It contains a 40px `surface-bubbles` disc with a `theme-earth` upload icon, **Upload certificate** (`type-button`, `theme-earth`) and _"PDF, JPG, JPEG, PNG or HEIC, up to 10 MB"_. Once a file is chosen the zone is replaced by a row showing the file name, its size, and **Replace** / **Remove** actions.
- The same lines appear beneath the zone in every state, so parents can check before uploading: **Supported formats:** PDF, JPG, JPEG, PNG, HEIC · **Maximum file size:** 10 MB.
- **Validation messages** use the shared message style (§3, `status-danger`, `role="alert"`), directly under the zone: _"Please upload your pet's vaccination certificate or vaccination record."_ when nothing is attached; _"Unsupported file type. Please upload a PDF, JPG, JPEG, PNG or HEIC file."_ for a wrong format; _"This file is larger than 10 MB. Please upload a smaller file."_ for an oversized file. A rejected file is never attached.
- An inset eyebrow "THE CERTIFICATE MUST SHOW" (`type-eyebrow`) lists three items, each with a small `theme-earth` check disc, a bold title (`type-normal`) and a muted explanation (`type-meta`): _The date the vaccine was given_; _The recommended revaccination date_; _Max's name and your vet's details_. They are stacked on mobile and in three columns from `md`.
- A **Save** primary pill button follows, right-aligned from `sm` and full width on mobile, like the Feedback submit button. It is **disabled** (50% opacity) until a valid certificate is attached, with the helper _"Upload the certificate to save."_ (`type-meta`). On success it shows the shared success message (_"Vaccination information saved."_) and the checklist item turns Done.
- There is **only one way to provide the certificate: the parent uploads it.** Do not offer "ask my vet to send it" or any other route.

### 8.5 Below the fold (both states)

Below the inner panel, still inside the page card:

- **The rules we follow:** a grouped list card (§3) used as an accordion, with 52px rows, all collapsed by default: _Vaccination requirements_; _Animals with unknown or incomplete status_; _Records we keep_; _How we prevent disease spreading_. The first two carry the rules that bind the parent; the last two describe the facility's own obligations (recordkeeping, staff training, isolation facilities) as reassurance, not as tasks.
- **Other pets on this booking** (only when the booking has more than one pet): a grouped list card, one row per other pet with its vaccination status, e.g. _Luna: Certificate received 2 Sep_ with a `status-success` check.
- **Source note:** an info-icon box on `surface-cream`: _"Code of Welfare: Temporary Housing of Companion Animals (New Zealand), issued 1 October 2018, amended 9 May 2021: Minimum Standard No. 6 (Contagious Diseases) and Minimum Standard No. 4 (Assessment on Admittance)."_

---

## 9. Deliverables and rules

- Produce **mobile frames at 390px wide** and **desktop frames at 1440px wide** for A, B1, B2, C1, C2, plus the Vaccination information page in both its default (No) and Yes states.
- Keep the header, navigation, Your pets and Quick actions identical across states; only the content described above changes.
- Use only the tokens listed in §3 and the layout patterns of the Leave Feedback page (page card, grouped list card, inner panel, selectable options, pill buttons). Do not introduce gradients, extra shadows, emoji or new accent colours.
- Write copy about specific pets and stays (names, dates, services). No lorem ipsum and no generic marketing copy. The brand is **WagStay**.
- Every warning must have a way to resolve it inside the app: an Outstanding checklist row is always tappable and leads somewhere the parent can fix it.
- Every screen must make the user's next step obvious through a single primary button in the hero.
