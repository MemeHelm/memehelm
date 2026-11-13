# MemeHelm functional audit — 2026-11-13

Follow-up: F2–F5 are fixed; see [FUNCTIONAL_REPAIRS_2026-11-13.md](FUNCTIONAL_REPAIRS_2026-11-13.md). F1 subsequently passed live generation and private persistence with a working model; see [AI_ACCEPTANCE_2026-11-13.md](AI_ACCEPTANCE_2026-11-13.md). The findings below preserve the original audit evidence.

## Verdict

The core local product exists, but functionality is not complete. This audit confirmed three reproducible defects, a missing content-editing workflow, and unresolved live AI readiness. Passing existing tests does not cover these gaps.

Scope: the current working tree, Robinhood Chain 4663 and pons v2. Existing UI changes were preserved. No application source was changed in this audit, no real mainnet transaction was broadcast, and no paid AI generation was requested. This is a functional review, not an independent security audit.

## Findings in priority order

### F1 — Live AI remains unaccepted (P1, external dependency)

The existing validation document records rejected real generation. On this audit, the configured provider's authenticated `GET /models` returned HTTP 403. No generation request was sent, so this result does not independently establish the current response of `POST /chat/completions` or its cause. Provider permissions, gateway restrictions and model availability still need verification.

`server/copilot.mjs:1` treats three present environment variables as configuration readiness; it is not a successful generation check. Copilot briefs, social drafts, plans and Signals AI briefs depend on this provider. Controlled-provider tests pass, but cannot establish live usability or output quality.

Next: restore provider access, then perform one explicitly initiated generation through the product and verify persistence, retry, ownership and publication. Do not expose credentials or model configuration in the user interface.

Evidence: `artifacts/function-audit-2026-11-13/provider-readiness.json`; existing `docs/VALIDATION.md`.

### F2 — An activated split prevents saving an unlaunched draft (P1, reproduced)

Normal workflow: activate the revenue split, then save the coin before issuance. `src/main.tsx:46` places the confirmed vault address in the draft. `src/main.tsx:54` sends that address at the top level when saving.

`server/index.mjs:82` rejects every nonempty top-level vault address without a token address: `A vault needs a token address.` The token does not exist yet at this point. An authenticated isolated API reproduction returned HTTP 400; an ordinary draft saved with HTTP 201. The rejection occurs before chain verification, so the isolated reproduction requires no actual vault deployment.

Impact: local browser draft persistence remains, but server save and later restoration through My Projects fail during a legitimate launch workflow.

Next: separate draft configuration from verified issued-token/vault linkage. Keep owner and fee-recipient validation for issued projects. Add a regression covering activate → save → restore → launch.

Evidence: `qa/function-audit-2026-11-13.mjs`; `artifacts/function-audit-2026-11-13/isolated-reproductions.json`.

### F3 — Saving a draft again deletes its assistant profile (P2, reproduced)

An owner can save `aiName`, `aiVoice` and `aiGoal` through the assistant endpoint (`server/index.mjs:108`). Saving the same draft through `/api/projects` constructs a new record without those fields and replaces the previous record (`server/index.mjs:90–92`).

An isolated authenticated reproduction saved a profile successfully, resaved the draft successfully, and observed all three profile fields absent afterward.

Impact: the user's saved assistant identity, voice and goal are lost. Subsequent generation falls back to defaults or missing context.

Next: preserve unrelated stored fields during draft updates and test profile preservation across save/restore.

Evidence: the same isolated reproduction and JSON above. Its temporary database and test session were removed after verification.

### F4 — Generated content has no in-product editing workflow (P2, product gap)

`src/CopilotWorkspace.tsx:25` renders saved generated content as read-only text, with copy and visibility/publication actions. There is no content-update endpoint. The editable assistant goal is a separate profile field.

The guide nevertheless says to “edit before sharing” (`src/Desktop.tsx:69`). Users can copy text elsewhere, but cannot save edited text and publish that revision to their MemeHelm project page.

Next: implement edit, save, cancel and publish-the-reviewed-revision behavior, preserving ownership checks and explicit sharing consent.

### F5 — Background monitoring permanently skips rules after the first 100 (P2, reproduced at multi-user scale)

`server/monitor.mjs:6` selects the first 100 enabled rules without a rotation cursor. The scheduled global check repeats the same selection every minute (`server/index.mjs:134`). A wallet-specific manual check can still work for that wallet.

An in-memory reproduction used 101 rules across six owners, respecting the 20-per-owner limit. Two global passes each checked 100 rules, but only the same 100 unique rules were observed; rule 101 was never checked.

Impact: later users can receive no background alerts despite enabled watch rules. A single owner's current maximum of 20 does not expose the problem.

Next: rotate bounded batches fairly, or queue all enabled rules with bounded concurrency and explicit observation/error timestamps.

Evidence: `artifacts/function-audit-2026-11-13/monitor-cap.json`. No network calls were used in this reproduction.

## Feature inventory and verification boundaries

| Area | Present behavior | Current limit |
| --- | --- | --- |
| Wallet/session | Injected EVM wallet, signed challenge, owner-scoped private API and data | Automated signed-session tests and local-fork API login passed; no human browser-wallet acceptance in this audit. No WalletConnect/QR connector. |
| Launchpad | Four-step identity/revenue/economics/review flow; live pons permissions, fees/config; user-signed launch | Official factory issuance passed on a fresh local mainnet fork. Real wallet permission must be queried per user. F2 affects draft saving. |
| Drafts/projects | Local wallet-scoped drafts, server save/restore, import and confirmed receipt recording | F2 and F3. No project archive/delete workflow. |
| Revenue | Fixed-recipient ETH split adapter; fee sweep, escrow claim and separate recipient release | Fresh fork payout path and conservation tests passed. Not an independently audited contract or real-funds acceptance. |
| Trading | Curve buy/sell, quote expiry and exact approvals; graduation and v4/Permit2 trade paths | Fresh fork passed. ETH-paired assets only; other quote assets are read-only. No real mainnet trade was signed. |
| Discover/details | Actual factory launches, token price/phase/reserves, recent executions and explorer holders | Public browser list and detail loaded. Recent 20,000-block window, bounded results; no complete candles/history, volume or USD valuation. Holder service unavailable in this sample. |
| Copilot | Profile, brief/post/plan requests, private history, copy and opt-in publication | F1, F3 and F4. No fresh real generation performed. |
| Signals | Owner watchlist, observed changes, private alerts and saved AI briefs | In-app notifications while server runs; external push/email/Telegram absent. AI briefs depend on F1; global monitoring has F5. |
| Community page | Creator-verified opt-in page, explicitly shared updates, public-field whitelist | Fresh fork API publication passed. Local service only; hosting was explicitly deferred. |
| Artwork | File preview and manual HTTPS/IPFS image link | Automatic IPFS upload absent by the user's accepted first-version scope. A local file preview is not a published upload. |
| Desktop utilities | App windows, taskbar, guide and allocation calculator | Presentational/tooling features do not establish backend completeness. |

Autonomous market making and cross-chain issuance are explicitly excluded product scope, not unfinished features. Public hosting is deferred by the user. These should not be treated as defects or reintroduced during fixes.

## Fresh verification performed

| Check | Result |
| --- | --- |
| Existing Node suite | 34 tests passed, zero failures. Includes ownership/auth, protocol validation, quotes/approvals, data gaps/timeouts, private/public filtering and monitoring isolation. |
| Contract compilation | RevenueSplitVault compiled successfully; creation bytecode reported 3,677 bytes. |
| Foundry | Four tests passed, including 256 fuzz runs for accounting conservation. |
| TypeScript and production frontend | Type checking and Vite production build passed. Vite used the native config loader for this environment. No dedicated lint script is configured. |
| Read-only live mainnet | Chain 4663 and eight pinned protocol deployments verified; live enabled launch config, creator-fee cap and fee read successfully. This does not establish any user's launch permission. |
| Fresh local mainnet fork | Fixed adapter deployment/runtime, official factory launch and curve-owned supply, curve buy/sell, exact approvals, sweep → escrow → adapter claim → fixed payout, final-buy refund/graduation, v4 native ETH buy and ERC20/Permit2 sell all passed. |
| API against that fork | Signed login, verified receipt save, snapshot, creator-only publication and public/private field filtering passed. Forged receipt/token pairing and anonymous trade preparation rejected. |
| Running local public/private routes | Health/status/launch options and discovery returned HTTP 200. Anonymous projects and watchlist returned HTTP 401. |
| Live sampled market | HOOD detail, trades and holder endpoints responded independently within about five seconds. Detail supplied price/phase; recent trades were empty in the current bounded window. Holders returned `holderDataAvailable:false`, not invented data. |
| Browser smoke check | Welcome entrance completed; Discover loaded actual recent launches; a MicroSoft/MSFT-paired detail completed loading and correctly restricted trading to read-only; empty launch identity fields produced validation messages. No real wallet or private UI session was injected. |
| Targeted audit reproductions | F2, F3 and F5 reproduced in isolated local state. Provider model discovery returned HTTP 403. |

The native fork client could not reach the official public RPC directly in this environment. For the successful fresh fork, a loopback-only Node relay forwarded an allowlist of public RPC reads to the fixed official endpoint and rejected write methods. All transactions stayed on local Anvil at port 8546. The fork and relay were stopped afterward. No private key or provider credential was supplied to these helpers.

## Recommended completion order

1. Fix F2 and F3 with meaningful save/restore regressions; they affect existing user data/workflows.
2. Restore and accept live AI, then implement editable reviewed drafts (F1 and F4).
3. Fix monitoring fairness and verify later owners receive observations and alerts (F5).
4. Run the complete browser workflow with a human wallet: sign in, save/restore, activate split, review launch, inspect pending/rejected/success states, manage project and publish only selected content. Any actual mainnet transaction must be explicitly signed by its owner.
5. Recheck the agreed local acceptance list before preparing the later hosted release.

No finding in this report has been fixed as part of the audit. Existing automated success should be retained as regression evidence, not described as full production readiness or a guarantee of financial safety.
