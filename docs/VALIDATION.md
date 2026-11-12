# Mainnet integration validation

Date: 2026-11-12. Active network: Robinhood Chain mainnet 4663. No real mainnet transaction was broadcast by the assistant.

| Check | Evidence |
| --- | --- |
| Protocol identity | Read-only script verified chain 4663 and pinned runtime hashes for eight official pons/Uniswap deployments. Live enabled config, fee and creator-fee cap were read successfully. |
| Contract build | solc 0.8.26, Shanghai, optimizer 200; active artifact is the fixed RevenueSplitVault adapter only. |
| Node suite | 34 tests passed. Covers wallet/session ownership, launch validation, live permission/fee refresh, exact approvals, quote ownership/expiry/phase, stalled RPC/explorer/body timeouts, retry after failed in-flight reads, six-decimal quote assets and both currency orders, registry discovery, data gaps, public field filtering, private AI history and alert isolation. |
| Foundry | Four tests passed, including 256 accounting fuzz runs, escrow collection, unrelated-launch sweep rejection and wrong-network deployment rejection. |
| Local mainnet fork | Official factory issuance with live economics pin; all supply to curve; adapter set as fee recipient; curve buy/sell; exact approvals; fee sweep → escrow → adapter claim → both fixed-recipient accounting paths; final-buy refund and graduation; hook-aware Universal Router native buy and Permit2 sell. |
| API against fork | Wallet signature sign-in → confirmed factory receipt saved → snapshot → creator-only publication → public field whitelist. Forged token/receipt and anonymous trade preparation rejected. |
| Frontend | TypeScript and Vite build passed. Nine app pages and four launch steps render without developer setup content. Browser checked live launch terms, English review, required identity fields, actual mainnet launches, observed ETH chart and recent trade receipts. Desktop and phone layouts were inspected. |
| Live market source | Mainnet RPC returned actual launches and 21 recent curve trades for a sampled token; native spot price and phase were readable. Blockscout holder queries were unavailable and remained blank. The event window is bounded, not an all-time index. |
| Credential boundary | Provider credential absent from source, documentation, public files and built assets. Runtime data, local QA, artifacts and environment values remain ignored by Git. |

## Reproduce the fork verification

Use an official Anvil binary and a fresh local fork of https://rpc.mainnet.chain.robinhood.com on loopback port 8546 with chain id 4663, then run pnpm verify:fork. The script hardcodes the local destination, checks web3_clientVersion for Anvil, uses only its local unlocked accounts and temporary QA storage, and never accepts a remote signing URL or wallet private key. Stop the local node afterward. Fork promptly: the public RPC may prune historical state, so a long-idle fork can need restarting.

pnpm verify:mainnet is read-only and does not require any account. pnpm check runs compile, offline Node tests and the client build. pnpm contracts:test runs Foundry.

## Remaining external limits

The configured AI provider still rejects real generation; controlled-provider tests prove the application path only. Restore provider access before claiming live Copilot availability. Blockscout holder indexing depends on its external service. Public hosting is deferred by the user. No real human-wallet mainnet launch, public deployment, independent contract audit or complete historical index is claimed by this validation. Local simulations are not a guarantee of financial safety.

Loading regression verified on the real hood morning (HOOD) launch, 0xf7F6DbB998F4BD0f78597C24Df05b4F4d67684C2, paired with the onchain six-decimal USDG token. Core price/phase/reserves and recent trades were read separately. Failure of Blockscout no longer blocks those facts. No trade was broadcast.
