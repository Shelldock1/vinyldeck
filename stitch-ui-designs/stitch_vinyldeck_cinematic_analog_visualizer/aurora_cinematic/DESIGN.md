---
name: Aurora Cinematic
colors:
  surface: '#0e1419'
  surface-dim: '#0e1419'
  surface-bright: '#343a40'
  surface-container-lowest: '#090f14'
  surface-container-low: '#161c22'
  surface-container: '#1a2026'
  surface-container-high: '#252b30'
  surface-container-highest: '#2f353b'
  on-surface: '#dee3ea'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dee3ea'
  inverse-on-surface: '#2b3137'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dbe7'
  primary: '#e1fdff'
  on-primary: '#00363a'
  primary-container: '#00f2ff'
  on-primary-container: '#006a71'
  inverse-primary: '#00696f'
  secondary: '#94d1d1'
  on-secondary: '#003737'
  secondary-container: '#095252'
  on-secondary-container: '#86c3c2'
  tertiary: '#fcf5ff'
  on-tertiary: '#3c0090'
  tertiary-container: '#e3d4ff'
  on-tertiary-container: '#7318ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#74f5ff'
  primary-fixed-dim: '#00dbe7'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#b0eeed'
  secondary-fixed-dim: '#94d1d1'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#044f4f'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d1bcff'
  on-tertiary-fixed: '#23005b'
  on-tertiary-fixed-variant: '#5700c9'
  background: '#0e1419'
  on-background: '#dee3ea'
  surface-variant: '#2f353b'
typography:
  display-lg:
    fontFamily: Sora
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Sora
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1440px
---

## Brand & Style

This design system embodies a "Cinematic Sci-Fi" aesthetic, drawing inspiration from high-fidelity futuristic interfaces and deep-space exploration themes. The personality is atmospheric, sophisticated, and immersive. It targets audiophiles and collectors who appreciate a moody, high-contrast environment that puts the focus on digital "artifacts" and media.

The visual style is a hybrid of **Glassmorphism** and **Minimalism**. It utilizes deep oceanic layering, frosted textures, and precision-engineered typography to create a sense of vast, digital depth. The UI should feel like a holographic projection floating in a midnight environment, using soft neon accents to guide the eye without overwhelming the content.

## Colors

The palette is rooted in the "Midnight Oceanic" spectrum. The background is not a flat black, but a deep, desaturated navy to provide more depth for layering.

- **Primary (Cyan Glow):** Used for active states, primary actions, and "light-bleed" effects. It represents the aurora's brightest edge.
- **Secondary (Deep Teal):** Used for subtle accents, secondary buttons, and decorative strokes.
- **Tertiary (Nebula Violet):** A rare accent color used for highlights or special statuses to break the monochromatic teal feel.
- **Neutral:** A range of cool grays and deep blues used for surfaces, borders, and text.

Backgrounds should utilize radial gradients transitioning from `#0A191E` at the corners to `#050A0F` at the center to simulate an infinite horizon.

## Typography

The typography strategy emphasizes technical precision and modern geometry. 

- **Headlines (Sora):** Wide, geometric, and futuristic. Used for major section titles and branding.
- **Body (Geist):** A high-legibility, neutral sans-serif that feels engineered and clean.
- **Data/Labels (JetBrains Mono):** A monospaced font used for metadata, vinyl specs (RPM, Year), and UI labels to reinforce the sci-fi, "readout" aesthetic.

Letter spacing is tightened for large headlines to maintain a cinematic punch, while labels are tracked out significantly to evoke a professional, technical interface.

## Layout & Spacing

The layout follows a **Fluid Grid** model with a heavy emphasis on "negative space as luxury." 

- **Grid:** Use a 12-column grid for desktop with 24px gutters.
- **Rhythm:** All spacing (padding, margins) must be multiples of the 4px base unit.
- **Breathing Room:** Content should be grouped into distinct modules with generous internal padding (32px+) to prevent the UI from feeling cluttered.
- **Responsiveness:** On mobile, margins shrink to 20px, and the grid collapses to a single column, but the "atmospheric" padding within cards remains high to maintain the premium feel.

## Elevation & Depth

Depth is created through **Tonal Layering** and **Glassmorphism** rather than traditional drop shadows.

1.  **Base Layer:** The deepest background, featuring a subtle, drifting teal gradient.
2.  **Surface Layer:** Semi-transparent panels (`rgba(15, 25, 30, 0.6)`) with a `backdrop-filter: blur(20px)`.
3.  **Luminous Borders:** Instead of shadows, use 1px solid borders with low opacity (`rgba(255, 255, 255, 0.1)`) or a subtle "top-light" gradient border to simulate light hitting the edge of a glass pane.
4.  **Aurora Glows:** High-level elements (like active cards) may feature a soft, teal outer glow (`box-shadow: 0 0 30px rgba(0, 242, 255, 0.15)`) to suggest they are emitting light.

## Shapes

The shape language is "Soft-Technical." Elements use a subtle corner radius to feel approachable but retain a crisp, architectural edge.

- **Base Radius:** 4px (Soft) for buttons and inputs.
- **Large Radius:** 8px for cards and primary containers.
- **Interactive States:** Hovering over a card may trigger a transition to a slightly sharper corner or a "bracket" visual effect to simulate a targeting reticle.

## Components

- **Buttons:** Primary buttons use a solid Cyan-to-Teal gradient with black text for maximum contrast. Secondary buttons are "Ghost" style with a 1px teal border and a subtle glass blur background.
- **Cards:** The "Vinyl Card" should be a frosted glass container. The album art should have a 1px internal border to separate it from the glass.
- **Inputs:** Ultra-minimalist. Use a bottom-only border in teal that glows (increases brightness) when focused. 
- **Chips/Badges:** Small, monospaced text inside a high-contrast teal outline. No fill.
- **Progress Bars/Seekers:** A thin 2px line. The "filled" portion should have a primary cyan glow, while the "unfilled" portion is a dark navy with 20% opacity.
- **Special Component (The Deck):** A custom playback control area that uses a circular glass dial, mimicking a modern turntable, with rotating metadata text using the monospaced label font.