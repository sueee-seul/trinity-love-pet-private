# Admin & Pet Parent Login Feature

## Overview

Trinity uses a dual-login system for pet parents and administrators. The system is built with a strict 3-tier architecture on the backend and uses **Zustand** for frontend global state management.

## Features

- **Google OAuth Integration**: Users can log in quickly using their Google accounts via `@react-oauth/google`.
- **Password Authentication**: Traditional email and password login flow.
- **Database-backed Password Verification**: Password login looks up `users.email` and compares the submitted password with `users.password_hash` in PostgreSQL. Signup creates the `users` and `pet_owners` records in one transaction.
- **Strict Password Validation**: Passwords must be 8-32 characters long, containing at least one number and one symbol. Validation is enforced on both frontend and backend; surrounding whitespace, mismatched confirmation, and passwords containing personal information are also rejected during signup.
- **Signed Cookie Session**: Successful password or Google login sets a signed, HttpOnly cookie. The token contains only the local user UUID, application session version, issued-at time, and expiry time; the current user and role are loaded from PostgreSQL on protected requests.
- **Password Recovery**: The Login password step links to `/forgot-password`. A valid recovery request returns the same generic response for known and unknown emails. A local/test reset URL is exposed only when `EXPOSE_LOCAL_PASSWORD_RESET_URL=true`; production never exposes it through this response.
- **Session Hydration**: The frontend calls `GET /api/auth/me` after reload. The session cookie is not exposed to JavaScript or stored in localStorage.
- **Dynamic UI**: Navbars and access controls react instantly to the `isAuthenticated` state in the `authStore`.
- **English and Chinese**: The sign-in, sign-up, forgot password, reset and first sign-in pages follow the site language, and each card has a 中文/English switch. Every word is in `Frontend/src/shared/auth/authCopy.ts`. The server writes its messages in English, so Chinese pages match each fixed message, or each field rule by its `code`, to Chinese, and show the page's own sentence for anything else. Errors are kept as what happened, so a language switch rewords them. The Google button is drawn in the page language (`zh_CN` for Chinese). The forms check addresses themselves (`noValidate`), because the browser words its own warnings in the browser's language.

## Workflow

1. User enters their email on the `/login` page.
2. System checks if the email is registered via `authApi.checkEmail`.
3. If registered, the user is prompted for their password.
4. If the password format is invalid, the frontend blocks the request. If valid, it is sent to `authApi.loginWithPassword`.
5. Upon success, the backend sets the signed session cookie and returns the public User Object.
6. The frontend `authStore` stores the current user in memory, and the UI (like `PetParentNavbar`) updates to show the user's profile and a Sign Out button.

## Password recovery

The public password recovery flow is separate from the authenticated employee first-login flow:

1. From the password step on `/login`, the user selects **Forgot password?**.
2. `/forgot-password` submits the email to `POST /api/auth/password-reset/request`.
3. The Backend returns the same generic response whether the email exists or not, preventing account enumeration.
4. In local/test environments, an existing account with a non-null `users.password_hash` receives a reset URL only when `EXPOSE_LOCAL_PASSWORD_RESET_URL=true`. The URL contains a short-lived signed token; the token is not stored in the database.
5. `/reset-password?token=...` reuses the existing Set your password form and submits to `POST /api/auth/password-reset/complete`.
6. The Backend verifies the token and its password-hash fingerprint, then atomically replaces the existing `users.password_hash` with a PostgreSQL `crypt` hash.
7. A successful reset does not create a session. The Frontend returns to `/login` and displays `Password reset successfully. You can now sign in.`

The token becomes unusable after the password changes because its fingerprint no longer matches the current hash. The flow does not add a reset-token table, columns, migration, runtime schema operation or `must_change_password` field. Production email delivery remains a separate integration because this repository has no configured email provider.

After normal or Google signup succeeds, the Frontend also returns to `/login` with the transient notice `Account created successfully. You can now sign in.` The notice is passed through router state rather than a URL query parameter or browser storage.

## Session boundary

`GET /api/auth/me` verifies the signed cookie and reloads the current user and role from the database. The
session lasts up to eight hours and survives page reloads, but it is not a persistent remember-me session.
`POST /api/auth/logout` clears the browser cookie only. This demo does not maintain a server-side session
table or revoke a stolen cookie before its expiry.

The feedback boundary uses the session as follows:

- Pet Parent feedback submission requires an authenticated `pet-parent` user. The backend derives the
  feedback owner from the verified user identity and checks that the selected pet belongs to that owner.
- Existing admin feedback routes require an authenticated employee. Staff and manager permissions remain
  coarse for this demo; fine-grained role and pet visibility rules are deferred.
- Existing Google ID token verification remains the login boundary. Google credentials are exchanged for
  the local application cookie and are not used as the credential for later API requests.

## Signup persistence

The Pet Parent signup flow collects the required account and profile fields, then sends them to `POST /api/auth/signup`. The backend validates the payload again, hashes the password with PostgreSQL `pgcrypto`, inserts the `users` record with role `pet_owner`, and inserts the required `pet_owners` fields in the same transaction. Passwords and hashes are never returned to the client.
