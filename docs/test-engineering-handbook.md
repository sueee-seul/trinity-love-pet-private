# Test Engineering Handbook

This handbook explains how to test Trinity as a test engineer. It complements the command-focused [Testing Guide](./testing-guide.md): use this document to decide **what** evidence is needed; use the Testing Guide to run the relevant commands.

## 1. Quality strategy

The product is a set of independently deployable or runnable boundaries:

| Boundary            | Technology                   | Main test approach             | Primary risk                                               |
| ------------------- | ---------------------------- | ------------------------------ | ---------------------------------------------------------- |
| Frontend            | React, TypeScript, Vite      | Vitest, Testing Library, jsdom | UI state, accessibility, client/API integration            |
| Backend             | Express, TypeScript          | Vitest and Supertest           | validation, authorization, business rules, error contracts |
| PostgreSQL          | Neon PostgreSQL              | isolated API read-back tests   | persistence, schema compatibility, seed assumptions        |
| Parent feedback E2E | React + Express + PostgreSQL | Playwright                     | browser-to-database persistence                            |

Testing is risk-based. A small visual change needs visual verification and quality checks; a change to authorization, persistence, a state transition, or an API contract needs focused automated regression coverage. Passing a test does not replace linting, formatting, type checking, building, or a manual exploratory check.

## 2. Test levels and expected evidence

| Level                  | Purpose                                                             | Typical evidence                                       | When required                                       |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Static checks          | Catch type, formatting, and code-quality defects                    | lint, Prettier, TypeScript build/type check            | Every relevant code change                          |
| Unit/component         | Prove a focused rule, function, hook, store, or UI behavior         | Vitest test with controlled inputs and expected output | Changed behavior or regression                      |
| API/service            | Prove HTTP status, response contract, validation, and authorization | Supertest/Vitest test                                  | Changed endpoint, service, auth, or validation      |
| PostgreSQL integration | Prove read/write behavior against the isolated database             | PostgreSQL API test and preflight                      | Changed persistence/schema-dependent behavior       |
| Contract               | Protect public types and exported package behavior                  | Agent contract tests; producer and consumer tests      | Shared API, DTO, schema, or package contract change |
| End-to-end             | Prove a critical user journey across real boundaries                | Playwright plus persistence assertion                  | High-risk journey or release-critical flow          |
| Exploratory/manual     | Find usability, visual, timing, and negative-path issues            | a recorded charter and observations                    | New/changed workflows and release review            |

## 3. Test selection matrix

| Change                                        | Minimum test work                                                                 | Additional preparation                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Static text, CSS, spacing, color, typography  | Manual visual check; relevant lint/format/build                                   | Test desktop and narrow viewport where layout changes                               |
| React component rendering or interaction      | Component test covering user-visible behavior and failure/empty state             | Mock external APIs; use accessible queries                                          |
| Hook, selector, utility, or Zustand store     | Focused unit test for state transitions and boundaries                            | Include empty, invalid, and repeated-event cases                                    |
| New page or workflow                          | Page/integration test plus exploratory journey                                    | Define routes, role/session, fixture data, and expected navigation                  |
| Backend service/controller                    | Focused service/API regression test                                               | Define valid, invalid, unauthenticated, and unauthorized inputs                     |
| API request/response or DTO change            | Backend contract test and Frontend consumer test                                  | Write the old/new payload examples before implementation                            |
| PostgreSQL repository or persistence behavior | Focused repository/service test; PostgreSQL API suite if API behavior is affected | Isolated `TEST_DATABASE_URL`, prepared schema, required fixtures                    |
| Authentication/authorization/security         | API regression test for allowed and denied roles                                  | Use separate authenticated and unauthenticated session fixtures                     |
| Critical browser-to-database journey          | Playwright E2E only where unit/API evidence is insufficient                       | Browser, ports, session setup, isolated database, seed data, provider configuration |

## 4. Preparation checklist

Before starting a test run, record:

1. **Scope and risk:** changed files, user-visible behavior, non-goals, affected role(s), and affected data.
2. **Environment:** Node 24, installed dependencies for the selected package, and no conflicting local servers.
3. **Configuration:** use local `.env` / `.env.local` files only; never place credentials in test source, logs, or bug reports.
4. **Data:** known fixture IDs, roles, valid and invalid input, cleanup expectation, and whether data is mock-only or persisted.
5. **Isolation:** PostgreSQL integration and E2E tests require `TEST_DATABASE_URL`, distinct from normal `POSTGRESQL_URL`.
6. **Oracle:** exact expected result: UI text/state, status code/body, database row, emitted event, or error message.

For a browser test, also prepare the target URL, browser, viewport, authenticated user/session state, and a repeatable way to inspect network and console failures.

## 5. Automated suites

Run the smallest sufficient suite first. Broaden the run only when the change crosses boundaries, focused evidence is insufficient, or CI/release requirements demand it.

```powershell
# Frontend: run once, without watch mode
npm run test --prefix Frontend -- --run
npm run lint --prefix Frontend
npm run build --prefix Frontend

# Backend: unit suite and build
npm run test:unit --prefix Backend
npm run build --prefix Backend

# Isolated Neon/PostgreSQL API suite
npm run ci:api:postgres

# Parent-feedback browser persistence scenario
npm run test:e2e:parent-feedback

# Repository quality checks
npm run lint
npx prettier --check Frontend Backend docs
git diff --check
```

Do not use `npm run format` merely as a check: it rewrites files. Review its diff if formatting is intentionally applied.

### PostgreSQL expectations

The PostgreSQL suite validates the isolated database schema and required fixtures before its selected API tests run. It does not create, migrate, reset, or fall back to another database. A missing or unsafe `TEST_DATABASE_URL` is a correct failure, not a reason to point tests at a product database.

### Playwright expectations

The parent-feedback persistence spec starts Backend and Frontend servers itself on ports 3000 and 5173. It requires an isolated prepared database, a browser, configured provider dependencies for the feedback path, and authentication/session setup. The current spec does not create a login session, so a clean checkout may need local session preparation before it can pass. Record such prerequisites in the test run rather than reporting an unexplained failure.

## 6. Exploratory testing workflow

Use an exploratory charter after focused automation passes for meaningful UI/workflow changes:

```text
Charter: Explore <feature> for <risk>.
Role/session: <user role and authentication state>.
Data: <fixtures and inputs>.
Timebox: <for example, 30 minutes>.
Focus: happy path, validation, permissions, loading/error/empty states, refresh/navigation,
       keyboard operation, narrow viewport, and repeated actions.
Observations: <actual results and evidence links>.
```

Test the happy path first, then deliberately vary one condition at a time: missing data, malformed data, a denied role, a slow/failing request, refresh/back navigation, duplicate submit, and cancellation. Capture screenshots, network responses, console errors, timestamps, and affected fixture identifiers for failures.

## 7. KPI and chart checklist

For dashboard components such as `KpiDonutChart`, test behavior as well as appearance:

- Each label/value maps to the intended segment and legend item.
- Default and supplied color palettes are applied predictably.
- Percentages are correct, including decimal rounding and a total of zero.
- Toggling raw values versus percentages changes only the label representation.
- Tooltip text includes the category, raw value, and calculated percentage.
- Empty, zero-only, one-segment, and large-value data do not crash or produce `NaN`/`Infinity`.
- Optional help text is discoverable and keyboard-accessible.
- Chart title and meaningful summary remain available to assistive technology.
- Desktop and narrow viewport layout do not obscure labels, legend, or tooltips.

When a chart library canvas is difficult to assert directly, test its generated configuration through a controlled mock and combine that with a focused manual visual check.

## 8. Test-case template

```markdown
### TC-<area>-<number>: <short behavior>

- Risk: <low / medium / high>; <why>
- Level: <component / API / integration / E2E / exploratory>
- Preconditions: <role, configuration, fixtures>
- Steps:
  1. <action>
  2. <action>
- Expected result: <observable state, contract, or persisted outcome>
- Evidence: <test name, screenshot, response, query result>
- Result: <pass / fail / blocked / not run>
```

A useful test case has one clear purpose, deterministic data, an observable expected result, and no hidden dependency on test ordering or another tester's local state.

## 9. Defect-report template

```markdown
### BUG-<number>: <observable problem>

- Severity: <blocker / critical / major / minor>
- Priority: <P0 to P3>
- Environment: <branch/commit, browser or API client, configuration without secrets>
- Preconditions and data: <role and fixture identifiers>
- Steps to reproduce:
  1. <action>
  2. <action>
- Actual result: <what happened>
- Expected result: <what should happen>
- Frequency: <always / intermittent, count>
- Evidence: <screenshots, console/network output, correlation/request ID>
- Suspected scope: <optional; do not present as proven root cause>
```

Severity describes impact; priority describes when the team should address it. Keep them separate. A missing label might be minor severity but high priority before a demonstration; unauthorized data access is critical severity regardless of visual polish.

## 10. Exit criteria and release sign-off

A feature is ready for test sign-off when:

- its acceptance criteria have mapped test cases and recorded results;
- focused automated tests pass, including relevant failure/boundary cases;
- applicable lint, format check, type check/build, and `git diff --check` pass;
- API and persistence changes have producer/consumer and isolated database evidence;
- critical workflows have manual/exploratory evidence where automation cannot assess usability;
- known failures are triaged with severity, owner, and explicit release decision;
- skipped checks are named, justified, and never reported as passing.

Use this report format:

```markdown
## Test run: <feature / release>

- Scope and commit: <scope, commit SHA>
- Environments: <browser, API/database target, fixture set>
- Passed: <test cases and commands>
- Failed: <bug IDs and severity>
- Blocked/not run: <check and exact reason>
- Residual risks: <what remains unverified>
- Recommendation: <ready / ready with accepted risks / not ready>
```

## 11. Project standards

Follow these rules in every test:

- Test observable behavior and meaningful boundary/error cases, not implementation trivia.
- Keep test names outcome-oriented: `rejects a parent without a valid session`, not `calls helper`.
- Use accessible UI queries (role, label, visible text) before implementation-specific selectors.
- Keep external network/model calls mocked in unit tests. Make live-provider evaluations explicit and opt-in.
- Do not hardcode credentials, connection strings, or personal data in source or reports.
- Do not modify `Backend/database/neon.sql`, and do not add/remove database columns without explicit approval.
- Preserve test isolation: no reliance on execution order, shared mutable fixtures, or a product database.
- Treat a flaky test as a defect: capture timing, concurrency, environment, and retry evidence before weakening assertions.

For the complete repository rules, see [Testing Guide](./testing-guide.md), [Clean Code Rules](./clean-code-rules.md), and [Clean Code Rules for Agents](./clean-code-rules-for-agents.md).
