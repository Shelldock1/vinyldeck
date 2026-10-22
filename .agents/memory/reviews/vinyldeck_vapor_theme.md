# vinyldeck_vapor_theme

## Visuals (from PNG)

- A full application layout implementing the Vaporwave/Synthwave aesthetic.
- The background features a deep purple void and a 3D perspective neon grid (`retro-grid`).
- Navigation includes a glowing "VinylDeck" top app bar and a left-side vertical navigation menu (Player, Collection, Mixes, Discovery).
- The central focus is a large vinyl record with a skeuomorphic metallic tonearm.
- Below the turntable is a wide glassmorphic control panel containing track metadata, a glowing magenta progress bar, and playback controls.

## Behavior (from HTML)

- Relies heavily on CSS animations and hover states:
  - The vinyl spins continuously (`animate-spin-slow`, 8s).
  - The primary play/pause button features an `animate-pulse-glow` effect, shifting its shadow intensity.
  - Interactive elements (nav items, playback buttons) utilize CSS transitions for scaling (`hover:scale-110`, `active:scale-95`) and opacity changes.
- Unlike the animated fullscreen variants, this standard theme view does not appear to use JS for parallax or reactive lighting.

## Summary

This design adapts the highly stylized Vaporwave aesthetic into a functional, full-app layout. It balances the neon, atmospheric visuals (grid, glows) with standard UI paradigms (side nav, control panel) while using CSS animations to keep the interface engaging.
