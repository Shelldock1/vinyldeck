# vinyldeck_vapor_experience_2

## Visuals (from PNG)

- An evolution of the Vapor theme, adopting a "Bento box" layout on the right side.
- Introduces a global "CRT scanline" overlay across the entire body for a stronger retro TV/monitor effect.
- The left side holds the player, featuring an angular, heavily stylized tonearm.
- The right side features modular cards: an "Up Next" queue, a static "Levels" visualizer, and a large "Speed" (33 1/3 RPM) typographic card.
- Desktop transport controls float independently at the bottom center.

## Behavior (from HTML)

- The CRT scanline effect is a `linear-gradient` applied to the `body` background.
- The 3D cyber-grid from the previous iteration is enhanced with a CSS animation (`moveGrid 10s linear infinite`) that constantly shifts the background-position, creating the illusion of continuously moving forward through the grid.
- The vinyl record spins, but the tonearm is completely static.
- Unlike `vapor_experience_1`, the LED meters here are static CSS shapes with no JavaScript randomization.

## Summary

This iteration marries the Vaporwave aesthetic with modern Bento-style UI architecture. The addition of the CRT scanlines and the animated, infinitely scrolling 3D grid significantly enhance the atmospheric "outrun" vibe. However, it trades away some of the interactive JS features (like the moving peak meters and tonearm logic) seen in previous prototypes.
