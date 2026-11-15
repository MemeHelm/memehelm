# MATE startup — From chaos to a first mate

Delivery: the ten-second **MATE · Take the helm** V2 sequence, using authored 2D character artwork with restrained 2.5D shading. The browser animates separate SVG body parts and armor layers using its native Web Animations API. No Blender download, 3D model, Three.js, WebGL, canvas renderer, rendered movie or audio is required or included.

## Creative direction

MATE begins as a small graphite character, gets briefly overwhelmed by market symbols, calls its silver M-shaped armor, and enters the creator's desktop. It becomes the actual assistant control at the lower-right edge of the interface.

The first beat is physical comedy: two readable bumps, squashed poses and eye reactions, followed by a successful dodge of a third symbol. MATE deliberately taps its wrist twice before summoning armor. The character remains resourceful and likable. Armor conveys preparation and organization. It must not suggest that the assistant defeats market risk, guarantees profit, or trades autonomously.

The original MATE concept guides the silver M-shaped helmet, graphite faceplate, simple white eyes and upper-right citron tab. The delivered character is independently authored SVG; the earlier PNG remains a concept reference only. Startup and idle assistant use the same SVG, so arrival does not swap between different character styles.

## Time and delivery split

- Total experience: 10.0 seconds, followed by the short overlay exit. The retiming cuts setup and holds more than key actions, preserving the same native SVG artwork and story.
- SVG story: 0.0–8.1 seconds, using articulated layers, authored poses and a fixed composition rather than an animated camera. The system window expands across the frame around the eight-second mark.
- Real desktop handoff: 8.1–10.0 seconds. The same SVG character follows an arc toward the actual assistant button's bounds, reaches the anchor at 9.25 seconds, waves, blinks and settles.
- `src/mate/MateCharacter.tsx` supplies the shared character artwork. `src/mate/MateStory.tsx` supplies market props, impact marks, portal and story composition. `src/mate/sequence.ts` controls the native animations; `src/mate/choreography.ts` supplies responsive flight geometry.
- `src/EntryLoader.tsx` coordinates the overlay, reveal and exit. The desktop is the real application, prepared behind the intro; no screenshot or movie replaces it.
- No greeting bubble, recorded voice or sound is implemented. Those remain optional future ideas below.

## Shot script

| Time | Delivered action | Direction |
| --- | --- | --- |
| 0.0–0.65 s | A citron point falls through a quiet slate space. A soft light and a head/eye response introduce the graphite character. | The small point leads attention toward the character; keep the background calm. |
| 0.65–2.15 s | Candlesticks and a stock-chart tile cause two brief body/head reactions, squash-and-stretch poses and compressed eye expressions. MATE ducks beneath a third symbol, then recovers and looks toward its wrist. | Keep the comedy readable. No prices, real tickers or external logos appear. |
| 2.15–2.9 s | MATE raises a forearm and taps the wrist control twice. Two local light responses culminate in six angular fragments; the market props drift away. | Preserve the decision and double-tap beat before armor arrives. |
| 2.9–5.35 s | Boots, upper-arm shells and gauntlets arrive in a short stagger. The chest rises and its two panels close; the helmet's left/right shells converge, the chin seats, and the citron tab locks last. Small overshoots, silver afterimages and a brief chest highlight punctuate assembly. | Keep the eyes and M silhouette legible. The last tab is the strongest assembly beat. |
| 5.35–5.8 s | The complete MATE silhouette takes a small confident step and holds with the name and “Your project's first mate.” line. | Let the character identity read before the next action. |
| 5.8–6.9 s | MATE gestures and flicks a citron diamond toward the clipped corner of a system window. Corner points appear; the diamond reaches the corner and the window unfolds. | The diamond echoes the helmet tab. The portal reads as OS chrome, rather than a generic glowing ring. |
| 6.9–8.1 s | MATE crouches and leaps toward the window, briefly disappears through it, and the system window expands across the frame before the real desktop reveal. | Preserve the anticipation and the clipped-corner transition. No moving wallpaper ribbons or camera fly-through. |
| 8.1–9.25 s | The backdrop reveals the real desktop. The same SVG character emerges and follows a responsive arc, shrinking toward the live lower-right assistant anchor. | Preserve the path across wide and portrait viewports; the target comes from actual layout bounds. |
| 9.25–10.0 s | MATE lands with a short squash, waves, blinks and returns to its idle pose. When the overlay exits, the shared SVG becomes the persistent assistant button. | Idle behavior is stillness. Clicking the figure opens AI Copilot. |

## Artwork and motion system

- Graphite/slate ground, cold-white and silver armor, citron brand details. Market props stay subordinate to the character.
- The shared SVG has independently articulated body, head, arms, legs and eyes. Fixed outer SVG groups position joints; inner groups rotate around local pivots. Eight nested armor groups follow their respective body parts. Left/right chest panels and left/right helmet shells, chin and citron tab support the articulated assembly. Clipped halves reuse the same artwork as the idle control.
- A separate core wrist control supports the pre-armor double tap. Six authored diamonds and localized light accents accompany summoning; brief cloned armor layers supply silver afterimages and are removed on teardown.
- Broad gradients, edge planes and a clear outline provide 2.5D depth without lighting, materials, a model rig or physics simulation.
- Native animations drive transforms and opacity with the existing `--mh-ease` and `--mh-move` curves. RAF observes the playback stage and desktop reveal; it does not redraw the character every frame.
- A `ResizeObserver` updates flight geometry and the portal position from actual surface and anchor bounds. The character scales with the story composition and target control.

## Browser contract and interaction boundaries

- The full ten-second sequence plays automatically on a first visit when motion is allowed. Completion and skipping save this version's seen state in browser storage; repeat visits enter promptly. Storage being unavailable never blocks the desktop. The existing seen-state key is retained across this timing change, so returning visitors are not forced through another intro.
- **Skip intro** and **Escape** release the desktop through the short exit. Automatic entrance respects reduced motion; **Apps → Replay intro** explicitly requests the full sequence even after it has been seen, without resetting drafts, selected project, wallet session or open windows, and without changing the saved motion preference.
- The real desktop is revealed at 8.1 seconds. The workspace stays inert until entry completes, so the mascot does not bypass session or wallet boundaries.
- The idle assistant remains measurable but hidden during arrival. The same armored SVG is shown after the handoff. If a desktop user previously collapsed the companion, the landing crossfades to the compact brand mark.
- Desktop placement clears the Dock. On phones a reserved right-hand Dock slot holds the smaller assistant control rather than covering app content; the mobile collapse control is hidden.
- The persistent button is labeled **Open Mate AI assistant**, with **Ask Mate** as its desktop hint. It opens the existing AI Copilot workspace and retains established sign-in/project guidance. Desktop users can collapse the character to the brand mark.
- Module or animation setup failure releases the intro. An overall 14-second deadline is a final escape hatch. The sequence is a brand story, not a connection check or transaction progress indicator.
- Teardown cancels native animations and the observation frame, removes temporary armor afterimages, disconnects resize observation, clears timers and removes keyboard and motion-preference listeners. Cancelled animation completion promises do not reopen the handoff.
- There is no audio, greeting bubble, movie playback or autoplay-media dependency in the delivered sequence.

## Optional future direction

The current SVG approach is editable directly in the project and does not require external modeling software. Further refinement can focus on authored contact poses, hand gestures, eye expressions and the portal transition while retaining the same artwork at startup and idle.

A later rendered-film version could use Blender for a separately modeled and rigged MATE, with refined materials and precise contact animation. That would be a different delivery workflow: review a greybox animatic first, prepare wide and portrait versions, preserve a matched landing pose, and keep the live desktop and responsive assistant anchor outside the movie. No `.blend` scene, imported animation rig or film export is delivered here.

Soft cartoon impacts, mechanical armor clicks or a short greeting are possible future additions. Any future sound must follow an explicit user choice; a greeting should be dismissible and clear of transaction controls. Neither is part of this implementation.
