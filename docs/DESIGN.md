# MemeHelm product interface

Kind: software / Web3 creator workspace. Audience: English-speaking coin creators on Robinhood Chain. Main action: prepare a coin launch, then review and sign in a wallet.

## Direction implemented

A precise brand desktop: angular app symbols, neutral graphite windows, cold-white welcome canvas and restrained citron actions. The welcome screen contrasts a large typographic introduction with a working allocation calculator. Operational pages lead with their content rather than a repeated promotional hero. Signed-out project, revenue and AI screens use the dark working surfaces; the welcome canvas is not a reusable sign-in card.

This implements the product review in `UI_TASTE_REVIEW.md`. It supersedes the visual treatment of the earlier A/B/C layout studies. It preserves the existing desktop, windows, taskbar, user-selected palette, wallpaper particles and tagline. It does not import Taste's marketing-site kit, random palette, photographs, mandatory screen-height sections or shader effects into the application. Those conflict with the established product brief and existing architecture. Taste and frontend-design guide the typography, content, restraint and browser critique; no marketing-site GATE pass is claimed.

## Tokens

- Background `#090b0e`; window `#13161b`; raised surface `#1b1f25`; border `#343b45`.
- Text `#f1f4f7`; muted `#a7b0bd`; welcome canvas `#eef2f5`; canvas ink `#14181e`.
- Citron `#d7ff00` for primary actions, selection and the brand mark. Success and warning retain distinct semantic tones.
- DM Sans for body and controls, Space Grotesk for headings and the wordmark. Remove Nunito and Pixelify from active UI. Body 14/22, helper 12/18, control 13/20, section 22/28, page 30/36, welcome display 64/64 with a responsive clamp. Data uses tabular figures.
- Spacing: 4, 8, 12, 16, 24, 32, 40. Layout edges align; no decorative tilt.
- Radius: 6px controls, 10px content surfaces, 12px outer windows. Reserve rounded pills for compact network/status indicators.
- Shadows separate floating desktop windows from the wallpaper. No glow or gradient on ordinary cards and inputs.
- Primary actions and form controls have at least 44px touch height; some secondary desktop controls are 36–40px. Window controls get separate 44px hit areas. Keyboard focus stays visible.

## Structure

- Welcome: cold-white introduction + working allocation example; compact tool rows; actual project count or actionable empty state. No invented market, AI or revenue numbers.
- Launchpad: compact title, real four-step navigation, current form, readable token preview. Keep all fees, risk notices, validation and wallet signing unchanged.
- Discover: compact page heading, search and filters first; real artwork or token initials; names and addresses in stable text areas.
- Guest tools: My Projects uses a compact sign-in state with a launch action; Treasury gives a short sign-in prompt and collapsible payout explanation; Copilot shows a full-width sample document and a compact sign-in bar. Do not reuse large explanation panels or split marketing compositions for these tools. Examples stay labeled; generation, saved data and revenue operations still require verified-wallet access.
- Common surfaces: neutral opaque content, calm navigation, one shared type scale. Keep fees, data coverage, source, missing data and contract risks visible.

## Motion

Keep the existing brief skippable entrance and interruptible window lifecycle. Remove icon rotation and primary-button sweeps. Hover uses a small color or 1–2px position response; press moves 1px. 140–220ms, `cubic-bezier(.2,.75,.25,1)`. Only wallpaper points wander; curves stay still. Reduced motion disables nonessential animation.

## Responsive and verification

Use the existing window-body container for breakpoints, so resized desktop windows also reflow. At small widths stack the welcome/calculator and form/preview, show one token per row, keep readable labels, and allow window body scrolling. Check 1440×900, 1024×768, 768×1024 and 390×844, plus a narrow 320px check. Perform two screenshot rounds; document results and limits in `UI_IMPLEMENTATION.md`.
