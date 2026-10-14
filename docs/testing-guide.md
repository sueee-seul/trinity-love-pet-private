# Testing Guide

## Overview

Trinity enforces strict testing and code quality rules. Before pushing to a feature branch, all tests must pass and the linter must report 0 warnings to ensure robust deployments.

## Running Tests

To run tests across the backend:

```bash
npm run test --prefix Backend
```

To run the Main-schema PostgreSQL API read-back suite, use the isolated Neon database configured in
`TEST_DATABASE_URL`. The command validates the auth, staff, Pet, `employee_assignments`, feedback,
and Google review tables and columns covered by the PostgreSQL API tests against `Backend/database/neon.sql`,
checks the required seed fixtures,
serializes concurrent test runs with a PostgreSQL advisory lock, and runs the API integration tests
without starting Docker, recreating a database, or applying schema at test time. It never falls back
to the normal `POSTGRESQL_URL`.

```bash
npm run ci:api:postgres
```

The local CI command runs the Backend unit phase and then the Neon PostgreSQL API phase. The normal
application connection is the pooled Neon URL in `POSTGRESQL_URL`; the API test process receives the
isolated `TEST_DATABASE_URL` as its temporary `POSTGRESQL_URL` value. PostgreSQL integration tests use
a 20-second test timeout and a 30-second hook timeout to allow normal remote Neon latency while
remaining bounded.

The Neon PostgreSQL CI job uses `NEON_TEST_DATABASE_URL` for API traffic. It must point to an isolated
Neon test database that has been prepared from `Backend/database/neon.sql`. The API test phase never
drops, recreates, or migrates an existing database.

To run tests across the frontend:

```bash
npm run test --prefix Frontend
```

## End-to-End Tests (Playwright)

`playWright/parent-feedback.persistence.spec.ts` drives the pet-parent feedback form in a real
browser and asserts the submission actually persists to PostgreSQL. It queries the database
directly after submitting, rather than only checking the UI.

Prerequisites, beyond the unit/integration test setup above:

- A Neon PostgreSQL database prepared from `Backend/database/neon.sql` with the fixed owner/pet seed
  rows required by the spec. `npm run db:up` from the repository root is an optional local alternative
  and applies the Docker initializer only when its volume is new.
- `TEST_DATABASE_URL` pointing at that isolated test database. When the command runs from the
  repository root, the spec loads it from the root `.env.local` if present (`process.loadEnvFile`), or
  from the environment; it throws immediately if `TEST_DATABASE_URL` is not set. The Playwright
  Backend child process receives that test value as `POSTGRESQL_URL` only for the test run.
  `DATABASE_URL` is not supported.
- The current spec calls the protected parent feedback endpoint but does not perform a login or load
  a saved browser session. A fresh checkout therefore needs the session setup expected by the local
  test environment, or the spec must be extended before this can be treated as a green authenticated
  smoke test.
- A Playwright browser available: on macOS it auto-detects a system Chrome install, otherwise set
  `PLAYWRIGHT_BROWSER_PATH` or run `npx playwright install` once to fetch Playwright's own browser.

Run it with:

```bash
npm run test:e2e:parent-feedback
```

This starts its own Backend and Frontend dev servers (`reuseExistingServer: false`) on ports 3000
and 5173, so stop any copies you already have running first to avoid a port conflict.

## Known Testing Quirks

### Supertest & Multer

When testing file uploads in Express using `supertest` alongside `multer`, you may encounter an issue where the request hangs or throws a proxy error if the body is completely empty or missing required fields.

**Solution**:
Always pass `.send({})` or `.field('payload', JSON.stringify(...))` to properly trigger Multer's parsing sequence in the test runner.
Example:

```typescript
const response = await request(app)
  .post('/api/feedback')
  .field('payload', JSON.stringify(mockData))
  .attach('audio', 'mock_audio.webm'); // Ensure headers are correct
```

## Code Quality & Linting

Root ESLint must finish with zero warnings. The following rules are errors:

- `react/no-array-index-key`
- `react/button-has-type`
- `react/self-closing-comp`
- `no-duplicate-imports`
- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/explicit-function-return-type`
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/no-inferrable-types`
- `@typescript-eslint/no-non-null-assertion`
- `react-hooks/exhaustive-deps`

The `no-console` rule has not been added yet. Node server operational and error logs, as well as deferred privacy logging, require a separate phase to handle correctly.

Run the local quality gate with:

```bash
npm run ci:quality
```

The pre-commit hook runs lint-staged: ESLint with auto-fix and zero warnings, followed by Prettier on staged files. GitHub Actions runs the same root quality gate in the `quality-gate` job.
