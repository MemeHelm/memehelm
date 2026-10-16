# Flap capability map

Researched on 2026-10-16. This is internal product planning, not website copy. It records documented protocol capabilities; it does not certify deployment compatibility or completed MemeHelm integrations.

## Current network — Robinhood Chain

As of 2026-10-16, MemeHelm targets Robinhood Chain Testnet (46630), native ETH. The official Robinhood integration guide supports non-tax `TOKEN_V2_PERMIT` and Tax Token V3, V2 migration only, and native ETH only. MemeHelm currently integrates the Tax V3 custom two-recipient vault path; this does not automatically enable other vaults or AI execution. See [ROBINHOOD_MIGRATION.md](ROBINHOOD_MIGRATION.md) for verified addresses and tests. The capability research below is cross-chain; BNB-specific infrastructure must not be advertised on Robinhood without a separate deployment check.

## Model the choices independently

MEME OS mode names are product choices, not Flap protocol primitives. For MemeHelm, separate:

1. Token type: standard or tax-bearing token.
2. Revenue destination: creator wallet, split vault, or Gift Vault.
3. Tax allocation: recipient/vault, burn, dividends, and liquidity, where permitted by the selected launch path and factory.
4. Operations: creator-led AI assistance, or an independently implemented and tested agent vault.

AI assistance can accompany several revenue arrangements. A split vault does not imply AI autonomy. A vault manages revenue; it does not automatically impose new rules on every token transfer.

## Documented capabilities

| Capability | Flap provides | MemeHelm implication |
| --- | --- | --- |
| Standard / tax tokens | Both token types; Tax Token V3 supports asymmetric buy/sell taxes | Build separate valid transaction paths rather than relabel the existing custom-vault path |
| Creator wallet | Portal tax-token launch with a beneficiary address | A creator-led launch need not deploy a custom factory |
| Split Vault | Official factory; 1–10 unique, nonzero recipients; allocations sum to 10,000 bps; claim/dispatch methods | Reuse the official factory where appropriate; its encoding and payout interface differ from our two-recipient vault |
| Gift Vault V2 | X ownership proof controls revenue routing; current taxed and zero-tax variants; unactivated routing falls back to holder dividends after a factory-configured timeout (documented default 7 days) | Implement the current V2 path, proof validation, timeout behavior, and factory-specific launch constraints |
| Burn / dividends / liquidity | Tax allocation fields in the token-launch interface | These are economic settings, not necessarily mutually exclusive run modes |
| AI Oracle | Paid reasoning requests, numeric decisions, callbacks, IPFS reasoning proofs, BNB mainnet and testnet addresses | An agent vault is feasible using official infrastructure, but spending limits, strategy, execution, stale decisions, refunds, and failure handling remain our responsibility |
| Trigger Service | Paid delayed callbacks on BNB mainnet and testnet, with a trusted execution backend | Reuse for scheduled vault operations; design for delayed execution and callback failure |
| Sentinel-style transfer rules | No equivalent general max-wallet/anti-dump transfer-rule suite identified in the reviewed standard launch paths | Do not advertise those rules on the basis of a revenue vault or anti-farmer setting alone |
| Bitcoin Rune | No native Rune issuance/Bitcoin-to-Solana route identified in reviewed BNB Flap launch interfaces | Exclude from the BSC/Flap scope |

## Important version differences

- The registered-vault table and official skills still list legacy Gift V1 factories. The dedicated Gift Vault guide explicitly recommends V2 for new integrations.
- Gift V1 timeout falls back to buyback and burn. Gift V2 timeout falls back to holder dividends. Never mix these descriptions or ABI assumptions.
- GiftTaxVaultFactoryV2 requires equal buy/sell rates of 1%, 2%, or 3%, native BNB quotes, and the documented dividend settings. Those constraints differ from a generic V3 launch.
- GiftV4VaultFactoryV2 is a separate zero-tax product and requires the documented non-tax token version. The current custom-tax-vault path cannot simply be reused for it.
- General V3 documentation permits one tax rate to be zero as long as the other is nonzero. MemeHelm currently applies a more conservative both-nonzero constraint; this is an application limit, not a statement of Flap's full capability.
- AI Oracle and Trigger documentation remain under Preview. Deployed addresses are documented, but testnet AI fulfillment may stop when the service budget is exhausted.
- Oracle and scheduling calls are paid services. Query model pricing / trigger fees onchain at the time of use, preserve a budget, and handle unavailable fulfillment. They do not make autonomous operations free.

## Integration priorities

Start with creator-led launches and revenue distribution. Add the official Split Vault and current Gift Vault V2 paths only after ABI, live read-only factory/schema checks, fork simulation, payout reads, and wallet review behavior are verified. Build an agent vault as a separate capability with explicit execution limits and runtime cost controls. Do not place unimplemented modes into a working launch selector.

MemeHelm now uses its custom two-recipient vault path on Robinhood Testnet. This capability research did not deploy contracts, submit proofs, invoke paid AI services, broadcast transactions, or enable new launch modes.

## Primary sources

- [Robinhood Chain integration guide](https://docs.flap.sh/flap/developers/token-launcher-developers/robinhood-integration-guide.md)

- [Flap overview](https://docs.flap.sh/flap)
- [Portal vs VaultPortal](https://docs.flap.sh/flap/developers/basic-and-mechanism/portal-vs-vaultportal)
- [Registered vaults](https://docs.flap.sh/flap/developers/token-launcher-developers/registered-vaults.md)
- [Gift Vault — current V2 and legacy V1](https://docs.flap.sh/flap/developers/vault-developers/gift-vault)
- [Vault developer quick start](https://docs.flap.sh/flap/developers/vault-developers/quick-start-vault-developers)
- [Flap AI Oracle](https://docs.flap.sh/flap/developers/preview/flap-ai-oracle.md)
- [Flap Trigger Service](https://docs.flap.sh/flap/developers/preview/flap-trigger-service)
- [Official BNB tax parameters](https://github.com/flap-sh/flap-skills/blob/main/launch-bnb-token-on-flap/references/tax-params.md)
- [Official BNB transaction construction](https://github.com/flap-sh/flap-skills/blob/main/launch-bnb-token-on-flap/references/construct-tx.md)
