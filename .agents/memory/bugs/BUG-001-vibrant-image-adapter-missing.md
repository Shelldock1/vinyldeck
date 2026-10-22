# BUG REPORT — VinylDeck Color Extraction Completely Dead

**Date:** 2026-06-08
**Severity:** High — Core feature non-functional
**Phase 1 Diagnostic:** Completed via systematic browser agent instrumentation
**Status:** RESOLVED / STALE — Original `@vibrant/core` issue no longer applies.

---

## Confirmed Working (from browser probes)

| System | Status |
|---|---|
| AmbientLayer DOM (orbs, vignette, grain) | ✅ Renders correctly |
| CSS custom property cascade (theme tokens) | ✅ Works |
| Theme switching (data-theme attribute) | ✅ Instant, visual, correct |
| Play/Pause, track change via MockSource | ✅ Works |
| Artwork data URL generation (canvas PNG 200×200) | ✅ Generated, loaded |
| CSS variable write path (setProperty inline) | ✅ Works if called |
| Z-index / stacking context | ✅ No issues |
| Vite HMR | ✅ No build errors |

---

## Root Cause — Single, Definitive

**`@vibrant/core` v4 requires an explicit browser image adapter. None is registered.**

### Error (from browser console, Probe 4):
```
Palette extraction error: this.opts.ImageClass is not a constructor
```

### Mechanism:
1. `useColorExtraction.ts` calls `Vibrant.from(dataUrl).getPalette()`
2. `@vibrant/core` v4's modular design requires an `ImageClass` to be provided — it does NOT bundle one
3. In a browser (Vite) context with just `@vibrant/core`, `ImageClass` is `undefined`
4. When `.getPalette()` tries to instantiate the image decoder: `new this.opts.ImageClass(...)` → **TypeError: not a constructor**
5. The `try/catch` in `extractAmbientColors()` catches this silently → returns `null`
6. `useColorExtraction` then calls `resetAmbientColors()` → inline CSS var is cleared
7. CSS cascade falls back to stylesheet theme token (e.g., Noir `#93000a`)
8. `--ambient-primary` inline style is ALWAYS empty → no dynamic color EVER applied

### Evidence Chain:
- Probe 1: `--ambient-primary (inline): ""` — ALWAYS empty
- Probe 4: `Vibrant.from(dataUrl).getPalette()` → explicit constructor error
- Probe 8: After track change, inline var still empty → orb stays theme-default color
- Probe 9: No console error visible — silently swallowed by catch block

### What is NOT the problem:
- Canvas generation — works (48KB PNG generated, Probe 4)
- The CSS variable write path — works (Probe 5 force-set confirmed)
- AmbientLayer DOM — fully rendered (Probe 2)
- Z-index / visibility — confirmed clear (Probe 6)

---

## Fix Options (for user discussion — NOT implementing yet)

### Option A: Install `@vibrant/image-browser` (modular, minimal)
`@vibrant/core` v4 has a separate `@vibrant/image-browser` package that provides the browser adapter.
```ts
import { Vibrant } from '@vibrant/core';
import { BrowserImageLoader } from '@vibrant/image-browser';
// Register before calling .from()
Vibrant.use(BrowserImageLoader); // or pass as option
```
- **Pro:** Minimal dependency, stays modular
- **Con:** Needs an `npm install @vibrant/image-browser` and API needs verifying for v4.x

### Option B: Switch to `node-vibrant` browser entry (batteries included)
`node-vibrant` is the "all-in-one" package. It has a `node-vibrant/browser` entry that bundles the browser adapter.
```ts
import Vibrant from 'node-vibrant/browser';
const palette = await Vibrant.from(dataUrl).getPalette();
```
- **Pro:** Single import, tested browser pattern, documented
- **Con:** Larger bundle, installs `node-vibrant` which currently isn't in package.json

### Option C: Ditch @vibrant, do manual canvas pixel sampling (zero dep)
Write a ~30-line canvas sampler that reads pixel data directly — no library needed.
```ts
// Draw image to canvas → getImageData → find most saturated RGB
// via HSL conversion → return as ambient color
```
- **Pro:** Zero dependency, no version mismatch risk, full control over the algorithm
- **Con:** Slightly more code, less "smart" than Vibrant's median-cut quantizer

---

## Current State Update
- Browser verification on `http://localhost:1420/` confirmed Album Art Ambient works.
- Toggling Album Art Ambient ON writes inline CSS vars, e.g. `--ambient-primary: rgb(50,147,174)`.
- Toggling OFF clears inline CSS vars and restores theme defaults.
- Current implementation uses locked `fast-average-color` path, not the broken `@vibrant/core` adapter path.

---

## Files Already Changed Since Original Bug
- `src/hooks/useColorExtraction.ts`
- `package.json`

---

## Related Memory Updates
- `state.md` now notes FAC color extraction is locked and currently working.
- `decisions.md` already records final FAC decision.
