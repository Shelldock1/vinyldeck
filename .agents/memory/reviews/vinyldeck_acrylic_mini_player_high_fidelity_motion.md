# vinyldeck_acrylic_mini_player_high_fidelity_motion

## Visuals (from PNG)

- Visually very similar to the animated acrylic mini-player.
- The glass panel shows slightly more depth, lighting variation, and sharper shadows.
- Features a dark aesthetic with colored volumetric lighting in the background (cyan and magenta hues).
- Retains all core UI elements: "Now Playing", vinyl record, track details, progress bar, and control icons.

## Behavior (from HTML)

- Introduces 3D perspective to the body (`perspective: 1000px`).
- Adds a `glass-reflection` overlay on the acrylic panel that shifts and rotates continuously via `reflectionShift` keyframes to simulate light moving across the glass surface.
- The entire widget floats up and down with subtle 3D rotation (`animate-float-widget`).
- The vinyl record's rotation is updated to `spin-wobble`, creating a slight scaling/wobble effect as it spins to simulate physical imperfection.
- The playback tonearm incorporates a new `animate-tonearm-wobble` effect.
- Interactions are more "magnetic": the play button uses custom cubic-bezier transitions to scale up and translate on hover.
- Background orbs use smooth interpolation for opacity and movement.

## Summary

The "high fidelity motion" iteration focuses heavily on physics-based micro-interactions and 3D depth. By adding widget floating, tonearm wobble, glass reflections, and magnetic hover effects, the player feels much more tangible, physical, and premium.
