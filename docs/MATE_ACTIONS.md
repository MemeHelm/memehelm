# MATE reviewed workspace actions

MATE can turn a creator's natural-language request into a content plan, a community event draft, or an entry to a fresh holder-payout review. The creator reviews and confirms each proposal. MATE does not publish social posts, hold a signing key, or submit financial transactions.

## Product entry and workflow

1. Sign in with the wallet that owns the project and open **AI Copilot → Chat → Plan an action**.
2. Describe a content plan, community event, or holder-payout review. **Ask a question** retains the existing read-only conversation flow; switching modes does not reinterpret earlier messages as permission to act.
3. MATE returns an explanation and up to three allowlisted proposals. Proposals are saved privately and remain available after reopening the workspace.
4. Review the complete content, channels, times, event link and capacity. Content and event details can be edited before approval. All product schedules, input fields and displayed timestamps use **UTC**, with visible UTC labels. Relative dates such as “tomorrow at 15:00” use the current UTC date. A specifically supplied offset is converted to its equivalent UTC instant. Missing or ambiguous dates remain empty for review. Existing saved ISO instants are preserved; changing the display convention does not reschedule existing records.
5. Confirm the private creation checkbox, then choose **Create private drafts**, **Create private event**, or **Open payout review**. Missing or invalid required details prevent approval.
6. Open the resulting content plan or Community tool to continue the existing editing and publication workflow. A calendar time is a planning date, not an instruction to post automatically.

Unsent requests, edits and in-flight work participate in the existing desktop unsaved-work guard. A saved proposal alone does not prevent closing the window. Failures retain the request or proposal; a failed list refresh does not erase already loaded records.

## Supported destinations and validation

| Kind | Proposal data | Effect after confirmation |
| --- | --- | --- |
| `calendar` | One to seven complete content items: title, content, channel and time | Creates private `content_calendar` records with `status: planned` and an `assistantActionId` reference. No post is sent. |
| `event` | Event title, description, start/end, optional link, and open or bounded capacity | Creates a private Community event with `publishedDetails: null` and an `assistantActionId` reference. No invitation is published. |
| `distribution` | Empty payload only | Records the reviewed handoff and opens Treasury. It supplies no amount, recipient, calldata or signature. |

Action and item titles are limited to 120 characters. Content is limited to 8,000 characters, with an additional 280 Unicode character limit for X drafts. Event descriptions are limited to 4,000 characters and capacity is either open or an integer from 1 to 500. Dates must be future times within one year when creating destination records. Events must end after they start and last no more than seven days. A proposal may retain a missing time while being edited; approval requires complete valid times.

Holder-payout handoffs require an issued token and a verified holders vault controlled by the connected owner. Split and social escrow vaults are not eligible. Treasury reads a fresh snapshot and prepares the ordinary payout review. The user still checks exact recipients, amounts, exclusions, expiry and simulation results before separately approving and signing in the wallet. The handoff is consumed after Treasury handles it, so reopening the window does not reuse an old request. A preparation failure uses the ordinary explicit review retry.

## Architecture and API

- `src/ProjectChat.tsx` owns the explicit question/action mode switch and aggregates unsaved-work protection.
- `src/AssistantActions.tsx` loads proposals, creates plans, renders complete previews and editable reviews, obtains explicit confirmation and exposes saved-result navigation.
- `server/copilot.mjs` defines the structured assistant task. Model output is data; it is not executed as code or a free-form tool call.
- `server/assistant-actions.mjs` strictly parses the allowlist, rejects extra payload fields, validates dates/content, owns proposal revisions and applies confirmed changes in a workspace transaction.
- `server/index.mjs` enforces the wallet session and project ownership, gathers bounded project/chain context, checks payout eligibility and connects AI journaling, budget accounting and workspace actions.
- `src/api.ts` provides stable, wallet-scoped request identities for transport retries. `server/request-journal.mjs` provides durable replay protection.

The private routes are:

| Route | Purpose |
| --- | --- |
| `GET /api/projects/:projectId/assistant/actions` | Read the owning wallet's saved proposals and results. |
| `POST /api/projects/:projectId/assistant/plan` | Request structured proposals with `{ content, chatId?, requestId, timezone? }`. The optional chat must belong to the same wallet and project. The updated client sends `timezone: "UTC"`; omission also means UTC. Other zones are rejected before AI usage. |
| `POST /api/projects/:projectId/assistant/actions/:actionId` | `edit` with revision/title/payload, or `apply`/`dismiss` with the displayed revision. Approval requires `confirm: true`. |

The action record includes its project and owner, optional chat attribution, originating request ID, kind, title, rationale, payload, revision, status and timestamps. Status progresses from `proposed` to `applied` or `dismissed`. Destination IDs and a truthful result message are retained. Reapplying an already applied action returns its saved result without creating another set of records. Editing a stale revision fails rather than silently overwriting another window's review.

Result navigation uses project-scoped browser events. `memehelm-open-assistant-result` opens the existing content or Community view; it ignores unsupported kinds, other projects and blocked editors. `memehelm-open-distribution-review` requests the existing Treasury review. These events are navigation signals, not authorization for a transfer or publication.

## Budgets, retries and replay protection

Planning uses the project's existing persistent daily AI request allowance: the default is 10 requests per UTC day, configurable from 1 to 20. Started requests count toward the allowance, including provider failures. This allowance limits AI requests, not ETH spending. The existing wallet-level concurrent-request guard and short-term writing rate limits also apply.

The client hashes the request path and body together with the wallet scope and persists a UUID request identity without storing prompt text in that identity key. A timeout or ambiguous transport failure retains the identity. The server journals owner, scope, ID and payload fingerprint. Concurrent identical requests join the same operation; completed requests replay their saved result; reusing an ID with different input is rejected.

Planning requests and retries always use UTC regardless of the browser's time zone. Non-UTC requests receive `400` before an AI call or journal allocation; they are never silently reinterpreted. Legacy requests that omitted `timezone` retain their previous journal fingerprint and replay behavior, with UTC interpretation. An already saved proposal or calendar record retains its original absolute instant and is simply displayed in UTC.

An interrupted paid request is never automatically restarted after a server restart. The UI first offers inspection of saved proposals, then requires an explicit acknowledgment before starting a fresh request that can consume another AI allowance. Pending requests retry the original identity. The server returns current action revisions when replaying an earlier plan, and the client refuses to merge an older revision over a newer review. Slow initial list responses likewise cannot erase a proposal returned by a faster planning request.

Proposal approval creates destination records and marks the action applied in one workspace transaction. The action module has no signer, social publisher or outbound HTTP client. The separate approval request does not run the AI again.

## Recorded outcomes and the next review

Content outcomes, Community attendance and event recaps, community-goal recaps, recorded X links/results and Operations task outcomes feed the next private AI context. A calendar outcome remains a creator report, not a verified publication receipt. Manual X publication and engagement retain their creator/unverified labels; unknown counts remain null, and a reported zero remains zero. Reports for a replaced X link stay attached to the original post and are excluded from the current link's context.

Context selection reserves room for recent results: up to eight completed plans within 20 calendar items, five closed events within 15 events, five closed goals within 15 goals, and four posts with recent results within eight X posts. Remaining capacity covers active plans or recent publications. Operations selects recent outcomes and edited updates by their effective change time and retains the latest 90 closed actions by valid completion/update/creation timestamps. A result on an old record therefore remains usable when newer drafts exist.

Published event invitations and contribution instructions use their approved snapshots in the primary context fields. Unpublished revisions are explicitly labeled private drafts. Hiding an invitation preserves its last published details for private attendance and recap entry after the published start; it does not make the invitation or recap publicly visible. A never-published event cannot be completed or receive attendance records.

If an Operations outcome request loses its response, the UI reads the saved state back. An exact saved outcome is treated as successful without resubmission. If another saved result already closed the task, the user's unsaved text remains available for comparison. X publishing failures likewise refresh the saved state and clear confirmation. After reconnecting or changing accounts, the saved post exposes **Approve again for X**; approval remains bound to the current account and saved text revision. Uncertain delivery does not trigger an automatic send.

## Private boundaries

- The shared MATE platform scope also applies to planning. Requests unrelated to MemeHelm cannot be answered inside reply text or smuggled into a content/event proposal. Provider output requires a scope field; an off-topic response is replaced by the fixed refusal with no proposals, and malformed plans fail before action records are created. Older unversioned journal results require saved-work inspection rather than paid regeneration or raw replay.
- Proposals, rationale, source context, AI request journals and new content/event drafts are private to the verified project owner.
- Approval does not make a project page public and does not change existing publication consent.
- X, Discord and Telegram are content destinations. Planning a draft does not establish account ownership, fetch engagement data or send a social message.
- Private project notes are untrusted context, not permission to reveal secrets in a draft. The creator reviews all proposed text before any later publication.
- A payout proposal cannot contain recipient/amount overrides. Treasury derives the current review through its existing server and onchain checks.
- No autonomous trading, market making, cross-chain issuance, social posting or wallet custody is introduced.

## Verification and limits

The focused suites cover strict parsing, owner/project isolation, revision conflicts, private destination records, atomic/idempotent approval, request recovery, UI confirmation, local-time interpretation, invalid/missing dates, complete X content, slow-response races, context recency, publication snapshots, outcome readback and navigation guards:

```text
node --test --test-isolation=none --test-concurrency=1 test/assistant-actions.test.mjs test/assistant-api.test.mjs test/assistant-actions-ui.test.mjs test/assistant-handoff.test.mjs test/operating-context.test.mjs test/operating-ui-recovery.test.mjs
```

`qa/assistant-actions-check.html` is an isolated illustrative browser fixture. It intercepts every request and never forwards a call to an AI provider, social service, RPC or wallet. Fixture screenshots and mocked integration tests validate interaction and state boundaries; they are not evidence of a real account publication, a paid model response, or a funded mainnet payout.

On November 16, 2026 (Asia/Shanghai), the opt-in live workflow check passed using four upstream requests in total: three for the normal action/outcome/review exercise and one for local-time interpretation. Replays consumed no additional requests. The real next review received the recorded synthetic content outcome; unsupported transfer, automatic-trading and unreviewed-publication requests returned no proposals. See [live workflow acceptance](LIVE_WORKFLOW_ACCEPTANCE_2026-11-16.md) for sanitized reports and exact limits.

The final local automated run for that acceptance iteration passed **228/228 tests**. This is the current checkout's total, including local experimental Sentinel checks, rather than a stable product-feature count. Historical 199/207-test counts describe earlier snapshots. Real social-account acceptance, funded wallet execution, independent audit, deployment and sustained provider/monitoring availability remain separate work. A successful synthetic provider sample does not establish output quality for every possible request.
