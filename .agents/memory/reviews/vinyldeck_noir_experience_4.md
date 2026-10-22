# vinyldeck_noir_experience_4

## Visuals (from PNG)

- Almost identical layout to experience 3, featuring a centered turntable with a physical tonearm and a glassmorphic bottom control panel.
- The aesthetic remains dark, premium, and analog-nostalgic.
- Visuals are enhanced with more detailed lighting effects, including a shimmer overlay on the record and dynamic bloom lighting.

## Behavior (from HTML)

- Introduces an analog noise overlay using an SVG `feTurbulence` filter.
- JavaScript playback logic is significantly upgraded: it uses `requestAnimationFrame` for smooth rotation tracking rather than a simple CSS class toggle.
- When paused, it includes a realistic "inertia stop" effect using a `cubic-bezier` transition to slowly bring the record to a halt.
- Playback triggers a `record-shimmer` CSS animation and intensifies the ambient background blur and brightness.

## Summary

A refinement of the third iteration, focusing heavily on interactive fidelity and animation quality. The addition of JavaScript-driven rotation with inertia and more complex lighting states (shimmer, bloom) makes the turntable feel much more physical and responsive.
