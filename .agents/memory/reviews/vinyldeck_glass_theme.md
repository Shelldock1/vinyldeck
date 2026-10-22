# vinyldeck_glass_theme

## Visuals (from PNG)

This design is a slightly more restrained version of the Glass theme. The visual structure is identical to the high-fidelity version: it has the same dark background with pink and blue ambient gradients, the same central vinyl record, and the same glassmorphism application container. The top navigation (logo and 4 icons), floating playback controls (previous, white pause button, next), and bottom navigation (Player, Collection, Mixes, Discovery) are laid out exactly the same. The text uses Sora and Inter fonts. The glassmorphism blur is prominent on the main container and the floating controls. However, it lacks the explicit film grain overlay and some of the intense lighting reflections seen in the high-fidelity version, resulting in a slightly "flatter" but cleaner look.

## Behavior (from HTML)

The animations are simplified compared to the high-fidelity version, focusing on core movement without the heavy post-processing effects:

- **Ambient Orbs**: The background gradients (`.ambient-orb-1`, `.ambient-orb-2`) float using a simpler `translate` and `scale` animation over 15s and 20s.
- **Vinyl Rotation**: The central vinyl spins at a slightly faster 8s linear infinite rate (`.spin-slow`).
- **Absences**: It deliberately removes the SVG noise filter (no grain), the shimmering conic gradient reflection on the vinyl, and the volumetric pulsing box-shadows on the containers.
- **Interactions**: Buttons still have hover states (opacity and scale changes) and active states (`transform: scale(0.95)` or `0.90`), but without the complex inset shadows or expanding background effects of the high-fidelity variant.

## Summary

This folder contains the baseline "Glass Theme". It provides the core visual identity—blur, ambient background colors, and the central vinyl layout—but skips the heavy, performance-intensive visual effects like film grain, complex shimmers, and volumetric pulsing. This makes it a lighter, cleaner implementation that still maintains the premium glassmorphism aesthetic.
