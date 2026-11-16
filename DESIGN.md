---
name: MemeHelm OS
description: A metallic architectural OS for meme creators, with graphite task surfaces, silver tools and a single citron accent.
colors:
  citron: "#d7ff00"
  citron-hover: "#e1ff40"
  accent-ink: "#171e00"
  graphite: "#0d1115"
  window: "#191f26"
  card: "#1e252d"
  field: "#101318"
  cold-white: "#edf1f5"
  silver: "#d2dbe3"
  muted: "#a6b0bb"
  subtle: "#96a1ad"
  line: "#38424d"
  field-line: "#4b586b"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "35px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-1.3px"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-1px"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.7px"
  body:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.4
  button:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "20px"
rounded:
  badge: "4px"
  field: "6px"
  control: "7px"
  panel: "10px"
  window: "13px"
  tile: "14px"
  dock: "20px"
spacing:
  tight: "4px"
  compact: "8px"
  control-gap: "10px"
  row: "12px"
  inset: "16px"
  section: "24px"
  content: "30px"
  workspace-inline: "32px"
components:
  button-primary:
    backgroundColor: "{colors.citron}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: "11px 17px"
    typography: "{typography.button}"
  button-primary-hover:
    backgroundColor: "{colors.citron-hover}"
  button-secondary:
    backgroundColor: "#ffffff04"
    textColor: "#dce4ec"
    rounded: "{rounded.control}"
    padding: "11px 17px"
  input:
    backgroundColor: "{colors.field}"
    textColor: "#e5ebf2"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  badge:
    backgroundColor: "#293139"
    textColor: "#c9d5df"
    rounded: "{rounded.badge}"
    padding: "3px 7px"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.cold-white}"
    rounded: "{rounded.panel}"
  application-window:
    backgroundColor: "{colors.window}"
    textColor: "{colors.cold-white}"
    rounded: "{rounded.window}"
  app-tile:
    textColor: "{colors.silver}"
    rounded: "{rounded.tile}"
    size: "54px"
  dock:
    rounded: "{rounded.dock}"
    padding: "9px 10px 7px"
---

# Design System: MemeHelm OS

## Overview

**Creative North Star: "MemeHelm OS — a creator's command desk"**

A working desktop in graphite, cold white, silver and citron. The approved direction is a metallic architectural scene: a sculpted angular M, dark structural planes, a low platform and restrained citron reflections. The scene supplies atmosphere while compact, legible tools supply the product. Opening an application continues the same material world instead of switching to an unrelated page theme.

The material is restrained and tactile: dimensional silver app tiles, translucent chrome, thin dividers and diffuse shadows. `public/brand/command-world.png` is the implemented architectural artwork, used by both the wallpaper and Command hero at `/brand/command-world.png`. It is a real raster asset rather than a CSS approximation of the scene. `public/brand/mate-v1.png` supplies MATE artwork in the hero, persistent assistant and Launchpad tip; the existing authored SVG character powers the unchanged entrance. The current workspace does not mount a separate floating MATE character. The architectural geometry stays still. Three small points move independently when motion is enabled. English labels describe actual tools and honest states.

The shared material layers are `src/system-shell.css` for desktop chrome, app tiles and frames, `src/command-board.css` for Command, and `src/launch-system.css` for Launchpad. `application-system.css`, `copilot-system.css`, `community-system.css` and `treasury-system.css` retain the completed application interior improvements. `workspace-assistant.css` supplies the shared horizontal project-tool navigation and persistent AI interior; `single-workspace.css` loads last and owns the single-main-window shell, attached panels and responsive drawer. These layers load after the existing `os-theme.css`, `workspace-design.css` and product styles. The frontmatter retains the base design tokens. `motion.css` and `wallpaper.css` retain the existing entrance and background behavior. The code, rather than the concept image, determines effective values. The older `docs/DESIGN.md` is a legacy record; `docs/SINGLE_WORKSPACE.md` records the current interaction contract.

**Implementation scope:** Command, Launchpad, projects, community, calendar, revenue, Discover, Signals and AI use the shared working surfaces. A stable primary canvas now replaces the previous independently opened application windows. Its adjacent MATE panel owns the only chat host; temporary dialogs retain bounded actions and confirmations. The complete automated suite passed 269/269 tests; one subsequently added Treasury guard regression passed with its related tests. Real-browser visual checks covered 1440px desktop, 1280×720 desktop, 1024×768 tablet and 390px phone layouts. These checks do not constitute a wallet-signed mainnet transaction or a security audit.

**Key Characteristics:**

- Graphite task surfaces and silver tool identities.
- A single citron accent for action, focus and the brand notch.
- One persistent main window, a right-side persistent MATE panel, a thin top bar and a floating Dock.
- An architectural M scene shared by the hero and desktop, with three restrained points.
- A first-visit Workbench with visual capability previews, replaced by real saved-work summaries once a project exists.
- Compact text with clear labels and visible keyboard focus.

## Colors

Citron gives direction within a cool, low-chroma working environment. The frontmatter owns the reusable values; local translucent materials remain in the sidecar's component CSS.

### Primary

- **Citron:** primary actions, focus outlines, selected tool details and the original M notch.
- **Citron Hover:** a lighter primary-action hover state.
- **Accent Ink:** dark lettering on the citron action surface.

### Neutral

- **Graphite:** the desktop's outer ground.
- **Window / Card / Field:** solid task interiors, inset panels and editable surfaces.
- **Cold White / Silver:** primary reading text and dimensional app glyphs.
- **Muted / Subtle:** supporting text and lower-emphasis inherited details.
- **Line / Field Line:** structural divisions and the stronger boundary of editable controls.

**The Citron Has a Job Rule.** Use citron to identify an action, focus, selection or the established brand detail. Preserve the dark silver field around it.

## Typography

**Display Font:** Space Grotesk, with a sans-serif fallback.
**Body Font:** DM Sans, with Arial and sans-serif fallbacks.

Space Grotesk supplies the compact geometric headings and wordmark; DM Sans keeps navigation, labels and working copy calm. Fonts are loaded by the existing Google Fonts import in `product.css`.

- **Display:** the brand entrance and Command's compact “Launch it. Steer it.” heading; the latter uses its scoped responsive size in `command-board.css`.
- **Headline:** Workspace's main heading; application page headings retain their observed local sizes.
- **Title:** project identity within Workspace.
- **Body:** Workspace supporting copy. The root base is larger (14px), while shared page descriptions use 14px with a 22px line height.
- **Label:** desktop shortcut labels and compact working rows. The primary workspace title uses the compact Space Grotesk shell style (14px, 500; 13px on phones); Command panel headings use DM Sans (14px, 600, 1.3).
- **Numeric emphasis:** the calculator uses Space Grotesk (52px, 500, line height 1), reducing to 44px in narrow window containers. Allocation percentages and launch-step counts use clear numeric hierarchy; the shell has no clock.

Avoid introducing a second display voice. Legacy eyebrow declarations are not a reusable heading pattern for new surfaces.

## Layout

The shell fills the dynamic viewport and contains overflow. Desktop rows are a 52px top bar, the available workspace surface and a 96px Dock area. A fresh home visit opens Workbench inside the main window. With no project, it introduces Launchpad, the AI review workflow, community/content planning and a usable token lookup through labeled previews. Once a project exists, it opens the actual project library, action queue, UTC agenda and saved watchlist summaries. It contains no standalone revenue calculator, invented market statistics or second assistant. MATE occupies the adjacent assistant panel rather than another Command chat card.

At 1100px and above, an 88px left rail uses one column of labeled tools. The main canvas and assistant occupy an attached grid beside it. The assistant starts at 340px wide and can be resized from 280px to 460px using its divider or keyboard arrow controls. Collapsing MATE or entering focus mode gives the main canvas the available width. Below 1100px the rail is hidden; Apps, search, the Dock and shared project-tool navigation keep every tool reachable. The top bar, rail and Dock expose Workbench, Launchpad, Projects and Market. AI entry points reveal the existing MATE panel without replacing the primary page. Help stays in Apps and search.

All ordinary applications replace content inside the same main frame. The frame stays in place; it is not independently dragged, stacked or resized for each tool. Visited page slots stay mounted and become hidden and inert when inactive, preserving their forms, filters, scroll positions and unfinished requests. Project operations, memory and activity share one operations host; community, calendar, goals and writing retain their own visited editor surfaces. Their common horizontal tool navigation remains available inside the main canvas. Hiding the workspace or entering focus mode does not discard state.

Below 1100px, MATE becomes an explicitly opened drawer over the main canvas. It has dialog semantics, bounded focus, Escape and backdrop dismissal; the covered main surface is inert. A route change closes the drawer while preserving the conversation. Transaction and sign-in dialogs keep their higher priority and focus. At 720px and below, shell rows become 52px / available space / 78px and the main frame fills the middle surface without outer margins. Command becomes a vertically scrolling single-column layout with larger touch controls. The Dock and horizontal project-tool navigation scroll within their own regions. At 360px and below, the wordmark condenses to the original M. Container queries respond to the actual main-content width, including changes caused by the assistant. Preserve reachable tools without horizontal document scrolling.

### Launchpad workflow

Launchpad is the representative application interior: a left four-step navigation rail (Your coin, Revenue, Economics, Review), a central scrolling form, a right coin preview with MATE tip, and a fixed footer. The preview shows the selected artwork, identity, network, issuance protocol and actual selected revenue mode. The same existing wallet callbacks, validations, mainnet terms, fee-recipient choices and risk acknowledgments remain in use.

The footer keeps Back, Save draft and the current primary action reachable. Continue remains associated with `launch-wizard-form` for normal submission and step validation; controls remain locked while a wallet/API action or AI assistance is busy. Final launch still requires current prepared terms, explicit review and the user's wallet signature. A chosen local image remains clearly identified as a preview unless a hosted link is supplied.

At narrow window widths the preview becomes a collapsible strip above the form. At 600px container width and below, step navigation becomes a horizontal row, the footer compacts and the form remains independently scrollable. At 360px container width and below, fields and revenue choices stack and the save control compacts while retaining its accessible name.

## Elevation & Depth

Depth is soft and structural. Subtle silver gradients and inset highlights give app tiles their matte relief. The main frame and assistant share diffuse shadows and thin silver edges. Temporary dialogs sit above them. The top bar, titlebars, Dock and Apps menu carry translucent glass; working content remains solid.

**The Glass at the Edge Rule.** Use translucency for desktop chrome and floating navigation. Keep task interiors opaque enough to read over the architectural wallpaper.

The scoped component styles record exact window, focused-window, tile, Dock and launcher shadows. No hard offset shadow is a new OS token.

Motion follows function. Content switches and workspace minimize/restore keep the stable frame and do not replay the former per-app opening, dragging or closing choreography. The top bar, Dock and shortcuts retain their brief entrance stagger; fine-pointer Dock hover retains its restrained lift. Tool controls use short, interruptible feedback. Reduced motion disables shell animations and hides the points. Background motion can be paused explicitly and stops when the document is hidden. The current MATE entrance and handoff are specified below.

The entrance introduces MATE over 5.5 seconds using the existing layered 2D SVG and native Web Animations API. A falling citron point wakes the graphite character; market-symbol bumps and a dodge lead into a double wrist tap. Silver armor assembles from 1.8–3.2 seconds, preserving the separate chest panels, helmet sides, chin and final citron-tab lock. A brief identity pose leads into the branded system-window transition. The real desktop reveals at 4.35 seconds, the character reaches its destination at 5.15 seconds, and a short wave and crossfade complete by 5.5 seconds. Existing motion curves, artwork and signature poses remain; the graphite backdrop stays still.

The flight lands on the welcome MATE portrait near the top of the actual assistant panel. An existing conversation falls back to the panel title portrait; a closed panel on a narrow screen uses the visible MATE toggle. Visible target bounds are remeasured after reveal and on layout or session changes. Hidden copies and offscreen controls are ignored. The destination is temporarily transparent during arrival and crossfades from the animated character at the same location. Skip, failure and teardown restore its original state. No persistent floating mascot or fabricated lower-right destination is added.

The full story plays automatically on the first visit when motion is allowed. Completion or skipping retains the existing seen-state key, so later visits enter promptly and this revision does not force a replay. Skip intro and Escape exit in 180ms; reduced motion bypasses automatic playback. Apps → Replay intro explicitly plays the complete sequence without changing saved motion preferences or resetting work. A 5.8-second safety deadline plus the short exit releases the desktop within six seconds if playback stalls. The workspace stays inert until completion. Teardown cancels native animations and observation frames, removes afterimages, restores the target and disconnects resize observation. There are no service checks, fabricated progress, boot logs, audio, 3D runtime or rendered movie. MATE remains in its persistent panel with verified-wallet access and platform-only chat scope.

## Shapes

Use gently rounded controls, slightly broader task panels and generous app-tile/Dock curves. The current main frame and assistant use 12px corners; phone frames become square and borderless. Borders are thin and controlled; fields have a stronger boundary. The logo's angular M and diagonal citron notch remain the distinctive hard geometry.

The original M is authored SVG. App and utility icons use the existing thin SVG path language; the calculator's diagonal arrow shares the authored Arrow component. Do not replace the mark with a circular plate or convert the interface to pixel art.

## Components

### Buttons

Citron primary actions have dark ink; secondary actions use a faint white tint and a quiet border. Shared buttons have a 44px minimum height, a 20px text line and medium weight (500). The Workspace heading uses its own compact padding (10px 13px). Hover lightens the surface and gives a small lift; active moves down by 1px. Disabled controls reduce opacity. Focus uses a citron outline (2px, 3px offset).

### Inputs / Fields

Inputs, selects and textareas are dark and plainly bounded. The effective shared field cascade retains `workspace-design.css`'s important background, border and radius: the frontmatter's Field, Field Line and field radius describe that result. Later OS rules supply cold text, a 44px minimum height and 13px type. Placeholders are subdued; focus gets the existing citron outline with a 1px offset. Validation remains textual as well as visual.

### Chips / Tags

Neutral badges are compact informational labels: DM Sans (10px, 500, 16px line height), a slate fill, a thin border and a small curve. Keep status words meaningful; a badge alone must not imply a live observation or completed action.

### Cards / Containers

Application panels use the Card surface, thin boundaries and quiet rounded corners. Workspace's project shelf uses an honest empty state or actual saved project identities; next actions are full-width rows. Avoid importing the large window shadow into every nested panel.

### Navigation

The top bar provides direct app entries plus account utilities; the brand and Command open the default board inside the main window. Apps contains every application and project tool. The rail, Apps, search, Dock, Command widgets and shared horizontal project-tool navigation all use the same primary route. Community and Calendar select their matching main-canvas tools. The title and selected navigation identify the current page; browser back/forward and the titlebar back control restore its route without opening another window or duplicating a history entry. Discover deep links retain the workspace history state.

AI entries reveal the existing MATE host without changing the main route. Repeated opens, collapsing and focus mode keep its conversation mounted. Ordinary tool switches are allowed while an editor remains open because visited content is preserved. Explicit project changes check every editor and request guard, including hidden tools, and return to the protected tool or assistant when blocked. Wallet changes reset the private workspace boundary. Dock icons retain text on hover/focus, a visited mark and a citron active mark.

**The One App, One Identity Rule.** Keep the same app glyph and matte tile across shortcuts, Apps and the Dock. Opening, minimizing and restoring must remain connected to that identity.

### Primary Window, Assistant and Dialogs

A metallic titlebar sits over a solid body. The primary frame has back, Command, MATE toggle, focus-mode and minimize controls with accessible names. Focus mode expands the main task by temporarily hiding the assistant; exiting restores its prior panel. Minimize and Show desktop hide the attached stage without unmounting visited pages or chat. Selecting an application restores that same stage and focuses its heading. The assistant can collapse independently and be reopened from its controls, Apps or Dock.

Import, previews, sign-in and transaction confirmations remain temporary dialogs above the workspace. Their completion returns to the underlying task. Signing out with unsaved edits or a request in progress requires an explicit keep-working or discard-and-sign-out decision; browser exit remains protected while any guard or shared action is active. Ordinary navigation and minimizing never imply cancellation, publication, wallet approval or loss of saved work.

### Honest desktop states

Project counts and rows come from the authenticated wallet's saved collection. Before its first read succeeds, counts remain unknown and the panel says it is reading projects. A failed read offers Retry projects; an empty collection is shown only after a successful read. Resource summaries load independently and retain valid same-scope content after a partial refresh failure. No stale response may populate another wallet or project.

Allocation planning belongs to Launchpad’s Revenue step. A collapsible Preview allocation uses the draft’s existing split and illustrative ETH amounts, without a second ratio control or a transfer action. Existing calculator links enter this step. Activated fixed-recipient wallets and percentages remain immutable. Community and content summaries navigate to their matching real subviews for the selected project; they do not publish, approve, or execute anything. Every schedule and timestamp uses UTC.

## Do's and Don'ts

### Do:

- **Do** retain the original angular M, citron notch, MemeHelm name and “Launch it. Steer it.” tagline.
- **Do** reuse graphite task surfaces, silver app tiles and the existing two-font hierarchy.
- **Do** keep all tools reachable through Apps, search and the Dock on narrow screens.
- **Do** preserve solid task interiors, visible focus and reduced-motion behavior.
- **Do** show real project state and identify illustrative examples.

### Don't:

- **Don't** animate wallpaper lines, ribbons or sculpted planes; only the three independent points move.
- **Don't** replace this OS world with pastel chrome, retro pixel typography or a generic flat dashboard detached from the architectural desktop.
- **Don't** add a circular plate behind the M, dense dot patterns or invented activity metrics.
- **Don't** introduce decorative eyebrows, hard offset shadows or Unicode substitutes for authored SVG icons as reusable OS patterns.

## Application interiors

Command and Launchpad establish the shared chrome. The other tools retain their refined opaque graphite working surfaces, thin silver boundaries, compact controls and citron only for selection or primary actions inside the same main canvas. Application content adapts to its available container width rather than assuming a full browser viewport.

My Projects uses a library and selected-project detail together on desktop, stacked on phone. Keep project selection, continuing a launch draft, import, Copilot, revenue and publication controls available. Balances without an observed vault stay unknown. A failed first project read has a retry state; it must not become an empty collection.

The project tools share a project context bar and horizontally scrollable navigation for overview, memory, goals, calendar, community, activity and writing. These tools replace primary content; they never create another chat surface. MATE has one bounded conversation canvas beside them. Chat history and observations use a reversible shelf within that panel, preserving the conversation when the shelf is opened or closed. Community events retain their list and detail surface; content plans retain their agenda alongside editing when space permits. Editor actions follow all fields in normal flow, without covering later inputs. Dates and schedules stay explicitly UTC.

Treasury keeps project and wallet context separate from observed balances and payout actions. A narrow window collapses the context to its project selector. Every payout review retains its complete recipients, amounts, coverage, risk notes and wallet approval. Selecting different recipients invalidates the earlier signable review.

Guest states use the same tool surfaces and MATE identity. They explain sign-in or show explicitly identified examples. Signals keeps counts unknown before its first successful read and offers recovery after an unavailable read. Private records used in isolated visual acceptance fixtures never enter production defaults.

## Recovery surfaces

Transaction recovery lives above the Dock, outside the main and assistant panels. It shows a saved hash and a status-check action, never an automatic repeat transaction. At narrow widths it uses the viewport minus 24px and a bounded scroll region. Signing out protects unsaved work with a focused confirmation whose primary action keeps working. Hiding a page or collapsing MATE preserves its request and recovery state. AI interruptions keep the original question and billing identity, with saved-work review before any explicit fresh request.

Command no longer contains a second MATE card, and the current shell does not mount the old floating companion. Its AI entry points reveal the unique persistent assistant. After minimizing the workspace, the Dock's MATE entry can reopen the attached stage without discarding its conversation. Phone transaction recovery remains above the Dock with a bounded scroll region so controls stay reachable. The top bar has no time display or clock-update timer.

## Task hierarchy

The four global areas are Workbench, Launchpad, Projects and Market. Detailed routes remain available for history, search, action handoffs and visited-editor preservation; they are not all promoted to standalone desktop apps.

Projects opens the project library. A chosen project has five sections: Overview (priorities, reviewed actions, observations, outcomes and activity), Content (Writing, Assets, Calendar and Publishing), Community (Events & links, Goals and Public page), Treasury (observed receipts, collection and reviewed payouts), and AI setup (assistant profile, project knowledge, operating limits and pauses). A shared project selector obeys all pending-edit and request guards. Mobile exposes all five project sections in one row; secondary tools remain a separate, scrollable row.

MATE is the sole persistent conversation surface. Project knowledge has a direct link in its context bar. In the narrow sidebar, duplicate assistant identity headings are suppressed to leave space for the transcript. Reviewing content in chat does not automatically publish or synchronize Writing, Calendar and X records. Assets composes local images and captions for PNG export; its visible upload control uses English product copy.

Market combines Discover with Watchlist & alerts. Token details retain Overview, Trades, Holders, X-Ray and wallet-signed trading; watchlists remain wallet-scoped rather than tied to whichever project is selected. Public project pages remain separate visitor-facing destinations.

UI hierarchy verification on 2026-11-16: TypeScript and the production bundle pass; the complete local suite passed 285 tests, followed by focused reruns after final refinements. Browser checks include first-visit and illustrative project screens at 1440×900 and 390×844. An isolated fixture blocks writes and external calls. These checks do not establish a live funded launch, social publication or paid AI acceptance.
