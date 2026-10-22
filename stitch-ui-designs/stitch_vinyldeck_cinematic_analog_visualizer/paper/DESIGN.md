---
name: Paper
colors:
  surface: '#fef9eb'
  surface-dim: '#dfdacc'
  surface-bright: '#fef9eb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3e5'
  surface-container: '#f3eedf'
  surface-container-high: '#ede8da'
  surface-container-highest: '#e7e2d4'
  on-surface: '#1d1c13'
  on-surface-variant: '#4f453c'
  inverse-surface: '#323127'
  inverse-on-surface: '#f6f0e2'
  outline: '#81756a'
  outline-variant: '#d3c4b8'
  surface-tint: '#785836'
  primary: '#715230'
  on-primary: '#ffffff'
  primary-container: '#8c6a46'
  on-primary-container: '#fff4ec'
  inverse-primary: '#e9bf95'
  secondary: '#5f5f58'
  on-secondary: '#ffffff'
  secondary-container: '#e2e0d7'
  on-secondary-container: '#64635c'
  tertiary: '#5c5753'
  on-tertiary: '#ffffff'
  tertiary-container: '#756f6b'
  on-tertiary-container: '#fdf4ef'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcbc'
  primary-fixed-dim: '#e9bf95'
  on-primary-fixed: '#2c1700'
  on-primary-fixed-variant: '#5e4120'
  secondary-fixed: '#e5e2da'
  secondary-fixed-dim: '#c9c6be'
  on-secondary-fixed: '#1c1c17'
  on-secondary-fixed-variant: '#474741'
  tertiary-fixed: '#e9e1dc'
  tertiary-fixed-dim: '#cdc5c0'
  on-tertiary-fixed: '#1e1b18'
  on-tertiary-fixed-variant: '#4b4642'
  background: '#fef9eb'
  on-background: '#1d1c13'
  surface-variant: '#e7e2d4'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-sm:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  max-width: 1440px
---

## Brand & Style

The design system is centered on the concept of **Physical Heritage**. It transforms the digital interface into a tactile, high-fidelity experience reminiscent of luxury analog audio equipment and high-end editorial print. The target audience consists of audiophiles and collectors who value intentionality, warmth, and the "ritual" of music.

The visual style is a sophisticated blend of **Minimalism** and **Tactile Skeuomorphism**. It avoids heavy shadows in favor of subtle paper textures, micro-embossing, and metallic "machined" accents. The emotional response should be one of "Analog Calm"—a quiet, premium atmosphere that feels grounded, expensive, and timeless.

## Colors

The palette is anchored by **Warm Cream** (`#F5F2E9`) which serves as the primary canvas, mimicking heavy, unbleached cardstock. **Bronze** (`#8C6A46`) is used for primary actions and highlights, providing a metallic warmth that feels like aged brass.

**Charcoal** (`#2D2926`) provides the necessary contrast for high-fidelity typography, while **Stone** (`#E8E3D5`) acts as a secondary surface color to create subtle depth without breaking the light-mode aesthetic. Accents should be used sparingly to maintain the "collector's edition" feel.

## Typography

Typography in this design system balances editorial elegance with technical precision. 

- **Libre Caslon Text** is used for headlines to evoke the authoritative feel of classic vinyl liners and high-end lifestyle magazines.
- **Work Sans** provides a clean, highly legible foundation for body copy, ensuring the interface feels modern and accessible despite its vintage inspirations.
- **Space Mono** is used for labels, metadata, and technical readouts (e.g., track time, RPM, bit rate), mimicking the utilitarian stamped text found on back-panels of vintage Hi-Fi gear.

## Layout & Spacing

This design system utilizes a **Fixed Grid** philosophy on desktop to maintain the "frame" of a physical object. The layout is structured around a 12-column grid with generous margins (`64px`) to allow the cream-colored "paper" background to breathe.

Spacing follows an 8px rhythmic scale. On mobile, margins tighten to `20px`, and the layout shifts to a single column with cards spanning the full width minus the margins. Padding within containers should be "airy," prioritizing white space to emphasize the quality of the content and the texture of the surfaces.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Micro-Insetting** rather than dramatic shadows. 

1.  **Base Layer:** The `secondary_color_hex` (Cream) background with a very subtle noise grain texture.
2.  **Surface Layer:** Cards and containers use the `neutral_color_hex` (Stone) with a 1px solid border (`#D9D3C5`). 
3.  **Active Elements:** Primary buttons and interactive components use a "Letterpress" effect (inner shadow) to appear as if they are stamped into the paper.
4.  **Metallic Accents:** Bronze elements utilize a subtle linear gradient to simulate a brushed metal finish, catching "light" from the top-left.

## Shapes

The shape language is disciplined and geometric. A "Soft" roundedness (`0.25rem`) is applied to cards and buttons to mimic the slightly rounded corners of premium cardstock or machined metal faceplates. Large-scale elements like album art containers should use `rounded-lg` (`0.5rem`) to feel substantial but never "bubbly." Icons should be stroke-based with a weight that matches the `label-md` typography.

## Components

- **Buttons:** Primary buttons are Solid Bronze with a subtle top-down metallic gradient. Text is in `label-md` Charcoal. Secondary buttons are "Ghost" style with a 1px Stone border.
- **Cards:** Heavy cardstock aesthetic. No drop shadows; instead, use a 1px solid border in a shade slightly darker than the surface. Use an inner "gutter" padding of 24px.
- **Inputs:** Text fields should appear as underlined slots (border-bottom only) or subtly recessed boxes, using `Space Mono` for user input to maintain the "technical manual" feel.
- **Chips/Labels:** Small, rectangular tags with sharp corners and a light Stone background, featuring `label-sm` text.
- **Playback Controls:** The "Play" button should be a distinctive Bronze circle, mimicking a physical volume knob or dial.
- **Dividers:** Use very thin (0.5px or 1px) solid lines in `#D9D3C5` to separate editorial sections.