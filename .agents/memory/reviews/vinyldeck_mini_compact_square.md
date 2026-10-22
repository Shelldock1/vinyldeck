# vinyldeck_mini_compact_square

## Visuals (from PNG)

- **Theme/Style**: A compact, floating "Mini Player Widget" following a dark, tactile aesthetic.
- **Layout**:
  - The UI is constrained to a small square container (`w-80 h-80`).
  - The top section features a spinning vinyl record set inside a recessed well (`hardware-recess`).
  - The tonearm is simplified into an SVG graphic rather than a complex DOM structure.
  - The bottom section is a frosted glass bar (`backdrop-blur-[40px]`) containing track info and basic transport controls (previous, play/pause, next).
- **Key Elements**: Deep shadows, subtle inner shadows to simulate a physical hardware recess, and glowing progress rings.

## Behavior (from HTML)

- **Animation Logic**:
  - Relies primarily on CSS animations. The vinyl record spins continuously using a `spin-slow` keyframe animation.
  - There is no JavaScript logic included for play/pause toggling in this static mockup; the focus is on the visual presentation of the compact state.

## Summary

The Compact Square mini-player successfully translates the premium, physical feel of the main application into a small, floating widget. By using SVG for complex elements like the tonearm and relying on strong shadow cues, it maintains visual fidelity in a highly constrained space.
