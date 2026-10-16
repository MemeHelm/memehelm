# Robinhood Chain migration

Date: 2026-10-16 (Asia/Shanghai).

MemeHelm now targets **Robinhood Chain Testnet (46630)** through Flap. The creator-led launch, AI writing workspace, fixed two-recipient revenue vault, brand and desktop interface are retained. This is a network migration, not a Robinhood brokerage integration or affiliation.

## Verified network and contracts

| Setting | Value |
| --- | --- |
| Chain ID | 46630 (`0xb626`) |
| Native currency | ETH; testnet funds have no monetary value |
| RPC | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://explorer.testnet.chain.robinhood.com` |
| Flap Portal | `0x26605f322f7fF986f381bB9A6e3f5DAb0bEaEb09` |
| Flap VaultPortal | `0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B` |
| Tax Token V3 implementation | `0x7777C8743C88B3aff3cf262135beF2c8b2e83333` |
| Flap Guardian | `0x0000b48720d3B4ED6BC5031768B07F2b59270000` |

The official RPC returned chain 46630 and nonempty code for all four contracts. The Guardian address matches the retained official Flap base contracts. Robinhood mainnet (4663) and BNB chains are blocked by the wallet transaction guard and factory constructor.

## Launch path

- Tax Token V3 via `newTokenV6WithVault`, native ETH quote, V2 migrator, DEX0, 80% graduation threshold, `7777` CREATE2 suffix, and the custom two-recipient vault.
- Flap's Robinhood guide supports only Non-Tax `TOKEN_V2_PERMIT` and Tax Token V3, with V2 migration and native ETH. The non-tax path is not integrated into this release.
- Native quote configuration read from the deployed Portal: `enabled=1`, `defaultCurve=25`, `alternativeCurve=25`, `nativeToQuoteSwapType=0`, `dexId=0`. The guide names the current curve `CURVE_RH_TOSHI_5ETH`.
- The archived interface's curve enum stops at 24. The live configuration read uses a separate uint8-based ABI rather than decoding an unknown Solidity enum. Launch preparation rejects a disabled quote, unexpected default curve, or unexpected DEX instead of silently adapting to changed economics.
- Lifetime received native ETH is the vault balance plus released funds. Revenue split and Guardian upgrade trust are unchanged. This does not authorize automated trading, publishing to X, or paid onchain AI callbacks.

## Isolation and compatibility

- Browser factory, draft, draft ID and wizard progress use `memehelm:46630:*` keys. Old BNB keys remain untouched and are not reused.
- Default local data directory is `data/robinhood-testnet`; records are also filtered and validated by chain ID. Old BNB records are not relabeled or exposed as Robinhood projects.
- RPC configuration is `ROBINHOOD_TESTNET_RPC_URL`; optional factory configuration is `ROBINHOOD_SPLIT_FACTORY_ADDRESS`. Old BSC factory configuration is ignored.
- Explorer links, currency labels, signing prompts, public pages, guides and AI context target Robinhood/ETH. ETH balances remain explicitly testnet values.
- ERC-20 reads do not assume that the generic Multicall3 deployment exists on this network.
- Model credentials remain in the ignored server environment. No provider key is copied into source or browser assets.

## Validation

The read-only Foundry fork against actual Robinhood Testnet contracts passed at block **136509923**. It deployed the new factory locally, launched a token through the actual Portal/VaultPortal, verified token and vault setup, dispatched actual protocol taxes, and paid both recipients. There was no broadcast, public deployment, or real-money spending. The test's overall gas includes local vanity-address search and is not a transaction quote.

A public wallet-signed Robinhood Testnet launch and payout session remains outstanding. Historical BNB fork evidence and the earlier internal specification review do not certify the migrated build. Browser screenshot/pointer QA remains limited by the previously recorded preview connection failure.

## Official references

- [Robinhood network configuration](https://docs.robinhood.com/chain/connecting/)
- [Robinhood deployment guide](https://docs.robinhood.com/chain/deploy-smart-contracts/)
- [Flap deployed addresses](https://docs.flap.sh/flap/developers/deployed-contract-addresses)
- [Flap Robinhood integration guide](https://docs.flap.sh/flap/developers/token-launcher-developers/robinhood-integration-guide.md)
- [Flap Vault developer guide](https://docs.flap.sh/flap/developers/vault-developers/quick-start-vault-developers)

Flap currently quotes an optional audit/badge path at 0.16 ETH per factory. No audit or badge is claimed or purchased by this migration.
