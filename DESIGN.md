---
name: MemeHelm OS
description: A graphite creator's desktop with silver tools and a single citron accent.
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

**Creative North Star: "MemeHelm OS — a creator's desk"**

A modern working desktop in graphite, cold white, silver and citron. Independent tools sit on a calm branded desk; opening a window gives the task a solid, legible interior. The original angular M appears as quiet relief, with its citron notch intact.

The material is restrained and tactile: matte dimensional app tiles, translucent chrome, thin dividers and soft ambient shadows. The wallpaper's sculpted geometry stays still. Three small points move independently when motion is enabled. English labels describe actual tools and honest states.

This records the implemented OS cascade in `src/os-theme.css`, supported by `motion.css`, `wallpaper.css`, `product.css` and `workspace-design.css`. It captures the approved world in `.impeccable/os-direction.md`; the code, rather than the concept image, determines values. The older `docs/DESIGN.md` is a legacy record.

**Key Characteristics:**

- Graphite task surfaces and silver tool identities.
- A single citron accent for action, focus and the brand notch.
- Independent windows, a thin top bar and a floating Dock.
- A quiet relief M and three restrained points.
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

- **Display:** the brief brand entrance. The wallpaper name instead uses its implemented responsive size (`clamp(27px, 2.5vw, 36px)`).
- **Headline:** Workspace's main heading; application page headings retain their observed local sizes.
- **Title:** project identity within Workspace.
- **Body:** Workspace supporting copy. The root base is larger (14px), while shared page descriptions use 14px with a 22px line height.
- **Label:** desktop shortcut labels. Window titles use DM Sans (12px, 500, 1.3); section labels use DM Sans (14px, 500, 1.4).
- **Numeric emphasis:** the calculator uses Space Grotesk (52px, 500, line height 1), reducing to 44px in narrow window containers. The top clock uses tabular numerals.

Avoid introducing a second display voice. Legacy eyebrow declarations are not a reusable heading pattern for new surfaces.

## Layout

The shell fills the dynamic viewport and contains overflow. Desktop rows are a thin top bar (44px), the available window surface and a Dock area (96px). Five labeled shortcuts occupy a narrow left rail; the M relief sits center-right. A fresh home visit has no open window.

Windows are independently movable and resizable within the desktop surface. Workspace starts from a desired width of 940px; the calculator 500px, guide 690px and other tools 1060px, all fitted to available bounds. The Workspace sidebar is 172px. Main content uses 30px vertical and 32px horizontal padding; task rows rely on separators rather than a dashboard card grid.

At 720px and below, shell rows become 52px / available space / 84px. Windows fill the available middle surface, their content scrolls internally, and resize/maximize controls are removed. Shortcuts form three columns. The Dock scrolls horizontally inside itself; Apps retains all nine tools, motion control and connected-wallet sign-out. At 360px and below, the top wordmark condenses to the original M.

Container queries respond to each window: Workspace drops its sidebar at 700px; at 440px, its heading stacks and content insets reduce. The shell also compacts chrome at 1050px and shortens desktop shortcut spacing below 710px height. Preserve reachable tools without horizontal document scrolling.

## Elevation & Depth

Depth is soft and structural. Subtle silver gradients and inset highlights give app tiles their matte relief. Windows cast diffuse shadows, while active windows gain a slightly stronger edge and shadow. The top bar, titlebars, Dock and Apps menu carry translucent glass; working content remains solid.

**The Glass at the Edge Rule.** Use translucency for desktop chrome and floating navigation. Keep task interiors opaque enough to read over the wallpaper and other windows.

The sidecar records the exact window, focused-window, tile, Dock and launcher shadows. No hard offset shadow is a new OS token.

Motion follows function: windows open and restore over 240ms, minimize over 240ms and close over 180ms. The top bar, Dock and shortcuts enter with a brief stagger; fine-pointer Dock hover rises 4px and scales to 1.06. Motion is interruptible, dragging bypasses animation, and keyboard window actions are immediate. Reduced motion disables shell animations and hides the points. Background motion can be paused explicitly and stops when the document is hidden. The entrance is skippable and never reports fabricated progress.

## Shapes

Use gently rounded controls, slightly broader task panels and generous app-tile/Dock curves. Rounded window frames become square when maximized or used on phone widths. Borders are thin and low contrast; fields have a stronger boundary. The logo's angular M and diagonal citron notch remain the distinctive hard geometry.

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

The top bar provides the brand, Desktop and Apps plus account utilities. The brand opens Workspace. Apps displays all nine tools in three columns; the floating Dock keeps six common tools and adds open tools. Selected Workspace navigation uses a faint white surface and a citron SVG detail. Dock icons have text on hover/focus, a running dot and a citron active dot.

**The One App, One Identity Rule.** Keep the same app glyph and matte tile across shortcuts, Apps and the Dock. Opening, minimizing and restoring must remain connected to that identity.

### Application Windows

A quiet glass titlebar sits over a solid body. Left traffic-light controls retain accessible names and keyboard focus. Opening or restoring transfers focus into the window; keyboard focus entering a background window raises it without taking focus from its control. Minimizing returns focus to its Dock identity. Closing returns the user to a remaining window or the desk.

## Do's and Don'ts

### Do:

- **Do** retain the original angular M, citron notch, MemeHelm name and “Launch it. Steer it.” tagline.
- **Do** reuse graphite task surfaces, silver app tiles and the existing two-font hierarchy.
- **Do** keep all tools reachable through Apps, search and the Dock on narrow screens.
- **Do** preserve solid task interiors, visible focus and reduced-motion behavior.
- **Do** show real project state and identify illustrative examples.

### Don't:

- **Don't** animate wallpaper lines, ribbons or sculpted planes; only the three independent points move.
- **Don't** replace this OS world with pastel chrome, retro pixel typography or a dashboard grid.
- **Don't** add a circular plate behind the M, dense dot patterns or invented activity metrics.
- **Don't** introduce decorative eyebrows, hard offset shadows or Unicode substitutes for authored SVG icons as reusable OS patterns.
