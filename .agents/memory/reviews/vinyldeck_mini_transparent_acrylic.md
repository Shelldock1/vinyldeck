# vinyldeck_mini_transparent_acrylic

## Visuals (from PNG)

- **Theme/Style**: A clean, modern "Transparent Acrylic" look, relying heavily on frosted glass and bloom effects.
- **Layout**:
  - A medium-sized square floating widget (`w-[380px]`).
  - Top header with title and a 'more' icon.
  - Central display features a vinyl platter with highly visible concentric grooves.
  - Bottom area contains centered track text, a glowing progress bar, and machined-looking transport controls.
- **Key Elements**: The main chassis uses `backdrop-filter: blur(40px) saturate(180%)` to create the acrylic feel. Generous use of drop shadows (`ambient-bloom`) creates a glowing, ethereal presence against dark backgrounds.

## Behavior (from HTML)

- **Animation Logic**:
  - The entire container features a smooth scale-up effect on hover (`hover:scale-[1.02]`).
  - The central vinyl record rotates continuously via a CSS `spin-anim` class.
  - Transport buttons feature detailed hover states, including shadow intensity changes and scaling (`active:scale-95`).

## Summary

The Transparent Acrylic mini-player balances a highly tactile hardware feel with modern glass UI trends. The semi-transparent chassis allows the background to bleed through, making the widget feel light and unobtrusive while maintaining strong visual hierarchy through glowing accents.
