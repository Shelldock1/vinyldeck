# vinyldeck_acrylic_mini_player

## Visuals (from PNG)

- Displays a dark, frosted glass (acrylic) mini-player card centered on the screen.
- A glowing background gradient of cyan, magenta, and deep blue sits behind the card.
- At the center of the player is a vinyl record with a dark, abstract, fluid-art album cover.
- The UI includes "NOW PLAYING" text, track information ("Midnight Horizon" by "The Synthetics"), a sleek progress bar, and playback controls (shuffle, previous, play, next, repeat, volume, cast).
- The player features a stylized floating playback head/tonearm hovering over the record.

## Behavior (from HTML)

- Uses an ambient background drifting animation (`drift` keyframes) composed of blurred radial gradients.
- The acrylic panel uses `backdrop-filter: blur(40px) saturate(150%)` to achieve a frosted glass effect.
- Playback controls have subtle hover states (scaling up and glowing text shadows).
- The vinyl record rotates continuously via an `animate-spin-slow` class.
- The vinyl includes CSS-generated textures: a `conic-gradient` for iridescent sheen and a `repeating-radial-gradient` for grooves.
- The progress slider has a custom thumb that fades in on hover.

## Summary

A beautiful, compact "mini-player" mode that leverages CSS backdrop filters, conic gradients for vinyl sheen, and slow spinning animations to create a highly aesthetic, skeuomorphic yet modern playback experience.
