# vinyldeck_noir_motion_mode

## Visuals (from PNG)

This design is a cinematic fullscreen experience that sits visually between the standard Noir Fullscreen and the High-Fidelity variant. It features the massive central vinyl, the white progress ring, and the skeuomorphic tonearm on a deep black background with a subtle center radial glow. The typography ("Midnight Voyage") and layout are standard. What sets it apart visually is the presence of an atmospheric particle field covering the dark void behind the turntable, giving it a spatial, deep-space feel.

## Behavior (from HTML)

The behavior in this mode is heavily focused on creating a distraction-free, highly performant "theater" mode:

- **Canvas Particles**: Instead of using CSS-animated DOM elements (which can be heavy), this design uses an HTML5 `<canvas>` and a JavaScript rendering loop to draw and animate hundreds of floating particles. This is a much more performant way to handle complex particle physics.
- **Cursor and UI Hiding**: To maximize immersion, an inactivity timer tracks mouse movement. After 3 seconds of stillness, JavaScript not only fades out the UI elements (top bar, track info, controls) but also adds a `.hide-cursor` class to the body, completely removing the mouse pointer from the screen until moved again.
- **Dynamic Reflection**: Like the high-fidelity versions, the CSS conic gradient on the vinyl rotates based on mouse position to simulate dynamic lighting.
- **Breathing Ring**: The white SVG progress ring has a subtle 4s `breathe` animation, causing its drop-shadow to throb gently, giving the interface a heartbeat.

## Summary

The "Noir Motion Mode" is designed for deep listening and visual immersion. By implementing a high-performance canvas particle system and aggressively hiding both the UI and the user's cursor after a few seconds of inactivity, it turns the screen into a mesmerizing, distraction-free visualizer centered purely on the spinning vinyl record.
