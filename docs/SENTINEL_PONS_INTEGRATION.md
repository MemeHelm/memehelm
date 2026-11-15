# Sentinel and pons v2 integration assessment

Assessed on 2026-11-15. This is an implementation compatibility assessment, not a security audit or evidence of a mainnet deployment. No contracts, credentials, deployment configuration or issuance routes were changed for this assessment.

The experimental Sentinel source paths below describe a local research prototype. That prototype and its compiler additions are not included in this product update; references are compatibility findings, not supported modules available in this release.

## Decision

**Do not expose the experimental Sentinel engine as a pons v2 launch mode.** It is a separate issuer and cannot be attached to the current official issuance call. Keep issuance through the verified pons v2 factory on Robinhood Chain 4663. Build transparent, evidence-backed launch rules over that flow; do not label ordinary pons settings as custom Sentinel enforcement.

The existing repository instruction is explicit: “The selected issuance backend is pons v2 on Robinhood mainnet 4663” and “Replace the historical independent issuer rather than treating it as pons-compatible.” `AGENTS.md` also excludes autonomous market making and cross-chain issuance. An independently seeded Sentinel pool would change that approved product boundary.

## Official protocol evidence

The current [official pons v2 documentation](https://docs.ponsfamily.com/v2) describes a factory-created fixed-supply token, an initial bonding curve, and graduation into a locked v4 pool. The launch signature accepts metadata, a fee recipient, creator tax, buyback choice, an economics pin, a salt, a configuration ID and a quote asset; its optional overload accepts snipe-tax exemptions. It does not offer a custom token implementation or hook parameter. The graduated pool uses the shared pons hook. That hook collects fees rather than controlling token transfers. The documented creator controls are the fee recipient and buyback setting. A token remains associated with its original factory/hook stack. These documented interfaces, together with the local adapter below, support the incompatibility conclusion; this review did not independently reverse-engineer deployed bytecode.

## What the current code actually implements

| Area | Active pons path | Experimental Sentinel path | Compatibility consequence |
| --- | --- | --- | --- |
| Entry point | `server/pons.mjs` → `prepareLaunch()` → official `PONS.factory.address` → `launchToken` | `contracts/src/MemeHelmFactory.sol` → its own `launch(LaunchPlan)` | Different callers, calldata, deployment logic and registry events. Changing the destination would replace the issuer. |
| Initial supply | Factory-selected pons token and curve; tracked by `getLaunchedToken` and `TokenLaunched` | Factory deploys `FlapToken`, mints supply to `SentinelLaunch`, then seeds a pool | The experimental token never enters the official pons curve or registry. The historical `FlapToken` filename does not make it a supported integration. |
| Launch funding | Live official launch fee; curve buyers supply quote liquidity over time | `msg.value` must fund immediate liquidity; `launch()` rejects zero liquidity | Exposing it would require a different funding and price-setting workflow, not a new switch on the existing wizard. |
| Pool and hook | `shared/pons.mjs` reconstructs the pool with `PONS.hook.address`; verification pins the factory, hook and escrow | A separately mined, per-launch `SentinelHook` plus its own pool and locker | A v4 pool key has one hook address. Substituting a hook creates a different pool; it cannot modify the existing official pool. |
| Transfer rules | Active `TokenParams` and `LaunchConfig` have no max-wallet, max-transfer, blacklist, cooldown or rule-agent fields | `FlapToken._transfer` checks fixed max-wallet/max-transfer caps until `rulesExpire`; pool-manager and fee-recipient destinations are exempt | These restrictions live in the token implementation. A front-end setting, recipient vault or swap router cannot add them to the pons-issued ERC-20. |
| Opening protection | `options()` reads factory snipe parameters; quotes read `currentSnipeTaxBps(owner)` | Experimental hook uses a distinct linear `snipeBps()` schedule and local immutable parameters | The formulas, timing, fee base and enforcement venue differ. Do not reuse the experimental preview for a pons trade. |
| Fee collection | Pons curve/shared hook → official fee escrow → wallet or verified MemeHelm vault | Experimental hook records output-currency fees and sends them to an immutable recipient | The active vault adapter claims a pons escrow ledger; pointing an experimental hook at a vault does not create that ledger or protocol registration. |
| Adaptive policy | No custom policy agent in the current issuance ABI | Experimental token/hook values are immutable; no agent/rule-update controller is exposed | The prototype is also not an adaptive AI Sentinel. Its existing rules expire permanently rather than being autonomously revised. |
| Evidence | Official factory record, code-hash checks, current permission/economics reads and simulations | `test/sentinel.test.mjs` uses Ganache and the local `TestPoolManager` | Local prototype tests do not establish pons compatibility, official v4 mainnet acceptance or independent audit coverage. |

## What can be added without changing issuance

1. **Verified launch terms.** Reuse `createPons().options(owner)` and `prepareLaunch(owner, input)`. Present the selected supply, curve trading fee, creator tax, fee destination, graduation threshold and quote currency, pinned economics, read block/time, and the exact signing destination. Keep the existing 90-second prepared-transaction expiry.
2. **Opening-fee transparency.** The wizard already supports normalized, unique snipe-exemption wallets (up to 32), the actual overload, and a statement that exemptions only remove the opening fee. Show the exact exemption list again at final review, alongside the connected launching wallet and fee recipient. Use the live curve read for an issued token's present opening fee; a new-launch explanation must not pretend that a live countdown already exists before mining.
3. **Public rule facts.** Extend the token detail's existing facts section with only authoritative pons terms. Classify each fact as fixed-at-creation, currently adjustable, current observation, or unavailable. For imported non-pons tokens, do not reuse these guarantees. A failed read is unknown, not “no restrictions.”
4. **Revenue rules.** Existing `RevenueSplitVault`, `HoldersVault` and `SocialVault` are compatible recipient-layer extensions already verified by `verifyVault()`. Explain their actual split, controller, snapshot and waiting-window rules. These govern creator revenue after settlement, not trading or ERC-20 transfers.
5. **MATE review.** A read-only assistant tool can summarize the same verified launch and revenue facts, link their source and observation time, and prepare a human-reviewable change or payout proposal. It cannot enforce new token rules. A proposal must never be reported as an executed transaction.

Recommended UI names are **Launch rules**, **Trading fees**, **Opening protection**, and **Revenue rules**. No new “Sentinel” app, selectable enforcement mode, protection score, guaranteed safety claim or live-rule-agent badge is warranted by the available implementation.

## Concrete implementation seams

| File / interface | Safe extension | Guardrail |
| --- | --- | --- |
| `server/pons.mjs`: `options`, `prepareLaunch`, `marketState`, `snapshot` | Construct a compact rules projection from their existing verified reads | Keep raw values, units, chain, factory, observed block/time and explicit unknowns. Do not assume a historic token uses the current stack. |
| `shared/pons.mjs`: `factoryAbi`, `curveAbi`, `poolKey` | Add only documented read methods if a missing fact needs them | No invented `setRules`, custom-hook launch argument or use of experimental ABI. |
| `shared/launch.mjs`: `validateLaunch` | Keep deterministic validated user settings and fixed exemption list | Do not accept `maxWallet`, `maxTransfer` or arbitrary hook settings that will never be applied onchain. |
| `src/LaunchWizard.tsx`: Economics and Review steps | Consolidate existing economics/protection facts and show the final exemption addresses | Keep the real wallet confirmation boundary; current preparation and review invalidation still apply. |
| `src/MarketWorkspace.tsx`: token facts / research | Render the authoritative rules projection with source links and freshness | Never present a local project record as proof of official issuance or a full security audit. |
| `server/copilot.mjs` / future assistant tools | Include the bounded rules projection in private project context | Treat chain metadata and creator text as untrusted input; no arbitrary contract calls or model-selected spender. |

## What requires a different protocol decision

Custom transfer caps require an official token-level extension or a different token implementation. Custom swap restrictions require an official curve/hook extension and consistent handling across both lifecycle phases. A hook cannot enforce peer-to-peer ERC-20 transfers. A wrapper only affects users of that wrapper and cannot truthfully promise token-wide rules. A second liquidity pool does not replace or constrain the existing pool. A fee vault governs received revenue only.

Supporting any such extension therefore requires a new, explicitly documented protocol contract/interface, verification of its deployed code and registry, economic and integration tests across curve/graduation/pool paths, and a deliberate product-scope decision. Replacing the factory or migrating to a replacement token is a separate issuance/migration product. Neither is a transparent upgrade of an existing pons token. This assessment does not authorize contacting pons, deploying contracts or broadcasting a transaction.

## Acceptance for the next implementable slice

- Pons remains the only active issuer; experimental contracts remain untouched and unadvertised.
- Rule projections use current verified data and distinguish fixed, adjustable and unknown facts.
- The final review exposes every optional snipe exemption, not only a count.
- Read failures and non-pons imports cannot acquire unsupported guarantees.
- The assistant may prepare a review; the owner explicitly confirms persistence, publication and any wallet-signed action.
- Tests cover unavailable RPC data, changed economics, an unsupported factory and no silent application of unsupported rule fields.

## Implemented compatible slice

`src/LaunchRules.tsx` is now integrated into the LaunchWizard final review. It displays exact supply and fee amounts, network/issuer, full recipient addresses, all additional exemption addresses, automatic exemptions and the actual authority of each revenue mode. Two native disclosure sections keep the working review compact. Prepared transactions use their own optional `protocolRules` snapshot; legacy prepared transactions with no snapshot show unavailable protection rather than borrowing a stale options response. The wizard's economics explanation also retains the actual seconds instead of rounding a five-second opening window to one minute.

`test/launch-rules.test.mjs` covers seven component scenarios: exact amounts, seconds, pinned terms, missing snapshots, all 32 exemptions, unsupported/unavailable protocol reads and the four revenue destinations. TypeScript passed. `qa/audit-launch-rules.html` is an explicitly illustrative, no-network fixture for visual review; it is not a production product route or a simulated successful launch.

Two browser looks at the actual component exposed and corrected a generic `dl` rule that initially forced labels and values onto crowded horizontal rows. The final fixture was checked at its 630px working width and a 320px container, without changing the integrating task's shared browser viewport. At 320px the content measured 280px with no horizontal overflow; all 32 exemption links remained in the bounded scroll list. Missing protection data showed unavailable rather than the old options rate, and the social disclosure retained the controller/48-hour/no-identity-proof distinction. Evidence: `.impeccable/review/launch-rules-desktop.jpg` and `.impeccable/review/launch-rules-container-320.jpg`. These are component/container checks, not a claim of a funded launch or a complete phone-viewport acceptance.

The useful product improvement is **clear, evidenced rules and assisted operations over pons**, rather than a cosmetic Sentinel selector backed by a different unapproved issuer.
