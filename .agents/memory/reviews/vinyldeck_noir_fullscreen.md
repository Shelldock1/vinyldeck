# vinyldeck_noir_fullscreen

## Visuals (from PNG)

This design is a dark, elegant fullscreen player that closely resembles the "Monochrome" theme but with a slightly softer, more atmospheric "Noir" touch. The layout centers on a large vinyl record with a skeuomorphic tonearm on the right. A thin white progress ring borders the record. The background isn't pure #000 black; it uses a very subtle radial gradient (`rgba(255,255,255,0.03)` to black) to create a faint ambient glow behind the turntable. The typography ("Midnight Voyage" / "The Cinematic Orchestra") and minimal icons follow the clean, cinematic aesthetic. The album art is a moody, dark photograph.

## Behavior (from HTML)

The behavior is functional and relies on a mix of CSS transitions and basic JavaScript:

- **Playback State**: A JavaScript script toggles an `isPlaying` boolean when the play/pause button is clicked. This plays/pauses the vinyl rotation (`4s linear infinite`) and toggles an `.active` class on the tonearm (rotating it from 20deg to 35deg).
- **Simulated Progress**: JavaScript uses a `setInterval` to constantly update the `strokeDashoffset` of the SVG progress ring, simulating track playback.
- **Hover Reveal**: The bottom playback controls and track info are wrapped in a `.controls-hover-area` that fades in from 0 to 1 opacity on hover, keeping the default state clean. The top app bar also fades in on hover.

## Summary

The "Noir Fullscreen" theme offers a polished, functional, and highly focused listening experience. It introduces basic JavaScript to make the skeuomorphic elements (tonearm, progress ring, spinning vinyl) genuinely interactive and reflective of the playback state. Visually, it provides a very subtle ambient lift compared to the harsh pure black of the Monochrome theme, fitting the "Noir" aesthetic perfectly.
