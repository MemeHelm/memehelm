# Independent release validation

Date: 2026-11-12. Applies to the independent MemeHelm contracts and local Robinhood workspace. Historical October protocol forks do not validate these new contracts.

| Check | Evidence |
| --- | --- |
| Solidity compilation | solc 0.8.26, Shanghai, optimizer 200; independent factory, token and vault artifacts generated |
| Node suite | 31 tests passed, including nine local-EVM/API subtests |
| Local EVM | Fixed-supply issuance, creator-bound prediction, exact factory registration, initial vault deposit, recipient validation, 0/100 percent splits, forced ETH accounting, isolated failures and reentrancy rejection |
| API to local EVM | Signed wallet session → prepare → sign/send locally → verify creator/token/vault receipt → save → publish → snapshot → payout; cross-wallet and mismatched vault/factory rejected |
| Wallet boundaries | Chain 46630 only; chain/account rechecked after gas estimation; no backend signing key |
| Foundry | Three tests passed, including 256 accounting fuzz cases and mainnet deployment rejection |
| Data integrity | Only bytecode-verified factory discovery; deduplication; generic ERC-20 reads; stale-cache isolation; missing prices/trades/holder data remain unavailable |
| Privacy | One-use origin/wallet/chain challenges, private owned APIs, separate database/browser namespace, whitelisted public fields and explicit AI sharing |
| App build and render | TypeScript and Vite passed; nine app pages and all four launch steps rendered without old protocol labels or developer setup copy |
| Browser and live reads | Updated launch UI and empty independent discovery feed checked in the in-app browser; live RPC confirmed chain 46630 at block 152114532; status has no old protocol addresses and legacy artifact endpoint rejects requests |

Live provider access returned HTTP 403 during the prior same-day check. No live generation recovery is claimed by this migration. Tests use a controlled provider fixture for that boundary.

No public factory/token deployment, independent audit, live market liquidity or hosted service is claimed. Public wallet-signing validation and real-network issuance/payout receipts remain outstanding. Test results are not an audit or a financial safety guarantee.
