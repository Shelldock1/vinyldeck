# vinyldeck_vapor_mini_player_animated

## Visuals (from PNG)

- Visually nearly identical to the static `vinyldeck_vapor_mini_player`, featuring the same vertical glassmorphic card over a Synthwave grid and glowing orbs.
- Adds an overlay of "drifting digital dust" particles in the background.

## Behavior (from HTML)

- **Enhanced CSS Animations:**
  - The vinyl spinning speed is increased (`animate-spin-fast` at 2s).
  - Introduces a digital dust particle system (`animate-dust`) floating upwards in the background.
  - The magenta progress bar features an `animate-flicker` keyframe, causing its glow and opacity to pulse rapidly.
- **JavaScript Interactions:**
  - A `mousemove` event listener tracks the cursor position to dynamically adjust the 3D transform (`rotateX` and `rotateY`) of the background grid (`#gridBg`), creating a responsive parallax perspective effect.

## Summary

The animated iteration takes the Vaporwave mini player and significantly amps up the interactivity and visual noise. The addition of mouse-tracked 3D grid perspective and flickering neon accents creates a highly kinetic and tactile experience.
