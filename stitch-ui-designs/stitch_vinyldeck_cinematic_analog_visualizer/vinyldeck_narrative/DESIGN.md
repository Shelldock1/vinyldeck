---
name: VinylDeck Narrative
colors:
  surface: '#141313'
  surface-dim: '#141313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353434'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c4c7c8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8e9192'
  outline-variant: '#444748'
  surface-tint: '#c6c6c7'
  primary: '#ffffff'
  on-primary: '#2f3131'
  primary-container: '#e2e2e2'
  on-primary-container: '#636565'
  inverse-primary: '#5d5f5f'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#ffffff'
  on-tertiary: '#2f3131'
  tertiary-container: '#e2e2e2'
  on-tertiary-container: '#636565'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#141313'
  on-background: '#e5e2e1'
  surface-variant: '#353434'
typography:
  display-xl:
    fontFamily: Hanken Grotesk
    fontSize: 72px
    fontWeight: '200'
    lineHeight: 80px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
    letterSpacing: 0.02em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.15em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 24px
  margin-mobile: 24px
  margin-desktop: 64px
  max-width: 1440px
---

## Brand & Style

The design system is engineered to evoke the tactile prestige of high-end analog audio equipment while leveraging the fluid possibilities of modern digital interfaces. It targets audiophiles and music collectors who value both the physical ritual of vinyl and the precision of contemporary Hi-Fi engineering.

The style is a sophisticated hybrid of **Tactile Realism** and **Glassmorphism**. It utilizes physical metaphors—brushed metal textures, matte vinyl finishes, and mechanical tolerances—layered behind a veil of ultra-premium digital materials. The interface should feel "heavy," expensive, and physically believable, utilizing subtle film grain and soft light blooms to bridge the gap between the digital screen and the listening room.

## Colors

The foundation of this design system is **Obsidian Black (#0A0A0A)**, designed to disappear on OLED displays, allowing the "physical" hardware and light effects to emerge. 

- **Noir**: A pure monochrome study in contrast and shadow.
- **Glass**: Focused on depth, utilizing 40px backdrop blurs and 1px "specular" white borders to simulate thick optical crystal.
- **Aurora & Vapor**: Emotive palettes that use wide-gamut accents and soft-scattered "light leaks" to reflect the mood of the music.
- **Paper**: A high-luxury "warm" mode inspired by vintage hi-fi manuals and bronze deck components.

## Typography

Typography is treated as an etched architectural element. **Hanken Grotesk** provides a clean, technical, yet elegant display face. For secondary data and technical specs (RPM, Bitrate, Tracking Force), **JetBrains Mono** is used to evoke the precision of digital readouts and industrial engraving. 

Generous tracking (letter-spacing) is applied to all labels to maintain legibility against textured backgrounds and to reinforce the premium, cinematic aesthetic.

## Layout & Spacing

This design system employs a **Fixed Grid** philosophy for the main player deck to mimic a physical hardware chassis, while content browsers use a fluid 12-column system. 

Layouts should prioritize negative space to allow "ambient blooms" to breathe. Components are spaced using an 8px base unit, but critical "hardware" elements (like the turntable platter or tonearm controls) are positioned using a central focal point rather than a traditional top-down flow.

## Elevation & Depth

Depth is the primary driver of hierarchy. This design system uses three distinct methods to communicate "Z-space":

1.  **Physical Layers:** Surfaces use "Inner Shadows" to create recessed wells (cavities) for buttons and platters, simulating CNC-milled aluminum.
2.  **Optical Layers:** Glass panels use `backdrop-filter: blur(40px)` combined with a 1px white stroke at 10% opacity on the top edge to simulate light catching the "cut" of the glass.
3.  **Luminous Depth:** No harsh drop shadows are used. Instead, elevation is signaled by the width and softness of an "Ambient Bloom" (a colored outer glow) that spills from underneath active components.

## Shapes

The shape language balances geometric precision with industrial comfort. 
- **Large containers** (Cards, Glass Panels): Use `rounded-xl` (1.5rem) to feel like molded high-end tech.
- **Interactive Elements** (Buttons, Inputs): Use `rounded-lg` (1rem).
- **Physical Dials:** Maintain perfect circles to reinforce the "Vinyl" metaphor.
- **Metal Accents:** Small details like "screws" or "indicator LEDs" remain sharp or minimally rounded to emphasize the "machined" look.

## Components

### Buttons
Primary buttons are styled as "Machined Aluminum" or "Frosted Glass." They feature a subtle vertical gradient (top-down light source) and a 1px bevel. On hover, the "Ambient Bloom" increases in intensity rather than the button changing color.

### The Platter (Visualizer)
A bespoke component representing the vinyl record. It must feature a high-resolution "Matte Vinyl" texture with circular micro-grooves. Lighting should reflect off the surface as it "rotates" in the UI.

### Controls & Dials
Sliders use a "Track" that appears recessed into the UI (inner shadow). The "Knob" is a brushed metal circle with a single-pixel "indicator" light that glows with the theme's accent color.

### Glass Cards
Used for album metadata and lyrics. These must utilize the `Glass` theme variables, ensuring text remains legible via a dark semi-transparent tint overlaying the background blur.

### Inputs
Search and data fields are "Ghost" style—transparent backgrounds with a 1px bottom border that glows when focused. Labels always use the `label-caps` typography style.