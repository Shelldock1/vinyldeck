import { useEffect } from "react";
import type { RefObject } from "react";

const TABBABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]",
].join(",");

// Open surfaces stack up (Crate can open over Settings); only the top one traps.
const trapStack: symbol[] = [];

/** Index to focus after Tab / Shift+Tab, wrapping at both ends. -1 = outside. */
export function nextTrapIndex(count: number, current: number, backward: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backward ? count - 1 : 0;
  if (backward) return current === 0 ? count - 1 : current - 1;
  return current === count - 1 ? 0 : current + 1;
}

function tabbablesIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
}

/**
 * Keeps Tab inside `containerRef` while `active`, focuses `initialFocusRef`
 * (or the first tabbable) on open, and returns focus to whatever opened it.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const id = Symbol("focus-trap");
    trapStack.push(id);
    const opener =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (container) {
      const initial = initialFocusRef?.current ?? tabbablesIn(container)[0];
      initial?.focus({ preventScroll: true });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || trapStack[trapStack.length - 1] !== id) return;
      const root = containerRef.current;
      if (!root) return;
      const items = tabbablesIn(root);
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = nextTrapIndex(items.length, current, event.shiftKey);
      event.preventDefault();
      if (next >= 0) items[next].focus();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      const index = trapStack.indexOf(id);
      if (index >= 0) trapStack.splice(index, 1);
      if (opener && opener !== document.body && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
    // Refs are stable; re-run only when the surface opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
