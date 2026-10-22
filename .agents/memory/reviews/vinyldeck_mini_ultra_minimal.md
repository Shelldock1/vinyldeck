# vinyldeck_mini_ultra_minimal

## Visuals (from PNG)

- **Theme/Style**: "Ultra-Minimal". Stripped down to the absolute essentials, resembling a high-end audio component embedded in a dark surface.
- **Layout**:
  - A very small, perfectly square widget area (`w-48 h-48`).
  - By default, it displays only a recessed vinyl platter surrounded by a thin SVG progress ring. There is no visible text or transport controls in the default state.
- **Key Elements**: Deep, machined recesses (`machined-recess`), extremely subtle vinyl textures, and a dark, moody ambient bloom behind the player.

## Behavior (from HTML)

- **Animation Logic**:
  - **Hover Reveal**: A `.controls-overlay` (containing play, previous, and next buttons) is hidden by default (`opacity: 0`) and fades in via CSS transitions when the user hovers over the player.
  - **Ambient Bloom**: Hovering also intensifies the background glow (`.ambient-bloom`).
  - The vinyl spins continuously with CSS animations.

## Summary

This design takes minimalism to the extreme. By hiding all metadata and controls behind a hover state, it allows the user to focus entirely on the aesthetic of the spinning record and the progress ring. It is ideal for users who want a distraction-free, highly aesthetic mini-player on their desktop.
