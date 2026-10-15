# Internal Flap Vault Specification Review

**Reviewer:** GPT-6-based coding assistant  
**Date:** 2026-10-15  
**Contracts:** `contracts/src/RevenueSplitVault.sol`, canonical Flap bases, relevant OpenZeppelin dependencies  
**Status:** Development self-review only; **unaudited** for product and certification purposes.

This report is AI-generated and should be checked by a human reviewer. It is not a paid independent audit, does not grant Flap certification, and does not establish the absence of vulnerabilities.

## Executive summary

The prototype implements a native-BNB revenue splitter behind a BeaconProxy and a Flap V2 factory. It follows the official base interfaces and UI-schema conventions, keeps the receive path lightweight, isolates payouts, and gives beacon upgrade ownership exclusively to the official Flap Guardian.

The tested development configuration did not produce an unresolved critical/high finding in this review. That statement is limited to the code paths and simulations below. Mainnet use is blocked; public wallet-signed and visual browser checks remain outstanding.

## Scope and method

Applied the official `flap-vault-spec-checker` instructions from the downloaded [FlapVaultExample skill](https://github.com/flap-sh/FlapVaultExample/blob/main/.agents/skills/flap-vault-spec-checker/SKILL.md). Read Rules 001–010, the imported canonical contracts and our implementation. Used static review, solc compilation, Foundry tests, in-memory EVM tests and a live-testnet fork simulation. Source provenance is recorded in `docs/PROTOCOL_NOTES.md`.

## Findings summary

| Severity | Count | Description |
| --- | --- | --- |
| Critical | 0 identified | No unresolved finding in reviewed paths |
| High | 0 identified | No unresolved finding in reviewed paths |
| Medium | 0 identified | No unresolved finding in reviewed paths |
| Low | 0 identified | No unresolved finding in reviewed paths |
| Informational | 3 | Guardian trust, zero-commission product choice, native-only/rollout scope |

## Protocol rules first

| Rule | Result | Evidence / scope |
| --- | --- | --- |
| 001 — V2 vault, schemas, Guardian access | Pass for implemented scope | `VaultBaseV2`; nonempty schema; public fixed-recipient release; beacon owned by Guardian |
| 002 — V2 factory and commission | Pass / product note | `VaultFactoryBaseV2`; VaultPortal-only creation; zero factory commission, so no paid commission formula is applied |
| 003 — Fairness | Pass for implemented scope | No swaps or price-sensitive privileged controls; recipients cannot be changed through a creator setter |
| 004 — UI-friendly errors/languages | Pass for custom code | Literal English errors; English is the only supported product language. Canonical imports remain unchanged |
| 005 — Receive gas | Pass | Constant-time event-only receive path; tested under 1,000,000 gas, no recipient/external calls |
| 006 — Integration coverage | Pass for development scope | Foundry suite, local-EVM adversarial cases, real-protocol fork launch/dispatch/release |
| 007 — On-chain AI callbacks | Not applicable | AI is an optional off-chain drafting service with no financial tools |
| 008 — Trigger callbacks | Not applicable | No keeper/trigger integration in this milestone |
| 009 — Emergency controls | Proxy exception applies | BeaconProxy upgrade authority is Guardian-only; no deployer upgrade path |
| 010 — ERC20-quote accounting | Not applicable | Factory accepts only native BNB; no V3 ERC20-quote compatibility is claimed |

## Informational findings

### I-01 — Guardian-controlled upgrades are a material trust assumption

The factory transfers beacon ownership directly to Flap's chain-specific Guardian. The creator/deployer cannot upgrade the implementation. A Guardian upgrade affects every vault using the beacon and can change the current recipient/accounting behavior. The UI and README disclose this control. Do not advertise unconditional immutable fund routing.

### I-02 — Prototype commission is zero

The builder has not selected a platform fee model. The current factory embeds no platform fee recipient and charges no commission. Audit-reserve share is a user-configured allocation to a separate fixed wallet. A later monetization model must identify who owns that wallet, show its fee basis and destination before signing, and revisit Flap's commission recommendation. No claim of current platform income is justified.

### I-03 — Scope excludes ERC20 quotes and mainnet

The factory is chain-97-only and supports only native BNB. Production mainnet support, ERC20 quote accounting, real provider calls, production authentication, and public wallet-signed integration are not certified by these results. Accidental ERC20 transfers are outside normal accounting; recovery would require a Guardian-controlled implementation change.

## Centralization analysis

- Guardian: owns the shared UpgradeableBeacon and can upgrade vault logic.
- Creator/deployer: selects launch-time recipient wallets/shares; retains no direct upgrade authority.
- Any caller: can trigger `release(recipient)` only toward a recorded recipient, never an arbitrary destination.
- Backend: stores local project metadata and performs reads/preparation; holds no user signing key.
- Model provider: generates text only, with no signing or execution tools.

## Gas and code quality

Receive work is bounded and does not depend on recipient responsiveness. Payout uses checks/effects/interactions plus a reentrancy guard. Lifetime-received accounting includes forced native transfers and preserves rounding remainder for the project recipient. The official Flap directory is retained unchanged.

## Testing and next verification

See `docs/VALIDATION.md` for commands and results. Before a public product, complete real testnet wallet signing, visual/browser QA, provider verification, a production data-ownership design, and version-specific mainnet compatibility review. Any code change can invalidate this review's conclusions.

## Conclusion

The tested code is a starting development implementation. Its product audit status remains **unaudited**. There is no partner audit report or low-risk badge, and no real audit payment was made.
