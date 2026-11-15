# MATE reviewed workspace actions

MATE can turn a creator's natural-language request into a content plan, a community event draft, or an entry to a fresh holder-payout review. The creator reviews and confirms each proposal. MATE does not publish social posts, hold a signing key, or submit financial transactions.

## Product entry and workflow

1. Sign in with the wallet that owns the project and open **AI Copilot → Chat → Plan an action**.
2. Describe a content plan, community event, or holder-payout review. **Ask a question** retains the existing read-only conversation flow; switching modes does not reinterpret earlier messages as permission to act.
3. MATE returns an explanation and up to three allowlisted proposals. Proposals are saved privately and remain available after reopening the workspace.
4. Review the complete content, channels, times, event link and capacity. Content and event details can be edited before approval. All displayed times use the browser's local time zone; the stored values are explicit ISO timestamps. The model receives the current UTC time. Ambiguous times should remain empty for the creator to supply.
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
| `POST /api/projects/:projectId/assistant/plan` | Request structured proposals with `{ content, chatId?, requestId }`. The optional chat must belong to the same wallet and project. |
| `POST /api/projects/:projectId/assistant/actions/:actionId` | `edit` with revision/title/payload, or `apply`/`dismiss` with the displayed revision. Approval requires `confirm: true`. |

The action record includes its project and owner, optional chat attribution, originating request ID, kind, title, rationale, payload, revision, status and timestamps. Status progresses from `proposed` to `applied` or `dismissed`. Destination IDs and a truthful result message are retained. Reapplying an already applied action returns its saved result without creating another set of records. Editing a stale revision fails rather than silently overwriting another window's review.

Result navigation uses project-scoped browser events. `memehelm-open-assistant-result` opens the existing content or Community view; it ignores unsupported kinds, other projects and blocked editors. `memehelm-open-distribution-review` requests the existing Treasury review. These events are navigation signals, not authorization for a transfer or publication.

## Budgets, retries and replay protection

Planning uses the project's existing persistent daily AI request allowance: the default is 10 requests per UTC day, configurable from 1 to 20. Started requests count toward the allowance, including provider failures. This allowance limits AI requests, not ETH spending. The existing wallet-level concurrent-request guard and short-term writing rate limits also apply.

The client hashes the request path and body together with the wallet scope and persists a UUID request identity without storing prompt text in that identity key. A timeout or ambiguous transport failure retains the identity. The server journals owner, scope, ID and payload fingerprint. Concurrent identical requests join the same operation; completed requests replay their saved result; reusing an ID with different input is rejected.

An interrupted paid request is never automatically restarted after a server restart. The UI first offers inspection of saved proposals, then requires an explicit acknowledgment before starting a fresh request that can consume another AI allowance. Pending requests retry the original identity. The server returns current action revisions when replaying an earlier plan, and the client refuses to merge an older revision over a newer review. Slow initial list responses likewise cannot erase a proposal returned by a faster planning request.

Proposal approval creates destination records and marks the action applied in one workspace transaction. The action module has no signer, social publisher or outbound HTTP client. The separate approval request does not run the AI again.

## Private boundaries

- Proposals, rationale, source context, AI request journals and new content/event drafts are private to the verified project owner.
- Approval does not make a project page public and does not change existing publication consent.
- X, Discord and Telegram are content destinations. Planning a draft does not establish account ownership, fetch engagement data or send a social message.
- Private project notes are untrusted context, not permission to reveal secrets in a draft. The creator reviews all proposed text before any later publication.
- A payout proposal cannot contain recipient/amount overrides. Treasury derives the current review through its existing server and onchain checks.
- No autonomous trading, market making, cross-chain issuance, social posting or wallet custody is introduced.

## Verification and limits

The focused suites cover strict parsing, owner/project isolation, revision conflicts, private destination records, atomic/idempotent approval, request recovery, UI confirmation, invalid/missing dates, complete X content, slow-response races and navigation guards:

```text
node --test --test-isolation=none test/assistant-actions.test.mjs test/assistant-api.test.mjs test/assistant-actions-ui.test.mjs test/assistant-handoff.test.mjs
```

`qa/assistant-actions-check.html` is an isolated illustrative browser fixture. It intercepts every request and never forwards a call to an AI provider, social service, RPC or wallet. Fixture screenshots and mocked integration tests validate interaction and state boundaries; they are not evidence of a real account publication, a paid model response, or a funded mainnet payout.

Real-provider output quality, real social-account acceptance, funded wallet execution and independent security review remain separate acceptance work. Local development completion does not establish a deployed, authenticated service or cloud monitoring availability.
