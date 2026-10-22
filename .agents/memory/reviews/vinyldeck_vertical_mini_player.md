# vinyldeck_vertical_mini_player

## Visuals (from PNG)

- A portrait-oriented, tall mini player widget featuring a split layout within a heavily rounded glassmorphic container.
- **Top Half:** Contains a spinning vinyl record and a highly blurred, subtle suggestion of a tonearm in the background. A unique vertical progress bar runs along the entire left edge of the player.
- **Bottom Half:** Displays track metadata ("Midnight City"), timestamp counters, primary playback controls (previous, play/pause, next), and secondary action icons (favorite, queue, more).
- Uses a dark, cinematic theme with stark white accents (e.g., the solid white play button).

## Behavior (from HTML)

- The vinyl record rotates using a standard CSS `spin` animation (4s per revolution).
- The UI relies heavily on CSS hover and active states for tactile feedback:
  - Playback buttons scale up on hover (`hover:scale-110` or `hover:scale-105`) and scale down on click (`active:scale-95`).
- The vertical progress bar on the left edge implies progress via the height percentage of the `bg-primary` inner div, paired with a `transition-all duration-300`.

## Summary

The vertical mini player offers a distinct, elegant form factor, utilizing a split layout to separate the spinning vinyl visualization from the dense control area. The left-edge vertical progress bar is a unique design choice that fits the portrait aspect ratio perfectly.
