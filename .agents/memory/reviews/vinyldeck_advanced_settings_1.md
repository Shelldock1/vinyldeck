# vinyldeck_advanced_settings_1

## Visuals (from PNG)

- A full-screen or large modal layout focused on "Performance & Playback" settings.
- The background is a very dark, cinematic room setup with soft volumetric lighting.
- The main settings panel is a frosted glass card (`glass-panel`).
- Contains sections for "Rendering Engine", "Physical Behavior", and "Environment Atmosphere".
- UI controls include custom skeuomorphic sliders with brushed metal thumbs and toggles that glow when active.
- Top app bar includes minimalist icons for palette, queue, fullscreen, and settings.

## Behavior (from HTML)

- Implements a mouse-tracking parallax effect using JavaScript, applying dynamic translation to `.parallax-layer` elements based on cursor position.
- Uses an SVG `<filter>` with `feTurbulence` to create a noise effect, applied as an animated film grain overlay (`grain-overlay` and `film-grain` keyframes).
- A background `<canvas>` renders an animated sine wave visualizer (`drawVisualizer`) reacting to the "Animation Smoothness" setting.
- Custom toggle switches feature JavaScript logic (`togglePhysical()`) that handles sliding the thumb, adding glowing borders, and changing background colors dynamically.
- Uses `backdrop-filter: blur(24px)` and intricate box-shadows to define the glass settings panel.

## Summary

A highly interactive, visually rich settings menu that acts like a physical control board. The addition of mouse parallax, SVG film grain, an HTML5 canvas visualizer, and custom skeuomorphic toggles creates an immersive configuration experience that aligns with the app's cinematic aesthetic.
