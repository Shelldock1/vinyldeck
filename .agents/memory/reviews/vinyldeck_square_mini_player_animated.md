# vinyldeck_square_mini_player_animated

## Visuals (from PNG)

- Visually identical to the static square mini player, featuring the same glassmorphic panel, centered mini vinyl, tonearm, and playback controls.
- Adds an ambient breathing background glow (`animate-breathe`) behind the container that pulses softly.

## Behavior (from HTML)

- The vinyl spinning animation is adjusted to `1.8s` to mathematically match 33 ⅓ RPM.
- Introduces CSS hover interactions for the tonearm (`hover:rotate-[22deg]` and `hover:-translate-y-[2px]`), adding physical responsiveness.
- Adds a JavaScript-driven parallax effect: tracking mouse movement over the container to translate the background layer (`parallax-bg`), creating a sense of 3D depth inside the glass panel.
- The top-edge progress bar includes a transition (`duration-1000 ease-linear`) to imply smooth continuous updating.

## Summary

The animated version of the square mini player significantly enhances the tactile feel by adding JS parallax tracking to the glass background and interactive CSS hover physics to the tonearm, making the widget feel much more alive.
