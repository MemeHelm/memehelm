# MemeHelm

**Launch it. Steer it.** An English-language creator workspace for **BNB Chain + Flap**.

Current release: **local development prototype, BNB Testnet only**. This app is not affiliated with or endorsed by Flap.

## What is implemented

- A desktop-style MemeHelm interface with illustrated app shortcuts, a welcome window, a Start menu, and a taskbar. Tool windows can be switched, moved, resized, minimized, maximized, and closed. On phones, tools fill the available workspace.
- English project, launch, treasury, and copilot tools; a working split calculator that carries its allocation into the launch form; and a user-facing Quick Guide.
- A brief, skippable brand entrance, staggered desktop reveal, hover feedback, and interruptible window opening/minimizing/closing transitions. Reduced-motion preferences bypass the entrance and remove animation. Font readiness is bounded so a slow font cannot block the desktop.
- An original dark brand wallpaper with static sculpted curves and small glowing particles that wander independently. Background layers never intercept clicks.
- User-facing pages omit developer configuration and internal progress information. Engineering setup remains in this README.
- Browser wallet connection and explicit switching to BNB Testnet (chain 97).
- A wallet-signed testnet factory deployment flow.
- A Flap `newTokenV6WithVault` launch builder for native-BNB Tax Token V3, including CREATE2 `7777` salt preparation, exact parameter encoding, and wallet gas simulation before signing.
- A beacon-backed revenue-split vault inheriting the official `VaultBaseV2`, with a factory inheriting `VaultFactoryBaseV2`.
- Project and audit-reserve recipients are fixed when each vault is created; payouts use independent pull payments. Any caller can trigger a payment, but its destination cannot be changed.
- The beacon is owned by the official Flap Guardian. The deployer does **not** retain an upgrade path. Guardian upgrades can alter the implementation and its behavior; displayed shares are not an absolute immutability guarantee.
- Local project drafts/imports, launch receipt verification, native treasury reads and a model-backed content/brief/plan generator.
- Explicit missing-data states: no made-up prices, holder counts, trading volume, AI answers, or audit badges.

The app has not deployed a factory or token on a public network. A read-only fork of the live BNB Testnet contracts has successfully simulated token creation, custom-vault registration, actual tax dispatch and both recipient payouts. A real wallet-signed public-testnet session is the next integration milestone.

## Start locally

Requirements: Node.js 22.12+ (tested on Node 24), pnpm, and an EVM browser wallet for public-testnet writes.

```sh
pnpm install
pnpm contracts:build
pnpm dev
```

Open **http://127.0.0.1:4317**. The API listens only on `127.0.0.1:4318`.

For a local production build:

```sh
pnpm build
pnpm start
```

Open **http://127.0.0.1:4318**. Keep the service local: there is no production multi-user authentication yet.

## Optional configuration

Copy `.env.example` to `.env`. Private environment files are ignored. The server requires **no wallet seed phrase or private key**.

| Variable | Purpose |
| --- | --- |
| `BSC_TESTNET_RPC_URL` | BNB Testnet JSON-RPC endpoint. The server checks chain ID 97. |
| `AI_API_BASE` | A chat-completions compatible base URL, for example your provider's `/v1` endpoint. |
| `AI_API_KEY` | Server-only model credential. |
| `AI_MODEL` | Model identifier accepted by that provider. |
| `SPLIT_FACTORY_ADDRESS` | Optional address after deploying this build's factory on BNB Testnet. |

Without a model configuration, AI stays disabled. On a generation request the server shares the selected project's description and observed chain facts with the configured provider. There is no automatic posting or transaction execution.

## First testnet session

1. Open the app in a browser with an injected EVM wallet. Obtain **tBNB** from the [BNB Chain testnet faucet](https://www.bnbchain.org/en/testnet-faucet).
2. In **Launchpad**, connect your wallet and enable revenue splits. Review the factory activation transaction in your wallet. The wallet flow selects BNB Testnet and uses test gas.
3. In **Launchpad**, enter a token name, symbol and description. Download the metadata template, replace its image placeholder and pin valid image/metadata content on IPFS. Enter the real metadata CID.
4. Choose separate project and audit-reserve wallets. Review the reserve share and tax settings. The UI's 10% reserve and 3% buy/sell tax are **editable draft defaults**, not an agreed business fee model.
5. Prepare the launch. The server checks the network, the factory's beacon owner and the implementation bytecode against the local build, then finds an unused vanity address.
6. Review the **exact** recipients, split, taxes and optional initial buy, then request the wallet signature. `eth_estimateGas` runs first; an incompatible or reverting launch stops before submission.
7. After confirmation, the app verifies the Flap event and saves the project. In **Treasury**, inspect claimable balances and request a wallet-signed release to each fixed recipient.

Actual public-testnet launch compatibility must be verified against the deployed contracts. Flap's published BNB testnet and mainnet versions differ; documentation alone is not proof of a completed integration.

## Revenue and audit budget

- The vault splits **only the native BNB it actually receives**. It does not receive every trading fee or all trade volume. Flap's protocol processing happens upstream.
- This prototype charges **zero separate factory commission**. Reserve share, platform pricing and platform recipient addresses have not been finalized. No hidden platform address is embedded.
- The audit reserve is an accounting destination, not a certification. It does not automatically pay anyone, and a deposit does not grant a low-risk badge.
- Flap's current guide quotes **0.5 BNB per factory** for its partner audit/low-risk-badge path. Recheck pricing and scope when ready. Changes or repeat reviews may have separate terms.
- **tBNB cannot pay for a real audit**. A real audit reserve needs real mainnet income after a separately reviewed mainnet release.
- Mainnet writes are deliberately blocked in both the wallet adapter and the factory constructor. Moving to mainnet requires a new reviewed release and deployment.

## Verification

```sh
pnpm check
```

This compiles artifacts, runs Node validation/model-context tests plus an in-memory EVM contract suite, and builds the English app. Ganache uses its JavaScript fallback on Node 24; that affects test performance, not the deployed contract.

Foundry tests follow Flap's guide:

```sh
forge test --root contracts -vv
```

The project helper excludes the optional network fork from ordinary tests:

```sh
pnpm contracts:test
pnpm contracts:test:fork
```

The fork command uses Cancun-compatible EVM execution because the deployed Flap contracts require those instructions. It reads the public testnet and performs all writes locally; it never broadcasts a transaction.

For this workspace, a checksum-verified Foundry v1.8.5 executable is available under ignored `vendor/foundry-v1.8.5/`. It is a local tool, not a required product dependency.

See [PROJECT_PLAN.md](docs/PROJECT_PLAN.md), [PROTOCOL_NOTES.md](docs/PROTOCOL_NOTES.md), [VALIDATION.md](docs/VALIDATION.md), and [audit_gpt_6.md](audit_gpt_6.md) for milestones, protocol constraints, test evidence, and the internal spec review. The internal review is **not** a third-party audit.

## Code layout

```text
src/                    English React UI and wallet adapter
server/                 Local API, chain reads, vanity worker, model integration
shared/                 Testnet addresses and validated launch parameter builder
contracts/src/          Revenue splitter and canonical Flap interfaces
contracts/lib/          OpenZeppelin and forge-std reference dependencies
contracts/test/         Foundry integration/property tests
test/                   Node boundary tests and in-memory EVM integration tests
scripts/                Compile and local development entry points
docs/                   Product plan, protocol notes and verification record
```

## What comes after this prototype

Finish a public-testnet launch → validate actual Flap payouts → choose a transparent commission model → harden the hosted service → prepare a mainnet release → accumulate real project/platform revenue → purchase a partner audit when affordable.

Full autonomous buybacks, X publishing, social identity claims, Bitcoin Runes, permanent transfer restrictions, and official Flap UI hosting are outside this first milestone.
