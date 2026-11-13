# MemeHelm UI implementation and verification

Date: 2026-11-12. Local product at `http://127.0.0.1:4318/`.

## Signed-out interface correction

The first guest layout repeated an oversized cold-white sign-in panel and a dark explanation panel across tools. This was inappropriate for the project-management task and was rejected in visual review. That guest layout has been replaced; the earlier implementation notes below are a record of the wider UI pass, not an endorsement of the rejected panels.

- My Projects now uses one neutral dark project area, a short wallet sign-in prompt and a launch action. The large white card, headline and tutorial panel are removed.
- Treasury uses a short revenue sign-in state. Payout instructions are available in a collapsed disclosure instead of occupying a second large panel. Its calculator entry still opens the existing working calculator.
- Guest Copilot uses a narrow sign-in bar and a document-centered example area. All three labeled examples remain selectable. There are no fabricated balances, projects or AI-generated results.
- Removed the obsolete guest split-panel styling from the shared stylesheet. The revised guest component has a dedicated stylesheet.
- Checked actual renders at 1440×900, 390×844 and 320×780. The 390px projects view and 320px Copilot view had no horizontal overflow. Verified the launch entry, Copilot example selection and the revenue disclosure/calculator entry. Wallet sign-in itself was not exercised; the existing authentication callbacks are unchanged.
- TypeScript and the production build passed, and `git diff --check` passed. This correction is presentational; the prior 34-test result below belongs to the broader UI pass and was not rerun for the guest-only correction.
- Evidence: `artifacts/guest-ui-correction-2026-11-12/`. No environment, wallet, contract, server or dependency changes; no publication or transactions.

## Implemented

- Welcome now pairs a cold-white brand introduction with the existing revenue allocation calculator. The calculator is shared with its standalone app; the amounts are explicitly illustrative. Tool entries describe posts, launches and alerts rather than generic marketing promises. The existing projects entry remains.
- Desktop symbols now share one geometric stroke system. Chrome, taskbar, typography, focus states, controls, borders and content surfaces follow `DESIGN.md`. A working window suppresses the large wallpaper wordmark. Static wallpaper curves and independently wandering points remain.
- Launchpad has a concise title, four real steps, clearer form hierarchy, a stable token preview and compact mobile preview. Existing validation, links, local artwork selection, hosted image link, fee choices, live economics, risk disclosure and wallet-signing actions remain. Symbol validation also exposes `aria-invalid`.
- Discover puts search and real project cards first. Artwork is no longer covered by a ticker. Missing artwork uses token initials rather than the MemeHelm logo. Mobile cards use one column; address text is 12px. An explicit retry action reruns the existing read requests after an error; unavailable data is distinguished from an empty launch feed. API URLs, authorization and protocol calls are unchanged.
- Guest Copilot explains its task and offers three labeled static examples, without generating paid AI content or granting access to private records. Guest Treasury and My Projects explain the existing workflows. Verified-wallet gates remain in place.
- Shared styles and plain task titles extend to Signals, projects, signed-in Copilot, Treasury, guide and public pages. The strongest layout work in this iteration is Welcome, Launchpad, Discover and guest tools; this is not a claim that every private state has been visually inspected.
- Motion retains the skippable brand entrance and existing interruptible window transitions. Icon tilt, repeating card entrances and primary-button sheen are suppressed. Reduced-motion overrides remain in source. No animation package or other dependency was added.

## Browser review and corrections

Real browser screenshots and rendered-style measurements were used. No synthetic screenshots or invented onchain figures were used.

Round one found a welcome calculator that pushed tool entries below the window, redundant page-title padding, excessive compact-preview padding and a tool row inheriting a column direction. These were corrected and rechecked.

Round two checked desktop and mobile renders and interaction states. It found token-initial clipping inherited from the old ticker overlay and awkward 320px welcome line wrapping. These were corrected and checked again. The mobile initial-art height was reduced to keep the card footer in view.

Observed viewport coverage:

| Viewport | Inspected views |
| --- | --- |
| 1440×900 | Welcome, Launchpad identity/revenue, Discover loading/error and real feed, Copilot guest |
| 1024×768 | Discover real feed and window controls |
| 768×1024 | Discover, Launchpad initial layout |
| 390×844 | Welcome, Launchpad identity/revenue, Discover real feed, Copilot examples and start menu |
| 320×780 | Welcome and Copilot; no document or window-body horizontal overflow in measured views |

Measured examples: 390px launch input text is 16px; 390px Discover address text is 12px. At 768px the launch window body measured 576px client/scroll width; at 320px the measured window bodies were 310px client/scroll width, with a 320px document. These measurements describe the checked states, not an exhaustive accessibility certification.

Interactions checked:

- Allocation input and keyboard slider: 2 ETH with an 11% reserve displays 1.78 ETH / 0.22 ETH. Restored the example to its default after checking.
- Empty launch submission shows field errors. Valid illustrative name, symbol and story update the preview and advance to revenue selection. Direct and split choices remain selectable. Cleared the temporary draft fields afterwards; no project was saved and no transaction was prepared or submitted.
- Start-menu navigation, opening windows, minimizing and restoring Launchpad, and maximizing Discover.
- Discover search with no matches and normal feed restoration. A real upstream timeout was observed earlier; a later request recovered to a real launch list. Remote data and artwork can still fail independently of this UI change.
- Guest AI example selection switches Social post / Daily brief / Weekly plan. All examples stay labeled; no wallet sign-in, AI generation or public sharing was performed.

Screenshots are in the ignored `artifacts/ui-redesign-2026-11-12/` directory, including `welcome-desktop.jpg`, `welcome-mobile.jpg`, `welcome-320.jpg`, `launch-desktop.jpg`, `launch-mobile.jpg`, `launch-tablet.jpg`, `copilot-desktop.jpg`, `copilot-mobile-example.jpg`, and Discover viewport captures. `round1-*` captures retain intermediate findings.

## Engineering checks

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` passed.
- Production build: `node node_modules/vite/bin/vite.js build --configLoader native` passed. The native config loader avoids the sandbox's pre-existing child-process restriction in Vite's default configuration bundler; project build scripts/configuration were not changed.
- Existing suite: all 34 tests passed after the final interaction changes. Ganache reported an existing native µWS mismatch and used its JavaScript fallback; tests still passed.
- `git diff --check` passed. The repository has no configured lint script; no lint success is claimed.
- Source review confirms no server, wallet, smart-contract, credential, environment or dependency changes. The only shared non-UI helper change enlarges the default welcome window; its existing boundary tests pass.

## Limits

This is local UI work, with no deployment or mainnet writes. Private signed-in pages, real wallet prompts, payouts, paid generation, import modal and published-project states were not browser-exercised in this iteration. Their shared styling was changed, but those flows need a separate authenticated visual pass. Reduced motion was checked in source, not by changing the user's operating-system preference. There is no new light/dark mode switch; the cold-white welcome surface is part of the existing dark desktop theme.

The `frontend-design` and `design-taste-frontend` guides informed the redesign. No Taste marketing-site checker/GATE, browser performance audit or independent audit is claimed. The application keeps its existing product structure rather than adopting a marketing-site template or adding decorative asset kits.
