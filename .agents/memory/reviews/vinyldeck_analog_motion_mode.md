# vinyldeck_analog_motion_mode

## Visuals (from PNG)

- Visually identical to the `vinyldeck_analog_fullscreen` design, retaining the warm bronze palette, large vinyl record, and skeuomorphic tonearm.
- The playback controls and track information at the bottom appear slightly faded or hidden, emphasizing the record itself.
- A soft, golden radial light illuminates the scene, enhancing the analog warmth.

## Behavior (from HTML)

- Introduces significant motion and physics-based animations to the analog fullscreen mode.
- Adds a `.wobble` keyframe animation to the vinyl record container, creating a slight, realistic imperfection as it spins.
- The tonearm features a `.tonearm-bounce` animation utilizing a custom cubic-bezier to simulate the physical drop and inertia of the needle hitting the groove.
- Implements a `.golden-hour-light` that slowly pans a radial gradient across the screen over 20 seconds.
- The SVG film grain is animated (`grainStep`) to flicker, rather than remaining static.
- Floating, out-of-focus dust particles (`.particle`) drift upwards across the screen.
- The bottom UI controls use a hover-reveal pattern: they remain semi-transparent (`opacity-40`) and fade in while translating upwards when the user hovers over the area.

## Summary

This iteration takes the static analog fullscreen design and injects extensive cinematic motion. By adding tonearm drop physics, vinyl wobble, panning environmental lighting, animated film grain, and drifting dust particles, it creates a highly immersive, breathing, and tangible analog listening environment.
