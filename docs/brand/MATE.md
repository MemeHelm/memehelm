# MATE — the MemeHelm AI companion

> Current update (2026-11-16): the entrance now lasts 5.5 seconds, reveals the desktop at 4.35 seconds and lands at 5.15 seconds on the welcome portrait near the top of the assistant panel. Closed panels use a visible MATE control; the lower-right floating companion is no longer mounted. The safety deadline is 5.8 seconds plus the 180ms exit. See the root `DESIGN.md` and `docs/SINGLE_WORKSPACE.md`. The earlier script below records the previous timing and companion treatment.

## Name and role

**MATE**, pronounced “mayt”, comes from *first mate*: the creator's capable partner at the helm. In conversational UI, use **Mate**, **Ask Mate** and **Chat with Mate**.

Character line: **Your project's first mate.**

Mate helps the creator understand observations, remember project context, draft content and review next actions. The creator stays in charge of publication and wallet signatures. The character must not imply autonomous trading, guaranteed outcomes or access to connected accounts that the product does not have.

## Character direction

- An original compact navigator robot with a recognizable angular M-shaped helmet.
- Cold-white ceramic and silver shell, graphite faceplate and joints, two simple white eyes.
- The detached citron parallelogram at the upper right of the helmet echoes MemeHelm's existing mark. A tiny matching torso indicator is the only other accent.
- Attentive, welcoming posture; calm and capable rather than noisy or overexcited.
- Use the full figure in welcome and empty states. A separately art-directed head portrait can support small chat avatars; do not stretch the full-body artwork into a tiny icon.

The character now appears in the startup sequence and as a persistent assistant control. It does not replace the MemeHelm logo or imply that every assistant surface has been renamed. Existing custom assistant profiles remain unchanged.

## Voice

Short, practical English. Distinguish observed facts, creator-supplied context and suggestions. Say when evidence is missing. No fabricated confidence, investment advice or claims of having executed an action.

Example greeting: “Hey, I'm Mate. What are we building today?”

Example empty chat prompt: “Ask about your project, or let's plan its next move.”

## Delivered assets and implementation

- `src/mate/MateCharacter.tsx`: original layered SVG artwork shared by the startup and idle assistant. The graphite character has separate head, body, arms, legs and eye groups, plus eight silver/cold-white armor groups. The chest has independent left/right panels; the helmet has independent left/right shells, chin and citron tab. The underlying wrist control supports the summon gesture, and a separate chest highlight supports the final assembly beat. Gradients and edge planes provide restrained 2.5D depth without a 3D renderer.
- `src/mate/MateStory.tsx`: authored SVG market props, impact marks, a wake point and light, wrist bloom, six angular light fragments, a window-corner diamond and the system-window portal.
- `src/mate/sequence.ts`: a ten-second sequence using the browser's native Web Animations API: wake-up, two playful bumps, a third-symbol dodge, a double wrist tap, layered armor assembly with short afterimages, a final citron-tab lock, identity hold, window unlock and entry, then a handoff over the real desktop from 8.1–10.0 seconds. `src/mate/choreography.ts` owns timing and responsive flight geometry.
- `src/EntryLoader.tsx`, `src/MateCompanion.tsx` and the existing desktop styles coordinate the intro and assistant anchor. The idle control stays hidden during arrival, then shows the same armored SVG as the clickable **Ask Mate** control that opens AI Copilot.
- `public/brand/mate-v1.png`: the original image-generated concept reference. It remains versioned for art direction, but is not used as the idle companion and was not converted into the SVG or a rigged model.

The delivered character is authored 2D artwork with independently animated layers, rather than a moving full-body PNG. The sequence does not use Three.js, WebGL, a canvas renderer or a 3D model. No Blender download, `.blend` file, imported rig, rendered movie or sound is needed or supplied. Blender remains an optional future rendered-film workflow, described in `MATE_STARTUP_STORYBOARD.md`.

## Entrance and interaction boundaries

- The ten-second sequence plays automatically on the first visit when motion is allowed. This timing revision keeps the existing seen-state key, so it does not force previously seen intros to play again. Completion or skipping records that this version has been seen in browser storage, so subsequent visits enter promptly. Unavailable storage never blocks entry. Automatic entrance respects reduced motion. **Skip intro** and **Escape** enter the desktop; **Apps → Replay intro** explicitly plays the full sequence even when it has already been seen, without resetting the workspace or wallet session or changing motion preferences.
- The landing reads the actual assistant anchor rather than a baked screenshot. The desktop remains the real application. On phones a reserved right-hand Dock slot holds the smaller companion without overlaying app content.
- Clicking the companion opens the existing AI Copilot page and keeps its session/project requirements. Desktop users can collapse the character to the brand mark; the mobile layout omits that extra control.
- The window unfolds at its clipped corner, then expands across the frame before the real desktop reveal at 8.1 seconds. The responsive flight reaches the assistant anchor at 9.25 seconds; the landing, wave and blink settle by 10 seconds.
- Module or animation setup failure releases the desktop, with a 14-second overall deadline as a final escape hatch. Teardown cancels native animations and the observation frame, removes temporary armor afterimages, disconnects resize observation, and removes keyboard and motion-preference listeners.
- The current sequence has no audio or greeting bubble. The voice examples above and the storyboard's sound notes are future creative suggestions, not delivered behavior.

## Original concept generation prompt

This prompt records the earlier PNG concept. The delivered layered SVG is separately authored code-native artwork.

```text
Use case: stylized-concept.
Asset type: original AI assistant mascot, a reusable transparent cutout for the MemeHelm creator operating system. Character name: MATE, the project's first mate. No text is to appear in the artwork.
Primary request: design ONE distinctive premium 3D character named MATE. A compact, attentive desk navigator robot, with a strong original silhouette derived from MemeHelm's angular M brand mark. Its personality is calm, smart, friendly and capable, like a helpful shipmate who leaves the creator in charge.
Design: a substantial faceted cold-white and silver helmet/head, occupying about half the character height, a recessed graphite-black faceplate and two small simple white rectangular eye slits. The brow and cheek planes trace a clearly readable angular M: high outer corners, a deep central V, clean diagonal planes. The helmet is softly chamfered rather than spherical. A single small detached neon citron parallelogram at the upper RIGHT of the helmet is the signature brand detail, like a navigation tab. This detail must be restrained and clearly visible. Small compact torso with a subtle angular M inset, short articulated arms, small dark graphite feet. Slightly asymmetric welcoming pose: head tilted just a little, one hand lifted with three simple sculpted fingers, the other arm relaxed. Keep every part of the figure inside the frame. No handheld objects.
Style/medium: exceptionally polished designer collectible / premium software mascot, stylized 3D product render, materially believable. Bead-blasted silver metal and matte cold-white ceramic shell, dark graphite joints. Clean broad forms and precise small chamfers; friendly but sophisticated, suitable for a professional Web3 creator product. Do not imitate any existing character.
Color palette: graphite #11171d, cold white #edf1f5, silver #b8c4cf. Only one accent family, neon citron #d7ff00, used for the signature helmet tab and one tiny torso indicator; less than 8 percent of the design. White eye slits, not blue or colored eyes.
Composition/framing: square image, one complete full-body character centered in a subtle front three-quarter view, occupying approximately 78 percent of the canvas height with comfortable clear margin all around. Every contour must read at avatar size. Camera level with the face. Do not add a display base or scene.
Lighting/mood: soft neutral studio key light from upper left, gentle dimensional contact shading and fine highlights on chamfers, strong readable silhouette without hard glare.
Scene/backdrop: genuinely transparent background with alpha, no solid black or white background, no checkerboard baked into pixels, no floor, no backdrop or vignette.
Constraints / avoid: no lettering, labels, logos as text, watermarks, layout board, multiple views or extra characters. No blue, purple, orange or rainbow accents. No astronaut suit, animal ears, humanoid skin, teeth, huge cartoon pupils, glowing rings, holograms, weapons, currency symbols, rockets or excessive greebles. Avoid the generic round white capsule robot: the angular M-shaped helmet and small floating citron tab must provide its own brand identity.
```
