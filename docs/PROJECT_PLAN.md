# Project plan

## Product

An English-language launch and operations desk for BNB Chain creators using Flap. The first audience is small project teams that want a transparent revenue plan and an AI writing/research assistant without handing over a primary wallet key.

## Milestones

| Milestone | Deliverable | Acceptance criterion |
| --- | --- | --- |
| 0 — Local foundation | English UI, Flap interfaces, native split factory/vault, local API, AI configuration | App builds, contract and boundary tests pass, missing connections are explicit |
| 1 — Public testnet proof | Wallet-signed factory deployment, Flap token creation and independent payouts | Explorer receipts connect creator → token → vault; observed revenue matches released + pending amounts |
| 2 — Pricing and operating model | Explicit platform commission, project share, audit-reserve share, provider usage budget | Rates and destinations are visible before signing; no undisclosed address or fee |
| 3 — Hosted service | Authentication, per-user data ownership, durable database, API abuse/rate controls, indexer and monitoring | Another user cannot read or modify a private workspace; restarts/reorgs/retries do not corrupt records |
| 4 — Mainnet pilot | Separately reviewed production configuration and restricted initial rollout | Production transaction simulations, Flap path compatibility and operational recovery are demonstrated |
| 5 — Funded audit | Partner review of the actual released factory/implementation version | Budget covers current quoted scope; report and risk status are linked to deployed addresses |

## Budget policy

Do not purchase an audit during development. Use local EVM and BNB Testnet first. Audit-reserve allocations are configurable per project. Keep testnet and real-income accounting separate. Record any real mainnet audit spending only after a separately authorized payment.

The initial code is not a revenue guarantee. Without launched projects, trading activity, and a finalized commission model, platform revenue is zero. The local prototype uses no factory commission.

## Required founder decisions before a public product

1. Final brand name and domain.
2. Which revenue belongs to the project and which funds the platform.
3. Reserve percentage, ownership of the reserve wallet, withdrawal governance and whether the target stops or continues after an audit.
4. Model provider, monthly spending ceiling and initial hosting budget.
5. Which actions remain wallet-signed and which might later use bounded automation.

These decisions do not block the current local/testnet foundation. They must be reflected in the UI and contract configuration before real user funds are involved.

## First real integration session

Use a dedicated BNB Testnet wallet, a second public treasury address and a valid pinned metadata CID. Deploy this factory from the app, launch a Tax Token V3 using native tBNB, then trace actual Flap revenue to the vault. Keep explorer transaction hashes as acceptance evidence. Do not infer that a passing local mock test proves the live protocol path.
