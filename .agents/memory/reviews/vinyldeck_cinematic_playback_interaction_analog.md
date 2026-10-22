# vinyldeck_cinematic_playback_interaction_analog

## Visuals (from PNG)

- This design utilizes the familiar warm, vintage analog aesthetic seen in previous analog iterations, featuring bronze accents, a dark background, and a skeuomorphic tonearm.
- The UI is centered around the large vinyl record, with track information and playback controls positioned neatly below it.
- A glowing bronze ring softly illuminates the area behind the record, creating depth.

## Behavior (from HTML)

- The core focus of this file is the implementation of interactive, physics-based playback logic using JavaScript and CSS transitions.
- **Playback Toggle:** Clicking the main play/pause button triggers the `togglePlayback()` function, which toggles an `.is-playing` class on the main container.
- **Inertial Stopping:** When playback is paused, a custom JS function (`getRotationDegrees`) calculates the exact current rotation angle of the spinning vinyl. It then applies an inline transform to rotate an additional 45 degrees paired with a CSS cubic-bezier transition (`.vinyl-stop`) to simulate the physical friction and inertia of a turntable coming to a halt.
- **Tonearm Mechanics:** The tonearm uses a spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) to physically swing into place (25 degrees) when playing, and swing back out (15 degrees) when paused. The headshell also dips slightly to simulate the needle dropping into the groove.
- **Dynamic Lighting:** The background glow ring (`.glow-ring`) and groove reflections only pulse and orbit while the state `is-playing` is active.

## Summary

This iteration focuses on the tactile, mechanical feel of operating an analog turntable. By combining CSS spring animations for the tonearm with custom JavaScript to calculate rotational inertia when stopping the record, it creates a highly satisfying and realistic playback interaction.
