---
name: VinylDeck Cinematic Collection
colors:
  surface: '#141218'
  surface-dim: '#141218'
  surface-bright: '#3b383e'
  surface-container-lowest: '#0f0d13'
  surface-container-low: '#1d1b20'
  surface-container: '#211f24'
  surface-container-high: '#2b292f'
  surface-container-highest: '#36343a'
  on-surface: '#e6e0e9'
  on-surface-variant: '#cbc4d2'
  inverse-surface: '#e6e0e9'
  inverse-on-surface: '#322f35'
  outline: '#948e9c'
  outline-variant: '#494551'
  surface-tint: '#cfbcff'
  primary: '#cfbcff'
  on-primary: '#381e72'
  primary-container: '#6750a4'
  on-primary-container: '#e0d2ff'
  inverse-primary: '#6750a4'
  secondary: '#cdc0e9'
  on-secondary: '#342b4b'
  secondary-container: '#4d4465'
  on-secondary-container: '#bfb2da'
  tertiary: '#e7c365'
  on-tertiary: '#3e2e00'
  tertiary-container: '#c9a74d'
  on-tertiary-container: '#503d00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#cfbcff'
  on-primary-fixed: '#22005d'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffdf93'
  tertiary-fixed-dim: '#e7c365'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#141218'
  on-background: '#e6e0e9'
  surface-variant: '#36343a'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-padding: 32px
  gutter: 24px
  component-gap: 16px
---

## Brand & Style
This design system establishes five cinematic identities for a premium analog hi-fi experience. The overarching personality is **Tactile Luxury**, blending the physical soul of vinyl hardware with high-end digital interfaces.

- **Noir:** Minimalist luxury focused on deep OLED blacks and surgical precision.
- **Glass:** High-refraction, Apple-inspired light mode using frosted acrylic layers.
- **Aurora:** Moody, volumetric sci-fi ambiance with teal and cyan glows.
- **Vapor:** 80s synthwave energy with neon accents and retro-futuristic grids.
- **Paper:** Warm, analog warmth using cream textures and bronze hardware accents.

Each theme prioritizes micro-textures, cinematic lighting, and physical material depth to create an immersive listening environment.

## Colors
The color strategy relies on **Atmospheric Immersion**. 
- **Noir** uses a strict monochrome scale to emphasize highlights on hardware textures.
- **Glass** utilizes high-transparency whites and subtle prismatic light bleeds.
- **Aurora** and **Vapor** utilize glow-mapping where the primary color acts as a volumetric light source.
- **Paper** uses a low-contrast, warm palette to simulate aged cardstock and bronze metal.

## Typography
The system uses a hierarchy designed for legibility and technical flair. 
- **Space Grotesk** provides a geometric, futuristic edge for headlines in tech-heavy themes.
- **Inter** ensures crystal-clear readability for tracklists and metadata.
- **JetBrains Mono** is used for technical data (bitrate, RPM, timecode), reinforcing the analog-digital hybrid aesthetic.
- *Note for Paper theme:* Swap headlines to **Libre Caslon Text** and body to **Literata** to maintain the vintage editorial character.

## Layout & Spacing
The layout follows a **Fixed-Width Cinematic Canvas** approach. On desktop, the interface is treated as a physical hi-fi console with central focus on the turntable or deck.
- **Grid:** 12-column grid with wide 32px margins to create breathing room.
- **Rhythm:** An 8px linear scale governs all padding and margins.
- **Mobile:** Elements reflow into a vertical stack, maintaining "Component Gaps" of 16px to ensure touch targets remain distinct and the UI feels uncrowded.

## Elevation & Depth
Depth is the primary differentiator between the five identities.
- **Noir:** Uses "Internal Glows" and micro-shadows (2px blur) to define the edges of physical buttons against a black void.
- **Glass:** Relies on **Backdrop Blur (20px - 40px)** and 1px white inner-borders to simulate thickness and refraction.
- **Aurora/Vapor:** Uses "Outer Glows" (Neon Bloom). Primary colors should bleed onto the surface below elements.
- **Paper:** Uses soft, directional shadows (Offset 4px/8px, Blur 12px, Opacity 0.1) to suggest stacked cardstock layers.

## Shapes
The system uses **Soft (0.25rem)** roundedness as the baseline to mimic machined metal and high-end plastics.
- **Buttons:** 0.25rem (Soft) for a precision-milled look.
- **Vinyl Sleeves/Cards:** 0.75rem (rounded-xl) to feel like physical objects.
- **Glass Elements:** Increase to 1rem (rounded-xl) to enhance the liquid-like quality of the refraction.

## Components
- **The Platter (Main Deck):** A circular component with a rotating animation. In **Noir**, it features high-contrast radial brushed metal textures. In **Vapor**, it features a glowing vector grid.
- **Tactile Buttons:** Should feel "clickable" using subtle gradients. Use 1px "Top Light" borders to simulate physical edges.
- **Glass Cards:** Used in the **Glass** theme for tracklists. Requires a background blur filter and a semi-transparent stroke.
- **Input Fields:** In **Noir**, these are simple underlined fields. In **Paper**, they appear as recessed "pressed" areas in the cardstock.
- **Sliders (Volume/Pitch):** Use "fader" styling—wide tracks with a metallic or glowing thumb indicator.
- **Visualizers:** In **Aurora**, use volumetric particles. In **Vapor**, use 80s-style peak meters (LED bars).