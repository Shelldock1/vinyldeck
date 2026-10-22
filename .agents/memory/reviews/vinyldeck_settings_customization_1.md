# vinyldeck_settings_customization_1

## Visuals (from PNG)

- A comprehensive, large-scale settings modal centered on the screen, utilizing heavy glassmorphism with a sidebar layout ("Preferences").
- The background incorporates a tactile film grain (`noise-overlay`) and large, soft, blurred orbs for volumetric lighting.
- The active "Themes" tab displays large cards for Noir, Aurora, and Vapor, each featuring a mini spinning vinyl record and specific accent glows.
- An "Accent Frequency" section provides circular color swatches to choose the primary UI accent color.
- Sidebar items have subtle active indicators (a glowing vertical bar).

## Behavior (from HTML)

- Advanced interactivity powered by JavaScript:
  - **Mouse Tracking**: Updates CSS variables (`--mouse-x`, `--mouse-y`) to move a specular highlight across the glass panel.
  - **Particle Engine**: A custom HTML5 Canvas (`#particle-canvas`) renders drifting particles that react to mouse parallax.
  - **Tab Navigation**: `switchTab` function handles switching between settings categories, updating active UI states dynamically.
  - **Custom Toggles**: A `toggleSwitch` JS function handles the animation of custom toggle buttons in the "Vinyl" tab.
- CSS Animations: Mini vinyls rotate using `animate-spin-33rpm`, and the active theme card pulses with `animate-breathe-glow`.
- Respects `prefers-reduced-motion` by disabling canvas particles and CSS animations.

## Summary

This iteration of the settings modal is highly dynamic and premium, leveraging both CSS and a custom JS particle engine to create a deeply immersive, tactile, and responsive configuration environment.
