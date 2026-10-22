# vinyldeck_noir_mini_player

## Visuals (from PNG)

This design is a compact, vertical "Mini Player" or widget card, centered on a stark black background. The card itself has a dark, frosted glass appearance. At the top, a subtle header reads "NOW PLAYING". Below that is a scaled-down vinyl record with a small, metallic tonearm resting on it. A tiny red LED glows on the tonearm. Below the vinyl, clean typography displays the track ("Midnight City" by "Noir Synthwave Ensemble"). Uniquely among the designs seen so far, this uses a traditional linear horizontal progress bar rather than a circular ring around the vinyl. Playback controls and secondary actions (volume, like, cast) sit neatly at the bottom of the card.

## Behavior (from HTML)

The behavior is straightforward and optimized for a small, functional widget:

- **Spin & Arm**: The vinyl spins continuously (`4s linear infinite`). A simple JavaScript toggle controls the play/pause state. When paused, the vinyl animation halts, and the tonearm rotates back to `0deg`. When playing, it drops to `12deg`.
- **Lighting**: A static `.volumetric-spotlight` sits behind the card, casting a subtle white radial gradient downwards.
- **Interactions**: Buttons and sliders have standard hover states (scaling up, increasing brightness). The play button has a glowing drop-shadow that intensifies on hover.
- **No Physics**: Unlike the high-fidelity variants, there is no mouse-tracking parallax, dynamic reflections, or complex particle systems here. It is built for lightweight efficiency.

## Summary

The "Noir Mini Player" successfully translates the cinematic, physical aesthetic of the larger VinylDeck designs into a compact, vertical format. It retains the skeuomorphic vinyl and tonearm but switches to a practical linear progress bar. The animations are kept simple and functional, making it an ideal lightweight companion widget or sidebar component.
