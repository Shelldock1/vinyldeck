# VinylDeck Design Guidelines (The Non-Negotiable Rules)

This document contains the synthesized visual blueprint derived from the top 20 cinematic UI reviews. All frontend scaffolding MUST adhere strictly to these rules. Failure to do so will result in a cheap, "flat" web application instead of a premium, living desktop appliance.

## 1. Color Palette & The Void

- **OLED Blacks:** The application background must anchor on pure black (`#000000`) or deep midnight tones (e.g., `#050b14` for Aurora). Avoid standard Material Design dark grays. Contrast is key.
- **Volumetric Lighting:** The background is never flat. Always use heavily blurred (`blur-[100px]` to `blur-[150px]`), low-opacity ambient orbs (`mix-blend-screen` or `color-dodge`) to simulate light bleeding behind the hardware.

## 2. Textural Analog Realism

- **Cinematic Film Grain:** A procedural SVG noise filter (`<feTurbulence>`) must be overlaid globally at 3-5% opacity using `mix-blend-mode: overlay`. This eliminates color banding and provides analog warmth.
- **Vinyl Grooves:** Do not use raster images for the record grooves. Use `repeating-radial-gradient` alternating closely packed dark hex codes (`#111`, `#1a1a1a`, `#0a0a0a`) every 1px to 4px.
- **Brushed Metals:** Hardware elements (tonearms, toggles, knobs) must use multi-stop `linear-gradient` (e.g., `#333 -> #888 -> #333`) paired with sharp `inset` shadows to create cylindrical depth.

## 3. Glassmorphism 2.0 (Material Refraction)

- **Heavy Frosting:** Glass panels must use intense blur and saturation (`backdrop-filter: blur(24px) saturate(150%)`).
- **Physical Edges:** Every glass element must possess a microscopic, highly transparent white border (`inset 0 1px 0 rgba(255, 255, 255, 0.1)` or a `0.5px solid white/10` border) to simulate a physical edge catching room light.
- **Deep Shadows:** Floating panels require massive, ambient drop shadows (e.g., `shadow-[0_20px_60px_rgba(0,0,0,0.6)]`) to establish a pronounced Z-axis separation.

## 4. Typography Hierarchy

- **Display/Headlines:** `Sora` or `Space Grotesk`. Used for Track Titles and App Logos. Adds geometric, cinematic authority.
- **Metadata/Hardware:** `JetBrains Mono`. Used for timestamps, RPM settings, and labels. Must be heavily tracked (`letter-spacing: 0.2em` to `0.3em`) to simulate screen-printed analog gear.
- **Body/Readability:** `Inter`. Used for standard paragraphs and settings descriptions.

## 5. UI Philosophy: "Calm Technology"

- **Distraction-Free Idle:** When the mouse is stationary for 2.5 - 3 seconds, all auxiliary UI (nav bars, controls, cursors) must fade to `opacity: 0`. The visualizer takes absolute priority.
- **Ghostly Default States:** Unfocused controls should rest at `opacity-40` or `opacity-60`. They should fluidly reveal themselves only when hovered.
