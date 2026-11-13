# MemeHelm

**Launch it. Steer it.** An English-language creator workspace on **Robinhood Chain mainnet (4663)**, with issuance and trading through **pons v2**. MemeHelm is independent of Robinhood and pons; neither endorsement nor affiliation is implied.

The user selected mainnet development on 2026-11-12. There is no testnet product. The backend never holds a signing key or broadcasts user transactions. Users review and sign each onchain action in their own EVM wallet. Public hosting remains deferred.

## Product

- Four-step issuance: identity and hosted artwork, direct recipient or fixed two-wallet ETH split, live issuance economics, and mainnet review. No factory deployment or creator preallocation. Pons receives the launch fee and mints supply to its curve.
- Live per-wallet launch permission, enabled supply/curve plans, creator-fee cap and launch fee. Every prepared launch pins the protocol economics and expires after 90 seconds.
- Wallet-signed curve buys/sells, final-buy partial-fill refunds, and graduated Uniswap v4 trades using Universal Router 2.1.2 and exact ERC-20/Permit2 approvals. Quotes show fees, slippage, minimum output, expiry and each signature step.
- Revenue separates unsettled gross protocol fees, the recipient-wide ETH escrow balance, and ETH received/released by the fixed splitter. Settle eligible ETH fees, collect escrow funds, then release each fixed share. Fees requiring conversion/buybacks wait for the protocol operator.
- Discovery reads recent official factory launches. Token details include prices in each launch’s quote asset, indicative FDV, real curve reserves, graduation phase, observed prices and recent verified trades. Holder data is optional from Blockscout. Market facts, trades and holders load independently with bounded read deadlines. ETH-paired trading remains the only trading mode; custom-pair pages are read-only. Coverage is bounded and stated; there are no invented USD prices or historical candles.
- Private watchlists and observed price/holder/graduation alerts. Monitoring runs only while the local server runs, and never calls paid AI or signs transactions automatically.
- AI assistant name, voice and community goal; requested daily briefs, social drafts, seven-day plans and signal briefs. Draft history is private until explicitly shared on the creator’s opt-in project page. **Live social drafting, daily briefing and Signals briefing with private persistence passed on 2026-11-13; see [AI acceptance](docs/AI_ACCEPTANCE_2026-11-13.md) for model-specific evidence and provider limits.**
- Project operations in Copilot: persistent story/audience/roadmap/commitments/boundaries, observed events, AI-proposed actions, manual tasks/updates, due dates, revision-checked review, separate publication confirmation, task outcomes and a factual journal. Writing also uses memory and past outcomes. The daily project AI request allowance survives restart; observations and scheduled AI reviews are separately opt-in and start paused. See [operations scope and acceptance](docs/OPERATIONS_WORKSPACE.md).
- Branded desktop, movable/resizable windows, taskbar, split calculator, wandering light points, entrance motion and reduced-motion support. All user-facing copy is English.

Autonomous market making and cross-chain issuance are excluded. Buyback vesting is not offered by this launch flow. Local image files are previews; supply a hosted HTTPS/IPFS image link to publish artwork.

Operations currently executes approved project-page updates and tracks creator-completed tasks. X/Telegram publishing and social-feedback ingestion are not connected. Scheduled operations run while the local backend is online. The allowance measures request count, including failed attempts, not currency spend. No AI wallet or autonomous financial execution is provided.

## Run locally

Node.js 24+, pnpm and an EVM browser wallet are required. No seed phrase or wallet private key belongs in the backend.

~~~sh
pnpm install
pnpm contracts:build
pnpm dev
~~~

Development UI: http://127.0.0.1:4317. API: http://127.0.0.1:4318. For the built app, run `pnpm build` and `pnpm start`, then use port 4318.

Copy .env.example to the ignored .env if configuration is needed. The optional RPC override is ROBINHOOD_MAINNET_RPC_URL; its chain must be 4663. AI_API_BASE, AI_API_KEY and AI_MODEL stay server-side. APP_ORIGIN defines the wallet-sign-in origin. DATA_DIRECTORY defaults to data/robinhood-mainnet-pons-v2. Earlier prototype databases and wallet-scoped browser keys are not reused.

## Verify

~~~sh
pnpm check
pnpm contracts:test
~~~

See [validation](docs/VALIDATION.md) for local fork verification. All fork writes target a local Anvil process, never the mainnet RPC. Pons deployments and runtime hashes are pinned in shared/pons-addresses.mjs and rechecked before preparing writes. Independent contract audit, public hosting and a human-signed real mainnet launch are not completed by local tests.

[Protocol integration](docs/PROTOCOL_NOTES.md) · [scope](docs/PRODUCT_RELEASE.md) · [plan](docs/PROJECT_PLAN.md)
