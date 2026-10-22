# vinyldeck_aurora_motion_mode

## Visuals (from PNG)

- Visually, it carries the same dark, neon "Aurora" aesthetic as the `vinyldeck_aurora_fullscreen` design.
- The record is centrally located, surrounded by atmospheric lighting and glowing orbs.
- In this specific capture, a dynamic dual-tone lighting effect (cyan on one side, teal/blue on the other) is prominent, suggesting a dynamic lighting model reacting to user input or environment.

## Behavior (from HTML)

- Enhances the `vinyldeck_aurora_fullscreen` base with advanced interactive motion and parallax physics.
- **Dynamic Lighting:** Introduces a `.dynamic-light` layer on the vinyl and tonearm that tracks the user's cursor. A `<script>` listens to `mousemove` events and updates CSS variables (`--mouse-x`, `--mouse-y`) to move a radial gradient reflection across the physical elements.
- **Parallax Particles:** The JS particle generator is upgraded to include a `depth` variable for each particle. As the mouse moves, particles shift based on their depth, creating a 3D parallax effect against the background drift.
- **Vinyl Reflections:** The vinyl surface includes an `.animate-spin-reflection` layer that continuously spins in reverse (`reverse spin`), simulating complex environmental light hitting the grooves.
- **Idle UI Fade:** Implements an inactivity timer (`resetIdleTimer()`). The UI controls and text (`.ui-element`) are only visible when the `body` has the `.ui-active` class. If the mouse is idle for 3 seconds, the class is removed, and all UI fades out seamlessly, leaving only the immersive visualizer.

## Summary

The Aurora Motion Mode transforms a static dark-luxury design into a highly interactive, breathing environment. By tying dynamic reflections and 3D particle parallax directly to cursor movement, and implementing an auto-fading UI on idle, it maximizes immersion and leverages the GPU for a premium, cinematic feel.
