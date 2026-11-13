# MemeHelm UI review — 2026-11-12

Status: phase one complete. This is an internal review and proposed implementation plan, not website content. No frontend, API, wallet, contract, transaction, environment, dependency or authentication code was changed during this review. The existing application was rebuilt for accurate inspection.

## Scope and evidence

- Project: `flap-copilot`, package name `memehelm`, existing Robinhood mainnet / pons v2 application.
- Inspected the running application at `http://127.0.0.1:4318/` using the browser, rendered screenshots and computed DOM styles.
- Checked 1440×900 desktop, 768×1024 tablet and 390×844 mobile layouts. Also checked the transition from a phone viewport to 1024×768. These are emulated viewports, not physical touch-device tests.
- Two observation passes: initial visual/interaction inspection; then a fresh production build, reload and repeat inspection. No claim is made that an after-redesign review has happened.
- Browser review: welcome, launch identity form and validation, Discover list, search empty state, token detail, application menu and taskbar. Private Copilot, Treasury, projects and publishing surfaces were inspected in source; their authenticated workflows were not exercised in the browser.
- No wallet authentication, paid AI generation, public publishing or onchain writes were initiated. No credentials were opened or changed.
- Screenshots are saved locally under `artifacts/ui-audit-2026-11-12/`, which is ignored by Git. They contain public token data and guest screens, not private workspace data.

## Skill availability and use

| Requested skill | Installed name | Review use |
| --- | --- | --- |
| frontend-design | `frontend-design` | Read full instructions; evaluated brand fit, composition, typography and UI copy. |
| ui-ux-pro-max | Not found | Not invoked or installed. |
| Taste Skill | `design-taste-frontend` | Read full instructions; applied product-specificity and consistency principles. Its marketing-page section/dealer/template rules are not imposed on this existing operational app. |
| Impeccable | `impeccable` | Read full instructions and technical audit guidance; ran `context` and the source detector. Reviewed detector findings in context. |
| animate | `animate` | Read full instructions; assessed the current motion ingredients and prepared constraints for implementation. No animation changes claimed. |
| web-design-guidelines | Not found | Not invoked or installed. |

The skills are instruction files, not interchangeable function calls. Impeccable additionally supplies a CLI. The assessment is a technical audit plus direct visual review, not the separate two-agent `critique` workflow. No hooks were enabled. There is no existing PRODUCT.md or DESIGN.md; the established brand and product constraints in AGENTS.md remain authoritative.

## Architecture

| Area | Current implementation |
| --- | --- |
| Frontend | React 19, TypeScript 5.9, Vite 8; existing dependencies retained. |
| Entry / page state | `index.html`, `src/main.tsx`; custom hash navigation and public `/project/:id` pages. |
| Shared chrome | `src/Desktop.tsx`: top bar, shortcuts, application windows, launcher menu and taskbar. |
| Window bounds | `shared/desktop-layout.mjs`; separate move/resize/fit helpers. |
| Main workflows | LaunchWizard, MarketWorkspace, TradePanel, CopilotWorkspace, TreasuryWorkspace, SignalsWorkspace, PublicProject. |
| Shared styling | `product.css`, `brand-theme.css`, `desktop.css`, `premium.css`, `pons.css`, `workflows.css`, `motion.css`, `wallpaper.css`. |
| Brand / motion | Brand.tsx, Wallpaper.tsx and EntryLoader.tsx. |
| Protected boundary | WalletSession.tsx, wallet.ts, api.ts, server modules and shared pons modules. Preserve behavior. |

Eight stylesheets contain repeated component definitions and 53 `!important` declarations in total. Palette variables exist, but many later rules hard-code their own colors, fonts and sizes. The problem is inconsistent ownership of styles rather than the absence of any design system.

## Audit health

Scores are an internal prioritization rubric, not a WCAG certification, financial assessment or product-readiness score. Authenticated visual states remain outside the browser-verified sample.

| Dimension | Score / 4 | Evidence |
| --- | --- | --- |
| Accessibility | 2 | Labeled fields, explicit validation and focus styles exist. Launcher contrast, keyboard order and workspace landmarks need work. |
| Performance | 3 | Lean runtime dependency set and successful build. CSS duplication and repeated entry effects remain. No performance trace or field telemetry was collected. |
| Theming | 2 | Recognizable brand tokens, overridden by multiple hard-coded component layers. |
| Responsive behavior | 2 | Mobile fits the viewport, but two-column cards, small targets and window-size restoration weaken usability. |
| Implementation consistency | 2 | Desktop metaphor is coherent; component typography, density and chrome styles drift. |
| **Total** | **11 / 20** | **Significant design and usability work needed.** |

No P0 task-blocking failure was verified in the reviewed guest flows. Three P1, five P2 and one P3 groups are documented below. Static scan warnings are not counted as separate verified defects.

## Verified issues, in priority order

### P1 — Reading sizes are too small for ordinary product use

- Observed desktop wallet button and shortcut labels: 10px. Welcome description: 12px; supporting rail labels: 7px.
- Discover metadata and card footer: 6–9px, including protocol label and address/action text.
- At 390px, cards remain in two columns, further compressing already small text.
- Impact: users must strain or zoom to identify tokens and read controls. A small font is not by itself a WCAG failure; it is a verified readability problem here.
- Locations: `src/desktop.css`, `src/premium.css`, `src/product.css`, `src/pons.css`.
- Fix: establish a shared scale: 15–16px body, 14px controls, 12–13px secondary data; reserve larger display type for welcome, not every tool.

### P1 — The main application launcher loses its contrast

- `brand-theme.css:52` gives the Start button and mark a dark foreground; `premium.css:20` replaces its bright background with a nearly transparent citron tint.
- Normal-state foreground: RGB 21,27,7. Background after compositing the button, taskbar and shell: approximately RGB 21,29,21. Calculated contrast: **1.03:1**.
- The mobile launcher hides its text and relies on this mark, making the primary route to other tools hard to find. Hover/selected styling temporarily improves contrast and can conceal the defect during testing.
- Fix: define foreground/background as one component token pair, with distinct normal, hover, selected and focus states. Keep a legible mobile label or clear accessible icon.

### P1 — Mobile controls need a deliberate touch layout

- Measured window minimize/close controls: 26×23px. Mobile Start: approximately 79×35px; task switcher: 36×35px; Connect wallet: approximately 98×37px.
- These fall below this project's proposed 44px touch-target standard. This finding does not assume every target fails WCAG 2.5.8, which has spacing exceptions.
- Fix: expand hit areas without inflating every glyph; use one-column or full-width token rows below 600px; preserve safe space above the taskbar and mobile keyboard.

### P2 — Keyboard navigation does not follow the open application menu

- Reproduced: open Start, press Tab. Focus moves to `Switch to Discover` on the taskbar while the application list stays open.
- The menu appears before its trigger in DOM order and does not receive focus on opening. Escape already closes it and returns focus, which should be retained.
- The workspace has no main landmark or skip link. Multiple open windows also expose background content to the accessibility tree; focus through obscured windows needs explicit verification and handling during implementation.
- Location: `src/Desktop.tsx:112`, `src/Desktop.tsx:114`, `src/main.tsx:60`.
- Fix: position launcher disclosure and list in a predictable focus order; give the active workspace an appropriate landmark; ensure obscured mobile windows do not remain keyboard destinations. Do not make all desktop background windows inert indiscriminately.

### P2 — Content competes with repeated branding

- Welcome and Discover repeat a large M treatment already present in the wallpaper; multiple small uppercase/monospace labels add more visual noise.
- Discover places a large promotional hero above search and results. On mobile, the first card starts well down the first screen.
- Current rebuilt desktop welcome window measured 820×728 at 1440×900, with a 683px body and 717px scroll content. Earlier captures used a shorter window; do not treat that shorter height as the current fresh-load baseline.
- Fix: keep the atmospheric wallpaper and desktop identity, reduce background brand prominence while a tool is active, give operational pages compact task headers and move useful content upward. Prefer a single memorable brand treatment on welcome.

### P2 — Styles are layered rather than governed by one system

- `main.tsx:18` starts a chain of global stylesheet imports; individual workflows add more rules. Desktop, theme and premium files repeatedly redefine the same components.
- Nunito, DM Sans, Space Grotesk, Pixelify Sans and monospace treatments are referenced for overlapping purposes.
- Fix: assign ownership: tokens, base elements, desktop chrome, workflow layouts, motion. Consolidate the relevant existing rules in place instead of adding another large override sheet or replacing the application stack.

### P2 — Missing token artwork produces indistinguishable cards

- In one observed twelve-card sample, eleven remote images failed and one loaded. This is a runtime observation, not a claim about all tokens or future network availability.
- The fallback repeats the MemeHelm mark across unrelated tokens, weakening recognition and suggesting a relationship that is only a placeholder.
- Location: `src/MarketWorkspace.tsx:62` and `.discovery-art` styling.
- Fix: use a restrained token-specific initial/symbol fallback and consistent image framing; retain real artwork when available. Do not invent project artwork, partnerships or metrics.

### P2 — Narrow window dimensions persist after returning to desktop

- Reproduced by changing 1440 → 390 → 1024: the application window retains a narrow phone-sized rectangle instead of recovering an appropriate desktop width. This is a resize-transition finding, not the fresh-load layout at 1024px.
- Location: Desktop ResizeObserver and `shared/desktop-layout.mjs`.
- Fix: separate compact presentation bounds from the saved desktop rectangle. Restore the user's desktop bounds after leaving compact mode; preserve manual move/resize behavior.

### P3 — Motion needs one restrained policy

- Existing strengths: skippable entrance, bounded font wait, Escape handling and reduced-motion support. Windows already have short open/close transitions.
- Existing weaknesses: the brand entrance runs on full page reload; shortcut hover combines lift and rotation; spring token overshoots; several overlapping reduced-motion rules switch all motion off.
- Fix: keep a brief brand entrance once per session, use short interruptible feedback for frequent actions, retain gentle state feedback under reduced motion, and keep independent particles optional. Do not animate chart data for decoration or move the wallpaper lines.

## What to preserve

- MemeHelm angular M, near-black / cold-white / citron identity, “Launch it. Steer it.” and the desktop apps/window/taskbar concept.
- English end-user copy; factual network, fee, recipient and transaction-risk information.
- Existing labels, field validation, examples explicitly labeled as examples, observation timestamps and unavailable-data disclosures.
- Creator-led pons v2 issuance, existing wallet confirmation and session boundaries, private drafts and explicit publishing.
- No new issuance platform, cross-chain launch, autonomous market making or fabricated activity.

## Three visual directions

| Direction | Character | Tradeoff |
| --- | --- | --- |
| **Brand workspace — recommended** | Refined desktop shell, large readable controls, quiet layered surfaces, compact task headers, citron reserved for primary actions and selected states. | Requires careful window and mobile navigation design; retains established identity. |
| Professional terminal | Denser market rows, tabular figures, restrained chrome, stronger emphasis on balances and trading information. | Excellent for repeat traders; less welcoming for a creator's first launch. |
| Launch studio | More space for token preview, story, identity and AI editing; editorial compositions inside existing application windows. | Strong creator onboarding; applying its spaciousness to every data screen would reduce efficiency. |

Choose Brand workspace as the common system, with terminal density inside market/treasury screens and a studio composition inside Launchpad/Copilot. These are variations within one token and component system, not three competing themes.

## Proposed design system for phase two

These are proposed values, not an implemented DESIGN.md or a claim of final contrast verification.

| System | Proposed rule |
| --- | --- |
| Palette | Canvas `#080B0C`; surface `#101719`; raised `#172124`; border `#2C383C`; primary text `#EDF2F6`; secondary text `#A7B5BC`; accent `#D7FF00`. Functional error/success colors remain distinguishable without relying on color alone. |
| Typography | Reuse existing DM Sans for interface/body and Space Grotesk for selective brand/display use; system monospace for addresses only. Body 15–16px, secondary 12–13px, controls 14px, section titles 20–24px, tool titles 28–36px. Tabular numerals for financial data. |
| Spacing | 4/8/12/16/24/32/48px scale; 24px desktop window padding and 16px mobile padding; equal content edges. |
| Radius | 6px inputs, 8px buttons, 12px inner panels, 16px desktop windows. Avoid rounding every element into the same capsule. |
| Depth | Window elevation only; flat inner sections. Restrained glass in top/task bars, opaque reading and form surfaces. No glow around every card. |
| Components | One primary/secondary/quiet button family; visible labels and consistent hint/error placement; clear selected, disabled, pending, focus and error states. Hit areas at least 44px on touch layouts. |
| Motion | CSS first; press 120ms, hover 160ms, window/overlay 200–240ms; `cubic-bezier(0.23,1,0.32,1)` for entry/exit. Transform/opacity only for spatial effects, pointer gating and an intentional reduced-motion alternative. |
| Responsive | Desktop retains windows and taskbar; tablet uses larger task windows and fewer columns; mobile uses one foreground window and a clear app switcher. Restore saved desktop bounds after compact mode. |

## Implementation order

1. Establish product/design context from the existing brief, then consolidate tokens, readable type, launcher states, hit areas and focus behavior. Keep development information in repository documentation.
2. **Representative page: Launchpad.** Redesign header, steps, form groups, image/link distinction, live preview and action placement. Preserve all validation, draft scoping, fee configuration, prepared-transaction review and signing behavior.
3. Apply the system to welcome, Discover, token details and trading. Replace the large operational hero with a compact heading/search arrangement and identifiable result rows/cards. Display only facts already supplied by the current APIs.
4. Extend to Copilot, Treasury, Signals and projects; then public project, guide and calculator. Reuse component classes rather than forking styles.
5. Run two real screenshot/fix passes on the changed UI at desktop, tablet and mobile widths; test keyboard order, reduced motion, loading/empty/error states, safe bottom spacing and form focus. Run type checks, build and relevant existing tests. A physical touch-device pass remains a separate check.

## Baseline validation

- Existing Node test suite: **34 passed, 0 failed**. Ganache reported a native µWS module incompatibility and used its JavaScript fallback; the tests still passed.
- TypeScript `--noEmit`: passed.
- Vite production build: passed after allowing the local build subprocess outside the restricted sandbox. Output: CSS 109.76kB / gzip 22.24kB; JS 388.29kB / gzip 116.11kB.
- The pnpm build wrapper initially rejected workspace-install metadata. The installed TypeScript and Vite entry points were run directly; no dependency/lockfile change was made. This is an environment limitation, not a reported UI bug.
- No lint script or lint configuration is defined for this project; no lint pass is claimed.
- Impeccable source detector: 12 findings (3 advisory, 9 warnings). Font popularity, side borders, loader grid and bounce warnings were reviewed as prompts, not objective proof that an interface is bad. Font choice alone is not counted as a defect. The loader grid is distinct from the wallpaper and is not a reason to replace the brand.
- The installed Impeccable CLI does not recognize the skill reference's `audit-storage` command. Automatic report archiving was unavailable; this report was saved directly to `docs/UI_AUDIT.md` instead. No automatic archive is claimed.
- The application console sample contained no captured warnings/errors, but that does not prove all remote assets load; DOM image observations showed failures.
- The dark theme was inspected. No light-theme switch exists, and none was added. Full contrast coverage, physical touch gestures, signed-in UI, paid AI responses and mainnet signing remain unverified by this browser audit.

## Local evidence files

- `artifacts/ui-audit-2026-11-12/home-desktop-before.png`
- `artifacts/ui-audit-2026-11-12/launch-desktop-before.png`
- `artifacts/ui-audit-2026-11-12/discover-desktop-before.png`
- `artifacts/ui-audit-2026-11-12/discover-mobile-before.png`
- `artifacts/ui-audit-2026-11-12/discover-tablet-before.png`
- `artifacts/ui-audit-2026-11-12/launch-mobile-before.png`
- `artifacts/ui-audit-2026-11-12/discover-empty-before.png`
- `artifacts/ui-audit-2026-11-12/launch-1024-before.png` (after the phone-to-desktop resize transition)

## Recommended actions

In priority order: `$impeccable harden` for launcher/focus states; `$impeccable adapt` for touch and compact layouts; `$impeccable typeset` and `$impeccable layout` for the shared scale and representative page; `$impeccable extract` for reusable tokens/components; `$impeccable animate` guided by the installed animate skill; finish with `$impeccable polish`.

These describe the implementation sequence. They were not all executed during phase one. Repeat the technical audit after the UI changes; do not treat this baseline as approval of the redesigned product.
