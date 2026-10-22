# vinyldeck_fullscreen_cinematic_mode

## Visuals (from PNG)

- **Theme/Style**: "Noir Meditative Mode". Extremely dark, minimal, and immersive.
- **Layout**:
  - The UI is entirely hidden by default, allowing a massive, screen-filling black vinyl record to dominate the viewport.
  - Only the subtle textures of the vinyl grooves and a minimalist tonearm are visible.
- **Key Elements**: Pure black backgrounds, heavy vignette, subtle film grain. High contrast is achieved through deep shadows rather than bright lights.

## Behavior (from HTML)

- **Animation Logic**:
  - **Hover Reveal**: The UI controls (top navigation and bottom playback bar) are hidden and only fade in via CSS (`opacity` transition) when the user hovers over the screen.
  - **Parallax**: A JavaScript mousemove listener creates a subtle parallax effect on the ambient background and vinyl reflections, adding depth.
  - **Particles**: A custom JS particle system generates slowly floating orbs to enhance the meditative atmosphere.
  - **Playback**: Play/pause toggles the tonearm rotation and the platter's spin animation state (`animationPlayState`).

## Summary

A striking, highly immersive cinematic mode that strips away all UI chrome to focus entirely on the physical presence of the vinyl. The use of hover-reveal UI, parallax depth, and floating particles creates a deeply meditative, distraction-free listening environment.
