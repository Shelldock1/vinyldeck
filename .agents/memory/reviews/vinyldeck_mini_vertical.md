# vinyldeck_mini_vertical

## Visuals (from PNG)

- **Theme/Style**: A vertical, almost mobile-phone-proportioned widget. It maintains the dark, high-fidelity "Noir" aesthetic.
- **Layout**:
  - Tall and narrow layout (`max-w-[320px] h-[600px]`).
  - **Header**: Features a drag handle icon and a glowing "HI-RES AUDIO" badge.
  - **Center**: A prominent recessed well containing the spinning vinyl and a simplified, abstracted tonearm hint.
  - **Footer**: Track metadata is stacked above a set of format badges (FLAC, 24-BIT, 192KHZ). Below this are the main transport controls and secondary controls (volume, time display, heart/like button).
- **Key Elements**: Extensive use of inner shadows for depth, gradient borders to simulate machined edges, and a prominent glowing progress ring around the platter.

## Behavior (from HTML)

- **Animation Logic**:
  - JavaScript is included to handle the primary play/pause interaction.
  - Toggling play/pause adds/removes a `.paused` class to the vinyl CSS animation.
  - The play/pause button also features a custom JS-driven tactile 'bump' animation (`transform: scale(0.95)` for 100ms) to simulate pushing a physical mechanical button.

## Summary

The Vertical Mini Player offers a comprehensive set of controls and metadata within a narrow footprint, making it perfect for docking to the side of a screen. It successfully incorporates premium audiophile signifiers (like the format badges and hi-res indicator) while maintaining the rich, tactile visual language of the larger interfaces.
