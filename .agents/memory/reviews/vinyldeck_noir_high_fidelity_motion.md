# vinyldeck_noir_high_fidelity_motion

## Visuals (from PNG)

This design strikes a balance between the app-like structure of the Glass theme and the dark, cinematic mood of the Noir fullscreen themes. It features a prominent glassmorphism container holding the central vinyl record and a skeuomorphic tonearm. The background is not pure black; it contains large, deeply blurred ambient orbs in dark crimson and amber/brown, giving the whole scene a moody, "After Hours" jazz club or synthwave vibe. A procedural film grain overlays the entire view. At the bottom, a sleek, pill-shaped glass panel houses the track information ("After Hours" by The Weeknd), playback controls, and a custom volume slider. The album art perfectly matches the red-and-black aesthetic.

## Behavior (from HTML)

This theme integrates high-fidelity physical simulations and parallax effects:

- **Parallax Background**: The ambient background orbs (`.parallax-layer`) move in response to mouse position, creating a subtle 3D depth effect behind the glass panel.
- **Dynamic Vinyl Shine**: JavaScript calculates the angle between the mouse cursor and the center of the vinyl (`Math.atan2`), dynamically updating a CSS custom property (`--rotation`). This causes the conic-gradient reflection on the vinyl to physically follow the user's mouse.
- **Tonearm Physics**: The metallic tonearm moves between a resting state (25deg) and an active playing state (40deg) using a custom bouncy `cubic-bezier` curve. It also features a pulsing red LED indicator.
- **Breathing Orbs**: The background color orbs slowly pulse in size and opacity over a 10s alternate animation (`.animate-breathe`), making the environment feel alive.

## Summary

The "Noir High Fidelity Motion" is perhaps the most richly atmospheric design. It combines the structured UI of a standard player with intense, moody lighting (crimson/amber on black), heavy procedural grain, and highly interactive physical simulations (mouse-tracking reflections and parallax). It feels luxurious, tactile, and highly premium.
