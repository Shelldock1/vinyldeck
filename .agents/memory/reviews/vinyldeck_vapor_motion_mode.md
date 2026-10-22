# vinyldeck_vapor_motion_mode

## Visuals (from PNG)

- A highly immersive fullscreen Synthwave visualizer, heavily based on the `vinyldeck_vapor_fullscreen` design.
- Features the dark void background, large glowing cyan/magenta orbs, and the 3D perspective grid floor.
- The central element is a massive vinyl record with a neon magenta progress ring.
- **New Element:** A stylized, metallic CSS-drawn tonearm (`tonearm-container`) is positioned over the right side of the massive vinyl. The arm features a shimmering light reflection.

## Behavior (from HTML)

- **CSS Animations:** Includes background orb floating, grid movement, vinyl spinning, and a new `breathePulse` for the progress ring. The tonearm features an `armShimmer` animation simulating a reflection running down its metallic gradient.
- **JavaScript Logic - Inactivity Timeout:** Implements a `showUI()` function that reveals the top app bar and bottom controls, and changes the cursor to default. After 2.5 seconds of mouse inactivity, it adds a `ui-hidden` class (hiding the cursor) and removes the `ui-active` class (hiding the UI elements via CSS opacity/transform transitions).
- **JavaScript Logic - Reactive Lighting:** The `mousemove` event updates `--mouse-x` and `--mouse-y` CSS variables. These variables are used in the `.vinyl-record`'s `box-shadow` property to dynamically shift the drop shadow based on cursor position, simulating a moving light source.

## Summary

"Motion Mode" creates a deeply immersive, distraction-free fullscreen playback experience. It combines complex CSS drawing (the tonearm), reactive shadow physics, and a robust JS timeout system to hide the UI and cursor, focusing entirely on the cinematic aesthetic.
