// src/lib/vinyl/shaders/vinyl.frag.ts

export const VINYL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uWaxMap;
uniform sampler2D uArtwork;
uniform bool uHasArtwork;
uniform vec2 uMouse;
uniform float uRotation;
uniform float uVelocity;
uniform float uSeed;
uniform float uTime;
uniform int uRecipeId;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;
uniform vec3 uDeep;
uniform vec3 uHighlight;
uniform float uTranslucency;
uniform float uRoughness;
uniform float uGrooveIntensity;
uniform float uDiffraction;
uniform float uRimAbsorption;
uniform float uAlpha;
uniform float uSmokeDensity;

const float PI = 3.14159265358979323846264;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(p) * amp;
    p = mat2(1.62, -1.18, 1.18, 1.62) * p + 0.13;
    amp *= 0.52;
  }
  return value;
}

vec3 spectral(float t) {
  t = fract(t);
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
  return pow(c, vec3(1.8));
}

float ringMask(float r, float center, float width) {
  return 1.0 - smoothstep(width, width * 2.0, abs(r - center));
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float r = length(p) * 2.0;

  if (r > 1.0) {
    discard;
  }

  float angle = atan(p.y, p.x);
  float rotationRad = radians(uRotation);
  float matAngle = angle;
  vec2 polar = vec2(matAngle / PI, r);
  vec4 wax = texture(uWaxMap, uv);
  vec3 color = wax.rgb;
  float bakedAlpha = wax.a;

  // Fixed material impurity noise. It is not time-animated; the DOM rotation
  // moves the disc, while this shader only changes how light catches it.
  float large = fbm(vec2(cos(angle) * 1.8, sin(angle) * 1.8) + r * 1.2 + uSeed * 0.07);
  float fine = fbm(uv * 96.0 + uSeed * 0.17);
  color *= 0.96 + large * 0.08 + (fine - 0.5) * uRoughness * 0.11;

  // Translucent records reveal a ghost of the artwork. Kept subtle: it should
  // read as optical material depth, not pasted album art.
  if (uHasArtwork && uTranslucency > 0.08) {
    vec2 artUv = uv;
    float ghostBlur = 0.0;
    vec3 art = texture(uArtwork, artUv).rgb * 0.34;
    art += texture(uArtwork, artUv + vec2(0.012, 0.0)).rgb * 0.16;
    art += texture(uArtwork, artUv - vec2(0.012, 0.0)).rgb * 0.16;
    art += texture(uArtwork, artUv + vec2(0.0, 0.012)).rgb * 0.16;
    art += texture(uArtwork, artUv - vec2(0.0, 0.012)).rgb * 0.16;
    float ghostStrength = smoothstep(0.18, 0.86, uTranslucency) * (0.10 + 0.13 * (1.0 - smoothstep(0.72, 1.0, r)));
    color = mix(color, art, ghostStrength);
  }

  // Optical thickness: translucent vinyl is denser/darker at the outer rim and
  // around the label boundary, where there is more perceived material depth.
  float rim = smoothstep(0.66, 1.0, r);
  float labelEdge = ringMask(r, 0.38, 0.035);
  float thickness = clamp(rim * 0.78 + labelEdge * 0.32, 0.0, 1.0);
  color = mix(color, color * (1.0 - uRimAbsorption * 0.72), thickness * (0.35 + uTranslucency * 0.65));

  // Integrated grooves: modulate the actual wax, not a separate overlay.
  float groovePhase = r * (620.0 + uGrooveIntensity * 260.0) + rotationRad * 0.52;
  float grooveWave = sin(groovePhase + sin(r * 21.0 + uSeed) * 0.28);
  float grooveRidge = smoothstep(0.16, 0.84, grooveWave * 0.5 + 0.5);
  float grooveFine = sin(r * 1340.0 + rotationRad * 0.23 + fine * 0.55) * 0.5 + 0.5;
  float groove = mix(grooveRidge, grooveFine, 0.28) * uGrooveIntensity;
  color *= 0.90 + groove * 0.10;

  // Tangential anisotropic light response. Highlights stretch around grooves
  // instead of sitting as a flat radial/conic CSS sheen.
  vec2 tangent = normalize(vec2(-p.y, p.x) + 0.0001);
  vec2 radial = normalize(p + 0.0001);
  vec2 mouse = normalize(uMouse - 0.5 + vec2(0.0001));
  vec2 studioLight = normalize(vec2(-0.32, -0.88));
  float mouseSpec = pow(max(dot(reflect(-mouse, radial), tangent), 0.0), 18.0 - uRoughness * 7.0);
  float studioSpec = pow(max(dot(studioLight, tangent), 0.0), 22.0 - uRoughness * 8.0);
  float ridgeSpec = (0.18 + groove * 0.95) * (mouseSpec * 0.72 + studioSpec * 0.5);

  // Diffraction: intentionally restrained. It should flash at groove angles,
  // not become a rainbow sticker.
  float diffractionPhase = dot(tangent, studioLight) * 0.5 + r * 5.2 + rotationRad * 0.08 + fine * 0.22;
  vec3 rainbow = spectral(diffractionPhase);
  color += rainbow * ridgeSpec * uDiffraction * 0.34;
  color += uHighlight * ridgeSpec * (0.16 + uDiffraction * 0.18);

  // Recipe-specific final taste shaping.
  if (uRecipeId == 7) { // galaxy
    float stars = smoothstep(0.985, 1.0, noise(uv * 170.0 + uSeed));
    color += (uAccent + vec3(0.25, 0.35, 0.55)) * stars * 0.32;
    color = mix(color, color * vec3(0.78, 0.84, 1.18), 0.14);
  } else if (uRecipeId == 8) { // audiophile-black
    color = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))), 0.42);
    color += uAccent * ridgeSpec * 0.08;
  } else if (uRecipeId == 4) { // splatter
    color += uSecondary * max(groove - 0.6, 0.0) * 0.025;
  } else if (uRecipeId == 2) { // smoke
    color = mix(color, color * (0.88 + large * 0.24), uSmokeDensity * 0.22);
  }

  // Subtle dish depth and outer edge.
  float dish = ringMask(r, 0.42, 0.18) * 0.08;
  color *= 1.0 - dish;
  color *= 1.0 - smoothstep(0.92, 1.0, r) * 0.36;

  float alpha = bakedAlpha * mix(1.0, uAlpha, uTranslucency);
  alpha *= smoothstep(1.0, 0.985, r);
  outColor = vec4(color, alpha);
}
`;
