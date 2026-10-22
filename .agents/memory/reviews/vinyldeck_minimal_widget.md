# vinyldeck_minimal_widget

## Visuals (from PNG)

This design is a drastic departure from the immersive app window, functioning instead as an ultra-minimal desktop widget. There are no top app bars, no bottom navigation, and no glassmorphism container. The interface consists solely of a small, 200x200px vinyl record isolated on a pure dark background. The record is highly detailed with concentric circular grooves (implemented via nested divs) and a central label displaying album art. A subtle, blurred white border segment wraps the top-right edge acting as a minimal progress indicator. The overall aesthetic is extremely dark, stealthy, and focused entirely on the physical object.

## Behavior (from HTML)

The behavior relies heavily on hover states to reveal functionality:

- **Idle State**: The vinyl record spins continuously (`10s linear infinite`). Behind it, a soft radial gradient (`.pulse`) slowly expands and fades in/out over a 4s alternate animation cycle, giving the widget a subtle "breathing" presence.
- **Hover Reveal**: When the user hovers over the widget container, multiple things happen simultaneously:
  - The record itself scales up slightly (`transform: scale(1.02)`) and its outer glow intensifies.
  - A `.hover-overlay` (dark background with blur) fades in over the record, revealing clean white playback controls (previous, pause, next).
  - Track information (`.track-info` containing title "Midnight City" and artist "M83") fades in and slides up from below the widget (`translateY(-10px)` to `0`).

## Summary

The "Minimal Widget" strips away all traditional UI chromes to leave only the vinyl record. It acts as an ambient, non-intrusive desktop element. Functionality is hidden by default to preserve the clean aesthetic, relying on a unified hover interaction to gracefully reveal the playback controls and track metadata only when the user intends to interact with it.
