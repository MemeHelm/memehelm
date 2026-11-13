# Functional repairs and follow-up review — 2026-11-13

This follows `FUNCTIONAL_AUDIT_2026-11-13.md`. The four application issues F2–F5 have been fixed. F1 subsequently passed live generation and persistence; see [AI_ACCEPTANCE_2026-11-13.md](AI_ACCEPTANCE_2026-11-13.md). The provider-failure discussion below records the earlier repair-stage state.

## Completed repairs

| Finding | Change | Evidence |
| --- | --- | --- |
| F2: activated split blocks draft save | Store a pre-launch vault in private draft configuration. Keep the top-level vault link empty until an issued token is verified. Issued-token and fee-recipient checks still apply. | Authenticated API regression for save, restore, update, malformed input and ownership. Fresh local-mainnet-fork save → issued receipt transition also passed. |
| F3: saving deletes assistant profile | Merge validated draft fields into the current stored record in the atomic transaction, preserving the latest assistant profile. Remove the launch draft when the record becomes an issued/imported token. | API save/restore regression and fresh fork confirmed-launch transition preserve name, voice and goal. |
| F4: no editable AI content | Add edit, save, cancel and refresh. Changes to a shared update become private and require new review before publication. Content edits and visibility changes check a revision to reject stale-window requests. | Authenticated ownership, validation, stale revision, simultaneous edit, publication and immutable launch-entry regressions. Browser fixture verified failure/retry, cancel, revised publication and conflict recovery. |
| F5: monitoring skips later owners | Rotate bounded global batches using the last attempted rule. Manual checks remain owner-scoped and do not change the global cursor. Failed observations do not prevent later rules from being checked. | 205 enabled rules across multiple owners; later rules, wraparound, failed reads, paused rules and manual checks covered. |

## Additional issues found and fixed in the requested second review

- A stale content conflict originally had no practical recovery entry. Added “Copy my edits” and “Discard edits and reload”; reload errors preserve the editor. A separate “Refresh drafts” control refreshes saved records and clears publication approval.
- Long Unicode content can cross request chunks. Server request parsing now uses a UTF-8 decoder; a test splits a multibyte character across separate writes and verifies the exact saved content. Content updates accept a bounded 100 KB JSON request and still enforce the 20,000-character content limit.
- Slow project balance reads could arrive after another project was selected. Old snapshot requests are now aborted and ignored, so an earlier project's result cannot replace the current selection's balances.
- Cancel/save/reload now return keyboard focus to the draft edit action. Editing explicitly shows its state and disables conflicting draft/task/project actions.
- The first screenshot showed an existing form rule shrinking the editor to 68 pixels. The scoped editor rule now provides 300 pixels on desktop and 240 pixels on small screens, with 16-pixel mobile input text.
- The assistant profile summary wrapped its expand marker onto a separate line on mobile. Its scoped layout now keeps the marker aligned and the secondary label readable.
- Signals copy now distinguishes the 60-second scheduling interval from a guarantee that every token is observed each minute; large watchlists use rotating batches while the server is online.
- Revised public updates now display their edit time instead of presenting changed content with only its original timestamp. The added public timestamp is explicitly whitelisted; private fields remain excluded.
- Provider failures return a safe temporary-service error, retain saved history, release the in-flight request and permit a later successful retry. Provider internal details are not shown to end users.

## Fresh verification after the repairs

- **39 Node tests passed**, including five new functional regression groups. The existing Ganache native transport warning falls back to JavaScript; the suite passes.
- TypeScript and Vite production build passed. Native config loader used for the existing environment limitation. No lint script is configured, so no lint success is claimed.
- A fresh **local Anvil fork of Robinhood mainnet** passed adapter deployment/runtime checks; factory launch; curve supply and buy/sell; exact approvals; fee sweep → escrow → vault claim → fixed release; partial final-buy refund/graduation; v4 native buy and Permit2 sell.
- The fork's HTTP verification additionally saved the activated split as a draft, saved an assistant profile, converted the draft to the verified issued token, preserved all three profile fields, removed obsolete draft data, then checked snapshot, creator-only publication and public field filtering.
- No real mainnet transaction was broadcast. The fork and read-only upstream relay were stopped after verification. Solidity and wallet-signing logic were not changed by these repairs.
- Browser checks used the real Copilot component with a clearly labeled local fixture transport, not injected wallet/session state. No fixture request reached the real AI or chain API. The fixture and screenshots are under ignored `qa/` and `artifacts/`; they are not included in the production build.
- Browser interactions covered edit/save, failure preserving text, retry, cancel preserving the stored version, hiding changed public text, explicit re-publication, conflict with another window, copying unsaved text and loading the newer revision. The API tests independently cover the real authenticated routes.
- Two desktop screenshot passes were completed; the first detected the editor height problem and the second confirmed its correction. Subsequent captures reviewed the conflict recovery and final responsive layout. Viewports included desktop 1280 pixels, tablet 768 pixels, phone 390 pixels and narrow 320 pixels. The editor has no horizontal page overflow at the checked narrow widths. These were emulated browser viewports, not physical phones.
- The full product's guest My Projects and Launchpad were smoke checked; My Projects desktop/phone captures retain the existing dark, compact sign-in design. No new developer status or provider settings were added to the website.
- The mechanical design detector reported one **pre-existing** left-accent border in the old example styling (`src/workflows.css`), outside the added editor rules. It was not treated as a reason to redesign unrelated components. No clean detector/GATE pass is claimed.
- Source/build scan found no copy of the configured live provider credential. `git diff --check` passed. The local backend was restarted and serves the latest production asset bundle at port 4318.

Screenshots: `artifacts/function-repairs-2026-11-13/`, including `round1-editor-desktop.png`, `round2-editor-desktop.png`, `conflict-recovery.png`, `editor-mobile.png`, `editor-tablet.png`, `editor-320.png`, `projects-desktop.png` and `projects-mobile.png`.

## Remaining external dependency and acceptance limits

At the earlier repair-stage check, the provider returned HTTP 403 and denied access to the configured group. A later user-authorized check returned HTTP 200 for the same credential. After the configured model timed out, an available model completed real social drafting and daily briefing with private persistence. Only the ignored model setting was changed; see the live acceptance record above. No provider permissions, credential or base URL were changed.

Human-wallet mainnet acceptance, hosted deployment and an independent contract audit remain outstanding. Manual image links, ETH-only execution, bounded market history and explorer-dependent holder data retain their documented scope. Autonomous market making and cross-chain issuance remain excluded. This review does not claim all production or financial risks have been eliminated.

## Signals follow-up

A later Signals failure reproduced an upstream HTTP 400 model/group denial despite a successful model-list read. After selecting a model verified by real generation, the BIAO Signals brief passed in the actual local product in about 13 seconds with private persistence. Safe failure categories, explicit transient retry, preserved briefs, stale-wallet protection and narrow-screen watch-row corrections were added. The current Node suite has 41 passing tests. See the live AI acceptance document for exact samples, configuration scope, visual checks and remaining provider limits.
