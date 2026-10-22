# vinyldeck_cinematic_playback_interaction_noir

## Visuals (from PNG)

- A highly stylized, monochromatic "Noir" aesthetic. The palette consists almost entirely of black, white, and various shades of zinc/gray.
- The tonearm is a striking, minimalist white rod with a dark pivot and headshell.
- A thin, illuminated white progress arc curves around the outer edge of the vinyl record.
- The background is pitch black, punctuated by a faint central volumetric glow and subtle film grain/scanlines.
- The play button is a gradient metallic circle, providing stark contrast against the dark background.

## Behavior (from HTML)

- Features the most advanced physics engine of the set, managed entirely within a custom `requestAnimationFrame` loop (`updatePhysics()`).
- **Inertial Rotation:** Instead of relying on CSS animations for spinning, JS calculates `currentSpeed`, `targetSpeed`, `acceleration`, and `friction`. This allows for incredibly smooth, physically accurate spin-ups and spin-downs.
- **Complex Parallax:** The entire vinyl container (`#vinyl-container`) tracks mouse movement to apply 3D `rotateX` and `rotateY` transforms, creating a profound sense of depth.
- **Counter-Rotation:** The vinyl shine/reflection layer is dynamically counter-rotated in JS relative to both the record's spin and the parallax angle, simulating a stationary light source hitting moving grooves.
- **Magnetic Play Button:** The main play/pause button implements magnetic hover physics, tracking the cursor's exact position within its bounding box to subtly pull the button towards the mouse.
- **Cinematic Overlays:** Uses fixed CSS overlays for animated SVG noise (`.noise-overlay`), linear gradient `.scanlines`, and drifting JS particles.

## Summary

The Noir interaction model represents the peak of the cinematic playback experience. Stripping away color forces focus onto the sophisticated physics engine, which handles true inertial acceleration, 3D mouse parallax, magnetic button interactions, and dynamic counter-rotated lighting, resulting in an incredibly premium and tactile digital object.
