# AI Chat & Customer Support Inquiry Management: Unit Test Plan

Covers the frontend-only feature built against mock data: the pet-parent AI Chat widget/page and
the company-side Inquiries management screen. No tests exist for this feature yet. This is a plan
to work from, not a report of what's implemented.

## How this maps to the codebase

Stack: Vitest + `@testing-library/react` + `@testing-library/user-event` (already in
`Frontend/package.json`). Follow the existing convention: tests live in a `__tests__/` folder next
to the code they cover (see `Frontend/src/features/admin/store/__tests__/googleReviewStore.test.ts`
for the house style: `describe`/`it`, direct `useXStore.getState()` access, `vi.spyOn`/`vi.useFakeTimers`
for time-based logic).

Run with:

```bash
npm run test --prefix Frontend
```

## Planned test files

None of these exist yet. This is the file list to create, each colocated in a `__tests__/` folder
next to the module it covers, following the repo's existing pattern. Paths are relative to
`Frontend/src/features/`.

### Pet-parent AI Chat

| Test file                        | Path                                                                     | Purpose                                                                                                                                                                   |
| :------------------------------- | :----------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `utils.test.ts`                  | `pet-parent/ai-chat/__tests__/utils.test.ts`                             | Time/date formatting helpers (`formatTime`, `formatDayLabel`, `isoAt`).                                                                                                   |
| `mockData.test.ts`               | `pet-parent/ai-chat/__tests__/mockData.test.ts`                          | Seed-data invariants: exactly one Active conversation, chronological messages.                                                                                            |
| `store.test.ts`                  | `pet-parent/ai-chat/__tests__/store.test.ts`                             | `useAiChatStore` actions: messaging, the AI-reply timer, the support-escalation timer chain, panel open/minimize, inactivity detection. Highest priority in this feature. |
| `useAiChatState.test.ts`         | `pet-parent/ai-chat/__tests__/useAiChatState.test.ts`                    | Derives `current`/`past` correctly; starts/stops the inactivity poll interval.                                                                                            |
| `AiChatIconButton.test.tsx`      | `pet-parent/ai-chat/components/__tests__/AiChatIconButton.test.tsx`      | Active-dot visibility; click toggles the panel open/closed.                                                                                                               |
| `AiChatFloatingPanel.test.tsx`   | `pet-parent/ai-chat/components/__tests__/AiChatFloatingPanel.test.tsx`   | Open/closed/minimized render states; hidden on `/parent/ai-chat`; expand-to-page navigation; `MinimizedBar` content.                                                      |
| `ConversationSidebar.test.tsx`   | `pet-parent/ai-chat/components/__tests__/ConversationSidebar.test.tsx`   | New Conversation disabled-while-active state; past-list empty state; row selection.                                                                                       |
| `ConversationArea.test.tsx`      | `pet-parent/ai-chat/components/__tests__/ConversationArea.test.tsx`      | Empty state; read-only mode for closed conversations; Contact Support visibility; composer send behavior.                                                                 |
| `MessageBubble.test.tsx`         | `pet-parent/ai-chat/components/__tests__/MessageBubble.test.tsx`         | Correct styling/author label per `senderRole`.                                                                                                                            |
| `InactivityPromptModal.test.tsx` | `pet-parent/ai-chat/components/__tests__/InactivityPromptModal.test.tsx` | Open/closed rendering; each of the three actions calls its handler.                                                                                                       |
| `AiChatPage.test.tsx`            | `pet-parent/ai-chat/pages/__tests__/AiChatPage.test.tsx`                 | Default selection logic; sidebar-driven selection changes; new-conversation auto-select; close-then-fallback selection; inactivity-modal wiring.                          |

`SupportStatusPill.tsx` was deleted after the header cleanup left it with no remaining references
anywhere in the app.

### Admin Inquiries

| Test file                             | Path                                                                           | Purpose                                                                                                                                                                                                                                    |
| :------------------------------------ | :----------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inquiry.test.ts`                     | `admin/types/__tests__/inquiry.test.ts`                                        | Type guards `isInquirySupportStatusFilter`, `isInquiryNotesFilter`.                                                                                                                                                                        |
| `inquiryTime.test.ts`                 | `admin/utils/__tests__/inquiryTime.test.ts`                                    | Day-label/calendar-date formatting, including local-timezone zero-padding.                                                                                                                                                                 |
| `inquiryMockData.test.ts`             | `admin/data/__tests__/inquiryMockData.test.ts`                                 | Seed data assigns rows to the passed-in `currentStaff`; covers all 5 support statuses and both conversation statuses.                                                                                                                      |
| `inquiryStore.test.ts`                | `admin/store/__tests__/inquiryStore.test.ts`                                   | Hydration; per-conversation mutations don't disturb other entries; `closeConversation` forcing `supportStatus: 'Resolved'`; panel open/minimize/close state transitions.                                                                   |
| `inquirySelectors.test.ts`            | `admin/selectors/__tests__/inquirySelectors.test.ts`                           | Highest edge-case density in the feature: tab filter, isolated parent-name/topic search, support-status/assignee filters, inclusive date and duration boundaries, notes filter, combined-filter AND logic, sort by both fields/directions. |
| `useAdminInquirySnapshot.test.ts`     | `admin/hooks/__tests__/useAdminInquirySnapshot.test.ts`                        | Hydrates once `staff` is known; doesn't re-hydrate once `'ready'`; no-ops without `staff`.                                                                                                                                                 |
| `useAdminInquiryData.test.ts`         | `admin/hooks/__tests__/useAdminInquiryData.test.ts`                            | **Manager-vs-staff scoping** (the most important behavior in the feature); counts reflect the scoped set, not the filtered list.                                                                                                           |
| `ConversationStatusBadge.test.tsx`    | `admin/components/inquiries/__tests__/ConversationStatusBadge.test.tsx`        | Pulsing dot only for `Active`; label matches status.                                                                                                                                                                                       |
| `SupportStatusBadge.test.tsx`         | `admin/components/inquiries/__tests__/SupportStatusBadge.test.tsx`             | Correct color per each of the 5 statuses; conditional "Requested {time}" sub-line.                                                                                                                                                         |
| `InquiryRail.test.tsx`                | `admin/components/inquiries/__tests__/InquiryRail.test.tsx`                    | Manager-only controls/banner inversion; date/duration input clamping against each other and against "today"; Clear buttons.                                                                                                                |
| `InquiryListHeader.test.tsx`          | `admin/components/inquiries/__tests__/InquiryListHeader.test.tsx`              | Search input wiring.                                                                                                                                                                                                                       |
| `InquiryTable.test.tsx`               | `admin/components/inquiries/__tests__/InquiryTable.test.tsx`                   | Loading/error/empty states; row click selection; manager vs. read-only assignee cell (with click isolation); sortable-header click + chevron direction.                                                                                    |
| `InquiryDetailFloatingPanel.test.tsx` | `admin/components/inquiries/__tests__/InquiryDetailFloatingPanel.test.tsx`     | Null/minimized/expanded render states; per-conversation state reset via the `key` prop when switching conversations; store-action wiring.                                                                                                  |
| `ConversationInfoCard.test.tsx`       | `admin/components/inquiries/detail/__tests__/ConversationInfoCard.test.tsx`    | Collapse/expand toggle; conditional Support Requested row; null pet name rendering.                                                                                                                                                        |
| `AiSummaryCard.test.tsx`              | `admin/components/inquiries/detail/__tests__/AiSummaryCard.test.tsx`           | Collapse/expand toggle; conditional escalation-reason row.                                                                                                                                                                                 |
| `EmployeeNotesCard.test.tsx`          | `admin/components/inquiries/detail/__tests__/EmployeeNotesCard.test.tsx`       | Save disabled until dirty; Save calls `onSave`; collapse preserves in-progress draft.                                                                                                                                                      |
| `ConversationHistoryCard.test.tsx`    | `admin/components/inquiries/detail/__tests__/ConversationHistoryCard.test.tsx` | Collapsed-to-4-messages default with "View all"/"Show less" toggle; escalation-styled vs. neutral system messages.                                                                                                                         |
| `ReplyField.test.tsx`                 | `admin/components/inquiries/detail/__tests__/ReplyField.test.tsx`              | Enter-to-send and button-to-send both trim and clear; disabled state blocks both.                                                                                                                                                          |
| `DetailFooterActions.test.tsx`        | `admin/components/inquiries/detail/__tests__/DetailFooterActions.test.tsx`     | The confirm-to-close flow end to end: reveal → case-insensitive "confirm" gating → confirm/cancel/Escape/Enter → reset; manager-only Assign/Reassign; hidden once closed.                                                                  |
| `ConversationDetailPanel.test.tsx`    | `admin/components/inquiries/detail/__tests__/ConversationDetailPanel.test.tsx` | Composition: badges match the conversation; reply field omitted when closed.                                                                                                                                                               |
| `AdminInquiriesPage.test.tsx`         | `admin/pages/__tests__/AdminInquiriesPage.test.tsx`                            | Sort-toggle/switch-field logic; tab switching doesn't disturb the open detail panel; table selection reads/writes the shared store, not local state.                                                                                       |

### Cross-cutting integration tests

| Test file                                                   | Path                                                                            | Purpose                                                                                                                                                       |
| :---------------------------------------------------------- | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `inquiriesRoleScoping.integration.test.tsx`                 | `admin/__tests__/inquiriesRoleScoping.integration.test.tsx`                     | Renders `AdminInquiriesPage` as manager and as staff; asserts row set, manager-only controls, and the assigned-to-you banner all differ correctly.            |
| `inquiryPanelPersistsAcrossNavigation.integration.test.tsx` | `admin/__tests__/inquiryPanelPersistsAcrossNavigation.integration.test.tsx`     | Opens a conversation, renders a different admin route under `AdminPortal`, asserts the floating panel is still open/minimized as before.                      |
| `aiChatPanelPersistsAcrossNavigation.integration.test.tsx`  | `pet-parent/__tests__/aiChatPanelPersistsAcrossNavigation.integration.test.tsx` | Opens the AI Chat panel on one parent route, navigates to another under `PetParentPortal`, asserts it's still visible with the same conversation.             |
| `inactivityFlow.integration.test.ts`                        | `pet-parent/ai-chat/__tests__/inactivityFlow.integration.test.ts`               | Fake-timer walk from sending a message through the 10-minute idle threshold to the modal appearing, then "Continue with AI" not immediately re-triggering it. |

`supportEscalationFlow.integration.test.ts` was removed along with the fake-timer `requestSupport`
simulation it covered (see the `requestSupport` bullet above). The real staff-assignment/handling
transitions it now describes are backend-driven and covered on the `admin.inquiry.service.ts` side,
not by a frontend fake-timer walk.

---

Priority order if time is limited: **selectors > store actions > hooks > components**. The
selectors and stores are pure/near-pure logic with the highest bug density per line; components are
better covered by a handful of interaction tests than by exhaustively re-testing markup.

---

## 1. Pet-parent AI Chat (`Frontend/src/features/pet-parent/ai-chat/`)

### `utils.ts`

- `formatTime` renders a given ISO timestamp as `h:mm AM/PM`.
- `formatDayLabel` returns `"Today"` for a timestamp on today's date, and a `"Mon D"`-style label
  for any earlier date.
- `isoAt(hour, minute, daysAgo)` returns an ISO string whose local hour/minute match the inputs, and
  whose date is offset backward by `daysAgo` days from today.

### `mockData.ts` / `createMockConversations`

- Returns exactly one conversation with `status: 'Active'` (the "only one active conversation"
  invariant the rest of the feature relies on) and the rest `status: 'Closed'`.
- Every conversation's `messages` array is chronologically ordered (each `timestamp` ≥ the previous).
- The active conversation's `supportStatus` starts as `'AI Handling'`.

### `store.ts` (`useAiChatStore`): the highest-value target in this feature

- **`activeConversation()`** returns the single `Active` conversation, or `null` when none exists
  (e.g. after closing the only active one).
- **`pastConversations()`** returns only `Closed` conversations, newest-seed-order preserved.
- **`openPanel` / `closePanel`**: `closePanel` resets `isPanelMinimized` to `false` even if it was
  `true` (reopening should never resurrect a stale minimized state).
- **`minimizePanel` / `expandPanel`** toggle `isPanelMinimized` independently of `isPanelOpen`.
- **`startNewConversation`**:
  - Creates a new `Active` conversation with `supportStatus: 'AI Handling'` and empty `messages`
    when no conversation is currently active.
  - Is a no-op when an `Active` conversation already exists (enforces "only one active
    conversation at a time").
  - Resets `inactivityPromptVisible` to `false` and bumps `lastActivityAt`.
- **`sendMessage`**:
  - Trims and ignores whitespace-only input (no message appended, no state change).
  - Appends a `pet_owner` message to the target conversation and updates `lastActivityAt`.
  - Does **not** synthesize an `ai` reply locally, regardless of `supportStatus` or how long the
    test waits. The real reply is generated server-side
    (`Backend/src/services/conversation.ai.service.ts`) and arrives through `refreshConversation`
    via the SSE subscription in `useAiChatLiveUpdates.ts`. This was a canned client-side reply
    (`AI_REPLY_DELAY_MS`) before the real backend pipeline existed; removed once it did, since the
    two would otherwise both answer and show up as duplicate/contradictory `ai` messages.
- **`requestSupport`**:
  - Immediately sets `supportStatus` to `'Support Requested'`, stamps `supportRequestedAt`, and
    appends a `system` message.
  - Does **not** synthesize `'Support Assigned'`/`'Support Handling'` locally, regardless of how
    long the test waits. Those transitions are real, staff-driven backend state changes
    (`Backend/src/services/admin.inquiry.service.ts`: `assignStaff` sets `'support_assigned'`,
    and a staff member's first reply auto-transitions to `'support_handling'` via
    `hasEmployeeMessage`) that arrive through the same SSE-driven `refreshConversation` as an AI
    reply. This was a canned client-side simulation (`SUPPORT_ASSIGNED_DELAY_MS` /
    `SUPPORT_HANDLING_DELAY_MS`, a fake "John from Customer Support") before the real admin-side
    handoff existed; removed once it did, for the same duplicate/contradictory-message reason as
    the canned AI reply above.
- **`closeConversation`**: sets `status` to `'Closed'` and clears `inactivityPromptVisible`, without
  touching `supportStatus`.
- **`continueWithAi`**: clears `inactivityPromptVisible` and refreshes `lastActivityAt`.
- **`checkInactivity`**:
  - Sets `inactivityPromptVisible: true` once `Date.now() - lastActivityAt >= INACTIVITY_TIMEOUT_MS`,
    for a conversation whose `supportStatus` is `'AI Handling'`.
  - Does nothing when there's no active conversation.
  - Does nothing once the conversation has moved past `'AI Handling'` (e.g. `'Support Requested'` or
    later). The idle nudge is AI-only.

### `useAiChatState.ts`

- Derives `current` and `past` from the store correctly (mirrors the store-level cases above, at
  the hook boundary).
- Starts a polling interval on mount and clears it on unmount (spy on `setInterval`/`clearInterval`).

### Components

- **`AiChatIconButton`**: shows the green active-dot only when an active conversation exists;
  clicking toggles `isPanelOpen` via the store.
- **`AiChatFloatingPanel`**:
  - Renders nothing when `isPanelOpen` is `false`.
  - Renders nothing when the current route is `/parent/ai-chat` (avoids duplicating the expanded
    page).
  - Renders the `MinimizedBar` instead of the full panel when `isPanelMinimized` is `true`.
  - "Expand to full page" navigates to `/parent/ai-chat` and closes the floating panel.
  - Shows the "Start a conversation" empty state when there is no active conversation, and calls
    `startNewConversation` on click.
- **`MinimizedBar`**: shows the "Active · {pet}'s care" line only when a conversation is passed in;
  omits it when `current` is `null`.
- **`ConversationSidebar`**:
  - "New Conversation" is disabled while `current` is non-null, and shows the explanatory note only
    then.
  - Renders an empty state ("No past conversations yet.") when `past` is empty.
  - Clicking a past row calls `onSelect` with that conversation's id.
- **`ConversationArea`**:
  - Renders the empty-state message when `conversation` is `null`.
  - Read-only mode (`status === 'Closed'`): composer and Contact/Close action buttons are hidden;
    a "closed and read-only" message is shown instead.
  - "Contact Customer Support" button is shown only when `supportStatus === 'AI Handling'`.
  - Pressing Enter in the composer sends the message; sending clears the input.
  - Whitespace-only input does not call `onSendMessage`.
- **`MessageBubble`**: renders the correct alignment/styling per `senderRole`
  (`pet_owner`/`ai`/`support`/`system`), and shows `authorName` (falling back to "Customer Support")
  for `support` messages.
- **`InactivityPromptModal`**: renders nothing when `isOpen` is `false`; each of the three actions
  (Continue with AI / Contact Support / Close conversation) calls its respective handler.

### `pages/AiChatPage.tsx`

- Defaults the selected conversation to the active one when present, else the most recent past one,
  else `null`.
- Clicking a sidebar row updates the selected conversation shown on the right.
- Starting a new conversation auto-selects the newly created conversation.
- Closing the selected conversation clears the selection and falls back to whatever `past`/`current`
  is left.
- The inactivity modal's "Contact Customer Support" both requests support and dismisses the prompt.

---

## 2. Admin Inquiries (`Frontend/src/features/admin/`)

### `types/inquiry.ts`

- `isInquirySupportStatusFilter`: accepts `'All'` and every value in `SUPPORT_STATUSES`; rejects
  anything else.
- `isInquiryNotesFilter`: accepts `'All' | 'With notes' | 'No notes'`; rejects anything else.

### `utils/inquiryTime.ts`

- `formatInquiryDayLabel` returns `"Today"` for today's date, a short date otherwise (mirrors the
  pet-parent `utils.ts` cases).
- `toInquiryCalendarDate` converts an ISO timestamp to `YYYY-MM-DD` in local time, zero-padded for
  single-digit months/days.
- `todayInquiryCalendarDate` matches `toInquiryCalendarDate(new Date().toISOString())` for "now".

### `data/inquiryMockData.ts` / `createMockInquiries`

- When passed a `currentStaff`, at least one Active and one Closed conversation are assigned to
  that staff member's id (so "assigned to me" filtering always has something to show).
- Falls back to a placeholder assignee when `currentStaff` is `null`/omitted.
- Covers all five `SupportStatus` values and both `ConversationStatus` values across the seed set
  (a filter/selector test can assert on this directly rather than re-deriving it).

### `store/inquiryStore.ts` (`useInquiryStore`)

- `hydrateInquirySnapshot` populates both `inquiryByUuid` and `inquiryUuids` and sets
  `snapshotStatus: 'ready'`.
- `setAssignee`, `setSupportStatus`, `setNote` each update only the targeted conversation, leaving
  others in `inquiryByUuid` untouched (object-identity check on the untouched entries).
- `appendReply`:
  - Trims and ignores whitespace-only replies (no message appended).
  - Appends a `staff`-role message with the given `authorName`.
- `closeConversation` sets `status: 'Closed'` **and** `supportStatus: 'Resolved'` regardless of the
  prior support status (this differs from the pet-parent store, which leaves `supportStatus`
  alone. This is worth a test precisely because the two stores diverge here).
- `openConversation` sets `openConversationUuid` and forces `isPanelMinimized: false` (opening a new
  conversation always expands the panel, even if a previous one was minimized).
- `closeConversationPanel` clears both `openConversationUuid` and `isPanelMinimized`.
- `minimizePanel` / `expandPanel` toggle `isPanelMinimized` without touching `openConversationUuid`.

### `selectors/inquirySelectors.ts`: most edge-case-dense file in the feature

`selectInquiryList`:

- Filters strictly by `tab` (`Active` vs `Closed`). A `Closed` conversation never appears under
  the `Active` tab and vice versa.
- `searchQuery` matches across parent name, pet name, topic, and AI summary (case-insensitive); an
  empty query matches everything.
- `parentNameQuery` matches only against `parentName` (must **not** match on topic/pet name; this
  is the regression case for it being a "dedicated" filter separate from `searchQuery`).
- `topicQuery` matches only against `topic`, same isolation requirement as above.
- `supportStatusFilter`: `'All'` passes everything; a specific status excludes non-matching rows.
- `assigneeId`: `'All'` passes everything; `'Unassigned'` matches only `assignee === null`; a
  specific id matches only that assignee.
- `dateFrom`/`dateTo` range: inclusive on both bounds; empty string on either side means "no bound
  on that side"; a conversation exactly on `dateFrom` or `dateTo` is included, not excluded
  (off-by-one boundary case).
- `durationMin`/`durationMax`: inclusive bounds; `null` on either means unbounded; a duration
  exactly equal to a bound is included.
- `notesFilter`: `'With notes'` requires a non-whitespace `notes` string; `'No notes'` requires an
  empty/whitespace-only string; `'All'` passes everything.
- All filters combine with AND (a row failing any single filter is excluded even if it matches all
  others). Write at least one test with 2+ simultaneously-active filters.
- Sort (`compareInquiries` via `options.sort`):
  - `{ field: 'startedAt', direction: 'desc' }` (the default) orders newest-first.
  - `{ field: 'startedAt', direction: 'asc' }` reverses it.
  - `{ field: 'durationMinutes', direction: 'asc' | 'desc' }` orders by duration, independent of
    `startedAt`.

`selectInquiryCounts`:

- Counts reflect `status`, independent of any list filters (counts are computed from the
  role-scoped set, not the filtered/sorted list; verify the hook passes the right array, see
  below).

### `hooks/useAdminInquirySnapshot.ts`

- Hydrates the store from `createMockInquiries` once `staff` becomes available.
- Does not hydrate (or re-hydrate) once `snapshotStatus` is already `'ready'`.
- Does nothing while `staff` is `null` (waiting on identity before seeding).

### `hooks/useAdminInquiryData.ts`

- **Role scoping**: a manager sees all inquiries regardless of assignee; a `staff` role sees only
  inquiries where `assignee.id === staff.id`. This is the single most important behavior in the
  whole Inquiries feature and deserves its own focused test with both roles.
- `counts` are computed from the role-scoped set (an unassigned-to-me Active conversation must not
  inflate a staff member's Active count).
- `inquiries` reflects the combination of role-scoping + all filter/sort options passed through
  (integration-style test covering the hook, not just the selector in isolation).
- `loading` is `true` while `snapshotStatus` is `'idle'`/`'loading'`, `false` once `'ready'`.

### Components: badges

- **`ConversationStatusBadge`**: shows the pulsing dot only for `'Active'`; label text matches the
  status.
- **`SupportStatusBadge`**: correct color class per each of the five statuses (a table-driven test
  over `SUPPORT_STATUSES`); the "Requested {time}" sub-line renders only when both `requestedAt`
  and `requestedAtLabel` are provided.

### `InquiryRail.tsx`

- "All Assignees" filter and the "You're seeing conversations assigned to you" banner render only
  for `isManager === false` / `true` respectively (inverse conditions, easy to get backwards).
- Date pickers: typing/selecting a date after "today" is clamped back to today (`max` attribute
  _and_ the `onChange` clamp; test the clamp directly, since jsdom doesn't enforce native `max`).
  the `dateFrom` input's `max` is `min(dateTo, today)` when `dateTo` is set.
- Duration min/max inputs clamp against each other (setting min above the current max pulls max up
  to match, and vice versa).
- "Clear dates" / "Clear duration" only render when at least one of the respective pair is set, and
  reset both fields to their empty state.
- Clicking "Active"/"Closed" calls `onTabChange` with the clicked value.

### `InquiryTable.tsx`

- Loading, error, and empty (`inquiries.length === 0`) states each render their respective
  placeholder instead of the table body.
- Clicking a row calls `onSelect` with that row's `uuid`; the selected row gets the highlighted
  background.
- Manager view renders an assignee `<Select>` per row; non-manager view renders the read-only
  "You" pill instead, and clicking inside the assignee cell does not also trigger the row's
  `onSelect` (verify `stopPropagation`).
- `SortableHeader`: clicking a column calls `onSortChange` with that field; the chevron's rotation
  reflects `sort.direction` only when that column is the active `sort.field`.
- The Notes icon cell is styled differently for a conversation with a non-empty `notes` string vs.
  an empty one.

### `detail/` cards

- **`ConversationInfoCard`**: toggling the header collapses/expands the info rows; the "Support
  Requested" row renders only when `supportRequestedAt` is non-null; `petName: null` renders "None".
- **`AiSummaryCard`**: toggling the header collapses/expands the body; "Reason for escalation" row
  renders only when `aiEscalationReason` is non-null.
- **`EmployeeNotesCard`**: Save button is disabled until the draft differs from the `notes` prop;
  clicking Save calls `onSave` with the current draft; toggling the header hides/shows the textarea
  without discarding the in-progress draft.
- **`ConversationHistoryCard`**: shows only the last 4 messages by default when there are more than
  4, with a "View all" toggle that reveals the rest and flips the label to "Show less"; a `system`
  message containing "requested" renders with the escalation (orange) style, other `system`
  messages render neutral.
- **`ReplyField`**: Enter key and the send button both call `onSend` with the trimmed draft and
  clear the input; disabled state (closed conversation) blocks both.
- **`DetailFooterActions`**: the confirm-to-close flow is the most behaviorally rich unit here:
  - Clicking "Close Conversation" reveals the confirm box instead of calling `onCloseConversation`
    immediately.
  - The inline "Close Conversation" confirm button stays disabled until the typed text is exactly
    `"confirm"` (case-insensitive; test `"Confirm"`, `"CONFIRM "` with surrounding whitespace, and
    a near-miss like `"confir"` staying disabled).
  - Confirming calls `onCloseConversation` exactly once and resets the confirm box.
  - "Cancel" and pressing Escape both back out without calling `onCloseConversation`, and clear the
    typed text.
  - Pressing Enter while the text is confirmed triggers the close; pressing Enter while not yet
    confirmed does not.
  - Assign/Reassign control and its inline `<Select>` render only for `isManager === true`.
  - The "Close Conversation" button/box is omitted entirely once `isClosed` is `true`.
- **`ConversationDetailPanel`**: composes the above; the `ReplyField` section is omitted when the
  conversation is closed; badges shown match `inquiry.status`/`inquiry.supportStatus`.

### `InquiryDetailFloatingPanel.tsx`

- Renders `null` when `openConversationUuid` is `null` (nothing open).
- Renders the `MinimizedBar` when `isPanelMinimized` is `true`, the full panel otherwise.
- Switching `openConversationUuid` to a different conversation (without closing first) resets each
  card's local state. This is what the `key={inquiry.uuid}` on `ConversationDetailPanel` exists
  for; regression-test it by opening conversation A, expanding/collapsing a card or typing a note
  draft, then opening conversation B and asserting the card is back to its default expanded state
  and the draft is gone.
- All the store-wired callbacks (`onAssigneeChange`, `onSaveNotes`, `onSendReply`,
  `onCloseConversation`) call the correct store action with the currently-open conversation's
  `uuid`.

### `pages/AdminInquiriesPage.tsx`

- `handleSortChange`:
  - Clicking the currently-active sort field toggles its direction.
  - Clicking a different field switches to it with that field's sensible default direction
    (`startedAt` → `desc`, `durationMinutes` → `asc`).
- Switching the Active/Closed tab does **not** close or otherwise reset the floating detail panel
  (this is the behavior the store-backed `openConversationUuid` refactor was specifically for:
  regression-test it explicitly: open a conversation, switch tabs, assert the panel is still open).
- `InquiryTable`'s `selectedUuid`/`onSelect` are wired to the store's `openConversationUuid`/
  `openConversation`, not local page state (a row click updates the store, not just page-local UI).

---

## 3. Cross-cutting / integration scenarios

These span multiple files and are worth a small number of higher-level tests (render the page with
a mocked store rather than unit-testing each piece again):

- **Manager vs. staff view of Inquiries**: seed `useCurrentStaffStore` with a `manager` and
  separately with a `staff` role, render `AdminInquiriesPage`, and assert the row set, the presence
  of "All Assignees"/Assign-Reassign controls, and the assigned-to-you banner all differ correctly.
- **Floating panel persists across admin route navigation**: open a conversation from
  `AdminInquiriesPage`, then render a different admin route under the same `AdminPortal`. The
  `InquiryDetailFloatingPanel` should still show the same open (or minimized) conversation, since
  its state lives in the global `inquiryStore`, not page-local state.
- **Pet-parent floating chat persists across page navigation**: open the AI Chat panel from one
  parent page, navigate to another parent route under `PetParentPortal`, and assert the panel (or
  its minimized bar) is still visible with the same conversation.
- **10-minute inactivity end-to-end** (fake timers): send a message, advance time past
  `INACTIVITY_TIMEOUT_MS` without further activity, assert the inactivity modal appears on
  `AiChatPage`; advancing time again after "Continue with AI" should not re-trigger it immediately.
