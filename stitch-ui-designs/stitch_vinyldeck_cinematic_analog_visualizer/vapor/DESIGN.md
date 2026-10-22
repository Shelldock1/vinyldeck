---
name: Vapor
colors:
  surface: '#111225'
  surface-dim: '#111225'
  surface-bright: '#37374d'
  surface-container-lowest: '#0b0c1f'
  surface-container-low: '#191a2d'
  surface-container: '#1d1e32'
  surface-container-high: '#27283d'
  surface-container-highest: '#323348'
  on-surface: '#e1e0fb'
  on-surface-variant: '#d9bfd5'
  inverse-surface: '#e1e0fb'
  inverse-on-surface: '#2e2f43'
  outline: '#a18a9e'
  outline-variant: '#544153'
  surface-tint: '#fea9ff'
  primary: '#fea9ff'
  on-primary: '#580063'
  primary-container: '#eb3cff'
  on-primary-container: '#4d0057'
  inverse-primary: '#a400b6'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#7000ff'
  on-secondary-container: '#ddcdff'
  tertiary: '#00dbe9'
  on-tertiary: '#00363a'
  tertiary-container: '#00a0aa'
  on-tertiary-container: '#002f33'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffd6fb'
  primary-fixed-dim: '#fea9ff'
  on-primary-fixed: '#36003d'
  on-primary-fixed-variant: '#7d008b'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#23005b'
  on-secondary-fixed-variant: '#5700c9'
  tertiary-fixed: '#7df4ff'
  tertiary-fixed-dim: '#00dbe9'
  on-tertiary-fixed: '#002022'
  on-tertiary-fixed-variant: '#004f54'
  background: '#111225'
  on-background: '#e1e0fb'
  surface-variant: '#323348'
typography:
  display-lg:
    fontFamily: Anybody
    fontSize: 72px
    fontWeight: '800'
    lineHeight: 80px
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Anybody
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
  headline-md:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-mono:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
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
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  container-max: 1440px
---

## Brand & Style

The design system is an exercise in "Neon-Noir" cinematic luxury. It captures the retro-futuristic essence of 1980s high-fidelity audio culture, blending it with modern digital precision. The aesthetic is built on the concept of "The Grid"—a digital landscape that feels infinite, moody, and atmospheric.

The UI should evoke a sense of late-night immersion. It is targeted at audiophiles and collectors who view music not just as sound, but as a tactile, visual experience. The design style is a sophisticated blend of **Glassmorphism** and **Retro-futurism**, utilizing deep translucency, vibrant neon light-leaks, and subtle scanline textures to simulate a high-end vintage synthesizer interface.

## Colors

The palette is rooted in the "Deep Space" neutral—a navy so dark it acts as a canvas for light. The primary colors are high-energy neon signals.

- **Primary (Electric Magenta):** Used for interactive states, key branding moments, and "glowing" focal points.
- **Secondary (Cyber Purple):** Used for structural depth, background gradients, and secondary accents.
- **Tertiary (Electric Cyan):** Reserved for success states, data visualizations, and "hi-fi" digital readouts.
- **Neutral:** A range of desaturated deep blues and purples. Surface colors should never be pure black; they must retain a hint of violet to maintain the atmospheric depth.

Color application should mimic light emission. Elements don't just have color; they "glow" onto the surfaces behind them.

## Typography

This design system employs a three-tier typographic hierarchy to balance expression with technical clarity.

1.  **Anybody:** The "Expression" tier. Used for large, cinematic displays. Its variable nature allows for tight, aggressive kerning that mimics 80s movie posters and luxury audio branding.
2.  **Space Grotesk:** The "Interface" tier. Used for all primary reading and navigation. Its geometric construction feels modern yet aligns with the technical precision of high-end hardware.
3.  **Space Mono:** The "Readout" tier. Used for metadata, track durations, and technical labels. It evokes the feeling of digital VFD displays found on vintage amplifiers.

Headlines should occasionally use "text-shadow" glows in Magenta or Cyan to reinforce the neon aesthetic.

## Layout & Spacing

The layout is governed by a **Fluid Grid** that emphasizes "cinematic letterboxing." Large margins on the left and right sides of the desktop experience create a focused, stage-like center for the content.

- **The Grid Overlay:** Subtle, low-opacity horizontal and vertical lines (0.5px thickness) should occasionally be visible in the background, reinforcing the "Digital Frontier" theme.
- **Rhythm:** An 8px base unit is used for all internal component spacing.
- **Transitions:** Layout shifts and content loading should feel like a "wipe" or "scanline" refresh, moving horizontally across the screen.

## Elevation & Depth

Hierarchy is established through **Luminous Layering** rather than traditional shadows. 

- **Tonal Layers:** Surfaces are semi-transparent (60-80% opacity) with a heavy backdrop blur (20px-40px). 
- **Light as Depth:** Higher elevation is signaled by a brighter "inner glow" or a more vibrant border-top.
- **Ambient Glows:** Instead of black drop-shadows, use soft, diffused outer glows tinted with the primary Magenta or secondary Purple. This makes elements appear as if they are floating in a neon-lit mist.
- **Scanlines:** A faint, repeating pattern overlay should be applied to the background to give the screen a physical, CRT-like texture.

## Shapes

The shape language reflects **Precision Hardware**. Elements are primarily rectangular with a "Soft" (0.25rem) corner radius, mimicking the chamfered edges of aluminum hi-fi components.

Avoid fully rounded "pill" shapes for buttons; instead, use wide rectangles with subtle rounding. The exception is the "Vinyl" record itself, which remains a perfect circle, serving as the organic focal point amidst the geometric digital landscape.

## Components

### Buttons
Buttons should feature a "Glass" background with a 1px solid border. The border should have a subtle gradient (Magenta to Purple). On hover, the button’s glow intensity increases, and the text gains a slight bloom effect.

### Cards & Containers
Cards utilize the Backdrop Blur effect. The top edge of a card should have a "light-catch" highlight—a 1px semi-transparent white line to simulate 3D depth.

### Input Fields
Inputs are minimalist, often appearing as just a bottom border that "charges up" (glows brighter) when focused. The placeholder text should use the `label-mono` style.

### Vinyl Record Player
The central component of the experience. The vinyl should have a "shimmer" effect—a radial gradient overlay that rotates, simulating light reflecting off the grooves. The tone-arm should be a crisp, metallic geometric shape.

### Progress Bars & Sliders
Track progress is displayed as a glowing "laser" line. The "thumb" of the slider should be a vertical needle, reminiscent of an analog frequency tuner.