# Validation record

Date: 2026-10-15 (Asia/Shanghai).

## Completed

| Check | Result |
| --- | --- |
| Solidity artifact compilation | Passed: solc 0.8.26, optimized, Shanghai-compatible local deployment artifacts |
| TypeScript compilation | Passed: `tsc --noEmit` |
| English application production build | Passed: Vite 8.3.4 |
| Node validation, API, model-context and local-EVM tests | 16 tests passed across the complete suite |
| Foundry contract suite | 8 tests passed, including 256 revenue-conservation fuzz cases |
| Live BNB Testnet fork integration | Passed with Cancun EVM execution |
| Local static HTTP route | HTTP 200 at `http://127.0.0.1:4318` |
| Live testnet read checks | Chain ID 97, latest block read, Portal/VaultPortal bytecode present |

## Public-chain fork proof

`contracts/test/FlapTestnetFork.t.sol` simulates against the actual deployed BNB Testnet Portal and VaultPortal contracts. The passing expanded test used testnet block **136956386**.

The test deploys our factory locally into the fork; finds an unused `7777` token salt; calls the live protocol's `newTokenV6WithVault`; verifies the new token and vault; dispatches actual protocol tax proceeds; verifies both shares; and releases revenue to the two fixed recipient wallets.

The launch itself is capped at 10,000,000 simulated gas and tax dispatch at 1,000,000. The test's overall gas figure includes local vanity-address search and should not be interpreted as a launch transaction gas estimate. The application performs vanity search off-chain in a worker.

Two integration corrections were evidence-driven:

1. Deployed Flap code requires Cancun-capable fork execution. Shanghai-only fork execution fails on a not-yet-activated instruction.
2. The old `TWO_THIRDS` graduation threshold is rejected by the tested deployment. The launch builder now uses `FOUR_FIFTHS` (80%), matching the official reference fixture and the passing fork.

These are local simulations on public-chain state. There is **no public transaction hash**, no publicly deployed factory/token, and no money has been spent.

## Local contract coverage

- Native receive gas budget.
- Cumulative share accounting, rounding and later deposits.
- Forced native transfers included without double credit.
- No repeated claims after payment.
- Independent payout when another recipient rejects BNB.
- Reentrancy defense.
- VaultPortal-only factory creation.
- Native-only quote guard and invalid recipient/share rejection.
- Initializer locking/reinitialization rejection.
- Guardian-only beacon upgrade authority and preserved state after upgrade.
- UI schema and factory ABI consistency.

## API and AI boundaries

- Draft persistence is tested in an isolated temporary workspace.
- Cross-origin write attempts are rejected.
- Invalid address inputs are rejected.
- Missing token or model configuration produces explicit errors.
- The model receives bounded project/chain context, with no signing/execution tools.
- Model transport was tested with a mocked provider. No real model API key has been configured or charged.

## Verification limits

### Brand wallpaper and wandering particles — 2026-10-16

- Replaced the dot pattern, pixel clouds, stepped hills, and circular logo backdrop with an original SVG wallpaper: dark sculpted ribbons, fine lime edges, and a smaller freestanding brand lockup.
- Uses seven small round glowing particles that wander independently at different speeds, reduced to four on mobile. Ribbons and their edges stay static; removed moving stroke segments and ribbon drift following the user's correction. Uses CSS/SVG without a rendering loop, external media, or extra dependencies. Decorative layers ignore pointer events and are hidden from assistive technology.
- Simplified the composition for smaller screens. Reduced-motion preferences keep the wallpaper static; entrance pauses its background animations.
- TypeScript/Vite build and all seven route-rendering checks passed. Local preview and both updated assets returned HTTP 200. Browser visual and animation QA remain unavailable because of the browser connection failure recorded below.

### Entrance and interaction motion — 2026-10-16

- Added an entrance with the MemeHelm mark, accent animation, and an indeterminate line. It does not display artificial percentages or pretend to check wallet/network services.
- Entrance waits briefly for the font with a bounded fallback, can be skipped by button or Escape, and is bypassed for reduced-motion preferences.
- Desktop chrome and shortcuts enter in a short sequence. Added hover feedback, window opening/restoring/minimizing/closing transitions, and subtle background motion.
- Outgoing window transitions are interruptible: focusing the window clears its pending hide/removal timer. Dragging disables window animation, and timers are cleared on unmount.
- Production build and seven-route server-render checks passed. No contract, wallet signing, or revenue logic changed. Browser animation timing, pointer interaction, and screenshot QA remain unverified because of the previously recorded browser connection failure.

### MemeHelm brand palette — 2026-10-16

- Preserved the desktop layout and window interactions while restoring the near-black, cold-white, and neon yellow-green brand palette.
- Recolored all product tools, window chrome, taskbar, original SVG icons, wallpaper elements, brand mark, favicon, and browser theme metadata.
- Centralized the brand tokens in `src/brand-theme.css`. The kumioOS reference now informs layout and interactions only.
- No contracts, wallet actions, or revenue logic changed. Build and seven-route rendering checks cover this presentation change; browser visual QA retains the limitation recorded below.

### Desktop interface revision — 2026-10-16

- Replaced the long dark landing page and sidebar layout with a cream/mint/apricot desktop, original illustrated app icons, window titlebars, task switching, and a Start menu. The user's kumioOS reference informed the interaction pattern; no reference runtime or branding was reused.
- Adapted all existing product tools to light window interiors. Kept all English copy and the existing wallet/testnet boundaries.
- Preserved the interactive split calculator and connected it to the launch draft. Added a user-facing guide without exposing developer setup.
- TypeScript and Vite build passed. The full Node suite passed 18 tests, including bounds checks for window movement and resizing on desktop, mobile, and short viewports.
- Server-rendered routes cover welcome, projects, launch, treasury, copilot, calculator, and guide. These checks do not validate browser pointer interaction or visual layout.
- The public reference HTML/CSS was accessible for read-only inspection. Browser page loading and local tab selection still timed out, so screenshot, pointer interaction, and visual QA remain unverified.

### MemeHelm interface revision — 2026-10-15

- Rebuilt the product homepage and workspace around the supplied MemeHelm visual references.
- Added interactive Launchpad/Copilot/Vault examples and a split calculator that carries its allocation into the launch form.
- Removed developer settings, environment instructions, internal completion states, audit fundraising copy, and factory deployment tutorials from user-facing pages.
- Retained meaningful transaction information: BNB Testnet, tBNB, fixed recipients, independent audit risk, and vault upgrade authority.
- TypeScript and Vite production build passed. All 16 existing Node/API/contract checks passed.
- Server-side rendering checks passed for home, overview, launch, treasury, and copilot; no internal setup copy appeared in their output. HTTP delivery returned 200 with the new title and assets.
- In-app-browser selection and a fresh preview tab both timed out. Visual layout and browser interaction checks remain unverified; rendered HTML checks do not replace those checks.

- The app's in-app-browser preview could not be inspected: navigation/focus commands timed out. Static HTML HTTP delivery and the build passed, but desktop/mobile visual QA and browser interaction QA remain outstanding.
- No public wallet-signed testnet transaction has been submitted. The final wallet integration and metadata availability need a human testnet session.
- No real model provider has been exercised.
- No production deployment, production multi-user authorization, mainnet rollout or third-party audit has occurred.

## Next acceptance session

1. Open the local app in a normal browser with an EVM wallet extension.
2. Check desktop and mobile layout.
3. Deploy the factory with a dedicated BNB Testnet wallet.
4. Pin real metadata, launch one test token, and keep the public explorer receipt.
5. Verify protocol revenue and each recipient's payout against explorer receipts.
6. Configure the chosen model provider and review a generated English brief.
