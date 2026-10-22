# vinyldeck_square_mini_player

## Visuals (from PNG)

- A compact, square floating mini player utilizing a deep glassmorphic design (`glass-panel`) with ambient glowing borders.
- Top bar contains minimal icons for expanding to full-screen and closing the widget.
- Centered within the panel is a highly detailed miniature turntable: a spinning vinyl record and a small, metallic-gradient tonearm.
- The bottom area displays track metadata and primary playback controls (previous, play/pause, next).
- A very thin, subtle progress bar runs along the top edge of the panel.

## Behavior (from HTML)

- The vinyl record utilizes a CSS animation (`animate-spin` at 4s per revolution) for continuous spinning.
- The tonearm is positioned statically and does not have hover or state-based movement logic.
- Buttons feature basic CSS hover states (opacity and scale transformations).
- The container itself has a simple scale-up hover effect (`hover:scale-[1.02]`).

## Summary

This mini player provides a clean, tactile widget experience with deep shadows and glassmorphism, relying on basic CSS for spinning the record and simple hover states.
