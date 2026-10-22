---
name: Noir
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
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
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#ffffff'
  on-tertiary: '#303030'
  tertiary-container: '#e4e2e2'
  on-tertiary-container: '#646464'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c7'
  on-primary-fixed: '#1a1c1c'
  on-primary-fixed-variant: '#454747'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#e4e2e2'
  tertiary-fixed-dim: '#c8c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#474747'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-sm:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1'
    letterSpacing: -0.01em
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1440px
---

## Brand & Style
This design system embodies a cinematic, high-fidelity aesthetic tailored for collectors and audiophiles. The personality is disciplined, mysterious, and unapologetically premium. It draws heavily from **Minimalism** and **Modern Corporate** styles, filtered through a lens of "Tech-Noir" cinema.

The visual narrative focuses on "surgical precision"—where every pixel is intentional and every transition is silent. The goal is to evoke the feeling of a high-end, darkened listening room where the only thing that matters is the tactile quality of the hardware and the depth of the sound. The UI recedes to allow the album artwork and "brushed metal" interface elements to emerge as if caught in a spotlight.

## Colors
The palette is strictly monochromatic to maintain a "Noir" atmosphere. 

- **Primary (#FFFFFF):** Used exclusively for high-priority text, critical icons, and hairline borders that define active states. It acts as the "light" in the scene.
- **Secondary (#1A1A1A):** The surface color for elevated components like cards or menus. It represents brushed metal or matte plastic.
- **Tertiary (#4D4D4D):** Used for inactive states, subtle borders, and secondary metadata.
- **Neutral (#050505):** The "Surgical Black" foundation. This is not a true #000000, allowing for one level of deeper shadows for depth.

Color is strictly forbidden unless it originates from album artwork, which should be treated as the sole source of "organic" light in the interface.

## Typography
The typography system balances modern elegance with technical precision. 

**Hanken Grotesk** is used for headlines to provide a sharp, contemporary "editorial" feel. It should be tracked tightly to mimic high-end fashion or cinematic titling. **Geist** provides a neutral, highly legible body face that feels systematic. **JetBrains Mono** is employed for labels, metadata (like RPM, year, or track duration), and technical readouts, reinforcing the "precision equipment" metaphor. 

All labels should be in uppercase with wide letter spacing to create a distinctive, structural hierarchy against the fluid headlines.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop, centered to create a focused "theatrical" experience.

- **Desktop:** 12-column grid with 24px gutters. Large 48px margins ensure the content feels isolated and important.
- **Mobile:** 4-column grid with 16px margins.
- **Rhythm:** All spacing must be multiples of 4px. Use generous vertical white space (80px+) between major sections to let the design breathe and emphasize the minimalist aesthetic.

Elements should be aligned to a strict baseline grid. Grouping is achieved through distance rather than heavy containment.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Low-Contrast Outlines**.

Since the background is near-black, elevation is suggested by slightly lightening the surface (to `#1A1A1A`) rather than traditional shadows. To simulate "surgical" precision, use 1px solid borders in `#333333` for containers. 

When an element is hovered or active, it should emit a subtle "glow" effect using a very tight, low-opacity white shadow (`0 0 10px rgba(255, 255, 255, 0.1)`) or by transitioning the border color to `#FFFFFF`. This mimics the look of a backlit high-end audio console.

## Shapes
This design system uses **Sharp** (0px) corners for almost all structural elements (cards, containers, inputs). 

The only exception to the sharp-edge rule is the "Vinyl Record" itself or circular playback controls, which provide a necessary geometric contrast to the rigid, rectangular layout. The 0px roundedness emphasizes the industrial, brushed-metal nature of the "Noir" theme.

## Components

- **Buttons:** Primary buttons are solid white with black text (Geist Bold). Secondary buttons are transparent with a 1px white border. No rounded corners.
- **Inputs:** Simple bottom-border only (1px tertiary). On focus, the border turns white. Labels use `label-caps` positioned above the input.
- **Cards:** No shadows. Use a `#1A1A1A` background and a 1px border of `#333333`. Ensure internal padding is generous (24px or 32px).
- **Chips:** Monochromatic. Background of `#333333` with white text in `label-caps`. 0px border radius.
- **Playback Controls:** Use high-contrast icons. The progress bar should be a thin 2px line, with the "played" portion being pure white and the "unplayed" portion being `#333333`.
- **Lists:** Separated by 1px hairlines (`#1A1A1A`). Use `data-mono` for list numbering (e.g., 01, 02, 03).
- **Special Component - "The Platter":** A rotating disc component for currently playing media, utilizing a brushed metal texture overlay via a subtle conical gradient.