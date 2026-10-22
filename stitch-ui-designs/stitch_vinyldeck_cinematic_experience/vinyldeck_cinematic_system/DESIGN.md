---
name: VinylDeck Cinematic System
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1b1b1c'
  surface-container: '#201f20'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e2'
  on-surface-variant: '#c5c6cb'
  inverse-surface: '#e5e2e2'
  inverse-on-surface: '#313031'
  outline: '#8e9195'
  outline-variant: '#44474a'
  surface-tint: '#c1c7cf'
  primary: '#ffffff'
  on-primary: '#2b3137'
  primary-container: '#dde3eb'
  on-primary-container: '#5f656c'
  inverse-primary: '#595f66'
  secondary: '#c6c6c6'
  on-secondary: '#303030'
  secondary-container: '#474747'
  on-secondary-container: '#b5b5b5'
  tertiary: '#ffffff'
  on-tertiary: '#3a2e24'
  tertiary-container: '#f3dfd0'
  on-tertiary-container: '#706256'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dde3eb'
  primary-fixed-dim: '#c1c7cf'
  on-primary-fixed: '#161c22'
  on-primary-fixed-variant: '#41474e'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#f3dfd0'
  tertiary-fixed-dim: '#d6c3b5'
  on-tertiary-fixed: '#241a11'
  on-tertiary-fixed-variant: '#51443a'
  background: '#131314'
  on-background: '#e5e2e2'
  surface-variant: '#353535'
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
    letterSpacing: 0.05em
  headline-md:
    fontFamily: Sora
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.2em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 32px
  gutter: 24px
  touch-target: 48px
---

## Brand & Style

This design system is engineered for a high-fidelity, cinematic audio experience. It draws inspiration from premium analog Hi-Fi equipment and the tactile nature of vinyl culture, translated into a modern digital interface. The aesthetic is rooted in **Dark Luxury**—prioritizing pure blacks for OLED efficiency while utilizing "volumetric" light to define space rather than traditional lines.

The brand personality is sophisticated, immersive, and uncompromising. It targets audiophiles and collectors who appreciate the "mechanical" beauty of music hardware. The design style combines **Glassmorphism** for depth, **Tactile/Skeuomorphic** accents for physical interaction cues, and a **Minimalist** layout to ensure the album artistry remains the focal point. Use matte textures and brushed metal finishes to evoke the feel of high-end playback components.

## Colors

The palette is anchored by **Pure Black (#000000)** to provide infinite depth and maximize contrast on OLED displays. **Brushed Aluminum (#E2E8F0)** serves as the primary functional color, used for text and iconography to simulate etched metal.

The system utilizes atmospheric color "modes" to change the emotional temperature:
- **Noir:** Strictly monochrome. High-contrast whites and deep blacks.
- **Glass:** Focuses on translucency and refractive indices rather than hue.
- **Aurora:** Cyan and Teal glows that mimic the shimmer of a high-end DAC display.
- **Vapor:** Magenta and Purple highlights for a nocturnal, cinematic vibe.
- **Paper:** Introduces warm creams and bronze accents for a heritage, archival feel.

Accent colors should never be flat; they must be applied as soft, volumetric glows or thin, luminous strokes.

## Typography

The typography strategy balances geometric precision with technical utility. **Sora** is used for headlines, featuring wide tracking to evoke a premium, editorial feel. **Inter** provides high-legibility for body content and metadata, ensuring the interface remains functional during deep-dive browsing sessions.

For technical data (bitrate, timestamp, track number), **JetBrains Mono** is employed to reference the "digital readout" aesthetic of professional audio hardware. 

**Application Rules:**
- Use `label-caps` for all secondary navigation and categorization.
- Headlines should utilize wide letter-spacing (`0.05em` or higher) to emphasize the luxury positioning.
- On mobile, `display-lg` scales down to `36px` to maintain visual impact without breaking the layout.

## Layout & Spacing

The layout philosophy is "Atmospheric Centricity." Content is organized within a fluid 12-column grid for desktop, moving to a 4-column grid for mobile. However, the system relies on generous internal margins (`32px` minimum) to create a sense of breathing room, preventing the UI from feeling cluttered.

**Key Layout Rules:**
- **The Stage:** The primary focus (e.g., the Now Playing record) occupies a central or large-scale position with significant negative space.
- **Edge Controls:** Secondary interactions are anchored to the screen edges, mimicking the bezel controls of physical hardware.
- **Dynamic Padding:** Use larger spacing units (`64px`+) between distinct sections (e.g., "Recently Played" vs "Your Library") to define hierarchy without using visible dividers.

## Elevation & Depth

Depth in this design system is conveyed through **Light Emission and Refraction** rather than traditional drop shadows.

- **The Void:** The base layer is always `#000000`.
- **Glass Surfaces:** Secondary surfaces use `backdrop-filter: blur(20px)` with a very thin `0.5px` border of `rgba(255, 255, 255, 0.1)` to simulate a glass pane.
- **Volumetric Glows:** Elevated elements (like the active playback head) emit a soft, blurred glow in the current theme's accent color. This "inner light" suggests the element is powered on.
- **Matte Textures:** Interactive cards use a subtle noise overlay (2% opacity) to simulate the texture of high-quality plastic or vinyl sleeves, adding a tactile quality to the digital surface.

## Shapes

The shape language reflects the industrial design of high-end audio gear—precision-engineered with soft finishes. 

- **Containers:** Use `rounded-lg` (1rem) to create a approachable but structured feel for album art and content cards.
- **Interactive Elements:** Buttons and sliders utilize `rounded-xl` (1.5rem) or full pill shapes to mimic the comfortable touchpoints of physical dials and toggles.
- **The Disc:** The record/vinyl element is always a perfect circle, serving as the primary anchor for the circular motion language used throughout the app.

## Components

### Buttons & Interaction
- **Primary Buttons:** Pill-shaped, brushed aluminum background (`#E2E8F0`) with black text. On hover, they should emit a subtle volumetric glow of the theme's accent color.
- **Secondary Buttons:** Ghost style with a thin `1px` border. The border should have a slight "metallic" gradient.

### Input Fields
- Inputs are "sunken" into the UI. Use a dark inner shadow and a subtle top-light stroke to create an inset effect, making the field look like a slot in a physical console.

### Cards (Album Art)
- Album art cards should have no visible border. Instead, they utilize a "case shadow"—a tight, dark shadow that mimics the physical presence of a CD or Vinyl case sitting on a surface.

### Playback Controls
- The playback slider is a "Light Path." The progress line is a thin neon stroke in the accent color, while the remaining track time is a dim, desaturated version of that color.
- Knobs and dials (for EQ) use a skeuomorphic "brushed metal" CSS gradient with a rotating "indicator light."

### Lists & Navigation
- List items are separated by "Light Grooves"—very subtle, 1px lines that use a gradient to fade out at the edges, preventing a harsh "boxed-in" feeling.