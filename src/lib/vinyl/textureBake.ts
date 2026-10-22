// src/lib/vinyl/textureBake.ts
// Deterministic Canvas 2D wax-map baker for the WebGL vinyl renderer.
// Runs only when the track/pressing changes. The baked material does not
// animate; it rotates with the record like pigment trapped in pressed PVC.

import type { RgbColor, VinylPressing } from "./pressingEngine";
import { clamp, mixColors, seededUnit } from "./pressingEngine";

export interface BakedVinylTexture {
  canvas: HTMLCanvasElement;
  size: number;
}

interface Vec2 {
  x: number;
  y: number;
}

const DEFAULT_TEXTURE_SIZE = 640;

export function bakeVinylTexture(
  pressing: VinylPressing,
  size = DEFAULT_TEXTURE_SIZE,
): BakedVinylTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });

  if (!ctx) return { canvas, size };

  switch (pressing.recipe) {
    case "opaque-solid":
      bakeOpaqueSolid(ctx, pressing, size);
      break;
    case "clear-tint":
      bakeClearTint(ctx, pressing, size);
      break;
    case "smoke-clear":
      bakeSmokeClear(ctx, pressing, size);
      break;
    case "marble-blend":
      bakeMarbleBlend(ctx, pressing, size);
      break;
    case "splatter":
      bakeSplatter(ctx, pressing, size);
      break;
    case "color-in-color":
      bakeColorInColor(ctx, pressing, size);
      break;
    case "merge":
      bakeMerge(ctx, pressing, size);
      break;
    case "galaxy":
      bakeGalaxy(ctx, pressing, size);
      break;
    case "audiophile-black":
      bakeAudiophileBlack(ctx, pressing, size);
      break;
  }

  punchDiscAlpha(ctx, size, pressing);
  addVinylMicroGrain(ctx, pressing, size);
  return { canvas, size };
}

function bakeOpaqueSolid(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, deep, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, deep, edge],
    [0, 0.32, 0.78, 1],
  );
  addClouds(ctx, pressing, size, primary, highlight, 16, 0.09);
}

function bakeClearTint(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, secondary, edge],
    [0, 0.45, 0.78, 1],
    0.72,
  );
  addClouds(ctx, pressing, size, primary, secondary, 22, 0.13);
  addSubtleWaves(ctx, pressing, size, highlight, 0.12);
}

function bakeSmokeClear(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, deep, edge],
    [0, 0.38, 0.77, 1],
    pressing.material.alpha,
  );
  addSmokeVeils(
    ctx,
    pressing,
    size,
    secondary,
    accent,
    14 + Math.floor(seed(pressing, 90) * 10),
  );
  addSubtleWaves(ctx, pressing, size, highlight, 0.18);
}

function bakeMarbleBlend(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, highlight, edge } = pressing.colors;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const center = size / 2;
  const seedA = pressing.seedHash * 0.000001;
  const flow = pressing.material.marbleFlow;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const r = Math.sqrt(dx * dx + dy * dy);
      const index = (y * size + x) * 4;
      if (r > 1) {
        data[index + 3] = 0;
        continue;
      }

      const angle = Math.atan2(dy, dx);
      const polar = angle * 1.25 + r * (4.8 + flow * 3.5);
      const n1 = fbm(dx * 2.1 + seedA, dy * 2.1 - seedA, pressing.seedHash, 4);
      const n2 = fbm(
        dx * 5.2 - seedA * 0.5,
        dy * 5.2 + seedA * 0.3,
        pressing.seedHash ^ 0x8421,
        3,
      );
      const vein = Math.sin(polar + n1 * 5.8 + n2 * 2.2);
      const veinSoft = smoothstep(-0.18, 0.7, vein + n2 * 0.45);
      const pearl = smoothstep(0.72, 0.96, n1 + vein * 0.16);
      let color = mixColors(primary, secondary, clamp(veinSoft * 0.72, 0, 1));
      color = mixColors(
        color,
        accent,
        clamp((1 - veinSoft) * n2 * 0.34, 0, 0.44),
      );
      color = mixColors(color, highlight, pearl * 0.22);
      color = mixColors(color, deep, smoothstep(0.62, 1, r) * 0.32);

      writeColor(data, index, color, 220 + Math.round((1 - r) * 24));
    }
  }
  ctx.putImageData(image, 0, 0);
  addDraggedVeins(ctx, pressing, size, secondary, accent, 12);
  addRimPass(ctx, size, edge, 0.22);
}

function bakeSplatter(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, deep, edge],
    [0, 0.28, 0.76, 1],
  );
  addClouds(ctx, pressing, size, primary, deep, 10, 0.08);

  const density = pressing.material.splatterDensity;
  const largeCount = 7 + Math.floor(density * 8);
  const tinyCount = 34 + Math.floor(density * 54);
  const cxBias = (seed(pressing, 11) - 0.5) * size * 0.22;
  const cyBias = (seed(pressing, 12) - 0.5) * size * 0.22;

  for (let i = 0; i < largeCount; i += 1) {
    const s = seed(pressing, 100 + i);
    const angle = seed(pressing, 200 + i) * Math.PI * 2;
    const radius = Math.sqrt(seed(pressing, 300 + i)) * size * 0.43;
    const x = size / 2 + Math.cos(angle) * radius + cxBias * 0.3;
    const y = size / 2 + Math.sin(angle) * radius + cyBias * 0.3;
    const blob = size * (0.025 + s * 0.056);
    drawIrregularBlob(
      ctx,
      { x, y },
      blob,
      seed(pressing, 400 + i),
      i % 4 === 0 ? accent : secondary,
      0.66 + seed(pressing, 500 + i) * 0.3,
    );
  }

  for (let i = 0; i < tinyCount; i += 1) {
    const angle = seed(pressing, 700 + i) * Math.PI * 2;
    const radius = Math.sqrt(seed(pressing, 800 + i)) * size * 0.49;
    const x = size / 2 + Math.cos(angle) * radius + cxBias;
    const y = size / 2 + Math.sin(angle) * radius + cyBias;
    const blob = size * (0.005 + seed(pressing, 900 + i) * 0.018);
    drawIrregularBlob(
      ctx,
      { x, y },
      blob,
      seed(pressing, 1000 + i),
      i % 5 === 0 ? accent : secondary,
      0.35 + seed(pressing, 1100 + i) * 0.4,
    );
  }

  addRadialPressStreaks(ctx, pressing, size, secondary, accent, 9);
}

function bakeColorInColor(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, deep, edge],
    [0, 0.48, 0.82, 1],
    pressing.material.alpha,
  );
  addSmokeVeils(ctx, pressing, size, primary, secondary, 8);
  addDraggedVeins(ctx, pressing, size, accent, secondary, 8);
  const island = {
    x: size * (0.5 + (seed(pressing, 350) - 0.5) * 0.18),
    y: size * (0.5 + (seed(pressing, 351) - 0.5) * 0.18),
  };
  drawIrregularBlob(
    ctx,
    island,
    size * 0.18,
    seed(pressing, 352),
    accent,
    0.42,
  );
}

function bakeMerge(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, edge } = pressing.colors;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const center = size / 2;
  const splitAngle = seed(pressing, 140) * Math.PI * 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const r = Math.sqrt(dx * dx + dy * dy);
      const index = (y * size + x) * 4;
      if (r > 1) {
        data[index + 3] = 0;
        continue;
      }
      const side = Math.cos(Math.atan2(dy, dx) - splitAngle);
      const seamNoise =
        fbm(dx * 4.0, dy * 4.0, pressing.seedHash ^ 0x6612, 3) - 0.5;
      const mix = smoothstep(-0.17, 0.17, side + seamNoise * 0.38);
      let color = mixColors(primary, secondary, mix);
      color = mixColors(color, accent, (1 - Math.abs(mix - 0.5) * 2) * 0.2);
      color = mixColors(color, deep, smoothstep(0.7, 1, r) * 0.28);
      writeColor(data, index, color, 244);
    }
  }
  ctx.putImageData(image, 0, 0);
  addDraggedVeins(ctx, pressing, size, accent, secondary, 6);
  addRimPass(ctx, size, edge, 0.22);
}

function bakeGalaxy(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, secondary, accent, deep, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, deep, edge],
    [0, 0.36, 0.7, 1],
    0.92,
  );
  addSmokeVeils(ctx, pressing, size, secondary, accent, 18);
  addDraggedVeins(ctx, pressing, size, accent, highlight, 10);

  for (let i = 0; i < 90; i += 1) {
    const angle = seed(pressing, 2000 + i) * Math.PI * 2;
    const radius = Math.sqrt(seed(pressing, 2100 + i)) * size * 0.49;
    const x = size / 2 + Math.cos(angle) * radius;
    const y = size / 2 + Math.sin(angle) * radius;
    const dot = size * (0.002 + seed(pressing, 2200 + i) * 0.006);
    drawIrregularBlob(
      ctx,
      { x, y },
      dot,
      seed(pressing, 2300 + i),
      i % 3 === 0 ? accent : secondary,
      0.24,
    );
  }
}

function bakeAudiophileBlack(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const { primary, accent, highlight, edge } = pressing.colors;
  fillRadialWax(
    ctx,
    size,
    [highlight, primary, primary, edge],
    [0, 0.3, 0.84, 1],
  );
  addClouds(ctx, pressing, size, primary, accent, 12, 0.035);
  addSubtleWaves(ctx, pressing, size, accent, 0.045);
}

function fillRadialWax(
  ctx: CanvasRenderingContext2D,
  size: number,
  colors: RgbColor[],
  stops: number[],
  alpha = 1,
): void {
  const gradient = ctx.createRadialGradient(
    size * 0.38,
    size * 0.3,
    size * 0.04,
    size / 2,
    size / 2,
    size * 0.53,
  );
  for (let i = 0; i < colors.length; i += 1) {
    gradient.addColorStop(stops[i], rgba(colors[i], alpha));
  }
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function addClouds(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
  a: RgbColor,
  b: RgbColor,
  count: number,
  opacity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  for (let i = 0; i < count; i += 1) {
    const x = size * (0.16 + seed(pressing, 10 + i) * 0.68);
    const y = size * (0.16 + seed(pressing, 30 + i) * 0.68);
    const r = size * (0.08 + seed(pressing, 50 + i) * 0.22);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const color = i % 2 === 0 ? a : b;
    gradient.addColorStop(0, rgba(color, opacity));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function addSmokeVeils(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
  a: RgbColor,
  b: RgbColor,
  count: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = `blur(${Math.max(3, size * 0.012)}px)`;
  for (let i = 0; i < count; i += 1) {
    const angle = seed(pressing, 1200 + i) * Math.PI * 2;
    const r = Math.sqrt(seed(pressing, 1300 + i)) * size * 0.42;
    const x = size / 2 + Math.cos(angle) * r;
    const y = size / 2 + Math.sin(angle) * r;
    const blob = size * (0.045 + seed(pressing, 1400 + i) * 0.13);
    drawIrregularBlob(
      ctx,
      { x, y },
      blob,
      seed(pressing, 1500 + i),
      i % 2 ? a : b,
      0.08 + seed(pressing, 1600 + i) * 0.13,
    );
  }
  ctx.restore();
}

function addDraggedVeins(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
  a: RgbColor,
  b: RgbColor,
  count: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < count; i += 1) {
    const start = seed(pressing, 2400 + i) * Math.PI * 2;
    const arc = (0.18 + seed(pressing, 2500 + i) * 0.74) * Math.PI;
    const radius = size * (0.15 + seed(pressing, 2600 + i) * 0.36);
    const wobble = (seed(pressing, 2700 + i) - 0.5) * size * 0.06;
    ctx.strokeStyle = rgba(
      i % 2 ? a : b,
      0.1 + seed(pressing, 2800 + i) * 0.18,
    );
    ctx.lineWidth = size * (0.006 + seed(pressing, 2900 + i) * 0.02);
    ctx.beginPath();
    for (let step = 0; step <= 28; step += 1) {
      const t = step / 28;
      const angle = start + arc * t;
      const rr =
        radius + Math.sin(t * Math.PI * 2 + seed(pressing, i) * 10) * wobble;
      const x = size / 2 + Math.cos(angle) * rr;
      const y = size / 2 + Math.sin(angle) * rr;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function addRadialPressStreaks(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
  a: RgbColor,
  b: RgbColor,
  count: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (let i = 0; i < count; i += 1) {
    const angle = seed(pressing, 3100 + i) * Math.PI * 2;
    const startR = size * (0.08 + seed(pressing, 3200 + i) * 0.22);
    const endR = size * (0.35 + seed(pressing, 3300 + i) * 0.17);
    const color = i % 2 ? a : b;
    ctx.strokeStyle = rgba(color, 0.08 + seed(pressing, 3400 + i) * 0.12);
    ctx.lineWidth = size * (0.01 + seed(pressing, 3500 + i) * 0.028);
    ctx.beginPath();
    ctx.moveTo(
      size / 2 + Math.cos(angle) * startR,
      size / 2 + Math.sin(angle) * startR,
    );
    ctx.lineTo(
      size / 2 + Math.cos(angle + 0.06) * endR,
      size / 2 + Math.sin(angle + 0.06) * endR,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function addSubtleWaves(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
  color: RgbColor,
  opacity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.strokeStyle = rgba(color, opacity);
  ctx.lineWidth = Math.max(1, size * 0.003);
  for (let i = 0; i < 12; i += 1) {
    const radius = size * (0.18 + i * 0.028 + seed(pressing, 4300 + i) * 0.01);
    ctx.beginPath();
    ctx.arc(
      size / 2,
      size / 2,
      radius,
      seed(pressing, i) * Math.PI,
      Math.PI * 2 + seed(pressing, i + 1) * Math.PI,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function addRimPass(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: RgbColor,
  opacity: number,
): void {
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.32,
    size / 2,
    size / 2,
    size * 0.52,
  );
  gradient.addColorStop(0, rgba(color, 0));
  gradient.addColorStop(0.74, rgba(color, opacity * 0.4));
  gradient.addColorStop(1, rgba(color, opacity));
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}

function drawIrregularBlob(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  localSeed: number,
  color: RgbColor,
  opacity: number,
): void {
  const points = 9 + Math.floor(localSeed * 9);
  const rot = localSeed * Math.PI * 2;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rot);
  ctx.scale(1 + (localSeed - 0.5) * 0.6, 0.65 + localSeed * 0.8);
  ctx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const t = (i % points) / points;
    const angle = t * Math.PI * 2;
    const wobble = 0.68 + hashNoise(localSeed * 1000 + i * 17) * 0.62;
    const x = Math.cos(angle) * radius * wobble;
    const y = Math.sin(angle) * radius * wobble;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const gradient = ctx.createRadialGradient(
    0,
    0,
    radius * 0.05,
    0,
    0,
    radius * 1.35,
  );
  gradient.addColorStop(0, rgba(color, opacity));
  gradient.addColorStop(0.65, rgba(color, opacity * 0.68));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

function punchDiscAlpha(
  ctx: CanvasRenderingContext2D,
  size: number,
  pressing: VinylPressing,
): void {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const center = size / 2;
  const edgeSoftness = size * 0.016;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const r = Math.sqrt(dx * dx + dy * dy);
      const index = (y * size + x) * 4;
      const outer = smoothstep(size * 0.5, size * 0.5 - edgeSoftness, r);
      const thickness = smoothstep(size * 0.18, size * 0.5, r);
      const alphaBase = pressing.material.alpha;
      const alpha = clamp((alphaBase + thickness * 0.18) * outer, 0, 1);
      data[index + 3] = Math.round(data[index + 3] * alpha);
    }
  }

  ctx.putImageData(image, 0, 0);
}

function addVinylMicroGrain(
  ctx: CanvasRenderingContext2D,
  pressing: VinylPressing,
  size: number,
): void {
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  const center = size / 2;
  const strength = 4 + pressing.material.roughness * 10;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      if (data[index + 3] === 0) continue;
      const dx = (x - center) / center;
      const dy = (y - center) / center;
      const n = fbm(dx * 48, dy * 48, pressing.seedHash ^ 0xa11ce, 2) - 0.5;
      const delta = n * strength;
      data[index] = clampByte(data[index] + delta);
      data[index + 1] = clampByte(data[index + 1] + delta);
      data[index + 2] = clampByte(data[index + 2] + delta);
    }
  }

  ctx.putImageData(image, 0, 0);
}

function writeColor(
  data: Uint8ClampedArray,
  index: number,
  color: RgbColor,
  alpha: number,
): void {
  data[index] = color.r;
  data[index + 1] = color.g;
  data[index + 2] = color.b;
  data[index + 3] = alpha;
}

function seed(pressing: VinylPressing, salt: number): number {
  return seededUnit(
    (pressing.seedHash ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0,
  );
}

function hashNoise(value: number): number {
  const x = Math.sin(value * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function fbm(x: number, y: number, seedValue: number, octaves: number): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let i = 0; i < octaves; i += 1) {
    value +=
      valueNoise(x * frequency, y * frequency, seedValue + i * 101) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / total;
}

function valueNoise(x: number, y: number, seedValue: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = rand2(xi, yi, seedValue);
  const b = rand2(xi + 1, yi, seedValue);
  const c = rand2(xi, yi + 1, seedValue);
  const d = rand2(xi + 1, yi + 1, seedValue);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function rand2(x: number, y: number, seedValue: number): number {
  return hashNoise(x * 127.1 + y * 311.7 + seedValue * 0.013);
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgba(color: RgbColor, alpha: number): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}
