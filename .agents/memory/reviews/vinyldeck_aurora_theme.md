# vinyldeck_aurora_theme

## Visuals (from PNG)

- A complete departure from the focused fullscreen visualizers, presenting a comprehensive, 3-column application layout.
- The background is a vibrant, smooth gradient transitioning between deep blues, teals, and cyans.
- **Left Column:** Features a large, prominent album art card with a glassmorphic aesthetic (`glass-panel`). Below the album art is an active EQ visualizer.
- **Center Column:** A vinyl record rotating on a dedicated turntable platter base, flanked by a skeuomorphic tonearm.
- **Right Column:** Contains detailed playback controls (timeline slider, play/pause, skip) and a volume slider, segmented into cleanly defined frosted glass panels.
- The overall aesthetic leans heavily into neon teal (`primary`) accents and glowing text (`glow-text`, `progress-glow`).

## Behavior (from HTML)

- **Background Animation:** The background (`.bg-aurora`) uses a 4-color linear gradient oversized to `400% 400%`, animated via `aurora-shift` keyframes to continuously pan and shift colors over a 20-second loop.
- **EQ Visualizer:** The `#eq-bars` container uses a `<script>` to dynamically generate 30 DOM elements representing EQ bands. A `setInterval` loop updates their height and toggles their opacity classes every 150ms to simulate live audio reactivity.
- **Responsive Design:** Utilizes Tailwind utility classes (`hidden lg:flex`, `md:hidden`) to adapt the layout. The left album art column and the center tonearm hide on smaller screens, and a mobile bottom navigation bar (`BottomNavBar`) appears.
- **Interactive States:** Uses CSS hover transitions extensively on buttons, sliders, and the album art (`group-hover:scale-105`).

## Summary

The Aurora Theme is a full-featured, responsive application layout that balances high-end visual flair with practical UI controls. It utilizes an animated gradient background and a JS-driven faux-EQ visualizer to maintain a dynamic, energetic atmosphere while providing a clear 3-column structure for album art, the spinning vinyl centerpiece, and robust playback settings.
