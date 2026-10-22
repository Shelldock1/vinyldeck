# vinyldeck_aurora_fullscreen

## Visuals (from PNG)

- A striking fullscreen playback experience with a modern, "Aurora Neon" aesthetic.
- The color palette is dominated by deep midnight blues, cyan, and teal.
- A glowing cyan neon ring surrounds the central vinyl record.
- The tonearm is a sleek, minimalist metallic design, distinct from the vintage analog tonearm, featuring a glowing cyan stylus indicator.
- The center album label features a dark, abstract geometric design.
- The typography is spaced out and modern (`tracking-[0.3em]`).
- Playback controls are completely hidden by default, leaving only the record and minimalist track text visible.

## Behavior (from HTML)

- Uses an oversized, highly blurred background image combined with floating cyan/teal orbs (`animate-float`) to create a deep atmospheric environment.
- The vinyl record features a glowing cyan boundary (`neon-ring`).
- Implements a `<script>` to dynamically generate and animate 30 drifting particles with randomized sizes, opacities, and trajectories across the background.
- The playback controls are contained within a `.ui-reveal-area` at the bottom of the screen, which uses CSS `opacity` transitions to appear only when hovered, maximizing focus on the central visualizer.
- The playback buttons utilize a glassmorphic aesthetic (`backdrop-blur-md`, `bg-white/5`) with neon cyan hover states.

## Summary

A sharp departure from the vintage analog theme, the Aurora Fullscreen mode embraces a sleek, futuristic, and dark-luxury aesthetic. It utilizes glowing neon accents, deep atmospheric blurs, dynamic particle generation, and a hidden-by-default UI to deliver a highly modern, immersive visualizer.
