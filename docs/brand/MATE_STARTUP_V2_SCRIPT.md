# MATE — Take the helm.

> Current update (2026-11-16): the entrance now lasts 5.5 seconds, reveals the desktop at 4.35 seconds and lands at 5.15 seconds on the welcome portrait near the top of the assistant panel. Closed panels use a visible MATE control; the lower-right floating companion is no longer mounted. The safety deadline is 5.8 seconds plus the 180ms exit. See the root `DESIGN.md` and `docs/SINGLE_WORKSPACE.md`. The earlier script below records the previous timing and companion treatment.

Implemented ten-second sequence. This document records the current layered-SVG story, its assembly blocking and playback boundaries. Optional greeting and sound ideas below remain future suggestions; neither is part of the delivered animation.

## Direction

Keep the current authored 2D MATE, with limited 2.5D depth from separate foreground, character and backdrop layers. Graphite, silver/cold white and citron remain the entire visual language. The story is about a small character finding its composure, getting equipped and taking its place as the creator's first mate.

The sequence is shortened from fifteen to ten seconds by trimming quiet setup, the identity hold and the desktop flight more than the action beats. Preserve the readable contact poses and armor locks instead of applying one uniform speed-up. Put the strongest visual moments into armor assembly and the branded system-window transition. Keep the face readable throughout.

## Ten-second script

| Time | Shot | Action / expression | Visual treatment |
| --- | --- | --- | --- |
| 0.0–0.65s | A little presence | A small citron point drops into the quiet slate space. MATE looks up and responds with a head/eye movement and blink as a soft light reveals the graphite figure. | A local wake light supports the point. The character remains the focus; the background stays calm. |
| 0.65–2.15s | Market chaos | A candlestick bumps MATE's shoulder; it tips and catches itself. A chart tile knocks the top of its head. A third symbol approaches from above; MATE notices and ducks just in time. It straightens with narrowed eyes and glances at its wrist. | Two short impact marks, squash-and-stretch and tiny contact reactions. Give the near miss a brief held pose so the audience reads the joke. The physical comedy ends here. |
| 2.15–2.9s | The decision | MATE braces its feet and taps the citron wrist mark twice. The first tap gives a small response; the second emits a stronger local bloom and six angular fragments. Market props pause briefly, then drift away from the character. | Hold a fraction before the response. The light stays local to the gesture. |
| 2.9–5.35s | Suit up | Four overlapping assembly waves: boots lock first; shoulders and forearms follow; the chest rises and its two panels slide together; finally the M-shaped face armor closes from its two sides and the chin seats. The upper-right citron tab locks last. MATE's eyes compress for the final contact, then open. | Armor travels on short curved paths with a restrained silver afterimage. Each group lands firmly with a tiny overshoot. A brief highlight crosses the completed chest. The helmet's final lock is the strongest beat. |
| 5.35–5.8s | Meet MATE | MATE takes a small confident step and holds a clear hero pose. The name appears with “Your project's first mate.” | A subtle pose scale and tilt add emphasis without a camera move. Let the still pose carry the moment. The citron tab settles into its familiar brand angle. |
| 5.8–6.9s | A window, unlocked | MATE raises its hand and flicks a small citron diamond from its wrist. The diamond travels to the clipped corner of an outlined system window. It locks into the corner; the dark window unfolds into place. MATE notices the open path. | The diamond's diagonal matches the brand tab. Three small corner points appear before the window surface opens. The finished frame is stable and reads as an OS window. |
| 6.9–8.1s | Into the system | MATE crouches, pushes off and jumps into the window. The figure briefly disappears through it. Around eight seconds, the window expands across the frame before the real desktop is revealed. | Use a short anticipation, a fast leap and a clean occlusion at the frame edge. Keep the path continuous through the reveal; the diagonal window corner carries the transition. |
| 8.1–9.25s | Find the desk | As the desktop is revealed, the same MATE emerges along the continuation of its jump and follows a short descending arc to the actual lower-right assistant anchor. Its size reduces naturally as it approaches. | Use the real interface and current anchor bounds. The idle assistant remains hidden until handoff. |
| 9.25–10.0s | Your move | MATE lands, compresses briefly, recovers, gives one small wave, blinks and returns to its idle pose. | The shared SVG becomes the clickable assistant without a visual swap. If the assistant was compact, finish in the existing compact mark instead. No greeting bubble appears. |

“Your move.” remains an optional future greeting, not delivered end copy. The existing brand line “Launch it. Steer it.” remains part of MemeHelm's desktop identity.

## Assembly blocking

- 2.90–3.37s: boots arrive on opposing curved paths. MATE shifts weight as each sole settles.
- 3.26–3.98s: shoulder shells and gauntlets arrive in a short left/right stagger, with the wrists still visible.
- 3.94–4.72s: chest shell rises, its left/right panels close, and a brief chest highlight punctuates assembly.
- 4.63–5.28s: left/right face shells converge; the chin seats; eyes react to contact.
- 5.19–5.37s: the detached citron tab locks last, followed by a brief, legible still pose.

## Sound direction

The delivered entrance is silent. If a later implementation adds an explicitly selected sound replay, use soft cartoon impacts, a double wrist click, four grouped mechanical locks, a small final helmet click, an airy window pass and a quiet landing. The action must read fully without sound. No voiced exposition or music is required.

## Production notes

- Layered SVG and native browser animation deliver this version; it does not require Blender, a movie service or a return to real-time 3D.
- Independent helmet side/chin/tab layers, split chest panels, a ducking pose, a takeoff pose, brief silver afterimages and the branded window-corner diamond implement the signature beats. The effects stay localized and brief.
- Existing project motion curves drive travel and settlement. `src/mate/choreography.ts` owns the ten-second duration, 8.1-second desktop reveal, 9.25-second landing and fourteen-second safety deadline.
- The real desktop and wallet state stay alive underneath. Flight geometry measures the current assistant anchor and updates when the viewport changes. The sequence contains no baked desktop screenshot.
- Skip intro and Escape remain available throughout. Reduced motion bypasses automatic entrance; explicit Replay requests the full sequence without changing saved motion preferences. Focus restoration and previously selected compact state are preserved.
- The full ten seconds plays on the first visit when motion is allowed. Completion or skipping stores this version's seen state, so normal repeat visits enter promptly. Manual Replay always requests the full sequence. This timing revision retains the existing seen-state key; returning visitors do not receive a forced intro. Storage access failure never blocks entry.
- On phones, group armor arrivals closer to the character and keep the system window inside the portrait frame. Preserve the reserved Dock slot and keep captions above the skip control.
- Review beats at actual phone size: the duck must be readable, the M must remain recognizable during assembly, and the final SVG must match the idle control precisely.

## Continuing review targets

The shorter pacing should still read as a complete short story, with less time waiting between actions. The signature moments are the near miss, the last citron tab locking into the helmet, and a matching citron diamond unlocking an OS window. Preserve those three ideas when simplifying effects for small screens or lower-power devices.
