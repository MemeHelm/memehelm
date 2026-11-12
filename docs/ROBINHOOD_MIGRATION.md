# Independent Robinhood migration

Date: 2026-11-12 (Asia/Shanghai).

The initial October migration changed the network but retained Flap. The user has now explicitly removed that dependency. This release replaces the issuance and treasury contracts with independent MemeHelm contracts and removes the old protocol's runtime integration.

## Network

Robinhood Chain Testnet, chain 46630 (`0xb626`), native ETH, RPC `https://rpc.testnet.chain.robinhood.com`, explorer `https://explorer.testnet.chain.robinhood.com`. Mainnet 4663 remains blocked. This is a blockchain integration, not a brokerage connection or endorsement.

## Changes

- Own ERC-20 factory, creator-bound CREATE2 prediction and `TokenCreated` event verification.
- Fixed supply delivered to the creator. No transfer tax, mint authority or upgrade function.
- Own non-upgradeable splitter with immutable recipients, cumulative accounting and independent payouts.
- Optional initial funding explicitly labeled as a vault deposit. Removed buy/sell taxes, tax duration, anti-farmer fields, graduation claims, old audit-price references and external protocol fees.
- Generic ERC-20/holder reads replace protocol-specific price and reserve reads. Unsupported market data stays unavailable. Discovery accepts only matching MemeHelm factory bytecode.
- Default database `data/robinhood-independent`; browser draft/factory state has an `independent` namespace. Old data is retained without reuse or relabeling.
- Environment factory key is `MEMEHELM_LAUNCH_FACTORY_ADDRESS`; old factory keys are ignored.

## Evidence

Local EVM tests cover factory deployment, API preparation, creator-signed issuance, receipt verification, token supply, initial deposit, publication, treasury reads and payouts. Foundry verifies chain restrictions and fuzzes accounting. No public transaction was broadcast.

October Flap/BNB fork results and the old internal review are historical evidence about a different implementation. They do not certify this release. There is no independent audit claim.

Reference: [Robinhood network configuration](https://docs.robinhood.com/chain/connecting/).
