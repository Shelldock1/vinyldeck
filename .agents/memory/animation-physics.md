# VinylDeck Animation & Physics Engine

This document defines the exact mathematical constants, timing functions, and JavaScript logic required to achieve the "living" feel of the VinylDeck UI. Do not use linear or standard ease functions for hardware elements.

## 1. Mechanical Easing (The "Snap")

When simulating the physical weight of hardware components (tonearm drops, toggle switches, mechanical buttons, spring reveals), use this exact cubic-bezier curve to create a mechanical overshoot:

```css
/* The VinylDeck Spring Curve */
transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
```

## 2. Inertial Playback Mechanics

Turntables have heavy mass. They do not start or stop instantly.

- **Spin Up:** When `play` is engaged, the vinyl should accelerate to full speed using an `ease-in` curve.
- **Spin Down (Braking):** When `pause` is engaged, the rotation must decelerate over 1.5s to 3.0s using:

```css
/* The Friction Braking Curve */
transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
```

- **33 ⅓ RPM Accurate Rotation:** A mathematically accurate CSS spin for 33 ⅓ RPM requires exactly a `1.8s` linear loop (`60s / 33.333 = ~1.8s`).

## 3. Spatial Parallax & Lighting (Mouse Tracking)

The UI must react to the user's physical presence (mouse movement).

- **Specular Vinyl Reflection:** The `conic-gradient` highlight on the vinyl grooves must be mapped to the cursor angle using `Math.atan2(y, x)`. It must be rendered using `mix-blend-mode: screen` or `overlay` so it interacts physically with the grooves beneath.
- **Magnetic Buttons:** Primary CTAs (like Play/Pause) should utilize a magnetic pull. On `mousemove` within a 40px radius, translate the button by `(mouseX * 0.4, mouseY * 0.4)` to pull it toward the cursor.
- **Z-Axis Tilt:** Apply a global `mousemove` listener to calculate normalized X/Y coordinates (-1 to 1). Apply these to the main stage container using `transform: perspective(1000px) rotateX(±3deg) rotateY(±3deg)`.

## 4. Atmospheric Breathing

Elements should never be completely static.

- **Ambient Glows:** Background blurs and volumetric lights should scale (`1.0` to `1.05`) and shift opacity (`0.15` to `0.25`) continuously over an 8s to 12s `ease-in-out alternate` loop.
- **Particle Engine:** Dust motes floating in the light should use staggered CSS animations (`10s` to `25s` duration) or a `requestAnimationFrame` canvas with varying `parallaxFactor` values to simulate depth.

## 5. Tactile Feedback

- **Hardware Button Presses:** Use `active:scale-95` on all clickable components to simulate the physical depression of a switch.
- **Slider Thumbs:** Must scale up (`scale-125`) on hover to provide a clear, illuminated touch-target.
