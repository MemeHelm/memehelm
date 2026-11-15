# Reviewed actions, research evidence and launch rules

Implemented locally on 2026-11-15, following the current MemeOS comparison. This is a bounded feature expansion, not a claim of parity with every advertised MemeOS capability.

## Delivered

- **MATE → Plan an action:** natural language produces up to three private proposals for a content calendar, community event or holder-payout review. Full text, channel, date, event link and capacity can be reviewed. Content and events require explicit confirmation before private creation, with separate existing publication controls. Payouts open Treasury's fresh review and still require the owner's wallet signature.
- **Review reliability:** stable AI request identity, durable replay, current-revision hydration, monotonic UI merges, atomic destination writes, idempotent approval, project/owner checks, missing-date validation, unsaved-work guards and explicit recovery after an interrupted paid request.
- **X-Ray → Follow the launching wallet:** bounded official factory launch history, directly attributable creator curve trades and individual receipt links. Partial ranges are lower bounds; unavailable sources remain unknown. Pool router senders are excluded from attribution. Funding sources and wallet clusters are not established or scored.
- **Launchpad final review → Launch rules:** selected supply, fees, opening protection with exact seconds, full exemption addresses, fee destination, revenue controls, observation time/block and signing destination. The prepared response carries the opening-rule values read for that review; missing fields do not fall back to older settings.
- **Handoffs:** saved drafts open the existing Content studio or Community tool; holder reviews open the existing Treasury. The review navigation is consumed so an ordinary window reopen does not prepare another payout. A MATE-requested review scrolls into view when ready.

Issuance, wallet signing and trading retain their current pons v2 / Robinhood Chain 4663 paths. No autonomous trading, cross-chain issuance or social publishing was added.

## Sentinel compatibility decision

The repository's experimental Sentinel contracts are a different issuer and are not attached to the official pons launch call. They were not modified, deployed or exposed as an available pons mode. The compatible implementation is transparent launch/revenue rules; it does not promise custom max-wallet, transfer restrictions or an autonomous rule agent. See [SENTINEL_PONS_INTEGRATION.md](SENTINEL_PONS_INTEGRATION.md) for official interface evidence and limits.

## Verification

- GitHub product snapshot: **199 tests passed, zero failed** using the project's `test` command parameters (single-process, serial Node test execution). The earlier full local workspace run passed 207 tests; eight checks belong to the excluded experimental Sentinel prototype and do not ship in this product update.
- Production build: TypeScript and Vite succeeded. The existing large shared bundle warning remains; this change adds no UI dependencies.
- Independent integration review found and resolved cached-response state regression, slow-list overwrite and repeated-review handoff issues.
- Browser checks used actual React components in explicitly labelled, isolated illustrative fixtures. Every fixture request was intercepted; no call was forwarded to an AI provider, social account, RPC or signer.
- MATE checks covered date editing, full content preview, confirmation, creation of three content records, navigation to the real content calendar, private event creation/navigation to Community, actual Treasury review preparation without signable calldata, consumed-review reopening, interrupted request recovery, and unsaved-window protection.
- X-Ray checks covered full/partial/unavailable source states, failed refresh retaining previous timestamped evidence, successful retry and receipt URLs. Research inset and the narrow-screen check grid were corrected after the first visual pass.
- Desktop, 820px tablet, 390px phone and 320px phone sizes were inspected. The 320px MATE editor and research page showed no document/content overflow. Launch rules received a separate two-round check, including a 320px container and all 32 exemption addresses.
- No runtime errors were captured in the final MATE browser check. The temporary viewport override was reset and test tabs closed.
- Impeccable detection was run on the new interfaces. The existing shared stylesheet retains older font/palette advisories; this slice preserves the approved OS design instead of applying a new site-wide theme. No separate lint command is configured in this repository.

Representative local browser captures (QA only, not a live transaction or production-data claim):

- `qa/mate-actions-final-desktop.png`
- `qa/mate-actions-mobile-round2.png`
- `qa/mate-payout-handoff-final.png`
- `qa/xray-desktop-final.png`
- `qa/xray-mobile-320-final.png`
- `.impeccable/review/launch-rules-desktop.jpg`
- `.impeccable/review/launch-rules-container-320.jpg`

## Acceptance still separate

Real-model proposal quality, a funded mainnet launch/payout, independent contract/security audit and public hosting were not exercised by these mocked checks. Research is a bounded current observation, not lifetime developer history, a complete funding graph, an audit or a safety verdict. This local work does not add unattended financial execution or real X account credentials.

Usage and API boundaries are documented in [MATE_ACTIONS.md](MATE_ACTIONS.md).
