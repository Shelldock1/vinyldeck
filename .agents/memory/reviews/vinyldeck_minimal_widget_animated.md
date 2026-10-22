# vinyldeck_minimal_widget_animated

## Visuals (from PNG)

This builds directly upon the `vinyldeck_minimal_widget` design. Visually, it shares the exact same ultra-minimal, stealthy footprint: a single 200x200px vinyl record isolated against a black background with concentric grooves and central label art. The hidden playback overlay and the track info text below the widget are identical in layout and typography. However, it adds a visible glowing point of light on the edge of the record, making it look slightly more dynamic even in a static frame.

## Behavior (from HTML)

This version introduces enhanced, interactive animations that upgrade the physical feel of the widget:

- **Orbiting Light**: An `.orbiting-light` element (a blurred, dropped-shadow white border segment) spins rapidly around the perimeter of the record (`3s linear infinite`), independent of the 10s vinyl rotation. This acts as an energetic, dynamic playhead.
- **Interactive Lighting (JS)**: Unlike previous pure-CSS designs, this file includes a JavaScript event listener on `mousemove`. It calculates the cursor's position relative to the vinyl record and updates a radial gradient on a `.reflection` layer. This creates a realistic, dynamic specular highlight that follows the user's mouse as they move over the widget.
- **Spring Animations**: The hover reveal for the playback overlay and track info uses a bouncy `cubic-bezier(0.175, 0.885, 0.32, 1.275)` transition, making the UI pop in with a more physical, elastic feel compared to a standard ease.
- **Base Animations**: It retains the continuous 10s vinyl spin and the 4s volumetric background pulse from the base minimal widget.

## Summary

The "Animated" variant of the minimal widget takes the stealthy baseline and adds highly tactile, interactive elements. By introducing JavaScript-driven reactive lighting that tracks the cursor and a fast-orbiting playhead light, it transforms the static widget into a highly responsive, premium physical object. The spring-based hover animations further enhance the mechanical, high-end feel of the interactions.
