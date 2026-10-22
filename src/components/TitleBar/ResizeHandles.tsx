import type { MouseEvent } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./TitleBar.css";

type Direction =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const HANDLES: Array<{ direction: Direction; className: string }> = [
  { direction: "North", className: "edge-n" },
  { direction: "South", className: "edge-s" },
  { direction: "East", className: "edge-e" },
  { direction: "West", className: "edge-w" },
  { direction: "NorthEast", className: "corner-ne" },
  { direction: "NorthWest", className: "corner-nw" },
  { direction: "SouthEast", className: "corner-se" },
  { direction: "SouthWest", className: "corner-sw" },
];

/**
 * The window is frameless, so the desktop no longer provides resize borders.
 * These invisible strips call back into Tauri to start a native resize drag.
 */
export function ResizeHandles({ visible }: { visible: boolean }) {
  if (!visible || !isTauri()) return null;

  const appWindow = getCurrentWindow();

  function handleMouseDown(direction: Direction) {
    return (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      void appWindow.startResizeDragging(direction).catch((error) => {
        console.warn("[ResizeHandles] resize drag failed:", error);
      });
    };
  }

  return (
    <>
      {HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          className={`window-resize-handle ${className}`}
          onMouseDown={handleMouseDown(direction)}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
