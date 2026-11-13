# Project operations extension

Surface mode: Operate. Extends the existing AI Copilot window and its established graphite/citron visual system. The user approved project memory, event observation, proposals, review, execution, outcomes and budget/pause controls. The primary loop is **observe → review → approve → act → record outcome**.

## Composition

Four views: Today, Project memory, Activity, Writing. Today puts the actual observation state and allowance before a review action, a split queue/detail workspace, observations and upcoming due dates. Private memory uses a readable form. Activity distinguishes AI reviews from the factual action journal. Writing retains the existing assistant profile, three writing tasks, editor, history and publication controls.

The desktop and tokens are unchanged. Small containers stack queue and detail, group controls and use 16px form text. No new decorative motion, promotional metrics, fake agent thoughts or provider configuration are introduced.

## Functional boundary

- `server/operations.mjs` owns per-project memory, settings, observations, runs, proposals, outcomes, journal and request allowance in the existing SQLite workspace.
- Operations endpoints require the existing verified wallet session and project ownership.
- Scheduling is off until explicitly enabled. Read-only observations can run without paid AI. A separate opt-in allows scheduled reviews, bounded by the daily per-project request allowance. The same allowance applies to manual project writing and reviews, including failed attempts, resets at 00:00 UTC and survives restart. It measures requests, not currency cost. Signals has no project association and retains its existing wallet limits.
- Scheduled tasks run while the local backend is online; no cloud uptime or external push delivery is implied. At most five due projects are processed per tick. Existing wallet AI concurrency/rate limits also apply.
- Model output is untrusted structured data. Only task/update proposals are accepted. No tools, signing, transfers, trades or social account access are exposed. A run never directly publishes an update.
- Edits revoke approval. Tasks require a recorded outcome to complete. Project updates require approval plus explicit publication confirmation and an existing published token page. Activity append, proposal completion and journal entries commit atomically. Revision checks reject stale actions.
- Pause stops future scheduling and invalidates in-flight proposals. Already-sent AI requests may still be billed and consume allowance. Memory/settings changes also invalidate in-flight context. No automatic paid retry or model failover is used.
- Fixed recipients, wallet signing and protocol integrations retain their existing behavior.

## External limits

X/Telegram account integration and external publishing are not connected. Actions currently execute as project-page updates and recorded community tasks. Social reactions are not ingested automatically. Memory and outcomes supply the next review's context, but no model weight training is claimed. Market coverage follows the existing observed data; holder availability still depends on its source. Mainnet signing, public hosting and independent audit remain outside local acceptance.

## Verification

- **47 Node tests passed**, including six operations groups. Covers durable memory and allowance, UTC reset, failed/unsafe AI output, same-request replay, duplicate proposal filtering, revisions, changed-context/paused review cancellation, opt-in scheduling, observation-only behavior, atomic publication, recorded outcomes, manual actions without AI, private wallet ownership and legacy writing integration. TypeScript, Vite production build and `git diff --check` passed. The existing Ganache native transport fallback warning remains; no lint script is configured.
- **Real provider acceptance:** one authenticated request against the application with isolated storage and `gpt-6.1-sol` returned HTTP 200 in about 17.9 seconds. It produced one proposed action, retained private memory, allowed approval/outcome recording, denied another wallet, enforced the daily allowance and did not generate again for the same request ID. No real token, social message, public post or funded transaction was created. This is a bounded acceptance sample, not a guarantee of ongoing provider availability.
- **Actual server timer:** an isolated running application with observations explicitly enabled and scheduled AI disabled saved its first observation through the real 60-second timer. Zero AI requests were used. The first check initially missed its due slot because of a few milliseconds of setup offset; enabling now makes the project eligible for the next timer tick. The corresponding unit regression also checks immediate eligibility.
- **Running local product:** after rebuilding/restarting port 4318, a separate unfunded deterministic test wallet saved memory, added a manual task, approved it and recorded an outcome. Private access and default paused settings were verified, with zero AI requests. Only its exact temporary project/operations record was removed, and its test session was logged out. Existing user records were preserved.
- **Browser checks:** the actual Copilot/Operations components used a clearly labeled loopback QA transport backed by the real operations module and isolated SQLite data. Model output and project identity were explicitly illustrative; no provider, wallet or chain request was forwarded. Interactions covered review/loading, approval without publication, edited approval reset, confirmed fixture publication, task completion, manual task addition, memory save failure preserving Unicode input, retry, multi-window conflict, allowance saving, enable/pause, activity and retained writing tasks. The first and second visual passes checked desktop 1440×900, tablet 768×1024, phone 390×844 and 320px widths. A global CSS rule overriding mobile inputs was corrected; checked mobile memory fields now use 16px text and 130–180px height, with no horizontal page overflow. These are browser-emulated sizes, not physical-device acceptance.
- **Credential boundary:** source/public/build scan completed; live credentials and provider settings remain in the existing ignored server environment. No dependencies, contract code, wallet signing or `.env` values were changed for this extension.

Ignored evidence directory: `artifacts/operations-2026-11-13/`, including `live-acceptance.json`, `server-timer.json`, `running-product.json`, `today-desktop.jpg`, `today-tablet.jpg` and `memory-mobile.jpg`. Screenshots show the illustrative QA workflow; the JSON acceptance records describe the actual authenticated/provider checks.
