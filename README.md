# MemeHelm

**Launch it. Steer it.**

MemeHelm is a workspace for launching and managing meme projects on Robinhood Chain. It uses pons v2 for token issuance and trading, alongside tools for project planning, community activity and creator revenue.

The interface keeps your current task in one main window, with MATE, the AI assistant, available beside it. Private work is tied to your wallet. Public updates require approval, and every onchain transaction requires your wallet signature.

## Features

| Area | What it does |
| --- | --- |
| Launchpad | Save launch drafts, prepare token details, choose a fee recipient, review live pons settings and sign the launch. |
| Projects | Create or import a project, then manage its knowledge, tasks, content calendar, artwork and recorded outcomes. |
| MATE | Ask platform questions before creating a project, or use project context for writing, reviews and action proposals. |
| Community | Publish a project page, organize events, manage contribution goals and record community results. |
| Treasury | Collect creator fees, release fixed ETH shares, review holder-sample payouts and manage delayed escrow releases. |
| Market | Discover pons launches, inspect token activity, trade supported ETH pairs and maintain private watchlists and alerts. |

MATE's proposals stay private until reviewed. Project observations and scheduled AI reviews are separate settings, both off by default. All dates and schedules use UTC.

Community content can be drafted and posted manually on X without a developer application. The optional X integration supports OAuth, reviewed publishing and requested engagement reads; it requires application credentials and account authorization. Discord and Telegram are community links.

## Run locally

Requires Node.js 24 or later and pnpm. An EVM browser wallet is needed for sign-in and transactions.

```sh
git clone https://github.com/MemeHelm/memehelm.git
cd memehelm
pnpm install
pnpm contracts:build
pnpm dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317). The API runs on port `4318`.

To serve a production build locally, stop the development processes and run:

```sh
pnpm build
pnpm start
```

The built application is available at [http://127.0.0.1:4318](http://127.0.0.1:4318).

## Configuration

Copy [`.env.example`](.env.example) to `.env` when configuring the server. Restart the server after changing it.

| Variable | Purpose |
| --- | --- |
| `ROBINHOOD_MAINNET_RPC_URL` | RPC endpoint for Robinhood Chain, chain ID `4663`. Defaults to the public mainnet endpoint. |
| `AI_API_BASE`, `AI_API_KEY`, `AI_MODEL` | Server-side settings for an OpenAI-compatible provider. Required for AI chat and writing. |
| `APP_ORIGIN` | Origin used for wallet sign-in. The sample configuration uses `http://127.0.0.1:4318`. |
| `DATA_DIRECTORY` | Persistent workspace directory. Defaults to `data/robinhood-mainnet-pons-v2`. |
| `X_CLIENT_ID`, `X_CLIENT_SECRET`, `SOCIAL_ENCRYPTION_KEY` | Optional X integration. See [community setup](docs/COMMUNITY_WORKSPACE.md). |

Keep credentials in the server environment. Do not add wallet private keys or seed phrases. Environment files, workspace data and generated artifacts are excluded from Git.

Local image uploads provide a preview. Token artwork requires a hosted HTTPS or IPFS link.

## Development

The frontend uses React, TypeScript and Vite. The Node.js server uses SQLite for workspace records and the launch index, and viem for chain reads and transaction preparation. The revenue contracts are written in Solidity.

| Path | Contents |
| --- | --- |
| `src/` | Workspace interface and wallet interaction |
| `server/` | Authentication, APIs, MATE, community tools and event indexing |
| `shared/` | Protocol definitions, validation and shared calculations |
| `contracts/` | Revenue vaults and contract tests |
| `test/` | Application and integration tests |
| `docs/` | Product scope, protocol notes and validation records |

```sh
pnpm check
```

This compiles the vaults, runs the Node test suite, checks TypeScript and builds the frontend. Additional checks:

| Command | Purpose |
| --- | --- |
| `pnpm contracts:test` | Run Solidity tests. Requires Foundry. |
| `pnpm verify:mainnet` | Verify official deployments and current configuration through read-only mainnet requests. |
| `pnpm verify:fork` | Check the issuance, trading and revenue flow against a local Anvil mainnet fork. See [fork setup](docs/VALIDATION.md). |

## Current limits

- **Network:** Robinhood mainnet, chain ID `4663`, with pons v2 as the issuer. Trading is supported for native ETH pairs; custom-pair pages are read-only. Cross-chain issuance and autonomous market making are outside the product scope.
- **Market history:** discovery retains verified factory events and resumes missing ranges across restarts. It starts from a recent 20,000-block window and advances when requested. The interface shows actual coverage and freshness. Trade and creator research still use bounded recent queries; complete historical coverage and funding relationships are not available.
- **Holder payouts:** allocations use the balances returned by the explorer. This is a sample, without a complete-holder or fixed-block guarantee. The owner reviews the coverage and recipient amounts before signing.
- **External services:** RPC, explorer and AI availability affect their respective features. Direct X publishing is tested locally with a simulated provider; it has not been verified with a real X account.
- **Deployment and security:** the server binds to loopback and runs as a single local instance. Public deployment, end-to-end verification with a real mainnet wallet and an independent audit of the MemeHelm vaults have not been completed. Local tests and fork checks do not replace these steps.

MemeHelm is an independent project and is not affiliated with Robinhood or pons.

## Documentation

- [Product scope](docs/PRODUCT_RELEASE.md)
- [Workspace and navigation](docs/SINGLE_WORKSPACE.md)
- [MATE operations](docs/OPERATIONS_WORKSPACE.md)
- [Community workflows](docs/COMMUNITY_WORKSPACE.md)
- [Protocol integration](docs/PROTOCOL_NOTES.md)
- [Validation](docs/VALIDATION.md)
- [Development plan](docs/MEMEOS_ALIGNMENT_PLAN.md)
