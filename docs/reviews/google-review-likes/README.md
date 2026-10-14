# Google review likes: behaviour evidence

Screenshots captured from the running application, not mockups. They were produced by an
end-to-end run against the real frontend, the real backend, and the Neon test database, using a
real signed `maps_reviewer_session` cookie. Nothing was stubbed.

| Screenshot                                                         | What it shows                                                                                                         |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [01-signed-out-count-visible.png](01-signed-out-count-visible.png) | A signed-out visitor sees the like total. Tapping the button opens the reviewer sign-in flow and writes nothing.      |
| [02-signed-in-liked.png](02-signed-in-liked.png)                   | After a signed-in reviewer likes, the count rises and the thumb fills. `aria-pressed` becomes `true`.                 |
| [03-persisted-after-reload.png](03-persisted-after-reload.png)     | The like survives a full page reload, so it is stored in the database rather than held in React state.                |
| [04-unliked.png](04-unliked.png)                                   | Tapping again removes the like. The row is deleted and the button returns to its unliked state.                       |
| [05-two-reviewers-stack.png](05-two-reviewers-stack.png)           | Two different reviewers each count once, so the total reads 2.                                                        |
| [06-full-page-layout.png](06-full-page-layout.png)                 | The surrounding page layout is unchanged; the like button occupies the position its disabled placeholder already had. |

## Reviewer identity change

A second round of screenshots covering the fix for stale like state when the signed-in reviewer
changes. Two distinct reviewer sessions on one review.

| Screenshot                                                                       | What it shows                                                                                                                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [08-fix-1-signed-in-not-liked.png](08-fix-1-signed-in-not-liked.png)             | Reviewer A is signed in and nobody has liked the review yet.                                                                                       |
| [09-fix-2-account-a-liked.png](09-fix-2-account-a-liked.png)                     | Reviewer A likes it. The count reads 1 and the thumb is filled.                                                                                    |
| [10-fix-3-signed-out-count-kept.png](10-fix-3-signed-out-count-kept.png)         | A signs out. The count stays at 1, because the like still belongs to A, but the thumb returns to its outline: it is no longer the viewer own like. |
| [11-fix-4-account-b-liked-both-kept.png](11-fix-4-account-b-liked-both-kept.png) | Reviewer B signs in and likes. The count reads 2. B adding a like did not remove A.                                                                |

Before the fix, step 10 kept the filled thumb and step 11 removed A like instead of adding B.

The reviewer shown is `Postgres Reply Reviewer`, a fixture identity that already exists in the test
database. It is not a real customer.

See `docs/external-feedback-system-v2.md` sections 3, 9, and 10 for the route trace, the schema,
and the test-to-contract map.
