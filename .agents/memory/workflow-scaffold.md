# Scaffold Workflow (Visual First Implementation)

Because the core value proposition of VinylDeck is its "Premium, Living Aesthetic", standard full-stack scaffolding will fail. The UI cannot be bolted onto the backend later; the visual physics _are_ the application.
Follow this strict sequence for Stage 1 Implementation:

## Phase A: The Visual Foundation (Pre-Scaffold)

1. **CSS Architecture Lock-in:**
   - Establish `index.css` (or `globals.css`) with all root color tokens (OLED blacks, Aurora cyans).
   - Define global keyframes (`spin-slow`, `breathe`, `float`, `film-grain`).
2. **Physics Engine Implementation:**
   - Implement the `Math.atan2` hook for global mouse tracking.
   - Inject the `cubic-bezier` curves from `animation-physics.md` into CSS utility classes.

## Phase B: Component Scaffolding

1. **Atomic Shell First:**
   - Build the `<GlassPanel />` wrapper (ensuring the `backdrop-filter` and micro-borders are flawless).
   - Build the `<VinylRecord />` atomic component (testing the procedural grooves and specular reflections independently).
2. **Interaction Layer:**
   - Add the `<MagneticButton />` and `<SliderThumb />` components, verifying tactile feedback before connecting any real playback state.

## Phase C: State & Backend Integration

- Only after the cinematic visualizer runs smoothly at 60fps+ do we connect Zustand `PlaybackState` and the Rust Tauri backend.
