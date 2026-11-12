# Independent Robinhood workspace

Updated 2026-11-12. This release removes the earlier Flap runtime integration, interfaces, registry checks, launch event decoder, vanity worker and upgrade dependency. The existing English MemeHelm brand, desktop interface, wallet privacy, SQLite workspace, AI tasks and opt-in project pages remain.

## Available locally

- Activate a MemeHelm factory, prepare its own `createToken` transaction and verify the resulting creator/token/vault receipt. Fixed supply goes entirely to the signing wallet. Optional test ETH goes into the two-recipient vault. Mainnet is blocked.
- Read token/vault balances and request independent wallet-signed payouts. Contracts are non-upgradeable and have no hidden platform recipient.
- Discover recent events from bytecode-verified MemeHelm factories. Feed sources are a configured factory and factories of explicitly published, wallet-owned projects. Private project records do not expose factory addresses to discovery. The feed uses recent RPC events and the latest explorer event page per factory; it is not a complete chain index.
- Look up Robinhood ERC-20 name, symbol, supply and decimals via RPC, plus holder counts/largest holders via Blockscout. Missing holder data stays unavailable. No price, cap, volume, curve, graduation or trade history is inferred without a verified market source.
- Save private watches, check holder changes, pause/remove watches and read private alerts. Background checks run every minute while the local service runs, at most 100 watches per cycle and 20 saved watches per wallet. Failures preserve previous observations.
- Request AI briefs, drafts and plans with private history and explicit sharing. The configured live provider currently returns HTTP 403; successful mocked-provider tests do not establish live availability. Calls are limited to 5/minute and 20/hour per wallet, with no automatic paid AI or financial execution.

## Privacy and isolation

One-use EIP-4361 challenges bind wallet, origin, chain and five-minute expiry. Session cookies are HttpOnly/SameSite Strict; HTTPS adds Secure. Sessions expire after 24 hours and are invalidated by restart. Private APIs resolve ownership from the session; cross-wallet access returns 404 or an empty owned list.

The independent default database is `data/robinhood-independent/workspace.sqlite`. Old databases remain untouched. Factory, draft and wizard state use `memehelm:46630:independent:<wallet>:*` keys, avoiding reuse of old protocol addresses. Guest draft adoption occurs only on explicit sign-in and only if that wallet has no draft. Cached market data and observation history require the current source label.

Public pages contain explicitly approved project fields and updates. A saved launch requires a successful receipt from the signing wallet, a matching MemeHelm factory runtime and its token/vault/creator event. Importing a token is private tracking, not evidence of creator ownership.

## Remaining scope

Public-testnet wallet deployment/launch/payout verification, market liquidity and trading infrastructure, additional issuance modes, social integrations, autonomous spending strategies, external audits, and production hosting remain separate work. No mainnet or public-testnet financial transaction was broadcast during this migration. Hosting remains deferred until the user supplies an environment.
