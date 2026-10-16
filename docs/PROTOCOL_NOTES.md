# Protocol notes

Reference check: 2026-10-16. Contract addresses and protocol rules must be rechecked before a public deployment. Historical BNB test results do not certify this migration.

## Selected path

Robinhood Chain Testnet (46630), native test ETH quote, Tax Token V3, `VaultPortal.newTokenV6WithVault`, `FOUR_FIFTHS` (80% supply) graduation threshold, V2 migration, DEX0, 100% of the token's marketing/vault allocation directed to the split vault. The vault then accounts between project and audit recipients. Buy/sell taxes remain user-reviewed launch settings. Wallet writes and factory deployment reject mainnet and BNB chains.

The V6 path was selected because [Flap's launch guide](https://docs.flap.sh/flap/developers/token-launcher-developers/launch-token-through-vaultportal) documents it for Tax Token V3. The guide describes narrower current support and an allowlist for the V7-with-vault path; this project does not assume V7 allows every custom factory.

The [Robinhood integration guide](https://docs.flap.sh/flap/developers/token-launcher-developers/robinhood-integration-guide.md) limits launches to native ETH, V2 migration, Non-Tax `TOKEN_V2_PERMIT` or Tax Token V3. Only the Tax Token V3 path is integrated here. The native quote read returned enabled=1, default curve=25 and DEX0; launch preparation rejects unexpected changes. The archived curve enum stops at 24, so configuration reads use a separate integer-based ABI without modifying the canonical files.

## Source handling

`contracts/src/flap/` is copied unchanged from the official [FlapVaultExample](https://github.com/flap-sh/FlapVaultExample) archive. Retain that canonical directory and its interfaces. Do not patch them to make a custom implementation compile.

Downloaded branch: `main`. Retrieval date: 2026-10-15.

Archive SHA-256: `2F6549AF3A53A33252186F3504046734741A4B246DE413E2C1B97D5FB03203AF`.

The archive hash identifies the retrieved files; it is not a pinned upstream Git commit. Before future upgrades, resolve the exact upstream commit and review interface changes.

## Published Robinhood Testnet addresses

| Contract | Address |
| --- | --- |
| Portal | `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` |
| VaultPortal | `0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B` |
| Tax Token V3 implementation | `0x7777C8743C88B3aff3cf262135beF2c8b2e83333` |
| Guardian | `0x0000b48720d3B4ED6BC5031768B07F2b59270000` |

Source: [Flap deployed addresses](https://docs.flap.sh/flap/developers/deployed-contract-addresses) and canonical `VaultBase.sol`.

The official tables list different mainnet/testnet Portal versions. RPC checks confirm chain 46630 and contract code. A local fork of the actual Robinhood deployment passed token creation, vault registration, tax dispatch and both payouts at block 136509923. This does not replace a wallet gas simulation or a completed public-testnet session. See [ROBINHOOD_MIGRATION.md](ROBINHOOD_MIGRATION.md).

## Vault authority and accounting

- The implementation inherits `VaultBaseV2`. Factory inherits `VaultFactoryBaseV2` and rejects non-native quote tokens.
- `receive()` logs incoming value without calling recipients or swapping.
- Lifetime received native ETH is `balance + totalReleased`. Each recipient's available entitlement is its cumulative share minus its cumulative released amount. Project share receives integer-division remainder.
- Independent pull payouts isolate rejecting recipients and use a reentrancy guard.
- No AI, keeper, price oracle or automated swap is part of this vault.
- Beacon ownership goes directly to the Flap Guardian in the constructor. Upgrades are therefore a centralized trust assumption. The creator cannot silently change recipient shares through an exposed setter, but a Guardian-approved implementation upgrade could alter behavior.
- Native-only V2 vaults do not claim ERC20-quote compatibility. ERC20 quote support would require the V3 balance-delta accounting model and separate tests.

## Fees and future certification

[Flap's guide](https://docs.flap.sh/flap/developers/vault-developers/quick-start-vault-developers) currently describes optional partner audit certification at 0.16 ETH per factory and separate official custom-UI review after audit. Recheck price and scope before purchase. The standalone local app does not request either service; test ETH cannot pay a real audit provider.

The factory commission is zero in this prototype. Before adding a fee, assess the fee recommendation in Flap's checker, validate it against asymmetric token taxes and the actual revenue received, and disclose the fee basis and recipient. Do not describe token tax, protocol fees, LP fees and platform revenue as the same number.

## External dependencies

- Flap contracts and IPFS metadata availability.
- Robinhood Testnet RPC access; configured endpoints are checked for chain ID 46630.
- An injected wallet for user-initiated transactions.
- Optional user-configured model provider; only requested writing tasks call it.

The standalone local application is not the Flap-hosted `flap-vault-component-template` package. If official hosting is needed later, build and validate that separate constrained UI package through Flap's current workbench flow.
