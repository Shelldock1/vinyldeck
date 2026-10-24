// src/hooks/useFitScale.ts
// Shrinks a fixed-size layout to fit the window instead of letting it clip.
// The deck is laid out at its natural pixel size; this returns the uniform
// scale (never above 1) that keeps it inside the viewport minus the given
// reserve. Layout size (offsetWidth/Height) ignores transforms, so applying
// the result as `transform: scale()` cannot feed back into the measurement.

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

/** Below this the deck is unreadable anyway; let it clip instead. */
const MIN_SCALE = 0.5;

export function fitScale(
  natural: { width: number; height: number },
  available: { width: number; height: number },
): number {
  if (natural.width <= 0 || natural.height <= 0) return 1;
  const scale = Math.min(
    1,
    available.width / natural.width,
    available.height / natural.height,
  );
  if (!Number.isFinite(scale)) return 1;
  return Math.max(MIN_SCALE, Math.round(scale * 1000) / 1000);
}

export function useFitScale(
  ref: RefObject<HTMLElement | null>,
  reserve: { x: number; y: number },
): number {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    function update() {
      if (!node) return;
      setScale(
        fitScale(
          { width: node.offsetWidth, height: node.offsetHeight },
          {
            width: window.innerWidth - reserve.x,
            height: window.innerHeight - reserve.y,
          },
        ),
      );
    }

    update();
    window.addEventListener("resize", update);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [ref, reserve.x, reserve.y]);

  return scale;
}
