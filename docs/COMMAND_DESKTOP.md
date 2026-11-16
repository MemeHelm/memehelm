# Default Command desktop

MemeHelm opens to a populated Command desktop in the approved metallic architectural OS direction. The scene, silver tools and task windows form one visual world. Applications still open in movable windows, and the existing wallet boundaries, project ownership checks and transaction reviews remain in place.

This iteration fully rearranges the **Command homepage and Launchpad interior**. Other applications inherit the shared navigation, window frame, app tiles and Dock; their internal layouts remain to be unified in subsequent work. It does not complete every application interior or add protocol capabilities.

## Shared visual layers

- `src/system-shell.css`: graphite/silver desktop chrome, top navigation, app rail, dimensional tiles, window titlebars, controls and floating Dock.
- `src/command-board.css`: architectural hero, compact working panels and responsive Command composition.
- `src/launch-system.css`: four-step Launchpad rail, central form, live coin preview, MATE tip and fixed action footer.
- `/brand/command-world.png`: the actual architectural scene asset shared by the desktop wallpaper and hero, rather than a CSS stand-in for a sculpted M.
- `/brand/mate-v1.png`: MATE artwork within the hero, assistant panel and Launchpad tip. The authored SVG entrance and floating companion retain their established implementation.

The palette remains near-black graphite, cold white, silver and citron `#d7ff00`. English interface copy describes user actions; implementation status and developer setup are not product content. The architectural background is static. Only the small independent points wander, with existing pause, hidden-document and reduced-motion behavior.

## Default components

- An architectural brand hero with Launch a coin and My projects entry points. Its ribbon uses real project/draft counts only after project data is known; guest labels describe tools rather than inventing activity.
- My projects: the signed-in wallet's saved collection, status filters and a four-row preview. Loading, successful empty and failed reads have distinct states.
- Next up: up to two saved action previews for the selected project. The desktop is a summary, not the complete action queue or an automatic executor.
- MATE: clear entry points to Copilot, Workspace and the existing guide. Opening the desktop never generates AI content.
- Community: up to two saved content/event plans for the selected project. Events open Community and content plans open Content studio; View plans opens Content studio. These are bounded previews, not the complete schedule.
- Signals: enabled watch count, unread count within the returned recent signal set, and saved observations. Unknown values remain unknown; a failed read offers refresh rather than pretending the list is empty.
- Revenue split: a saved fixed allocation when available, otherwise an interactive **Example allocation** with an explicit statement that no funds are moved. Treasury and calculator entry points remain available. The desktop does not invent AUM, balances, earnings or a price chart.

Guests see useful starting actions in the same structure. Private project data is never rendered for a guest, even if accidentally supplied to the component. All timestamps, schedule inputs and relative-date interpretation continue to use UTC.

**Hide widgets** exposes the bare app desktop and returns keyboard focus to Command. Command/Show desktop restores the board. Opening an application hides the board; minimizing or closing the active application brings it back when no application is active. The floating MATE companion is hidden while the board's MATE panel is visible, and returns during bare-desktop/application use. Focused Launchpad also hides the floating companion because its own tip panel already supplies MATE.

## Window continuity and Launchpad

The top bar, wallpaper, left rail and Dock persist when an app opens. The app window uses the same metallic material and right-aligned minimize, maximize/restore and close controls. Desktop windows remain movable/resizable and fit within the rail reservation; phone windows fill the available middle surface.

Launchpad uses four existing workflow steps: **Your coin → Revenue → Economics → Review**. A central scroll region holds the current form, with a preview and MATE tip alongside it. The footer keeps Back, Save draft and Continue/review/connect/launch reachable. Continue remains associated with the real form for step validation. All action buttons preserve busy/AI-busy locks, and final launch still requires current prepared terms, explicit review and a wallet signature. Local artwork selection is a preview unless the user supplies a hosted link.

The four existing revenue choices and their actual terms remain intact: direct recipient, fixed two-wallet split, holder payouts and community escrow. The UI does not introduce autonomous trading, cross-chain issuance, a social-identity guarantee or a new issuance protocol. Mainnet Robinhood Chain and pons v2 remain the selected integration.

Community and Calendar rail shortcuts enter real Copilot subviews instead of creating duplicate tools. Copilot reports internal view changes back to the shell so the active shortcut reflects the actual subview. Project switching, subview switching, window closure and sign-out retain their existing unsaved-work/request guards; minimizing keeps the mounted work available.

## Data, loading and recovery

`src/useDesktopSummary.ts` reads the existing local `GET /watches`, `GET /alerts`, `GET /projects/:id/overview` and `GET /projects/:id/operations` APIs. Project collection state comes from the existing workspace `GET /projects` read. Widgets introduce no new backend, dependency, polling, RPC request, paid AI call or financial action.

The project read explicitly distinguishes loading, ready and error. Before the first successful read, the hero count is unknown and My projects shows Reading your projects. Failure provides Retry projects; it does not masquerade as a successful empty workspace. Already known same-wallet projects remain available when refresh fails.

Summary responses are bound to the current wallet/project during rendering and after effects. Switching wallet/project, hiding the board or unmounting aborts pending reads; late responses cannot fill a different workspace. Independent resources can succeed when another fails, and explicit refresh retains valid same-scope information where possible. The backend's ownership/session checks remain authoritative.

`overview.events` is a bounded context summary. The board does not use it to claim a complete event count or an exact item deep link. Agenda entries select the matching Community/Content studio view for the chosen project; they do not approve, publish or execute a proposal. The existing project-change guard must permit selection before the window is opened/restored for that project.

Transaction recovery remains outside moving app windows with saved hashes and explicit status checks, never an automatic repeat transaction. AI recovery retains the original request and billing identity, with saved-work review before a fresh request. Theme and layout changes do not relax those boundaries.

## Responsive behavior

Desktop uses a 52px top bar, a two-column left rail at 1280px and above, the working surface, and a 96px Dock region. The rail becomes one column from 1024px to 1279px. Below 1024px the rail and most direct top app labels are hidden; Apps, search, Dock and in-app navigation keep the tools available.

At 720px and below, the Dock region is 78px, application windows fill the middle surface and Command stacks into a vertically scrolling column. Touch targets enlarge and the Dock scrolls internally without horizontal document overflow. Launchpad responds to its own container: its preview collapses above the form in narrow windows, step navigation becomes horizontal at 600px and below, and fields/revenue choices stack at the narrowest widths. The fixed footer remains reachable independently of form scroll.

## Verification record

Behavior regressions cover guest privacy, wallet/project isolation, late responses, partial failures, unknown values, filters and explicit navigation. This iteration adds checks for unread-project loading/retry, agenda-to-subview routing and Copilot subview changes respecting unsaved work. The related handoff, AI-recovery, Command and summary tests were exercised during review; no real publication, signing or paid AI request was performed by these checks.

The 2026-11-16 implementation check passed 253 local tests, TypeScript checking and the production build. There is no configured Lint command. The production bundler still reports the existing large-JavaScript-chunk advisory; this check does not establish a public deployment or independent audit.

Two visual passes covered desktop, tablet and phone, including empty-form validation, advancing to Revenue, preview expansion, minimizing/restoring, and phone-to-desktop window sizing. Uncustomized windows adapt to the available desktop lane; manually moved or resized windows retain their position within the available bounds. Captured browser warnings/errors were empty for the final checked session.

Final captures include `qa/system-home-final.png`, `qa/system-launch-final.png`, `qa/system-home-tablet-final.png`, `qa/system-launch-tablet-final.png`, `qa/system-home-mobile-pass1.png` and `qa/system-launch-mobile-final.png`. The isolated saved-record fixture is captured in `qa/system-illustrative-records-final.png`; all its requests are intercepted locally. Earlier `qa/command-board-*` captures document the preceding layout and should not be treated as approval of this design. Browser fixtures are illustrative verification records, not replacement product data or evidence of real launches, revenue or users. Visual acceptance remains the user's decision.

Asset generation provenance and the final prompt are recorded in `docs/COMMAND_WORLD_ASSET.md`.
