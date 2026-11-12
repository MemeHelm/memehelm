# MemeHelm

**Launch it. Steer it.** An independent, English-language token creation and operations workspace on **Robinhood Chain**. MemeHelm is not affiliated with or endorsed by Robinhood.

This release runs locally on **Robinhood Testnet, chain 46630**. Mainnet transactions remain blocked. Public hosting is deferred at the user's request.

## Independent issuance

MemeHelm uses its own `MemeHelmLaunchFactory`, fixed-supply `MemeHelmToken` and non-upgradeable `RevenueSplitVault`. No third-party launchpad, registry, Guardian or protocol fee is required. The previous Flap integration has been removed.

- A creator signs a transaction to deploy the factory, unless a matching factory is already configured. Its deployed runtime bytecode must match the compiled artifact.
- A launch creates an ERC-20 with 18 decimals and a chosen fixed supply, delivered entirely to the signing creator. There is no additional mint, token owner, transfer tax, blacklist or upgrade function.
- Each launch creates a separate native-ETH splitter with two fixed recipient wallets and a fixed reserve percentage. Anyone can trigger a payment, but cannot redirect it.
- Optional initial funding is an **ETH deposit to the split vault**, not a token purchase. The testnet cap is 1 ETH. There is no separate launch commission; network gas still applies.
- **Launching does not create a trading pool, bonding curve, market price or liquidity. There are no automatic trading fees, buybacks, holder rewards or market-making strategies.** Those require separate implementations and validation.
- Token and metadata information use manually supplied IPFS links. Local image selection previews a file; it does not upload it.

## Workspace

- A branded desktop with movable/resizable windows, Start menu, taskbar, restrained entrance animation, wandering light points and reduced-motion support.
- Four-step launch flow, private drafts, split calculator, treasury balances, independent payouts, project imports and opt-in community pages.
- Discover indexes confirmed events from verified MemeHelm factories. Generic Robinhood ERC-20 lookup reads supply/name/symbol/decimals from RPC and holder data from Blockscout. No unsupported price, volume, graduation or trading history is shown.
- Signals checks observed holder counts every minute while the local backend runs. Missing data does not create an alert. Private watches can be paused or removed, and alerts marked read.
- Requested AI daily briefs, social drafts, community plans and signal explanations, with private saved history and explicit sharing. No automatic social posting or financial action. The current real provider has returned HTTP 403; provider access must be restored for live generation. Mocked-provider integration tests are separate evidence.
- EIP-4361 wallet sessions, one-use challenges, HttpOnly cookies, wallet-owned APIs and a transactional local SQLite store. Private drafts, model credentials and runtime data are excluded from Git.

## Local setup

Use Node.js 24+, pnpm and an EVM browser wallet. No seed phrase or private signing key is required by the backend.

```sh
pnpm install
pnpm contracts:build
pnpm dev
```

Open `http://127.0.0.1:4317`; the API listens on `127.0.0.1:4318`. For the built app, run `pnpm build` and `pnpm start`, then open port 4318.

Copy `.env.example` to the ignored `.env` when configuration is needed:

| Variable | Purpose |
| --- | --- |
| `APP_ORIGIN` | Wallet sign-in origin; defaults to local port 4318 |
| `ROBINHOOD_TESTNET_RPC_URL` | RPC checked for chain 46630 |
| `MEMEHELM_LAUNCH_FACTORY_ADDRESS` | Optional deployed factory matching this exact build |
| `AI_API_BASE`, `AI_API_KEY`, `AI_MODEL` | Server-only model provider configuration |
| `DATA_DIRECTORY` | Optional workspace path; default `data/robinhood-independent` |

Previous factory environment variables and browser factory/draft keys are not reused. Historical workspace files remain untouched. This prevents old protocol data from being presented as independent launches.

## Verification and remaining work

```sh
pnpm check
pnpm contracts:test
```

Node tests include local-EVM issuance, API preparation, signed launch receipt verification, publication, vault reads and payouts, plus authorization, recipient isolation and reentrancy checks. Foundry includes supply/deposit checks, a mainnet deployment rejection and 256 accounting fuzz cases. These are local tests, not a public deployment or audit.

A real wallet-signed public-testnet deployment/launch/payout is still outstanding. There is no audited release, live trading engine or publicly hosted backend. Audit fees have not been purchased; an internal historical review does not cover these new contracts. See [validation](docs/VALIDATION.md), [protocol notes](docs/PROTOCOL_NOTES.md) and [product scope](docs/PRODUCT_RELEASE.md).
