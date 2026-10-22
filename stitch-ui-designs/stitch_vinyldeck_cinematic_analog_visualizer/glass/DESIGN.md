---
name: Glass
colors:
  surface: '#f9f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f9f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f5'
  surface-container: '#eeeef0'
  surface-container-high: '#e8e8ea'
  surface-container-highest: '#e2e2e4'
  on-surface: '#1a1c1d'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3132'
  inverse-on-surface: '#f0f0f2'
  outline: '#717786'
  outline-variant: '#c1c6d7'  
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#5e5e5f'
  on-secondary: '#ffffff'
  secondary-container: '#e0dfdf'
  on-secondary-container: '#626363'
  tertiary: '#705d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c9a900'
  on-tertiary-container: '#4c3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#ffe170'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#f9f9fb'
  on-background: '#1a1c1d'
  surface-variant: '#e2e2e4'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-dt: 64px
  container-padding-mb: 20px
  gutter: 24px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system embodies a high-fidelity cinematic aesthetic inspired by contemporary glassmorphism and Apple’s translucent interface principles. It targets an audience that appreciates premium, tactile digital experiences—audiophiles and collectors who value the physical sensation of vinyl records. The UI should evoke a sense of clarity, depth, and atmospheric lightness.

The style is defined by **Glassmorphism** and **Minimalism**. It utilizes multi-layered background blurs to create a sense of three-dimensional space, where information floats over soft, refracted environments. Prismatic light-catching highlights on edges simulate the way light hits physical glass, providing a sophisticated, futuristic feel while remaining grounded in high-end industrial design.

## Colors
The palette is centered on transparency and light refraction. The base environment is a luminous neutral (`#F5F5F7`), serving as the "stage" for frosted layers. 

- **Primary**: A vibrant, high-clarity blue used sparingly for interactive highlights and focus states.
- **Secondary**: A muted, sophisticated silver-grey for secondary metadata and borders.
- **Tertiary**: A warm, golden accent used exclusively for "high-value" moments, such as rare record badges or specialized status indicators.
- **Surface**: Backgrounds are not solid colors but translucent whites (`rgba(255, 255, 255, 0.7)`) with high-saturation background blurs.
- **Prismatic Accents**: Subtle linear gradients mimicking light dispersion (soft pinks, cyans, and yellows) are used only on 1px borders to simulate glass edges.

## Typography
The typography system uses a clean, sans-serif pairing to maintain the "Glass" aesthetic's precision. **Manrope** provides a modern, balanced look for headlines, with its geometric influences echoing the circularity of vinyl. **Inter** is used for all functional text, chosen for its supreme legibility against translucent and blurred backgrounds.

Weights are kept towards the "Regular" and "Semi-Bold" spectrum to avoid cluttering the visual field. High-contrast sizing between headlines and body text creates a clear hierarchy without the need for heavy color-blocking.

## Layout & Spacing
This design system utilizes a **Fixed Grid** model for desktop to maintain the integrity of frosted-glass containers, transitioning to a fluid model for mobile.

- **Desktop**: 12-column grid, 1140px max-width, 24px gutters.
- **Mobile**: Single column with 20px side margins.
- **Rhythm**: All spacing is derived from a base 8px unit. Elements "float" within containers using generous internal padding (minimum 24px) to emphasize the breathable, airy nature of the brand.
- **Z-Axis**: Spacing is not just horizontal and vertical; vertical "stacking" is achieved through 16px to 32px of margin between layered glass cards to allow the background refraction to be visible between elements.

## Elevation & Depth
Depth is the core of this system. It is achieved through a combination of **Glassmorphism** and **Ambient Shadows**.

1.  **Surfaces**: Layers use `backdrop-filter: blur(20px)` and a 70% opaque white fill. 
2.  **Borders**: Every glass element features a 1px solid white border at 40% opacity, acting as a "specular highlight." Top and left borders may use a subtle prismatic gradient (Cyan to Pink at 10% opacity) to catch light.
3.  **Shadows**: Use highly diffused, low-opacity shadows. A "Floating" card uses a shadow with a 40px blur, 0px offset, and `rgba(0, 0, 0, 0.04)`. 
4.  **Refraction**: Backgrounds behind the glass should feature soft, organic color blobs that shift slightly as the user scrolls, creating a sense of dynamic light passing through the UI.

## Shapes
The shape language is consistently **Rounded** (0.5rem base) to soften the technical feel of the glass and align with the circular nature of vinyl media.

- **Large Containers/Cards**: Use `rounded-xl` (1.5rem / 24px) to create a soft, friendly silhouette.
- **Buttons/Inputs**: Use `rounded-lg` (1rem / 16px) for a modern, tactile feel.
- **Album Art**: Should always maintain a slight corner radius (8px) to prevent "sharpness" from breaking the glass aesthetic.

## Components
- **Buttons**: Primary buttons are solid, vibrant blue with a soft inner glow. Secondary buttons are "Glass" (translucent) with a 1px white border.
- **Cards**: The primary container. Features the 20px backdrop blur, 1px specular border, and 24px internal padding.
- **Input Fields**: Minimalist. Transparent backgrounds with a 1px bottom border that glows primary blue on focus. 
- **Chips**: Pill-shaped, semi-transparent (20% opacity) with high-contrast text. Used for music genres or record conditions.
- **Lists**: Separated by 1px translucent dividers. Hover states should trigger a "lift" effect where the row gains a slightly more opaque white background and a subtle drop shadow.
- **Music Player**: A persistent glass bar at the bottom of the viewport with a high-intensity blur (40px) to make it feel like a heavy acrylic slab.