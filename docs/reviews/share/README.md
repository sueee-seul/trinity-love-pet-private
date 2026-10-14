# Review sharing: behaviour evidence

Screenshots for this feature are attached to the pull request description, not committed to the
repository. What follows is the written record of the same run.

The run drove the real Vite frontend in Chromium through Playwright, against the **real Backend and
the real Neon data**: 30 live reviews, nothing stubbed. The reviewer named below, `Andrew`, and the
review id `00000000-0000-4000-8000-000000000606` are real rows.

## What was exercised

| Step                                  | Behaviour confirmed                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Public review page                    | Every review carries a Share action beside its Like button, and the surrounding layout is otherwise unchanged. |
| Opening the dialog                    | The dialog appears over the dimmed page and takes focus.                                                       |
| Copying                               | The button reads `LINK COPIED` only after the browser clipboard actually received the link.                    |
| Following the link as a new recipient | The link was opened in a fresh tab. That review is scrolled to and highlighted; no other card is.              |

## Values read back from the browser during the same run

| Check                                     | Observed                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Reviews loaded from the real API          | 30                                                                                       |
| Clipboard contents after copy             | `http://localhost:5173/maps/place/PetHouse/?review=00000000-0000-4000-8000-000000000606` |
| Copy announcement                         | `Link copied to the clipboard.` in the dialog's `role="status"` region                   |
| Focus on open                             | the dialog element                                                                       |
| Focus after Escape                        | returns to `Share Andrew's review`                                                       |
| Email channel `target`                    | absent, so a mail client does not strand an empty tab                                    |
| Facebook, X, WhatsApp `target`            | `_blank`                                                                                 |
| Recipient opening the link in a fresh tab | lands on `review-00000000-0000-4000-8000-000000000606`, carrying the highlight class     |
| Cards highlighted on that page            | 1, only the shared one                                                                   |
| Page scrolled away from the top           | yes                                                                                      |
| `/api/` requests caused by sharing        | 0                                                                                        |

That last row is the one worth keeping. Every `/api/` request made during the session was logged,
and sharing added none: the page issued only the requests it already made before this feature
existed. Opening the dialog, copying the link, and following a shared link produce no server
traffic at all, which is why this feature has no backend part.

See `docs/external-feedback-system-v2.md` section 12 for the link contract and the
test-to-contract map.
