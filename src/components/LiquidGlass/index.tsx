// src/components/LiquidGlass/index.tsx
// VinylDeck-native material primitive.
// Glass theme: aggressive optical stack with screen-space refractive field.
// Noir theme: same DOM primitive, but CSS collapses it into matte lacquer/velvet.

import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import "./LiquidGlass.css";

export type LiquidGlassVariant = "panel" | "dock" | "pill" | "button" | "icon";
export type LiquidGlassIntensity = "subtle" | "normal" | "strong" | "debug";

interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: LiquidGlassVariant;
  intensity?: LiquidGlassIntensity;
  contentClassName?: string;
  asLayout?: boolean;
}

export function LiquidGlassFilters() {
  return (
    <svg
      className="liquid-glass-filter-defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Large-scale optical bend: intentionally strong for the Glass test pass. */}
        <filter
          id="vinyldeck-liquid-refract"
          x="-36%"
          y="-36%"
          width="172%"
          height="172%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.002 0.006"
            numOctaves="1"
            seed="17"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="4.6" result="softMap" />
          <feComponentTransfer in="softMap" result="mappedMap">
            <feFuncR type="gamma" amplitude="1.42" exponent="9" offset="0.42" />
            <feFuncG type="gamma" amplitude="1.0" exponent="7" offset="0.20" />
            <feFuncB type="gamma" amplitude="1.12" exponent="8" offset="0.34" />
          </feComponentTransfer>
          <feDisplacementMap
            in="SourceGraphic"
            in2="mappedMap"
            scale="220"
            xChannelSelector="R"
            yChannelSelector="G"
            result="refracted"
          />
          <feGaussianBlur in="refracted" stdDeviation="0.42" result="softRefracted" />
          <feColorMatrix
            in="softRefracted"
            type="matrix"
            values="1.06 0 0 0 0  0 1.07 0 0 0  0 0 1.10 0 0  0 0 0 1 0"
          />
        </filter>

        {/* Backward-compatible alias used by older chrome pseudo-elements. */}
        <filter
          id="vinyldeck-liquid-bend"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.003 0.008"
            numOctaves="1"
            seed="17"
            result="bendNoise"
          />
          <feGaussianBlur in="bendNoise" stdDeviation="4" result="bendSoft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="bendSoft"
            scale="150"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Tight glass edge/rim deformation. */}
        <filter
          id="vinyldeck-liquid-edge"
          x="-24%"
          y="-24%"
          width="148%"
          height="148%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045 0.055"
            numOctaves="1"
            seed="1"
            result="edgeNoise"
          />
          <feGaussianBlur in="edgeNoise" stdDeviation="1.8" result="edgeMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeMap"
            scale="58"
            xChannelSelector="R"
            yChannelSelector="B"
            result="edgeDistort"
          />
          <feGaussianBlur in="edgeDistort" stdDeviation="0.65" />
        </filter>

        {/* Settings-panel lens: broad low-frequency refraction for large glass sheets. */}
        <filter
          id="vinyldeck-settings-panel-lens"
          x="-38%"
          y="-38%"
          width="176%"
          height="176%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0018 0.0048"
            numOctaves="1"
            seed="29"
            result="panelNoise"
          />
          <feGaussianBlur in="panelNoise" stdDeviation="5.2" result="panelMap" />
          <feComponentTransfer in="panelMap" result="panelLensMap">
            <feFuncR type="gamma" amplitude="1.55" exponent="8" offset="0.34" />
            <feFuncG type="gamma" amplitude="1.22" exponent="7" offset="0.24" />
            <feFuncB type="gamma" amplitude="1.34" exponent="7" offset="0.3" />
          </feComponentTransfer>
          <feDisplacementMap
            in="SourceGraphic"
            in2="panelLensMap"
            scale="280"
            xChannelSelector="R"
            yChannelSelector="G"
            result="panelBent"
          />
          <feGaussianBlur in="panelBent" stdDeviation="0.55" result="panelSoftBent" />
          <feColorMatrix
            in="panelSoftBent"
            type="matrix"
            values="1.04 0 0 0 0  0 1.06 0 0 0  0 0 1.09 0 0  0 0 0 1 0"
          />
        </filter>

        {/* Wet specular response. */}
        <filter
          id="vinyldeck-liquid-specular"
          x="-36%"
          y="-36%"
          width="172%"
          height="172%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.022"
            numOctaves="2"
            seed="43"
            result="specNoise"
          />
          <feGaussianBlur in="specNoise" stdDeviation="3.6" result="softSpec" />
          <feSpecularLighting
            in="softSpec"
            surfaceScale="9"
            specularConstant="1.45"
            specularExponent="130"
            lightingColor="#ffffff"
            result="specLight"
          >
            <fePointLight x="-220" y="-240" z="360" />
          </feSpecularLighting>
          <feComposite in="specLight" in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

export const LiquidGlass = forwardRef<HTMLDivElement, LiquidGlassProps>(
  (
    {
      children,
      className = "",
      contentClassName = "",
      variant = "panel",
      intensity = "normal",
      asLayout = false,
      ...props
    },
    ref,
  ) => {
    const classes = [
      "liquid-glass",
      `liquid-glass--${variant}`,
      `liquid-glass--${intensity}`,
      asLayout ? "liquid-glass--as-layout" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={classes} {...props}>
        <div className="liquid-glass__refract" aria-hidden="true" />
        <div className="liquid-glass__bend" aria-hidden="true" />
        <div className="liquid-glass__face" aria-hidden="true" />
        <div className="liquid-glass__edge" aria-hidden="true" />
        <div className="liquid-glass__specular" aria-hidden="true" />
        <div className={`liquid-glass__content ${contentClassName}`.trim()}>
          {children}
        </div>
      </div>
    );
  },
);

LiquidGlass.displayName = "LiquidGlass";
