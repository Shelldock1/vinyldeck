# vinyldeck_vapor_mini_player

## Visuals (from PNG)

- A compact, vertical card-style mini player placed against a fullscreen Vaporwave background.
- The background consists of a dark gradient, a 3D perspective neon grid (`grid-bg`), and large blurred floating cyan and magenta orbs.
- The player card utilizes heavy glassmorphism with a deep purple/magenta glowing border.
- Inside the card is a spinning vinyl record with a neon glowing center label, track info ("Neon Horizon"), a glowing magenta progress bar, and primary playback controls.
- The play button is a large, gradient-filled circular button.

## Behavior (from HTML)

- Pure CSS animations drive the atmospheric effects:
  - `animate-grid-move` for the continuous scrolling of the background grid.
  - `animate-drift` for the slow, alternating movement of the background orbs.
  - `animate-spin-slow` (8s) for the vinyl record.
- The playback controls feature basic CSS hover states (opacity changes, `scale-105` on the play button, and glow enhancements).

## Summary

This design successfully translates the immersive, neon-drenched Vaporwave aesthetic into a contained, glassmorphic mini-player widget, relying entirely on CSS animations to keep the background and vinyl feeling alive and dynamic.
