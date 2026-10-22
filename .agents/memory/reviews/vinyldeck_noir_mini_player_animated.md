# vinyldeck_noir_mini_player_animated

## Visuals (from PNG)

This design is a direct upgrade of the `vinyldeck_noir_mini_player`. It retains the exact same vertical layout: a dark frosted glass card containing a top-aligned vinyl record, linear progress bar, and bottom playback controls. The typography ("Midnight City") and iconography remain identical. Visually, the main difference is the addition of a soft, interactive radial spotlight that softly illuminates the grooves of the vinyl record where the user's cursor hovers.

## Behavior (from HTML)

This variant introduces elegant, lightweight JavaScript interactions to make the widget feel more alive without overwhelming the system:

- **Interactive Spotlight**: A JavaScript event listener tracks the mouse position relative to the widget card. It uses a custom inertia/easing function to smoothly update CSS variables (`--mouse-x`, `--mouse-y`), moving a soft radial gradient (`.interactive-spotlight`) across the surface of the vinyl record as the user hovers over it.
- **Pulsing LED**: The small red power indicator on the tonearm now features a continuous `pulse-light` animation, glowing between 50% and 100% opacity.
- **Vinyl Spin**: The vinyl rotation has been slowed down from 4s to a much more relaxed 8s (`8s linear infinite`).
- **Tonearm**: Retains the basic CSS transform (`12deg`) to drop onto the record when playing.

## Summary

The "Animated" variant of the Noir Mini Player takes a static, functional widget and injects it with a premium feel using a very localized, physics-based interaction. The interactive spotlight that smoothly follows the cursor across the vinyl grooves makes the digital interface feel like a physical object under dynamic lighting, perfectly capturing the "cinematic" brief in a confined space.
