# QA Readiness Guide

Read this before handing a feature, bug fix, or release candidate to QA. The goal is simple: give QA a stable, testable build with enough information and access to prove the agreed behavior.

For test strategy and test-case design, see the [Test Engineering Handbook](./test-engineering-handbook.md). For repository commands and test-environment details, see the [Testing Guide](./testing-guide.md).

## What the team must provide

### 1. Scope and acceptance criteria

Before QA starts, the feature owner must provide:

- A short description of the user problem and the intended result.
- Explicit acceptance criteria: expected behavior, validation rules, error states, roles, and non-goals.
- The branch, pull request, build, or commit SHA to test.
- A list of changed routes, pages, APIs, database-dependent behavior, and external services.
- Known limitations, feature flags, deferred work, and intentionally unsupported cases.

Avoid asking QA to infer product rules from implementation details. If expected behavior is undecided, resolve it before sign-off testing begins.

### 2. A usable test environment

The environment owner must ensure:

- Frontend, Backend, and any affected services are reachable and on compatible versions.
- The environment is separate from production.
- Required environment variables are set through secure configuration, never committed into source code or pasted into tickets.
- Relevant health checks work before handoff.
- Testers know the base URLs, relevant ports, deployment version, and any temporary restrictions.

For a locally run browser persistence test, ports 3000 (Backend) and 5173 (Frontend) must be free because Playwright starts its own servers.

### 3. Safe, repeatable test data

The data owner must provide test-safe fixtures that can be reused or restored:

- Pet-parent, employee, manager, and reviewer accounts for each affected role.
- Pets, owners, bookings, assignments, feedback, conversations, Google reviews, and media fixtures needed by the workflow.
- Valid, invalid, empty, boundary, and duplicate-input examples.
- Fixture identifiers and expected outcomes, without exposing production personal data.
- Cleanup or reset instructions when tests create persisted records.

Database-backed tests require an isolated `TEST_DATABASE_URL`. It must be different from the normal `POSTGRESQL_URL` and must never reference a production database. The PostgreSQL API suite validates the prepared schema and fixtures; it does not create, migrate, or reset the database for the team.

### 4. Access and authentication

Provide QA with:

- Test accounts for every required role and the role each account represents.
- A secure method to receive credentials or establish a test session.
- Any OAuth, cookie, MFA, allow-list, or identity-provider prerequisites.
- Expected authorization behavior: who can view, create, edit, delete, or export each resource.

Protected browser workflows need a repeatable authenticated-session setup. Do not assume a tester's local browser is already logged in.

### 5. External dependencies

If the feature uses an external service, identify it before handoff:

- Google OAuth or Google review integrations.
- PostgreSQL, MongoDB, object storage, and media uploads.
- LLM/model providers, transcription services, queues, server-sent events, or email-like notifications.
- Browser requirements and any Playwright browser-path setup.

State whether the QA environment uses a sandbox, mock, recorded fixture, or live test account. Provide safe failure behavior and an owner to contact if the provider is unavailable.

### 6. API and contract changes

For every changed endpoint or shared DTO, provide:

- Method, path, authentication requirement, and authorization rule.
- Valid request example and expected response/status.
- Invalid request examples and expected error response/status.
- Compatibility expectation for existing Frontend and Backend consumers.
- Any persistence side effect, event emission, or asynchronous processing expectation.

Contract changes must have focused producer and consumer test evidence. A successful manual request alone is not sufficient evidence that existing consumers remain compatible.

## Developer handoff checklist

Complete this checklist before requesting QA sign-off:

- [ ] Acceptance criteria and non-goals are written and linked.
- [ ] The target branch/build/commit is identified.
- [ ] Changed areas, roles, APIs, data effects, and external dependencies are listed.
- [ ] Required fixtures, test accounts, and setup instructions are available.
- [ ] Database testing uses the isolated `TEST_DATABASE_URL` where applicable.
- [ ] Focused automated tests for changed behavior pass.
- [ ] Relevant API contract, authorization, and persistence tests pass.
- [ ] Relevant lint, Prettier check, type check/build, and `git diff --check` pass.
- [ ] Known defects, skipped checks, and remaining risks are disclosed.
- [ ] There are no secrets, production credentials, or production personal data in source, logs, or handoff notes.

## QA start checklist

QA begins formal testing when:

- The handoff checklist is complete and the build is accessible.
- Testers can authenticate as the required roles.
- Required fixture data is present and identifiable.
- The expected behavior is clear enough to write pass/fail results.
- Dependency availability and fallback expectations are known.
- Open defects are triaged, with release-blocking status agreed.

If any item is missing, QA should record the work as **blocked**, explain the exact missing prerequisite, and avoid treating an untestable behavior as passed.

## What QA will return

QA will provide a test run report containing:

- Scope, tested build/commit, environment, roles, and data fixtures.
- Test cases and automated commands run, with pass/fail results.
- Defects with reproduction steps, actual versus expected result, severity, priority, and evidence.
- Tests blocked or not run, with their exact reason.
- Residual risks: behavior that remains unverified.
- A release recommendation: **ready**, **ready with accepted risks**, or **not ready**.

## Copy-ready handoff message

> **QA handoff: <feature name>**
>
> - Build/commit: `<SHA or URL>`
> - Scope: <user-visible behavior and affected roles>
> - Acceptance criteria: <link>
> - Environment: <base URLs and version>
> - Test data/accounts: <secure location and fixture IDs>
> - API/contracts: <link or examples>
> - Dependencies: <database, provider, browser, feature flag, mock/live status>
> - Automated evidence: <focused tests and quality checks run>
> - Known issues/risks: <list or none>
> - Requested QA focus: <highest-risk workflows and boundaries>

## Shared responsibility

QA owns independent verification, clear evidence, defect reporting, and risk communication. Developers own implementation quality, focused regression tests, reliable setup instructions, and correcting defects. Product owners own clear acceptance criteria and release-risk decisions. No team member should claim a feature is tested when a required environment, account, fixture, or expected outcome was unavailable.
