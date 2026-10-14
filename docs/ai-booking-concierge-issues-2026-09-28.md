# AI booking concierge: issues found and fixed (2026-09-28)

中文版见下半部分 · Chinese version follows the English one.

---

## English

### Scope

This report covers the AI booking concierge (`/book`, `/parent/booking`) and the code written for
it: `Frontend/src/features/concierge`, `Frontend/src/shared/dictation`, `Backend/src/services/concierge`,
the concierge contract, controller, routes and repository, the speech stream service, and
`Backend/src/services/booking.pricing.ts`. Other teams' code was not changed; problems found there
are listed under "Open items".

Sources of the findings:

- **Before review**: a competitor research pass (6 research lanes plus a critic), a cold-user
  walkthrough, and my own checks while building.
- **Adversarial review**: 5 reviewers (state and recovery, security and privacy, backend logic,
  accessibility and bilingual copy, contract and tests), each finding re-checked by an independent
  verifier. 36 findings were confirmed; 31 remain after merging duplicates.

Every issue below is **fixed** and covered by an automated test unless marked otherwise. Nothing is
committed yet.

Severity: **High** = wrong price, wrong booking, security or a guest cannot finish. **Medium** =
wrong data, broken recovery, privacy or accessibility gap. **Low** = confusing but recoverable.

### A. Found before the review

| ID  | Sev.   | Problem                                                                                                                                   | Fix                                                                                                                                |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A1  | High   | Every new guest's booking failed at the last step: the server required the guest's own mobile (`contact.phone`) but the page never asked. | "Your mobile" field, checked with the same phone rule as the server; errors shown at each field.                                   |
| A2  | High   | The card said "Price held until …", but checkout refused an agreed quote if the catalogue price had changed since.                        | Checkout books at the agreed prices; it refuses only if a quoted service no longer exists.                                         |
| A3  | High   | In production no email code can be sent, so new guests hit a dead end only after planning and agreeing.                                   | `GET /api/concierge/status`; the page says so up front and offers "Send this plan to our team" (mail app, copy, phone).            |
| A4  | High   | "Two dogs, one needs medication" charged medication for both dogs; "12 to 15 October" (the chat box's own example) was not understood.    | English month names, ordinals and durations; a detail that could belong to any pet is asked about ("Which pet takes medication?"). |
| A5  | High   | A reload (for example a phone discarding the tab while the guest reads the code) lost the whole plan; browser Back left the booking.      | Plan kept in `sessionStorage` for the tab (no contact details); each step has its own history entry.                               |
| A6  | Medium | The assistant told guests their health notes would reach staff, but chat notes were never sent with the booking.                          | Notes are carried into the details step's care notes, visible and editable.                                                        |
| A7  | Medium | The terms summary promised a card-hold process and free cancellation that nobody had approved.                                            | Copy limited to what the system does today; policy items listed as business decisions.                                             |
| A8  | Medium | Buttons were greyed out with no reason; keyboard users could not find out what was missing.                                               | Buttons stay enabled; pressing lists what is missing and moves focus to the first problem.                                         |
| A9  | Medium | Errors, screen-reader labels and dictation errors were English on the Chinese page.                                                       | Errors mapped by server code to EN/ZH; all labels translated.                                                                      |
| A10 | Medium | The in-place email re-check sat inside the booking form (forms cannot nest): Enter in its field would submit the booking form.            | Moved outside the form.                                                                                                            |
| A11 | Low    | A dog's size held back the price although size changes no price.                                                                          | Size is asked once after the options appear.                                                                                       |
| A12 | Low    | "One is large, one is small" gave both dogs the same size.                                                                                | Two sizes, or one dog singled out of several, is left for the guest to set.                                                        |
| A13 | Low    | After verifying, focus went to the page title instead of the step heading; a lapsed email check bounced the guest back a screen.          | Focus waits one frame for the heading; the details step renews the check in place.                                                 |

### B. Adversarial review findings

**Prices and quotes**

| ID  | Sev.   | Problem                                                                                                                                         | Fix                                                                                                          |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| B1  | High   | If a re-price failed after the guest changed the plan, the old packages stayed agreeable: the server would book the old dates at the old price. | The store remembers which plan the packages were priced for; stale packages lock Agree and show "Try again". |
| B2  | High   | Editing the checklist while Agree was in flight accepted the old quote, while the details, confirmation and calendar file showed the new dates. | An agreement that returns after the plan changed is discarded; details and confirmation use the agreed plan. |
| B3  | Medium | A checklist tick during a chat reply cancelled the reply and dropped the details it had read; a tick during a re-price could be overwritten.    | Checklist pauses while the assistant replies; ticks made during a re-price are kept and priced next.         |
| B4  | Low    | A plan restored with expired prices, or reached again from a later step, could show no options at all.                                          | Options are re-priced whenever they do not match the plan (once per version of the plan, no loops).          |

**Rules assistant (reading what guests type)**

| ID  | Sev.   | Problem                                                                                                                       | Fix                                                                                          |
| --- | ------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| B5  | High   | "She doesn't need any medication" / "不需要吃药" was read as a yes and charged every pet.                                     | Negations are never a yes; clear "no" phrases apply to all pets.                             |
| B6  | High   | "My dog needs medication" (dog + cat) charged the cat too.                                                                    | "my/our dog(s)", pet names and plurals pick the pet; anything unclear is asked.              |
| B7  | High   | "1/2 cup" in a feeding note replaced the chosen dates; "2026/11/01" and "12/10/2027" were misread; "24/7 care" became a date. | Guards for fractions, years and 24/7; chosen dates change only for a message about the stay. |
| B8  | High   | "And the other one is a cat" shrank a two-pet plan to one cat and quoted it.                                                  | Open species are filled in; the pet list is never shrunk by a mention.                       |
| B9  | High   | "2026年10月12日到2026年10月15日" was read as 12 to 20 October.                                                                | Chinese dates with years are read correctly.                                                 |
| B10 | Medium | "October 12 to 15 November" became 12-15 November; "2 October - 3 dogs, 4 nights" became a 1-night stay.                      | Mixed month order supported; counts after a date are not read as the end day.                |
| B11 | Medium | "好的" was never understood as yes, and a "yes" after a "didn't catch that" reply looped forever.                             | Chinese yes words recognised; the service question is matched at the end of the reply.       |
| B12 | Low    | The "which pet?" question said "tap it below" when there was no such button; the natural answer "the cat" was not understood. | Copy points to the checklist; "the cat", "pet 2", "both", "none" are understood.             |

**Booking data**

| ID  | Sev.   | Problem                                                                                                                         | Fix                                                                                                         |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| B13 | Medium | Saved-pet links followed list position: after a plan change a different saved pet (even another species) could be booked.       | Links are kept only while the position still holds that pet; the details rows rebuild when the pets change. |
| B14 | Low    | The server never compared a saved pet's species with the quoted pet.                                                            | Refused with `CONCIERGE_PET_SPECIES_MISMATCH`; the page only offers saved pets of the same kind.            |
| B15 | Medium | The size and medication flag the concierge collected were thrown away at checkout.                                              | Written to existing fields staff read (medication instructions, care notes). No column change.              |
| B16 | Medium | An emergency number such as "+64 (0) 21 - 555 - 0101" passed validation but is longer than `VARCHAR(20)`: 500 at the last step. | Numbers stored without spaces or brackets; length checked on the page.                                      |
| B17 | Medium | A saved pet name over 60 characters made every chat and re-price fail.                                                          | Names shortened to the server limit in the plan.                                                            |
| B18 | Medium | Long dictation could exceed the 2,000-character message limit, after which every turn failed until Start over.                  | Messages capped at 2,000 characters for typing and dictation.                                               |
| B19 | Low    | The page did not check maximum lengths; a too-long breed showed its error on the name field.                                    | Maximum lengths mirrored from the server; breed errors shown on the breed field.                            |

**Security and privacy**

| ID  | Sev.   | Problem                                                                                                                                                                               | Fix                                                                                                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| B20 | High   | Normal sign-up does not verify email. Someone could register a victim's email with their own password; the victim's email code then signed them into that account and booked onto it. | A code never signs into, or books onto, an account that has a password (`CONCIERGE_PASSWORD_ACCOUNT`). |
| B21 | Medium | The privacy note said saved progress is cleared after sending, but the chat, notes, pet names and email stayed in the tab.                                                            | After sending only the reference and dates stay; the note says exactly that.                           |
| B22 | Medium | The fallback contact `bookings@example.co.nz` is a domain anyone can register, and the plan hand-off sent guests' plans there.                                                        | No fallback address; email is offered only when a real one is configured.                              |
| B23 | Low    | Anyone could lock a victim's email for 24 hours with about a dozen requests.                                                                                                          | Spent codes keep the resend cooldown; locks start at 15 minutes and double up to 24 hours.             |
| B24 | Medium | After a successful booking, a failed session refresh showed the booking as failed (a resend could create a second booking).                                                           | The confirmation is shown first; a session refresh failure is ignored.                                 |

**Accessibility and bilingual copy**

| ID  | Sev.   | Problem                                                                                                | Fix                                                                                               |
| --- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| B25 | Medium | Keyboard focus fell to the page body after a chip tap, Start over and code sign-in.                    | Focus moves to the next question, the chat heading or the dialog's Close button.                  |
| B26 | Medium | Price units other than "per night" appeared in English on the Chinese page.                            | Units translated; an unknown unit shows nothing rather than raw English.                          |
| B27 | Medium | The tab title stayed "Plan your pet's stay" on every portal page afterwards.                           | Original title restored when the page closes.                                                     |
| B28 | Medium | "Do it now" links for vet consent, temperament and vet details went to a page that cannot do them.     | Only vaccination links to its page; the others say the team will go through them before drop-off. |
| B29 | Medium | The sticky "See your options" bar was broken inside the parent portal on phones.                       | Shown only on the public page.                                                                    |
| B30 | Low    | Every checklist tick announced "The assistant is thinking" and showed "Sending…" though no reply came. | Only chat messages and tapped answers show that.                                                  |
| B31 | Low    | Browser Back from the details step needed two presses.                                                 | Back walks to the nearest step that still applies; signed-in owners skip the verify entry.        |

### C. Open items (not changed)

| ID  | Where                             | Item                                                                                                                                              | Owner         |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| C1  | Shared `createBooking` repository | Test payments are recorded as succeeded/`paid`, so the portal may show "payment completed". The concierge confirmation says no payment was taken. | Booking owner |
| C2  | Auth                              | Sign-up does not verify email; forgot-password refuses passwordless accounts.                                                                     | Auth owner    |
| C3  | Repository history                | Commit `4265ca3` put real credentials in `Backend/.env.example`. Rotate those keys.                                                               | Team          |
| C4  | Concierge                         | Verification codes and the one-booking-per-agreement registry are in memory: one API instance only.                                               | Us, later     |
| C5  | Business                          | Handover hours, cancellation policy, reply time, meet-and-greet, real team email/phone, email provider (SES), payments (Stripe).                  | Facility      |
| C6  | Other teams' tests                | 5 tests were already failing: Frontend `AdminNavbar`, `FeedbackSidebarList`; Backend `feedback.api` (3).                                          | Their owners  |

### Verification

- Backend: 805 tests pass (187 for the concierge and speech); type check and ESLint clean.
- Frontend: 892 tests pass (60 for the concierge); type check, oxlint and ESLint clean; production build succeeds.
- Browser (local preview): full flow from tap-to-answer to confirmation; reload during the code step; Back from the
  confirmation; phone width; a failed re-price locks Agree and recovers with "Try again".

---

## 中文

### 范围

本报告只涉及 AI 预约助手（`/book`、`/parent/booking`）以及为它写的代码：
`Frontend/src/features/concierge`、`Frontend/src/shared/dictation`、`Backend/src/services/concierge`、
预约助手的接口约定、控制器、路由和数据访问、语音流服务，以及 `Backend/src/services/booking.pricing.ts`。
其他同学的代码没有改；在那里发现的问题列在"遗留事项"里。

问题来源：

- **审查之前**：竞品调研（6 路研究加 1 个挑刺角色）、新用户走查，以及我搭建时自己发现的。
- **对抗式审查**：5 个审查角度（状态与恢复、安全与隐私、后端逻辑、无障碍与中英文案、前后端约定与测试），
  每条都由另一个角色独立复核。确认 36 条，合并重复后 31 条。

除非特别说明，下面每个问题都**已修复**，并有自动化测试覆盖。目前还没有提交。

严重程度：**高** = 价格错、订错、有安全问题或用户走不完流程。**中** = 数据错误、恢复失败、隐私或无障碍缺陷。
**低** = 让人困惑但可以恢复。

### A. 审查之前发现的

| 编号 | 程度 | 问题                                                                                       | 修复                                                                                                 |
| ---- | ---- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| A1   | 高   | 所有新用户在最后一步都会失败：后端要求用户本人手机号（`contact.phone`），页面却从没问过。  | 新增"你的手机号"，用和后端相同的电话规则检查，错误显示在对应输入框下。                               |
| A2   | 高   | 卡片写着"价格保留到……"，但同意之后价目表一改，结账就拒绝。                                 | 结账按用户同意的价格下单，只有报价里的服务已下架才拒绝。                                             |
| A3   | 高   | 生产环境发不出邮箱验证码，新用户要到规划完、点了同意才发现走不下去。                       | 新增 `GET /api/concierge/status`，页面一开始就说明，并提供"把方案发给工作人员"（邮件、复制、电话）。 |
| A4   | 高   | "两只狗，其中一只要吃药"会给两只都收用药费；输入框自己的示例"12 to 15 October"也读不懂。   | 支持英文月份、序数词和"住几晚"；可能属于任意一只的细节一律反问"是哪一只？"。                         |
| A5   | 高   | 刷新（比如手机切去邮箱看验证码时标签页被回收）整个方案就没了；浏览器返回键会直接离开预约。 | 方案保存在当前标签页（不含联系信息）；每一步都有自己的浏览记录。                                     |
| A6   | 中   | 助手说健康备注会转给工作人员，实际上聊天里的备注从没随预约提交。                           | 备注带入填信息页的"注意事项"，用户可见可改。                                                         |
| A7   | 中   | 条款摘要承诺了没人批准过的"刷卡冻结流程"和"随时免费取消"。                                 | 只写系统现在真的做到的事；政策类内容列为待业务决定。                                                 |
| A8   | 中   | 按钮置灰却不说原因，键盘用户无法知道缺什么。                                               | 按钮保持可点，点了就列出缺哪些并把光标移到第一个问题。                                               |
| A9   | 中   | 中文页面上的错误、读屏文字和语音错误都是英文。                                             | 按服务器错误码给出中英文提示，所有标签都已翻译。                                                     |
| A10  | 中   | 填信息页里"重新验证邮箱"的表单嵌在预约表单里（表单不能嵌套），在里面按回车会提交预约。     | 移到预约表单外面。                                                                                   |
| A11  | 低   | 狗狗体型不影响价格，却挡着不出报价。                                                       | 出方案之后再问一次体型。                                                                             |
| A12  | 低   | "一只大的一只小的"会把两只都设成同一体型。                                                 | 出现两种体型或只点名其中一只时，不自动填，留给用户选。                                               |
| A13  | 低   | 验证后焦点跳到页面大标题而不是步骤标题；邮箱验证过期会把用户弹回上一页。                   | 等一帧再聚焦步骤标题；在填信息页原地重新验证。                                                       |

### B. 对抗式审查发现的问题

**价格与报价**

| 编号 | 程度 | 问题                                                                             | 修复                                                                 |
| ---- | ---- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| B1   | 高   | 用户改了方案但重新算价失败时，旧方案仍能点同意，服务器会按旧日期旧价格下单。     | 记住方案是按哪份需求算的价；对不上就锁住"同意"并显示"重试"。         |
| B2   | 高   | 点同意的过程中改清单：签下的是旧报价，填信息页、确认页和日历文件却显示新日期。   | 方案变了之后才返回的"同意"一律作废；后续页面只用已同意的方案。       |
| B3   | 中   | 助手回复时勾清单会取消这次回复、丢掉它读到的内容；重新算价时勾的选项可能被覆盖。 | 助手回复时清单暂停；算价期间勾的选项保留并在下一次算价时计入。       |
| B4   | 低   | 恢复的方案价格已过期，或从后面的步骤返回时，可能一个方案都不显示。               | 只要方案和需求对不上就自动重新算价（每个版本只算一次，不会死循环）。 |

**规则助手（读懂用户输入）**

| 编号 | 程度 | 问题                                                                                              | 修复                                                            |
| ---- | ---- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| B5   | 高   | "She doesn't need any medication"、"不需要吃药"被当成要吃药，每只都收费。                         | 否定句永远不算"要"；明确的"不用吃药"作用于所有宠物。            |
| B6   | 高   | 一狗一猫时说"My dog needs medication"，猫也被收了用药费。                                         | 识别 my/our dog(s)、宠物名字和复数；说不清的就反问。            |
| B7   | 高   | 喂食备注里的"1/2 杯"会改掉已选日期；"2026/11/01"、"12/10/2027"读错；"24/7 照顾"被当成日期。       | 排除分数、识别年份、忽略 24/7；只有和住宿有关的话才改已选日期。 |
| B8   | 高   | "另一只是猫"会把两只宠物的方案缩成一只猫并报价。                                                  | 只补还没确定的种类，提到宠物不会减少数量。                      |
| B9   | 高   | "2026年10月12日到2026年10月15日"被读成 12 到 20 号。                                              | 带年份的中文日期能正确识别。                                    |
| B10  | 中   | "October 12 to 15 November"变成 11 月 12 日至 15 日；"2 October - 3 dogs, 4 nights"变成只住一晚。 | 支持月份在前或在后的写法；日期后面的数量不再被当成结束日。      |
| B11  | 中   | "好的"从来不算同意；在"没太理解"之后回答"yes"会无限循环。                                         | 识别中文肯定词；判断的是回复末尾的服务问题。                    |
| B12  | 低   | 反问"是哪一只"时说"点下面的选项"，但没有这个按钮；用户自然回答"猫咪"也读不懂。                    | 文案改为指向清单；能听懂"猫咪""宠物 2""都要""都不用"。          |

**预约数据**

| 编号 | 程度 | 问题                                                                                          | 修复                                                                 |
| ---- | ---- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| B13  | 中   | 已保存宠物的对应关系按位置记，方案改动后可能订成另一只（甚至另一种）宠物。                    | 只有该位置仍是那只宠物时才保留对应；宠物变了就重建填信息页的宠物行。 |
| B14  | 低   | 服务器从不检查已保存宠物的种类和报价里的是否一致。                                            | 不一致时返回 `CONCIERGE_PET_SPECIES_MISMATCH`；页面只列出同类宠物。  |
| B15  | 中   | 助手收集到的体型和是否吃药在结账时被丢掉。                                                    | 写入工作人员已经在看的字段（用药说明、注意事项），不改数据库结构。   |
| B16  | 中   | "+64 (0) 21 - 555 - 0101"这类紧急电话能通过校验，但超过数据库 `VARCHAR(20)`，最后一步报 500。 | 电话去掉空格和括号再存；页面检查长度。                               |
| B17  | 中   | 已保存宠物名字超过 60 个字符时，之后每次对话和算价都失败。                                    | 放入方案时截到服务器允许的长度。                                     |
| B18  | 中   | 长时间语音输入可能超过 2000 字符限制，之后每一轮都失败，只能重新开始。                        | 打字和语音都限制在 2000 字符。                                       |
| B19  | 低   | 页面不检查最大长度；品种太长时错误显示在名字输入框下。                                        | 页面与服务器使用相同的长度上限；品种错误显示在品种输入框下。         |

**安全与隐私**

| 编号 | 程度 | 问题                                                                                                                             | 修复                                                                             |
| ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| B20  | 高   | 普通注册不验证邮箱。别人可以用受害人的邮箱加自己的密码先注册，之后受害人用验证码"登录"时，就进了对方的账号，预约也挂在对方名下。 | 验证码永远不能登录、也不能预约到设了密码的账号（`CONCIERGE_PASSWORD_ACCOUNT`）。 |
| B21  | 中   | 隐私说明写着"提交后清除进度"，实际聊天记录、备注、宠物名和邮箱都还留在标签页里。                                                 | 提交后只保留预约编号和日期；说明如实写明这一点。                                 |
| B22  | 中   | 备用联系邮箱 `bookings@example.co.nz` 是任何人都能注册的域名，"把方案发给工作人员"会把用户的方案发到那里。                       | 删除备用地址；只有配置了真实邮箱才提供邮件选项。                                 |
| B23  | 低   | 任何人用十几次请求就能把受害人的邮箱锁 24 小时。                                                                                 | 用完的验证码仍受重发冷却限制；锁定从 15 分钟开始，逐轮翻倍，最长 24 小时。       |
| B24  | 中   | 预约已经成功，但刷新登录状态失败时，页面显示"失败"（再点一次可能订出第二单）。                                                   | 先显示确认页；刷新登录状态失败不影响结果。                                       |

**无障碍与中英文案**

| 编号 | 程度 | 问题                                                                       | 修复                                                                   |
| ---- | ---- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| B25  | 中   | 点选按钮、"重新开始"、验证码登录之后，键盘焦点掉到页面最外层。             | 焦点移到下一个问题、对话标题或弹窗的"关闭"按钮。                       |
| B26  | 中   | 中文页面上除"每晚"外的价格单位都是英文。                                   | 单位已翻译；不认识的单位不显示，而不是显示英文原文。                   |
| B27  | 中   | 离开预约页后，门户里所有页面的标签标题都还是"安排住宿"。                   | 离开时恢复原来的标题。                                                 |
| B28  | 中   | 兽医同意书、性格记录、兽医信息的"现在就去"链接指向一个做不了这些事的页面。 | 只有疫苗证明链接到对应页面；其余写明"送来之前工作人员会和你一起完成"。 |
| B29  | 中   | 手机上家长门户里的底部"查看方案"悬浮条显示错位。                           | 只在公开预约页显示。                                                   |
| B30  | 低   | 每勾一次清单都播报"助手正在思考"、按钮显示"发送中…"，但不会有回复。        | 只有发消息和点选答案时才显示。                                         |
| B31  | 低   | 在填信息页按浏览器返回键要按两次才有反应。                                 | 返回键会跳到最近一个仍适用的步骤；已登录用户不再产生验证步骤的记录。   |

### C. 遗留事项（本次未改）

| 编号 | 位置                 | 事项                                                                                              | 负责人         |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| C1   | 共用 `createBooking` | 测试付款被记成成功/`paid`，门户可能显示"已付款"。预约助手的确认页已写明没有收取任何费用。         | 预约模块负责人 |
| C2   | 登录注册             | 注册不验证邮箱；"忘记密码"不支持没有密码的账号。                                                  | 登录模块负责人 |
| C3   | 仓库历史             | 提交 `4265ca3` 把真实密钥写进了 `Backend/.env.example`，需要轮换这些密钥。                        | 全组           |
| C4   | 预约助手             | 验证码和"每次同意只下一单"的记录都在内存里，只适用于单台后端实例。                                | 我们，后续     |
| C5   | 业务                 | 交接时段、取消政策、回复时限、首次入住见面、真实联系邮箱和电话、邮件服务（SES）、支付（Stripe）。 | 门店           |
| C6   | 其他同学的测试       | 5 个测试原本就失败：前端 `AdminNavbar`、`FeedbackSidebarList`；后端 `feedback.api`（3 个）。      | 各自负责人     |

### 验证

- 后端：805 个测试通过（其中预约助手和语音 187 个）；类型检查和 ESLint 无报错。
- 前端：892 个测试通过（其中预约助手 60 个）；类型检查、oxlint、ESLint 无报错；生产构建成功。
- 浏览器（本地预览）：从点选答案到确认页全程跑通；验证码步骤刷新后能恢复；确认页按返回键不会重开表单；
  手机宽度正常；算价失败时"同意"锁住，按"重试"后恢复。
