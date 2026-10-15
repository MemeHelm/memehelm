# Protocol notes

Reference check: 2026-10-15. Contract addresses and protocol rules must be rechecked before a public deployment.

## Selected path

BNB Testnet (97), native tBNB quote, Tax Token V3, `VaultPortal.newTokenV6WithVault`, `FOUR_FIFTHS` (80% supply) graduation threshold, V2 migration, 100% of the token's marketing/vault allocation directed to the split vault. The vault then accounts between project and audit recipients. Buy/sell taxes remain user-reviewed launch settings.

The V6 path was selected because [Flap's launch guide](https://docs.flap.sh/flap/developers/token-launcher-developers/launch-token-through-vaultportal) documents it for Tax Token V3. The guide describes narrower current support and an allowlist for the V7-with-vault path; this project does not assume V7 allows every custom factory.

## Source handling

`contracts/src/flap/` is copied unchanged from the official [FlapVaultExample](https://github.com/flap-sh/FlapVaultExample) archive. Retain that canonical directory and its interfaces. Do not patch them to make a custom implementation compile.

Downloaded branch: `main`. Retrieval date: 2026-10-15.

Archive SHA-256: `2F6549AF3A53A33252186F3504046734741A4B246DE413E2C1B97D5FB03203AF`.

The archive hash identifies the retrieved files; it is not a pinned upstream Git commit. Before future upgrades, resolve the exact upstream commit and review interface changes.

## Published BNB Testnet addresses

| Contract | Address |
| --- | --- |
| Portal | `0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9` |
| VaultPortal | `0x027e3704fC5C16522e9393d04C60A3ac5c0d775f` |
| Tax Token V3 implementation | `0xE6Ff967a887084c16D0fD71548CF709542cc1557` |
| Guardian | `0x76Fa8C526f8Bc27ba6958B76DeEf92a0dbE46950` |

Source: [Flap deployed addresses](https://docs.flap.sh/flap/developers/deployed-contract-addresses) and canonical `VaultBase.sol`.

The official tables list different mainnet/testnet Portal versions. RPC code-existence checks demonstrate that endpoints/contracts are present; they do not verify every ABI method or token-creation combination. A wallet gas simulation and a completed public-testnet session are still required.

## Vault authority and accounting

- The implementation inherits `VaultBaseV2`. Factory inherits `VaultFactoryBaseV2` and rejects non-native quote tokens.
- `receive()` logs incoming value without calling recipients or swapping.
- Lifetime received BNB is `balance + totalReleased`. Each recipient's available entitlement is its cumulative share minus its cumulative released amount. Project share receives integer-division remainder.
- Independent pull payouts isolate rejecting recipients and use a reentrancy guard.
- No AI, keeper, price oracle or automated swap is part of this vault.
- Beacon ownership goes directly to the Flap Guardian in the constructor. Upgrades are therefore a centralized trust assumption. The creator cannot silently change recipient shares through an exposed setter, but a Guardian-approved implementation upgrade could alter behavior.
- Native-only V2 vaults do not claim ERC20-quote compatibility. ERC20 quote support would require the V3 balance-delta accounting model and separate tests.

## Fees and future certification

[Flap's guide](https://docs.flap.sh/flap/developers/vault-developers/quick-start-vault-developers) describes optional partner audit certification at 0.5 BNB per factory and separate official custom-UI review after audit. The standalone local app does not request either service.

The factory commission is zero in this prototype. Before adding a fee, assess the fee recommendation in Flap's checker, validate it against asymmetric token taxes and the actual revenue received, and disclose the fee basis and recipient. Do not describe token tax, protocol fees, LP fees and platform revenue as the same number.

## External dependencies

- Flap contracts and IPFS metadata availability.
- BNB Testnet RPC access; configured endpoints are checked for chain ID.
- An injected wallet for user-initiated transactions.
- Optional user-configured model provider; only requested writing tasks call it.

The standalone local application is not the Flap-hosted `flap-vault-component-template` package. If official hosting is needed later, build and validate that separate constrained UI package through Flap's current workbench flow.
