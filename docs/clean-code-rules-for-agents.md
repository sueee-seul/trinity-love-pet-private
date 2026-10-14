# Clean Code Rules for Agents

This is the execution-oriented version of [`clean-code-rules.md`](./clean-code-rules.md) for AI agents working in Trinity.

The general document is the source of truth for the principles. This document translates those principles into actions and completion gates. It does not prove that the current codebase complies with any rule. The repository's `agents.md`, database controls, security rules, and user-approved scope take precedence if there is a conflict.

## 1. Before editing

Complete these checks before planning implementation or modifying a file:

1. Read `docs/clean-code-rules.md` and identify the rules that apply to the changed files.
2. Read the relevant local architecture, types, contracts, tests, and existing feature patterns.
3. Confirm the exact scope, non-goals, and ownership boundary. Preserve unrelated dirty-worktree changes.
4. Prefer an existing abstraction, type, contract, naming pattern, and module location when it fits.
5. If the task is a bug fix, reproduce the defect and establish the root cause before changing behavior.

## 2. While implementing

Use this checklist for every changed function, component, module, service, route, schema, and test helper:

1. Use names that describe purpose. Treat generic names such as `data`, `temp`, `x`, and `handler2` as a review signal unless their meaning is genuinely obvious.
2. Keep one responsibility per function, component, and module. Split unrelated UI, state, business, transport, and persistence work at the correct boundary.
3. Keep functions small enough to understand without scrolling through unrelated logic.
4. Extract repeated logic only when the shared behavior is real. Do not create speculative helpers or abstractions.
5. Make comments explain why, constraints, business rules, invariants, or non-obvious decisions. Delete comments that only narrate syntax.
6. Remove unused imports, dead branches, unreachable code, commented-out code, and temporary debugging output within the approved scope.
7. Replace meaningful or repeated magic numbers and strings with named constants, enums, or union values.
8. Keep business logic out of React rendering and API transport code. Keep database access out of UI components and unrelated services.
9. Reuse existing DTOs, interfaces, schemas, and shared values. Check both Frontend and Backend consumers when an API contract is involved.
10. Handle errors explicitly. Never add an empty `catch`, silent fallback, or ignored promise that hides a failure without a documented reason.
11. Validate API input, external data, AI output, and database identifiers at the boundary where they enter the trusted system.
12. Follow the repository's existing folder, import, naming, test, and architectural conventions. Do not introduce a generated pattern merely because it is available.
13. Keep cleanup and refactoring limited to the requested behavior or the smallest change needed to make it safe.
14. Add or update focused tests whenever observable behavior, business rules, state transitions, persistence, authorization, security, or a data contract changes.
15. Treat formatting, linting, type checking, builds, preparation, and product tests as separate checks. Do not use a green lint or format result as evidence that behavior is correct.

## 3. Before declaring completion

Run the smallest sufficient checks for the changed boundary and record the evidence:

- Re-read the exact changed files and inspect the final diff.
- Confirm that every changed public contract, type, route, component, service, and non-obvious invariant is still described accurately.
- Run relevant focused product tests for changed behavior. Include failure and boundary cases when the behavior requires them.
- Run applicable formatting, linting, type checking, build, and repository-preparation checks as separate checks.
- Run `git diff --check` for whitespace and patch problems.
- If a check is skipped, state the named exemption or exact reason. Do not report a skipped check as passed.
- Report what was inspected statically, what was verified by tests, what was verified at runtime or through an external provider, and what remains unverified.

## 4. Scope and safety reminders

- Do not modify `Backend/database/neon.sql`.
- Do not add or remove database columns without explicit approval for that exact schema change.
- Do not change unrelated files merely to make a quality check pass.
- Do not claim current compliance from the existence of this document, a plan, a green unrelated suite, or a static lint result alone.
