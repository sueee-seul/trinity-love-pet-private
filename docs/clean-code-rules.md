# Clean Code Standards and Best Practices

This document defines the expected practices for clear, maintainable, and reliable code across our React, TypeScript, and Node.js code.

These are engineering standards. The presence of a rule does not prove that the current codebase complies with it; compliance must be checked against the changed code and the relevant verification evidence.

## 1. General Clean Code Rules

The following rules apply to every language, component, module, service, test helper, and documentation example in this project.

1. **Use clear and meaningful names.** Name variables, functions, files, and components according to their purpose. Avoid names such as `data`, `temp`, `x`, or `handler2` unless the meaning is genuinely obvious from the local context.
2. **Give each function, component, or module one clear responsibility.** If it performs unrelated jobs, split those responsibilities into appropriately named units.
3. **Keep functions small and focused.** A function should be understandable without scrolling through a large block of unrelated logic. Split long or multi-purpose functions when doing so clarifies responsibility and behavior.
4. **Avoid duplicated logic.** When the same logic appears repeatedly, especially three times, extract it into a reusable function, component, or service when the shared behavior is real and stable.
5. **Write comments that explain why.** Do not use comments to repeat what the code already says. Add documentation for behavior, constraints, business rules, non-obvious decisions, or invariants that a clear name and structure cannot explain.
6. **Remove dead and temporary code.** Do not leave unused imports, unreachable code, commented-out code, temporary debugging statements, or abandoned implementation fragments.
7. **Avoid magic numbers and magic strings.** Use named constants, enums, or meaningful union values for repeated or semantically important values.
8. **Separate business logic from UI and infrastructure logic.** Keep React components focused on presentation and interaction, keep API routes/controllers focused on transport concerns, and keep business rules in the appropriate service or domain layer.
9. **Reuse existing types and contracts.** Do not create duplicate shapes for the same concept. Keep API request and response structures consistent between Frontend and Backend.
10. **Handle errors explicitly.** Do not silently ignore failures or use empty `catch` blocks. Preserve useful context, use the project's error-handling boundary, and make expected failure behavior clear.
11. **Validate data at system boundaries.** Validate API input, external data, AI output, and database-related identifiers before trusting them. Keep boundary validation close to the boundary that receives the data.
12. **Follow the existing project structure and naming conventions.** Reuse established architectural patterns and module locations. Do not introduce a new pattern solely because generated code makes it convenient.
13. **Keep refactoring bounded to the task.** Do not refactor unrelated code while implementing a feature or fixing a defect. Separate opportunistic cleanup from the requested change.
14. **Test changed behavior.** When behavior changes, add or update the smallest relevant test that proves the intended behavior, including important failure or boundary cases. Tests should provide behavioral evidence rather than only increase coverage.
15. **Complete all applicable quality checks.** Before considering a change complete, run formatting, linting, type checking, and relevant tests when those checks apply. Treat these as separate forms of evidence; one passing check does not replace another required check.

## 2. React Clean Code Standards

React clean code focuses on component design, state management, and project architecture.

- **Single Responsibility Principle (SRP)**: Each component should do one thing. If a component is handling API calls, complex state logic, and UI rendering, it should be broken apart. Extract business logic, data fetching, and state management into custom hooks to keep UI components declarative.
- **Keep Components Small**: Avoid "mega-components". Split a component when its purpose cannot be explained in a single sentence or when its size makes its state and rendering logic difficult to review.
- **Feature-Based Organization**: Instead of grouping files by type (for example, all components in one folder and all hooks in another), group them by feature. Use colocation to keep related files (`UserCard.tsx`, `useUser.ts`, `userApi.ts`) together.
- **Modern State Management and Performance**: Keep state as local as possible. For server-side async state, use tools such as TanStack Query (React Query). For lightweight global state, use Zustand. Avoid using array indices as `key` values in lists, and prefer derived state over unnecessary `useEffect` calls.

## 3. TypeScript Clean Code Standards

TypeScript clean code leverages the type system as automated documentation and a compile-time error catcher.

- **Leverage the Type System**: Provide explicit types for variables, function parameters, and return values where inference does not make the contract clear. **Never use `any`**; use `unknown` and type narrowing when the type is genuinely uncertain.
- **Precise Data Modeling**: Use discriminated unions and precise interfaces to model the domain accurately. Make invalid states unrepresentable where practical.
- **Reusable Type Definitions**: Use built-in utility types such as `Partial`, `Readonly`, `Record`, `Pick`, and `Omit` when they remove real duplication without obscuring the contract.
- **Keep Shared Contracts Consistent**: Reuse the established DTOs, interfaces, schemas, and shared values instead of defining competing frontend and backend shapes.

## 4. Node.js Clean Code Standards

Node.js applications, often acting as backend services, require clear architectural layering, asynchronous handling, validation, and error management.

- **Layered Architecture**: Do not write business logic directly inside Express or Fastify route handlers. Use the project's established layers:
  1. **API/Controller Layer**: Handles HTTP requests, boundary validation, authorization checks, and responses.
  2. **Service Layer**: Contains core business logic and workflow orchestration.
  3. **Data Access Layer**: Manages database interactions and persistence concerns.
- **Async Handling and Error Management**: Use `async/await` consistently where asynchronous work is required. Propagate or handle errors at the intended boundary so failures are observable and do not silently disappear.
- **Security and Validation**: Never trust user or external input. Use the validation library already adopted by the project for strict input validation. Manage environment variables and secrets through `.env` or `.env.local` configuration; never hardcode keys, credentials, or connection strings in source code.

## 5. Tooling and Enforcement

Tooling should support the standards rather than replace engineering judgment.

- **ESLint**: Use linting to catch anti-patterns and potential bugs, including forbidden `any` usage and invalid React hook usage where configured.
- **Prettier**: Use the project's formatter to keep indentation, quotes, spacing, and Markdown formatting consistent.
- **Type Checking**: Run the applicable TypeScript or Python type checks when the changed package and repository configuration provide them.
- **Relevant Product Tests**: Run focused tests for changed behavior and record them separately from linting, formatting, type checking, builds, and repository preparation.
- **Husky and lint-staged**: Use the configured pre-commit checks when committing. These hooks support quality enforcement but do not replace the required behavioral tests or type checks.
