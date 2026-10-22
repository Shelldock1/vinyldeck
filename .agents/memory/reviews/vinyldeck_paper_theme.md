# vinyldeck_paper_theme

## Visuals (from PNG)

- A light, paper-themed aesthetic featuring a warm cream background (`#fdfbf7`) and bronze-tinted elements.
- The interface utilizes "cardstock" shadows and "sunken" slots to create physical depth, mimicking real paper and embossed interfaces.
- The layout is divided into three main columns on desktop: Now Playing info on the left, a large Turntable Stage in the center, and Transport Controls / Up Next list on the right.
- High-end typography with Sora for headers and Inter for body text.

## Behavior (from HTML)

- The application uses CSS animations for the turntable: `animate-spin-slow` is applied to the vinyl record to make it spin continuously.
- The tonearm is positioned statically (`pointer-events-none`) with no defined dynamic CSS rotation transitions for interactive playback states.
- Hover and active states are present on buttons (scale down on click, opacity changes on hover).
- A CSS noise filter is overlaid to simulate a realistic paper texture.

## Summary

The paper theme successfully establishes a tactile, physical feel through careful use of warm colors, inner/outer shadows, and a noise overlay, providing a rich, high-end alternative to standard dark modes.
