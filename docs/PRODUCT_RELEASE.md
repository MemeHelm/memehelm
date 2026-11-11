# Discovery, signals and wallet workspaces

Updated: 2026-11-12 (Asia/Shanghai). This iteration implements the three agreed priorities locally: discovery/market details, monitoring with requested AI explanations, and wallet-owned workspaces. Public hosting is deferred at the user's request.

## User workflows

- Discover combines recent direct Portal events with up to 50 historical TokenCreated events indexed by Robinhood Blockscout. Search by name, ticker or address, sort results and open a verified Flap token. Community pages include only explicitly published projects. The list is not a platform-wide count or a recommendation.
- Token details read `getTokenV8Safe` from the official Robinhood Testnet Portal. Prices, native quote reserve, progress and taxes come from that contract. Holder counts, token supply and largest holders come from the official chain explorer, with unavailable states on failure. Market cap is an indicative reported-price-times-supply calculation in test ETH, never a USD valuation.
- The trade window covers the latest 50 indexed Portal buys and 50 sells across the network, filtered by token. It excludes other DEX venues and is not a complete trading history or a 24-hour-volume measure. Multiple events in a transaction retain their event order. Charts use these actual prices or timestamped local observations; no synthetic candles or filler history are generated.
- Sign in with an EOA wallet to add a watch. Change the price threshold, pause it, remove it, check manually or read private notifications. Price alerts compare consecutive successful observations. Holder changes and a transition to graduated also create alerts. Failed reads preserve the previous observation and show an unavailable state.
- Background checks run once a minute while the local Node service is running, with at most 100 enabled watches per cycle and 20 saved watches per wallet. They do not run after the service stops. Browser notifications, email, Telegram and social posting are not integrated.
- Click AI brief to request an explanation of one owned watch's observed facts and private alerts. Saved briefs remain wallet-private. Model calls share the same per-wallet writing limits as project Copilot: 5/minute and 20/hour. There is no background AI charge or automated financial action.

## Authentication and data

The server generates an exact EIP-4361 message bound to origin, wallet, Robinhood Testnet chain ID, nonce and five-minute expiry. A nonce is consumed before signature verification. Session identifiers are random, stored only as hashes in server memory, expire after 24 hours and use HttpOnly/SameSite=Strict cookies. HTTPS origins add Secure. Restarting the service invalidates sessions and requires a fresh sign-in. The local server continues to reject non-loopback hosts and cross-origin JSON writes.

Every private route resolves its project, watch or activity through the signed-in wallet. A client-supplied owner field is ignored. Launch receipts must belong to that wallet. Publishing a project requires matching ERC-20 information and a confirmed owned launch, or a creating wallet verified against the indexed launch list. Importing a token for private tracking does not grant creator publication rights. Public responses use explicit field whitelists.

The SQLite file is `data/robinhood-testnet/workspace.sqlite`. Document changes use database transactions with rollback and WAL. Existing projects/activity JSON files are imported once and left intact. Records without a verified owner remain quarantined. The database and all legacy files are ignored by Git. Private browser drafts, factory addresses and launch progress use `memehelm:46630:<wallet>:*`; guest drafts can move to a newly signed-in wallet only when that wallet has no saved browser draft. No signing key is stored by the application.

## Visual direction

The desktop metaphor, original M mark, brand palette and restrained point motion are retained. The upgrade adds dark glass surfaces, soft shadows, citron highlights, sculpted brand shapes, clearer primary actions, discovery cards, charts and a signal feed. New product text remains English and omits development progress or configuration instructions. Reduced-motion preferences remain supported.

## Remaining scope

- Public hosting, TLS, persistent session infrastructure, production abuse controls, operational backups and production load/reorg recovery need a separately supplied deployment environment and review.
- A real browser wallet sign-in and wallet-signed public-testnet launch/payout session still require the user's wallet. Local cryptographic signature and ownership tests do not replace that session.
- Autonomous buybacks, social publishing/escrow, Sentinel transfer rules, Bitcoin Runes, additional launch/vault paths and audit certification remain separate integrations. This release does not advertise them as available modes.
- This iteration changes no Solidity contract implementation and purchases no audit. Earlier fork proofs remain historical evidence with their original dates.

## Primary references

- [Flap Robinhood integration](https://docs.flap.sh/flap/developers/token-launcher-developers/robinhood-integration-guide.md)
- [Flap deployed contracts](https://docs.flap.sh/flap/developers/deployed-contract-addresses)
- [Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- [Node SQLite](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)
