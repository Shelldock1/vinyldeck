# vinyldeck_vapor_fullscreen

## Visuals (from PNG)

- A highly stylized Synthwave/Vaporwave fullscreen player featuring a deep space/dark purple background.
- Contains massive floating, blurred neon orbs (magenta and cyan) for dramatic atmospheric lighting.
- A 3D-perspective neon grid floor (`grid-floor`) provides a retro-futuristic horizon line.
- The centered vinyl record is large, enclosed in a glowing magenta progress ring (`progress-ring`), and has intense magenta drop shadows.
- Text uses a neon-glow text shadow effect (`neon-text`).
- The top app bar and bottom playback controls are hidden by default to maximize the immersive visualizer effect.

## Behavior (from HTML)

- Extensive pure CSS animations:
  - `moveGrid` pans the grid floor continuously.
  - `float` animates the background orbs with a slow, alternating translation and scale.
  - `spin` continuously rotates the vinyl record.
- **Hover Reveal:** Hovering anywhere on the `body` triggers CSS transforms (`translateY`) to smoothly slide in the top app bar and the bottom glassmorphic controls overlay.
- Playback buttons are styled as `glass-btn` with aggressive magenta hover glows and scaling.

## Summary

The Vapor Fullscreen view is a highly immersive, heavily animated CSS visualizer. By hiding the UI until hover and focusing on continuous grid/orb animations, it successfully replicates a premium 80s outrun/synthwave aesthetic.
