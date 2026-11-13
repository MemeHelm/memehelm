# MemeHelm — Phase two: design direction

Status: design proposal completed; no application UI implementation is claimed. This document supersedes the short direction outline in UI_AUDIT.md. Direction A is the recommendation for phase three, not a claim that the user selected it. Review material belongs in repository documentation, not the product website.

**Review update — 2026-11-12:** The user found the alternatives too similar. The subsequent `frontend-design` + `design-taste-frontend` review confirms that A/B/C demonstrate workflow layouts, not sufficiently distinct visual directions. Their shared component and surface treatment needs fresh exploration. Direction A remains a workflow reference only; the visual recommendation is pending revision and user selection. See `UI_TASTE_REVIEW.md`. The original proposal below is retained as a record, not a final design authority.

Local visual comparison: `artifacts/design-stage-two/index.html` and its rendered `directions.jpg`. These are miniature layout studies, not implemented application screens or production typography samples. They use placeholders and no wallet/API connections. The artifacts directory is Git-ignored; this specification is the durable repository deliverable.

## Decision

Recommend **A — Brand workspace** as the common visual system. Keep the existing desktop metaphor, angular M and near-black / cold-white / electric citron identity. Make the product feel finished through clear task hierarchy, readable type, predictable controls and precise feedback.

This proposal preserves the user's existing direction. It is not a rebrand, a landing-page replacement, a new issuance integration or a feature-cut exercise. All product UI remains English.

## Three alternatives, compared on the same Launchpad screen

All three use the same four-step pons v2 launch flow, fields, token preview and wallet review boundary. Their differences are composition, density and use of space—not three arbitrary color palettes.

| | A — Brand workspace (recommended) | B — Professional terminal | C — Launch studio |
| --- | --- | --- | --- |
| Main character | Calm, clear, capable | Compact, factual, efficient | Expressive, creator-focused |
| Composition | Task header, horizontal steps, form left, contextual preview right | Compact step navigation, aligned field rows, narrow summary | Large token preview left, identity/story editor right |
| Type hierarchy | Strong page title, readable body, quiet labels | Small title, consistent row labels, tabular values | Larger creative title and preview; restrained form labels |
| Citron use | Primary action, current step, keyboard focus | Selected step and exact action | Artwork accent and primary action |
| Strength | Supports launch, AI, signals and treasury within one system | Excellent for repeated checking and financial data | Strongest for artwork, story and public project presentation |
| Tradeoff | Requires careful mobile app/window behavior | Dense for first-time creators; can feel technical | Uses more space; less suitable for balances and long lists |
| Recommendation | Common system for all pages | Borrow its row alignment inside market/treasury only | Borrow its preview/editor relationship inside Launchpad/Copilot only |

### Why A

1. MemeHelm combines several jobs: launch, discover, write with AI and manage revenue. A single-purpose trading terminal or artwork studio would over-weight one of them.
2. The desktop apps, windows and taskbar were explicitly requested. A refocused workspace strengthens that identity without replacing the product's navigation model.
3. The audit's biggest weaknesses—tiny text, competing decoration, weak mobile controls and CSS drift—are addressed directly by a task-focused system.
4. It supports restrained expression: one brand entrance and atmospheric wallpaper, with quiet working surfaces. Large promotional treatments do not need to repeat inside every app.

## System specification for direction A

### Brand colors

| Token role | Value | Usage |
| --- | --- | --- |
| Canvas | `#080B0C` | Desktop backdrop |
| Window surface | `#101719` | Working windows and reading surfaces |
| Raised surface | `#172124` | Grouped controls, selected neutral sections |
| Input surface | `#0C1315` | Form fields |
| Quiet separator | `#2C383C` | Nonessential dividers; not the only cue for input boundaries |
| Input boundary | `#637078` | Clear form-field edges |
| Primary text | `#EDF2F6` | Headings and body |
| Secondary text | `#A7B5BC` | Explanations, timestamps, secondary labels |
| Brand accent | `#D7FF00` | Primary CTA, current step, focus indication |
| Accent foreground | `#151B07` | Text/icons on solid citron only |
| Error | `#F1A0A0` | Error text plus explicit message/icon |
| Success | `#B5D98C` | Confirmed result plus explicit wording |

Do not mix the dark accent foreground with a transparent dark button; this caused the invisible Start control found in phase one. Gradients belong in the wallpaper or one intentional brand treatment. Form panels remain opaque. No purple/lavender theme and no glow around every component.

### Typography

- Interface/body: existing **DM Sans**, 15px desktop and 16px mobile, regular/medium; line height 1.5–1.6.
- Brand/display: existing **Space Grotesk**, semibold, used selectively. Welcome display 48–56px; tool title 28–32px; section title 20–24px.
- Buttons: 14px medium/semibold; labels: 13–14px; essential secondary text: at least 12px.
- Addresses: system monospace, 12–13px. Financial values use tabular numerals. Do not make all small copy monospace.
- Retire overlapping Nunito/Pixelify typography during UI consolidation rather than importing more families. Font delivery and fallback are to be verified during implementation.
- Sentence case for ordinary labels. Step numbers indicate actual sequence. Avoid decorative uppercase eyebrows over each section.
- Body measure stays below about 75 characters. Standard body and placeholder contrast target is at least 4.5:1; final compliance depends on rendered states, not token names alone.

### Spacing and layout

- Spacing scale: **4, 8, 12, 16, 24, 32, 48px**.
- Desktop window padding: 24px; mobile: 16px. Related label/field: 8px; form groups: 24px; major sections: 32px.
- Shared content edges align. Avoid nested decorative cards around every field or metric.
- Desktop chrome stays recognizably separate from the application: global brand/network/wallet at top; shortcuts at the side; open apps and app launcher at the bottom.
- The active workflow receives most of the available space. Wallpaper branding recedes behind active tools; a quiet wallpaper and independent particles remain visible on the desktop.
- Market/treasury use compact headings and aligned data. Welcome can carry the larger brand expression.

### Radius and depth

- Inputs 6px; buttons 8px; grouped panels 12px; desktop windows 16px.
- Primary elevation: one window shadow with a vertical offset and soft blur, proposed `0 20px 64px rgba(0,0,0,.32)`.
- Inner sections stay mostly flat with separators or surface contrast. Do not stack shadows and bright borders on every box.
- Restrained glass may appear on the global top/task bars. Form fields, balances and draft text keep opaque backgrounds for readability.

### Components and states

| Component | Specification |
| --- | --- |
| Primary button | Solid citron, dark label, minimum 44px hit height, one dominant action per task area. |
| Secondary button | Quiet raised surface, cold-white label, defined boundary. |
| Quiet action | Readable text/icon with visible hover and focus; adequate hit area. |
| Input | Visible label, 44–48px control, contextual hint below, error beside the relevant field. Placeholder never substitutes for a label. |
| Cards/rows | Meaningful grouping; hover only where the item is actionable. Token-specific initial/symbol fallback when artwork fails. |
| Tabs/steps | Strong selected cue using shape/text as well as color; current step remains readable on mobile. |
| Dialog/review | Clear title, close/cancel, keyboard focus and visible transaction details; use the existing in-page transaction review where interruption is unnecessary. |
| Loading | Feedback stays inside the region actually loading. Keep unaffected facts and controls available. No invented progress percentage. |
| Empty | Explain what is absent and give a relevant next action. No fake sample metrics. |
| Error | State the problem and recovery; preserve drafts and unrelated data. |
| Disabled | Distinct but readable; include the missing prerequisite where needed. |

Wallet signing, prepared quote lifetimes, fee recipients, network identity, audit-risk wording, owner/session isolation and explicit AI publication remain product requirements. A visual cleanup must not hide or bypass them.

### Motion

The animation discussion becomes part of this shared system, implemented after the representative layout is established.

| Moment | Direction |
| --- | --- |
| Brand entrance | About 800ms total, skippable, once per tab session. No forced replay on refresh or wallet-driven remount. |
| Desktop reveal | Brief restrained sequence for the first entrance; never blocks usable controls. |
| Window open/restore | About 200ms, subtle opacity/scale or small displacement. Avoid a second content entrance inside the same motion. |
| Window close/minimize | Short and consistent with opening; rapid reversal must leave the app usable. |
| Button feedback | Press about 120ms; hover about 160ms. No rocking icons or sweeping gloss on every hover. |
| Launch steps | About 160ms opacity transition for content. Inputs and numbers do not move while typing. Errors focus/locate the relevant field. |
| Background | Sparse independent points on slow paths; the curves/ribbons stay still. Reduce particle count on mobile. |
| Reduced motion | Skip spatial entrances and loops, retain gentle color/opacity feedback and visible state changes. |

Use the existing CSS motion tokens, consolidated to `cubic-bezier(0.23,1,0.32,1)` for entry/exit. Gate hover motion to fine pointers. No animation library is needed for this scope. High-frequency navigation and reading data receive no ornamental movement.

### Responsive rules

- **Desktop ≥1180px:** desktop shortcuts and floating task windows; Launchpad form/preview columns, roughly 2:1; preserve move, resize, minimize and restore.
- **Tablet 768–1179px:** give the active task window most of the workspace; preview may move below or become a compact summary; do not shrink all labels to preserve columns.
- **Mobile <768px:** one foreground full-width application, clear launcher/app switcher, single-column form/results, safe bottom space above the taskbar and keyboard.
- Below the width where four readable step buttons fit, show the current step and accessible step navigation; do not squeeze four tiny labels into a fixed row.
- Compact presentation bounds are separate from saved desktop bounds, so leaving mobile restores a useful window size.
- Test 1440, 1024, 768, 390 and 320px, short viewports, keyboard focus and reduced motion. Physical touch verification is a distinct check.

## Phase three: representative page

**Launchpad** is the representative page because it combines navigation, grouped fields, preview, validation, async preparation and a high-stakes review boundary.

Proposed desktop structure:

```text
Global brand / network / wallet
App dock   ┌ Launchpad window ───────────────────────────────┐
           │ Launch a coin                                  │
           │ Your coin → Revenue → Economics → Review       │
           │ ┌ Form, approximately 2/3 ┐ ┌ Preview, 1/3 ┐    │
           │ │ Name + symbol           │ │ Artwork       │    │
           │ │ Story                   │ │ Name + ticker │    │
           │ │ Artwork preview + link  │ │ Current terms │    │
           │ │ Optional community      │ │ as available  │    │
           │ └─────────────────────────┘ └───────────────┘    │
           │ Back               Save draft        Continue  │
           └────────────────────────────────────────────────┘
Launcher / open applications
```

Mobile puts one form section first, uses a compact step header and an expandable/secondary preview, and keeps the primary action reachable without covering fields.

### Representative-page acceptance criteria

1. Real essential text is readable without zooming; no 6–10px addresses or controls.
2. Primary action, current step and relevant validation are immediately identifiable.
3. Token image preview is clearly distinguished from the hosted image link needed for publication.
4. Current launch validation, draft persistence and wallet review behavior remain intact.
5. Loading is local; errors retain input; keyboard focus stays visible and predictable.
6. Desktop/tablet/mobile screenshots receive two inspection/fix rounds after implementation.
7. Type checks, production build and relevant existing tests pass. No new dependencies are assumed.

## Stage boundary

- Phase one: audit completed in UI_AUDIT.md.
- Phase two: three alternatives, a recommendation, layout plan and full design specification completed here.
- Phase three: application code and representative-page implementation have not started.
- Phase four: remaining-page rollout has not started.
- Phase five: post-redesign quality checks have not started. Baseline tests from phase one do not count as those checks.
