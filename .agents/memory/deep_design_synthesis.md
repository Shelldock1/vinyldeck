# VinylDeck — Deep Design Synthesis
> Full study of all 20 prototypes. This is the design DNA bible.

---

## 1. The Common Denominator (Universal Laws)

These features appear in **every single high-scoring prototype** regardless of theme. They are non-negotiable.

### 1.1 Ambient Volumetric Lighting
Every premium design uses **blurred orbs** (`blur: 80–150px`) with `mix-blend-mode: screen` floating BEHIND the disc. This is not decoration — it is the illusion of a physical light source in a dark room. The orbs are never static; they either float (`floatOrb` keyframe, 20–25s) or breathe (`breathe` keyframe, 4–8s alternate).

**Current status in our app:** ✅ AmbientLayer has two orbs with mix-blend-mode: screen. **Gap: our orbs don't animate/float — they are static positions.** Noir theme: we use the ambient color from the album art. BUT the orbs need subtle independent float motion.

### 1.2 Vinyl Groove Texture
Every design uses `repeating-radial-gradient` at 1–4px intervals with alternating dark hex codes (`#111`, `#1a1a1a`, `#0a0a0a`) to simulate physical grooves. This is not a detail — it's the tactile bedrock of the whole visual.

**Current status:** ✅ Our VinylRecord has grooves layer.

### 1.3 Anisotropic Specular Reflection (Conic Gradient)
Every vinyl in the premium designs has a `conic-gradient` overlay on `mix-blend-mode: screen` or `overlay` that creates the "bow-tie" glare effect — simulating anisotropic light reflection from real vinyl grooves. **Crucially: this layer should spin counter to or independently of the record** so it feels like a fixed environmental light source.

**Current status:** ✅ We have groove-sheen and groove-reflection layers. Gap: verify reflection counter-rotates or is static while disc spins.

### 1.4 Spring Physics on the Tonearm
Every design that includes a tonearm drop uses `cubic-bezier(0.34, 1.56, 0.64, 1)` — the overshoot curve — giving the arm a bounce that exactly mimics a real tonearm's mechanical inertia.

**Current status:** ✅ NeedleArm uses motion.div with `stiffness: 60, damping: 18, mass: 1.2`.

### 1.5 Mouse-Reactive Specular Highlight
Across EVERY premium fullscreen design, there is a JS `mousemove` listener that maps `clientX/clientY` to a `radial-gradient` overlay on the vinyl with `mix-blend-mode: overlay`. This simulates a physical light source (desk lamp / spotlight) moving over the disc surface. This is the single biggest differentiator between "good UI" and "living cinematic experience."

**Current status:** ✅ VinylRecord/index.tsx has `handleMouseMove`. **Need to verify it's wired up and the opacity is strong enough to actually see.**

### 1.6 SVG Film Grain Overlay
Every premium design (Noir, Analog, Settings, etc.) overlays an SVG `feTurbulence` fractal noise at 3–5% opacity with `mix-blend-mode: overlay`. Animated via a `@keyframes grainStep` (4-step, 3–5% offset) that slightly randomizes position. This prevents blacks from being sterile/digital and adds analog warmth.

**Current status:** ✅ Our AmbientLayer has an animated SVG grain filter.

### 1.7 Inertial Vinyl Spin-up / Spin-down
Every expert reviewer called out the need for **non-linear rotation physics**:
- **Spin-up:** Ease-in from 0, reaches 33 RPM (1.8s/rev) over ~0.8–1.5s
- **Spin-down:** When paused, continues decelerating over 1.5–3s using `cubic-bezier(0.22, 1, 0.36, 1)`

**Current status:** ✅ Our `useVinylRotation` hook has a RAF loop with `velocityRef`, lerp-based spin-up (0.06 factor) and brake (0.018 factor). This is correct.

### 1.8 Lean-Back / Idle UI Fade
The Vapor and Aurora motion modes both implement a 2.5–3 second idle timer that fades controls to `opacity: 0` with `0.6s cubic-bezier(0.16, 1, 0.3, 1)` easing, hiding the cursor. This is the "cinematic mode" — the interface disappears, leaving only the spinning record.

**Current status:** ❌ Not implemented yet. **Stage 5 target.**

---

## 2. Theme-Specific Design Vocabulary

### 2.1 Noir
**Visual signature:** Pure OLED black (`#000`/`#0e0e0f`). No color ambient — the ONLY light comes from a top-center volumetric spotlight (radial gradient from center-top) and subtle environmental light that reacts to mouse position (inertia loop: `0.08` lerp factor).

**Key screens:**
- `noir_fullscreen_high_fidelity_motion` (#1): Pure void — the record floats in absolute darkness. No UI chrome. This is the "idol" state.
- `master_cinematic_experience` (#2): Full UI — shows the complete visual language. Blue-teal iridescent center label shimmer. Transport bar bottom with elegant serif.
- `noir_high_fidelity_motion` (#4): THE REFERENCE. Album art color creates the entire background (the blood-red "After Hours" glow dominates the canvas). Center label has a SWIRLING VORTEX of motion blur + red neon rings. The disc color IS the theme here.

**Noir tonearm:** White/silver brushed metal. Sphere counterweight (not a block). Tiny red dot on headshell. Power indicator LED pulses 2.5s ease-in-out.

**Typography stack:** Sora (bold display) + Inter (body) + JetBrains Mono (timestamps/metadata, gives HW-readout precision).

**Transport pill** (from #4): Floating rounded-corner pill, dark with album-color tint, minimal — title + artist + prev/pause/next + volume slider.

### 2.2 Aurora
**Visual signature:** Deep midnight cyan base (`#050b14`). Dual ambient orbs: `aurora-cyan (#00f0ff)` LEFT + `aurora-blue (#0080ff)` RIGHT. These two distinct orbs create the "aurora borealis" halo around the disc. The background is NOT black — it has a very subtle dark cyan/teal saturation.

**Key screens:**
- `aurora_motion_mode` (#7): The canonical Aurora look — two large blur orbs (cyan left, blue right) flanking the disc. Center label has a rotated square/diamond with cyan LED edges. Background feels like a deep ocean.
- `aurora_fullscreen` (#8): Adds a cyan neon progress RING around the disc perimeter. Track title ("MIDNIGHT SYNTHESIS") at bottom. JetBrains Mono subtitle in wide tracking.
- `aurora_theme` (#9): Full player layout with album art panel left, turntable center, controls right. Uses teal background (#0d9488 aurora-shift). EQ bars bottom-left. This is the "full UI mode" for Aurora.

**Aurora tonearm:** Grey/gunmetal, rectangular headshell, tiny cyan LED dot. No counterweight shown — arm emerges from right edge of disc.

**Unique features:** 
- Progress ring encircling the vinyl (neon cyan `stroke`)
- EQ bars: 32 bars, 150ms randomized update
- `aurora-shift` background: 20s ease-infinite keyframe on 400% gradient

### 2.3 Vapor
**Visual signature:** Deep space black-purple (`#050014`) with MAGENTA + CYAN orbs. Explicit neon ring around disc perimeter. OutRun 3D grid floor (`perspective(500px) rotateX(60deg)`). The disc itself has a hot-pink/magenta center label.

**Key screens:**
- `vapor_motion_mode` (#10): Most dramatic. Full neon magenta ring AROUND the disc as progress indicator. Magenta orb left, cyan orb right. Center label is bright magenta/pink. Grid floor implied at bottom.
- `vapor_experience_1` (#11): Shows the disc TILTED (rotated at 45° — diamond orientation). Purple/lavender center label. Minimal controls below. The disc is treated as a floating 3D object, not a flat top-down view.
- `vapor_mini_player_animated` (#12): Small card player. Dark interior glassmorphism card floating in space. Dust particle system. Interactive 3D grid floor reacts to mouse. Orange+cyan center label (album art).

**Vapor unique features:**
- OutRun/Synthwave 3D perspective grid (`moveGrid` 10s linear, simulates forward travel)
- `armShimmer` animation: sliding gradient over tonearm metallic surface (3s) — studio light catching brushed aluminum
- Progress ring that PULSES (`breathePulse` 3s, matching background `breatheBg`)

### 2.4 Analog/Paper (Warm)
**Visual signature:** Golden hour palette. `warm-bronze (#c28b5e)`, `warm-cream (#f4ebd8)`, `vinyl-black (#0c0b0a)`. Background: dark warm radial gradient (`#2a1f18` → `#000000`). Ambient golden orb behind the disc. Film grain.

**Key screens:**
- `analog_motion_mode` (#13): Golden bronze ambient glow behind disc. White center label (actual printed vinyl label with track name, RPM, STEREO markings). Tonearm is BRONZE/gold colored — matches the warm palette. Transport controls below with bronze play button.
- `cinematic_playback_interaction_analog` (#14): Paused state — shows vinyl label prominently. Orange-bronze ambient glow.
- `paper_experience_1` (#15): The only "light mode" design. Cream/beige background. Black vinyl. Gold center label. Full sidebar navigation. Shows the Paper theme is a completely different UX pattern — editorial, physical, daylight.

**Analog unique features:**
- Actual vinyl label (white circle with printed text: title, artist, "33 ⅓ RPM", "STEREO") — this replaces album art on the disc
- `wobble` animation: 1.5s, ±1px translate + 0.998–1.002 scale — physical imperfection
- Sequential tonearm drop: arm rotates first (1s), THEN headshell translates down (0.5s delay)
- Dynamic reflections: two conic gradients spinning in OPPOSITE directions at different speeds (6s / 8s); opacity lifts from 0.3 to 0.8 when playing

---

## 3. The Glass Theme (Design #6)
`vinyldeck_glass_high_fidelity_motion`

**Visual signature:** Presented inside a visible frosted acrylic WINDOW frame (rounded rectangle, `backdrop-blur: 40px, saturate: 150%`). Background is dark with purple-to-blue gradient bleed. The entire player sits INSIDE this panel — it's a windowed app view, not fullscreen.

Bottom nav: Player / Collection / Mixes / Discovery tabs.

This is the closest to our **actual desktop app** visual pattern — a window chrome, a contained vinyl disc (smaller), transport controls embedded inside the record view, and a bottom navigation dock.

**Unique features:**
- The vinyl disc is contained INSIDE the acrylic panel, not fullscreen
- Transport controls (prev/pause/next) overlap the bottom of the disc inside a pill
- No tonearm visible — pure vinyl
- `animate-float-widget`: 8s oscillation on Y-axis (±4–12px) with subtle ±1deg rotation — the panel feels like it's floating

---

## 4. Critical Missing Features in Our Implementation

Based on the gap analysis between our Stage 2 implementation and what the designs show:

### Priority 1 — Must Have (Stage 5 Polish)
| Feature | Gap | Implementation |
|---------|-----|----------------|
| **Floating ambient orbs** | Orbs are static | Add `floatOrb` keyframe (20–25s, random offset) |
| **Interactive mouse specular** | Wired but need to verify opacity/strength | Check `handleMouseMove` in VinylRecord, ensure radial-gradient is visible |
| **Counter-rotating reflection** | Need to verify | Sheen layer should NOT rotate with disc |
| **Vinyl wobble** | Not implemented | Add subtle `wobble` keyframe: ±1px translate + 0.998/1.002 scale, 1.5s |
| **Tonearm power LED** | Not implemented | Tiny pulsing dot on NeedleArm |
| **Lean-back idle mode** | Not implemented | 3s timer → fade controls → cursor:none |

### Priority 2 — Theme-Specific
| Feature | Theme | Notes |
|---------|-------|-------|
| Aurora neon progress ring | Aurora | SVG ring around the disc perimeter |
| Vapor OutRun grid floor | Vapor | CSS `perspective(500px) rotateX(60deg)` + `moveGrid` animation |
| Analog vinyl label | Analog | White circle with printed track data replacing center |
| Vapor armShimmer | Vapor | Sliding gradient on tonearm |
| Glass window float | Glass | `animate-float-widget` on the panel |

### Priority 3 — Physics Upgrades
| Feature | Current | Target |
|---------|---------|--------|
| Disc wobble | None | `wobble` keyframe: `translate(0,0)→translate(1px,1px)→translate(-1px,0)→translate(0,-1px)` |
| Counter-rotating conic | Verify | Two `conic-gradient` layers at 6s and 8s, opposite directions |
| Stylus "needle bump" | Not implemented | Quick `translateY(-2px)` on headshell exactly when arm drop completes |
| Tonearm tracking | Not implemented | Arm angle = `lerp(startAngle, endAngle, progress)` |

---

## 5. Typography DNA (Locked)

All premium designs use this exact stack:
```css
/* Display / Headlines */
font-family: 'Sora', sans-serif;

/* Body / Controls */
font-family: 'Inter', sans-serif;

/* Technical / Metadata / Timestamps */
font-family: 'JetBrains Mono', monospace;
letter-spacing: 0.2em–0.3em; /* wide tracking */
text-transform: uppercase;
```

Track title: Large, white, Sora, semibold.  
Artist: Inter, spaced caps, muted grey.  
Timestamps: JetBrains Mono, hardware-readout precision.

---

## 6. The Exact Physics Curves (Locked)

From the `detailed_cinematic_playback_interaction_analog.md` review — these are the canonical values:

```js
// Tonearm drop (spring overshoot)
cubic-bezier(0.34, 1.56, 0.64, 1)  // overshoots, bounces, settles

// Vinyl deceleration (spin-down)
cubic-bezier(0.22, 1, 0.36, 1)       // heavy friction, smooth stop

// Control reveal (lean-back restore)
cubic-bezier(0.16, 1, 0.3, 1)        // spring-like restore from idle fade

// Magnetic hover (button attraction)
cubic-bezier(0.25, 1, 0.5, 1)        // fast pull-in, smooth decelerate

// Toggle switch snap
cubic-bezier(0.4, 0, 0.2, 1)         // Material Design snap — physical switch
```

For the **Noir inertia spotlight**: `currentX += (targetX - currentX) * 0.08` — 8% lerp factor per frame, gives delayed, heavy follow.

---

## 7. The Noir HFM (#4) — The Reference Implementation

Design #4 (`vinyldeck_noir_high_fidelity_motion`) is THE reference for the album-art ambient glow system we've been building. Breaking it down:

1. Background: Pure `#000000` + soft **radial crimson glow** (`#6B0000` fading to true black at corners). This comes entirely from the album art color — "After Hours" is red.
2. Center label: Black swirl motion-blur vortex + 3 concentric RED neon rings. The neon rings are thin `box-shadow` rings on nested circles.
3. Tonearm: White, sphere counterweight, red dot on headshell.
4. Transport: **Floating pill** at bottom-center. Red tint matches album art. Minimal: title, artist, prev/pause/next, volume slider.
5. Top bar: "VINYLDECK" bold all-caps top-left. 4 icon buttons top-right.

Our ambient system (FAC simple + HSL boost) should produce EXACTLY this crimson glow for a red album. If it doesn't, the extraction is wrong.

---

## 8. What Makes the Label Area Special

Across ALL designs, the center label area is used differently per theme:

| Theme | Center Label |
|-------|-------------|
| Noir | Dark label with iridescent blue-teal shimmer / OR swirl vortex + neon rings |
| Aurora | Rotating SQUARE/DIAMOND shape with cyan LED edges |
| Vapor | Bright magenta/pink circle OR orange+cyan album art |
| Analog | White printed vinyl label (track title, artist, "33 ⅓ RPM", "STEREO") |
| Paper | Gold circle ("ANALOG" text) |
| Glass | Dark circle, minimal |
| Minimal Widget | Album art |

The center label IS the personality of each theme. Right now we have a static dark circle with a hole. This should be the most visually rich part of the disc per theme.

---

## 9. Immediate Next Implementation Priority

Based on everything above, here is the optimal implementation order for Stage 5 (and items that can improve Stage 2 right now):

### Tier A — Maximum Visual Impact, Low Code Risk
1. **Float motion on ambient orbs** — 20-line CSS keyframe addition. Massive perceived quality improvement.
2. **Vinyl wobble keyframe** — 8-line CSS addition. Makes disc feel physical.
3. **Counter-rotating reflection verification** — 5-minute check. May already be right.
4. **Mouse specular strength** — Tune opacity. May need bump from 0.15 to 0.3.
5. **Tonearm LED pulsing dot** — 10-line CSS. Tiny but meaningful hardware detail.

### Tier B — Architectural (Stage 3/5)
6. **Lean-back idle mode** — New `useIdleMode` hook + controls opacity transition
7. **Theme-specific label areas** — Per-theme CSS on the label element
8. **Aurora progress ring** — SVG ring component added around disc
9. **Vapor OutRun grid** — Background layer component for Vapor theme
10. **Tonearm tracking** — Map `position / duration` to arm angle range (25°→35°)

---

## 10. Settings Panel Design Language

The settings screens (#19, #20) reveal important app-shell design decisions:

- **Settings #19**: Left sidebar (`Preferences: Themes / Vinyl / Visualizer / Performance`) + right content pane. Theme cards show: Noir (selected), Aurora, Vapor. "Accent Frequency" section shows color swatches. Background is pure dark with particle dots.
- **Settings #20**: Glass modal panel over dark background with silhouette of hi-fi listening room. Section headers in spaced caps (`RENDERING ENGINE`, `PHYSICAL BEHAVIOR`). Toggle switches with brushed metal thumbs and spring overshoot.

Both confirm: Settings is a **glass modal** floating over the player background, NOT a separate page navigation.

---

## 11. Formal Design Token Reference (from DESIGN.md Files)

These are the **authoritative specifications** extracted from the 8 DESIGN.md files. They override any assumptions made from visual inspection alone.

### 11.1 Per-Theme Color Tokens

#### Noir (`noir/DESIGN.md`)
```
background:                 #131313
surface-container-lowest:   #0e0e0e   ← OLED void
surface-container:          #201f1f
on-surface (text):          #e5e2e1
primary:                    #ffffff   ← monochrome only
outline:                    #8e9192
outline-variant:            #444748
```
> **Rule:** Color is strictly forbidden unless it originates from album artwork. Album art IS the sole source of organic light.

#### Aurora Cinematic (`aurora_cinematic/DESIGN.md`)
```
background:                 #0e1419   ← deep desaturated navy, NOT pure black
surface-container-lowest:   #090f14
primary:                    #e1fdff   ← near-white cyan
primary-container:          #00f2ff   ← electric cyan
surface-tint:               #00dbe7
secondary:                  #94d1d1   ← deep teal
tertiary:                   #fcf5ff / #e3d4ff  ← nebula violet accent
on-surface:                 #dee3ea
```
> **Background rule:** Radial gradient from `#0A191E` at corners → `#050A0F` at center — infinite horizon effect. NOT flat color.

#### Vapor (`vapor/DESIGN.md`)
```
background:                 #111225   ← navy-violet, never pure black
surface-container-lowest:   #0b0c1f
primary:                    #fea9ff   ← electric magenta
primary-container:          #eb3cff   ← full magenta
secondary:                  #d1bcff   ← cyber purple
tertiary:                   #00dbe9   ← electric cyan (for HUD readouts)
on-surface:                 #e1e0fb
surface-tint:               #fea9ff
```
> **Rule:** Surfaces retain violet tint even in dark mode. Never use pure black — always `#111225` or `#0b0c1f`.

#### Paper (`paper/DESIGN.md`)
```
background:                 #fef9eb   ← warm cream canvas
surface-container-lowest:   #ffffff
surface-container:          #f3eedf
on-surface:                 #1d1c13   ← warm charcoal (not pure black)
primary:                    #715230   ← bronze
primary-container:          #8c6a46
on-primary-container:       #fff4ec
outline:                    #81756a
```
> **Rule:** Light mode ONLY. This is the one theme that does NOT use OLED black. Background is always cream.

#### Glass (`glass/DESIGN.md`)
```
background:                 #f9f9fb   ← luminous neutral light mode
surface-container-lowest:   #ffffff
primary:                    #0058bc   ← vibrant blue
primary-container:          #0070eb
on-surface:                 #1a1c1d
outline:                    #717786
```
> **Rule:** Surfaces are translucent whites (`rgba(255,255,255,0.7)`) with high-saturation background blurs — NOT dark. This is Apple-inspired light mode glassmorphism.

#### Cinematic System (`vinyldeck_cinematic_system/DESIGN.md`) — THE MASTER
```
background:                 #131314
surface-container-lowest:   #0e0e0f
primary:                    #ffffff
on-primary:                 #2b3137  (brushed aluminum text)
primary-container:          #dde3eb
tertiary-container:         #f3dfd0  (warm accent for Paper crossover)
on-surface:                 #e5e2e2
outline-variant:            #44474a
```
> This is the **base token set** all dark themes inherit from. The `#0e0e0f` void is explicitly named as "The Void."

#### Cinematic Collection (`vinyldeck_cinematic_collection/DESIGN.md`)
```
background:                 #141218   ← purple-black tint
primary:                    #cfbcff   ← lavender
primary-container:          #6750a4   ← Material You purple
tertiary:                   #e7c365   ← gold accent
on-surface:                 #e6e0e9
surface-tint:               #cfbcff
```
> This appears to be the **base design system for the collection/library view** — it's more "app shell" than a playback theme. Uses Material You purple + gold as the accent pair.

#### Narrative (`vinyldeck_narrative/DESIGN.md`)
```
background:                 #141313
surface-container-lowest:   #0e0e0e
primary:                    #ffffff
on-surface:                 #e5e2e1
```
> Effectively a Noir variant but with `Hanken Grotesk` at **weight 200 (ultralight)** for display — creates a very different, editorial feel. Used for narrative/storytelling views.

---

### 11.2 Typography Tokens — Full Correction Table

> ⚠️ **Our current implementation uses Sora/Inter/JetBrains Mono for ALL themes.** This is only correct for Noir (partially) and Cinematic System. Every other theme has a different font identity.

| Theme | Display/Headline | Body | Label/Data | Key Difference |
|-------|-----------------|------|-----------|----------------|
| **Noir** | Hanken Grotesk 700, -0.04em tracking | Geist 400 | JetBrains Mono 500, +0.1em | Sharp editorial, `-0.04em` tight tracking |
| **Aurora** | Sora 700, -0.02em | Geist 400 | JetBrains Mono 500, +0.08em | Sora correct ✅, body should be Geist not Inter |
| **Vapor** | **Anybody** 800, -0.04em | **Space Grotesk** 400 | **Space Mono** 500, +0.1em | All three fonts different from current |
| **Paper** | **Libre Caslon Text** 700 (serif!) | **Work Sans** 400 | **Space Mono** 500 | Only serif theme, warm editorial |
| **Glass** | **Manrope** 700, -0.02em | Inter 400 | Inter 600 (no mono!) | Manrope for glass, no mono labels |
| **Cinematic System** | Sora 700 | Inter 400 | JetBrains Mono 500, +0.2em | Our current setup ✅ |
| **Cinematic Collection** | Space Grotesk 700, -0.04em | Inter 400 | JetBrains Mono 500, +0.1em | Space Grotesk headline |
| **Narrative** | Hanken Grotesk **200** (ultralight!) | Inter 400 | JetBrains Mono 500, +0.15em | Weight 200 is intentional — ghost-thin display |

#### Fonts NOT Currently Loaded in Our App
These must be added to `global.css` Google Fonts import when the respective themes are built:
- `Hanken Grotesk` (Noir, Narrative)
- `Geist` (Noir, Aurora body)
- `Anybody` (Vapor display)
- `Space Grotesk` (Vapor body, Collection headlines)
- `Space Mono` (Vapor, Paper labels)
- `Libre Caslon Text` (Paper display — serif)
- `Work Sans` (Paper body)
- `Manrope` (Glass headlines)

---

### 11.3 Spacing & Layout Tokens

| Theme | Base Unit | Desktop Margin | Container Max | Gutter |
|-------|-----------|---------------|--------------|--------|
| Noir | 4px | 48px | 1440px | 24px |
| Aurora | 4px | 64px | 1440px | 24px |
| Vapor | 8px | 64px | 1440px | 24px |
| Paper | 8px | 64px | 1440px | 24px |
| Glass | 8px | 64px | 1140px | 24px |
| Cinematic System | 8px | — | — | 24px, touch-target: 48px |

> **Note:** Noir uses 4px base unit (finer rhythm). All others use 8px. Glass is the only theme with a smaller max-width (1140px vs 1440px) — it's designed for a contained windowed feel.

---

### 11.4 Shape / Border-Radius Tokens

| Theme | sm | default | md | lg | xl |
|-------|----|---------|----|----|----|
| Noir | 0px | 0px | 0px | 0px | 0px | ← **Sharp edges throughout** |
| Aurora | 2px | 4px | 6px | 8px | 12px |
| Vapor | 2px | 4px | 6px | 8px | 12px |
| Paper | 2px | 4px | 6px | 8px | 12px |
| Glass | 4px | 8px | 12px | 16px | 24px | ← **Most rounded** |
| Cinematic System | 4px | 8px | 12px | 16px | 24px |
| Narrative | 4px | 8px | 12px | 16px | 24px |

> **Critical Noir rule:** Containers, buttons, inputs — ALL have `border-radius: 0`. The only circles are the vinyl platter and playback controls. This is explicitly stated: "0px roundedness emphasizes the industrial, brushed-metal nature of the Noir theme."

---

### 11.5 Elevation & Depth Philosophy Per Theme

| Theme | Method | Key CSS |
|-------|--------|---------|
| **Noir** | Tonal layers + Low-contrast outlines | `border: 1px solid #333333`, hover: `box-shadow: 0 0 10px rgba(255,255,255,0.1)` |
| **Aurora** | Glassmorphism + Aurora Glows | `backdrop-filter: blur(20px)`, `box-shadow: 0 0 30px rgba(0,242,255,0.15)` |
| **Vapor** | Luminous Layering | Outer glow shadows in magenta/purple. No black shadows. Scanline overlay. |
| **Paper** | Tonal Layering + Micro-insetting | Letterpress inner shadow on primary buttons. Directional shadow `offset 4px/8px, blur 12px, opacity 0.1` |
| **Glass** | Glassmorphism + Ambient Shadows | `backdrop-filter: blur(20px)`, 70% white fill, `shadow: 0 0 0 40px rgba(0,0,0,0.04)` |
| **Cinematic System** | Light Emission + Refraction | `backdrop-filter: blur(20px)`, `0.5px border rgba(255,255,255,0.1)`, 2% noise texture overlay |
| **Narrative** | Physical Layers + Optical Layers + Luminous Depth | Inner shadows (CNC-milled look), glass `backdrop-filter: blur(40px)` + 1px white top stroke |

---

## 12. Implementation Gap Matrix — Tokens vs. Current Code

### 12.1 What Our `themes.css` Is Missing

Based on the DESIGN.md token specs vs. our current [themes.css](file:///c:/Coding/vinyldeck/src/styles/themes.css):

| Gap | Severity | Action Required |
|-----|----------|----------------|
| Noir uses `border-radius: 0` everywhere | HIGH | Add `--radius-base: 0` to Noir theme block |
| Noir body font should be Geist, not Inter | MEDIUM | Load Geist font, apply to `[data-theme="noir"] body` |
| Noir display font: Hanken Grotesk (not Sora) | MEDIUM | Load Hanken Grotesk |
| Vapor has 3 completely different fonts | HIGH | Load Anybody + Space Grotesk + Space Mono |
| Paper is light-mode, `#fef9eb` background | HIGH | Paper theme needs completely different background treatment |
| Aurora background: `#0e1419` navy (not `#000`) | LOW | Verify our Aurora `--bg` token is not pure black |
| Vapor background: `#111225` violet-black | LOW | Verify our Vapor `--bg` has violet tint |
| Glass is light-mode, `#f9f9fb` | HIGH | Glass theme is opposite of all others — light mode |
| Per-theme surface-container steps (5 levels) | MEDIUM | Map all 5 surface levels per theme to CSS vars |
| Cinematic Collection uses lavender `#cfbcff` primary | LOW | Not yet a selectable theme in our app |

### 12.2 Current Font Loads (global.css) vs. Required

**Currently loaded:**
```
Sora, Inter, JetBrains Mono
```

**Required for all 5 themes to be spec-correct:**
```
Sora          → Aurora, Cinematic System  ✅ loaded
Inter         → Aurora body, Glass, Cinematic System  ✅ loaded
JetBrains Mono → Noir, Aurora, Vapor*, Cinematic  ✅ loaded
Hanken Grotesk → Noir display  ❌ missing
Geist          → Noir body, Aurora body  ❌ missing
Anybody        → Vapor display (variable font)  ❌ missing
Space Grotesk  → Vapor body  ❌ missing
Space Mono     → Vapor labels, Paper labels  ❌ missing
Libre Caslon Text → Paper display (serif)  ❌ missing
Work Sans      → Paper body  ❌ missing
Manrope        → Glass display  ❌ missing
```

---

## 13. Master Component Vocabulary (from DESIGN.md Specs)

### The Platter Component Rules (Universal)
- Always a **perfect circle** — this is stated in every DESIGN.md
- Rotates via RAF-based JS (not CSS animation) for physics control
- Vinyl grooves via `repeating-radial-gradient`
- Specular sheen via `conic-gradient` + `mix-blend-mode: screen/overlay`
- In **Noir**: brushed metal `conic-gradient` texture
- In **Vapor**: glowing vector grid overlay on the disc surface
- In **Analog**: no album art on disc — shows white physical vinyl label
- In **Aurora**: diamond/square spindle hole with cyan LED edges

### Buttons
- **Noir**: Solid white, black text (Geist Bold), NO border-radius
- **Aurora**: Solid cyan-to-teal gradient, black text, 4px radius
- **Vapor**: Glass background + 1px magenta→purple gradient border, 4px radius
- **Paper**: Solid Bronze with metallic gradient, Work Sans, 4px radius
- **Glass**: Solid vibrant blue inner glow OR glass translucent, 16px radius
- All themes: `active:scale(0.92)` + inset shadow on press

### Progress/Seekers
- **Noir**: 2px line — white played / `#333` unplayed. No glow.
- **Aurora**: 2px line — cyan glow played / dark navy unplayed
- **Vapor**: "Laser line" — glowing magenta stroke + vertical needle thumb (frequency tuner style)
- **Paper**: Bronze gradient played / stone unplayed
- **Glass**: Primary blue glow played / translucent grey unplayed

### Playback Controls (Transport)
- **Cinematic System**: Pill-shaped, brushed aluminum `#E2E8F0` background, black text. Hover: volumetric glow in theme accent.
- **Noir**: High-contrast icons, no decoration
- **Glass**: Persistent glass bar at bottom (40px blur — "heavy acrylic slab")
- **Paper**: Distinctive Bronze circle play button (physical dial/knob metaphor)

---

## 14. Design System Hierarchy

Understanding how these 8 DESIGN.md files relate to each other:

```
vinyldeck_cinematic_system/DESIGN.md
  └── THE MASTER SYSTEM
      Defines: 5-theme architecture, shared component rules,
               layout philosophy ("Atmospheric Centricity"),
               base void (#000), glass surfaces, matte textures

      ├── noir/DESIGN.md          → Strict monochrome, 0px radius, sharp precision
      ├── aurora_cinematic/DESIGN.md → Midnight navy, cyan glows, Sora + Geist
      ├── vapor/DESIGN.md         → Violet-black, magenta/cyan neon, Anybody + Space
      ├── paper/DESIGN.md         → LIGHT MODE, cream, serif, bronze, editorial
      └── glass/DESIGN.md         → LIGHT MODE, frosted translucent, Manrope, blue

vinyldeck_cinematic_collection/DESIGN.md
  └── APP SHELL / LIBRARY VIEW
      Lavender + Gold palette, Space Grotesk, Material You-adjacent
      Used for collection browsing, not playback

vinyldeck_narrative/DESIGN.md
  └── EDITORIAL / STORYTELLING VIEW
      Hanken Grotesk ultralight (weight 200) for a ghost-thin editorial feel
      Same dark base as Noir but different typographic personality
```

**Key insight:** The Collection and Narrative DESIGN.md files are NOT playback themes — they're different **views/modes** within the app. The 5 playback themes are Noir, Glass, Aurora, Vapor, Paper.

---

## 15. Updated Typography DNA (Corrected)

> Replaces Section 5. The previous "locked" font stack only applies to the Cinematic System and Aurora themes. Each theme has its own distinct font personality.

### Per-Theme Font Stack (Authoritative)

```css
/* NOIR — Surgical Precision */
[data-theme="noir"] {
  --font-display: 'Hanken Grotesk', sans-serif;  /* tight -0.04em tracking */
  --font-body: 'Geist', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* AURORA — Cinematic Sci-Fi */
[data-theme="aurora"] {
  --font-display: 'Sora', sans-serif;            /* -0.02em tracking */
  --font-body: 'Geist', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;      /* +0.08em label tracking */
}

/* VAPOR — Neon Noir / Retro-Futurism */
[data-theme="vapor"] {
  --font-display: 'Anybody', sans-serif;         /* variable, -0.04em, weight 800 */
  --font-body: 'Space Grotesk', sans-serif;
  --font-mono: 'Space Mono', monospace;          /* VFD display aesthetic */
}

/* PAPER — Physical Heritage / Editorial */
[data-theme="paper"] {
  --font-display: 'Libre Caslon Text', serif;    /* -0.02em, luxury magazine */
  --font-body: 'Work Sans', sans-serif;
  --font-mono: 'Space Mono', monospace;          /* stamped back-panel text */
}

/* GLASS — Apple-Inspired Translucency */
[data-theme="glass"] {
  --font-display: 'Manrope', sans-serif;         /* -0.02em, geometric balance */
  --font-body: 'Inter', sans-serif;
  --font-mono: 'Inter', sans-serif;              /* no mono — glass uses Inter everywhere */
}
```

### Display Size Scale (Uniform Across Themes)
```
display-xl:  72px / weight 200–800 / lh 80px / ls -0.04em
display-lg:  48px / weight 700     / lh 1.1   / ls -0.02em
headline-lg: 32px / weight 600     / lh 1.2
headline-md: 24px / weight 600     / lh 1.3
body-lg:     18px / weight 400     / lh 1.6
body-md:     16px / weight 400     / lh 1.5–1.6
label-sm:    12px / weight 500     / lh 1.0    / ls 0.08–0.2em (UPPERCASE)
```
