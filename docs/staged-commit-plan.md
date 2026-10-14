# Staged commit plan

Reference list of `git add` + `git commit -m` pairs for every file currently
changed/untracked on `346-create-mongo-db-for-storing-messages-and-conversations`,
grouped by feature area and ordered so each group's dependencies (models →
repositories → services → controllers → routes → frontend) land before the
code that uses them. Run the blocks in order, or cherry-pick individual
pairs. Each is self-contained.

> **Before running any of this:** `AiChatbox/` contains a local `.env`,
> `venv/`, and `__pycache__/`. All are already covered by the root
> `.gitignore`, so `git add AiChatbox/` will skip them automatically. Spot
> check with `git status` after adding that directory before committing.

---

## 1. Backend: AI chatbot resolver & Mongo-backed conversation replies

```bash
git add Backend/src/repositories/conversation.repository.ts
git commit -m "Add updateConversationState to persist the AI resolver's context stack"

git add Backend/src/repositories/message.repository.ts
git commit -m "Add createAiMessage to persist AI-authored replies with resolver metadata"

git add Backend/src/repositories/petparent.chatbot.repository.ts
git commit -m "Add chatbot repository reads for booking/stay context resolution"

git add Backend/src/services/conversation.resolver.ts
git commit -m "Add the two-call LLM resolver: entity resolution + guarded answer generation"

git add Backend/src/services/conversation.ai.service.ts
git commit -m "Add generateAiTurn orchestrating the resolver against real conversation state"

git add Backend/src/services/conversation.service.ts
git commit -m "Fire the AI reply pipeline after a pet owner message when AI is handling the conversation"

git add Backend/src/__tests__/conversation.resolver.test.ts
git commit -m "Add tests for the context resolver and guarded answer generator"

git add Backend/src/__tests__/conversation.ai.service.test.ts
git commit -m "Add tests for the end-to-end AI turn pipeline"

git add Backend/src/services/llm.service.ts
git commit -m "Add supportsCustomTemperature so callers can skip a param OpenAI reasoning models reject"

git add Backend/src/__tests__/llm.service.test.ts
git commit -m "Add tests for supportsCustomTemperature across local Ollama and OpenAI routing"
```

## 2. Backend: Admin inquiries live "new inquiry" stream

```bash
git add Backend/src/services/conversation.events.ts
git commit -m "Extract a shared SSE runner and add an inquiry-created event bus"

git add Backend/src/controllers/admin.inquiries.controller.ts
git commit -m "Add streamInquiryList controller for the new-inquiry SSE endpoint"

git add Backend/src/routes/admin.inquiries.routes.ts
git commit -m "Route GET /admin/inquiries/stream to streamInquiryList"

git add Backend/src/__tests__/conversation.events.test.ts
git commit -m "Add tests for publishInquiryCreated and streamInquiryCreatedEvents"
```

## 3. Backend: Booking status rename (confirmed → paid) & "My Bookings"

```bash
git add Backend/src/repositories/parent.profile.repository.ts
git commit -m "Export toStayStatus so other owner-scoped stay reads share the same status derivation"

git add Backend/src/repositories/petparent.booking.repository.ts
git commit -m "Add listBookingsForOwner and flip booking completion status to 'paid'"

git add Backend/src/services/petparent.booking.ts
git commit -m "Add listMyBookings summary builder and rename booking status to 'paid'"

git add Backend/src/controllers/petparent.booking.controller.ts
git commit -m "Add getMyBookings controller"

git add Backend/src/routes/petparent.booking.routes.ts
git commit -m "Route GET /petparent/bookings to getMyBookings"
```

## 4. Backend: Live Care feature (tasks SSE + petparent live-care endpoint)

```bash
git add Backend/src/services/livecare.events.ts
git commit -m "Add per-pet task-updated SSE event bus for the Live Care dashboard"

git add Backend/src/services/task.service.core.ts
git commit -m "Publish a task event on create/update/complete/delete"

git add Backend/src/services/task.fromBooking.service.ts
git commit -m "Publish task events for each pet after generating tasks from a booking"

git add Backend/src/services/task.photo.service.ts
git commit -m "Publish a task event when task photos are added or removed"

git add Backend/src/repositories/petparent.livecare.repository.ts
git commit -m "Add repository reads for a pet parent's Live Care stay/task data"

git add Backend/src/services/petparent.livecare.ts
git commit -m "Add petparent Live Care service resolving a stay's tasks per day"

git add Backend/src/controllers/petparent.livecare.controller.ts
git commit -m "Add Live Care controller with REST read and SSE stream endpoints"

git add Backend/src/routes/petparent.livecare.routes.ts
git commit -m "Add petparent Live Care routes"
```

## 5. Backend: Stays feature (petparent stays endpoint)

```bash
git add Backend/src/repositories/petparent.stays.repository.ts
git commit -m "Add repository read for every stay belonging to a pet owner's pets"

git add Backend/src/services/petparent.stays.ts
git commit -m "Add petparent stays service mapping stay rows to summaries"

git add Backend/src/controllers/petparent.stays.controller.ts
git commit -m "Add petparent stays controller"

git add Backend/src/routes/petparent.stays.routes.ts
git commit -m "Add petparent stays routes"
```

## 6. Backend: Manager booking listing

```bash
git add Backend/src/repositories/manager.booking.repository.ts
git commit -m "Add repository read listing all bookings for the manager view"

git add Backend/src/services/manager.booking.ts
git commit -m "Add manager booking service"

git add Backend/src/controllers/manager.booking.controller.ts
git commit -m "Add manager booking controller"

git add Backend/src/routes/manager.booking.routes.ts
git commit -m "Add manager booking routes"
```

## 7. Backend: wire up new routers

```bash
git add Backend/src/server.ts
git commit -m "Mount live-care, stays, and manager booking routers"
```

## 8. Frontend: AI chat store now driven by real server replies

```bash
git add Frontend/src/features/pet-parent/ai-chat/store.ts
git commit -m "Replace client-simulated AI/support replies with real SSE-driven state"

git add Frontend/src/features/pet-parent/ai-chat/__tests__/store.test.ts
git commit -m "Update ai-chat store tests for the awaitingAiReply flag instead of simulated timers"

git add Frontend/src/features/pet-parent/ai-chat/components/ConversationArea.tsx
git commit -m "Show an 'AI is thinking' indicator while awaiting a real server reply"

git add Frontend/src/features/pet-parent/ai-chat/components/__tests__/ConversationArea.test.tsx
git commit -m "Add tests for the AI-thinking indicator"

git add Frontend/src/features/pet-parent/ai-chat/__tests__/supportEscalationFlow.integration.test.ts
git commit -m "Remove the support-escalation integration test for the old client-simulated flow"
```

## 9. Frontend: Admin inquiries live list updates

```bash
git add Frontend/src/shared/events/conversationServerEvents.ts
git commit -m "Add subscribeToInquiryCreatedEvents for the new-inquiry SSE stream"

git add Frontend/src/shared/events/__tests__/fakeEventSource.ts
git commit -m "Add a generic emit() helper to FakeEventSource for untyped event types"

git add Frontend/src/shared/events/__tests__/conversationServerEvents.test.ts
git commit -m "Add tests for subscribeToInquiryCreatedEvents"

git add Frontend/src/features/admin/store/inquiryStore.ts
git commit -m "Add addInquiry action to splice a newly created inquiry into the store"

git add Frontend/src/features/admin/store/__tests__/inquiryStore.test.ts
git commit -m "Add tests for addInquiry's dedupe/prepend behavior"

git add Frontend/src/features/admin/hooks/useInquiryListLiveUpdates.ts
git commit -m "Add hook subscribing the Inquiries list to new-inquiry SSE events"

git add Frontend/src/features/admin/hooks/__tests__/useInquiryListLiveUpdates.test.ts
git commit -m "Add tests for useInquiryListLiveUpdates"

git add Frontend/src/features/admin/hooks/useAdminInquiryData.ts
git commit -m "Wire useInquiryListLiveUpdates into the Inquiries page data hook"
```

## 10. Frontend: My Stays page refactor (real PetStay model)

```bash
git add Frontend/src/features/pet-parent/types/stays.ts
git commit -m "Replace mock Stay type with PetStay matching the real bookings API response"

git add Frontend/src/features/pet-parent/components/stays/formatStayDate.ts
git commit -m "Update stay date formatting for ISO timestamp fields"

git add Frontend/src/features/pet-parent/components/stays/stayStatus.ts
git commit -m "Derive stay display status from drop-off/pick-up timestamps"

git add Frontend/src/features/pet-parent/components/stays/dateUtils.ts
git commit -m "Remove dateUtils, superseded by formatStayDate"

git add Frontend/src/features/pet-parent/components/stays/flattenStays.ts
git commit -m "Remove flattenStays mock-data helper, superseded by the real bookings API"

git add Frontend/src/features/pet-parent/components/stays/resolvePetCosts.ts
git commit -m "Remove resolvePetCosts mock-data helper, cost now comes from the API"

git add Frontend/src/features/pet-parent/components/stays/staysDefaults.ts
git commit -m "Remove staysDefaults mock fixtures, superseded by the real bookings API"

git add Frontend/src/features/pet-parent/components/stays/PetStayCard.tsx
git commit -m "Update PetStayCard for the PetStay shape and bookingPetId-based callbacks"

git add Frontend/src/features/pet-parent/components/stays/BookingDetailsModal.tsx
git commit -m "Add booking details modal showing caring info and per-service costs"

git add Frontend/src/features/pet-parent/api/bookingApi.ts
git commit -m "Add fetchMyBookings and rename booking status to 'paid'"

git add Frontend/src/features/pet-parent/pages/MyStaysPage.tsx
git commit -m "Fetch real bookings and wire up the booking details modal"
```

## 11. Frontend: Live Care dashboard refactor (real data + SSE)

```bash
git add Frontend/src/features/pet-parent/types/liveCare.ts
git commit -m "Replace mock LiveCareDashboardProps with the real LiveCareData API shape"

git add Frontend/src/features/pet-parent/components/live-care/liveCareDefaults.ts
git commit -m "Remove mock care entries/stats, keep only the category bubble styles"

git add Frontend/src/features/pet-parent/components/live-care/DaySelector.tsx
git commit -m "Add DaySelector for picking a day within a multi-day stay"

git add Frontend/src/shared/events/liveCareServerEvents.ts
git commit -m "Add subscribeToLiveCareServerEvents for the per-stay task-updated stream"

git add Frontend/src/features/pet-parent/api/liveCareApi.ts
git commit -m "Add liveCareApi fetch client for the Live Care dashboard endpoints"

git add Frontend/src/features/pet-parent/pages/LiveCareDashboardPage.tsx
git commit -m "Fetch real Live Care data over REST/SSE with day selection by bookingPetId"

git add Frontend/src/App.tsx
git commit -m "Add /live-care/:bookingPetId route"
```

## 12. Docs

```bash
git add docs/pet-parent-ai-chatbot-architecture.md
git commit -m "Add architecture doc for the pet-parent AI chatbot resolver design"

git add docs/ai-chat-and-inquiries-test-plan.md
git commit -m "Update AI chat and inquiries test plan for the live-reply and live-list behavior"
```

## 13. AiChatbox: offline resolver design harness

```bash
git add AiChatbox/
git commit -m "Add Ollama/OpenAI test harness validating the chatbot resolver design against mock data"
```

---

### Notes

- Groups 1 to 7 are backend-only and should type-check/test independently once
  applied in order; groups 8 to 11 are frontend and depend on their matching
  backend group being in place if you want `npm run dev` to work end-to-end
  between groups.
- If per-file commits are more granularity than you want, each numbered
  section can instead be applied as a single `git add <all files in section>`
  - one `git commit -m "<section title>"`.
- Double-check `git status` after `git add AiChatbox/`: `.env`, `venv/`, and
  `__pycache__/` are gitignored and should not appear staged.
