import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Kbd } from "../Kbd";
import "./AppContextMenu.css";

export interface AppContextMenuAction {
  id: string;
  label: string;
  kbd?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

interface AppContextMenuProps {
  actions: AppContextMenuAction[];
}

interface MenuPoint {
  x: number;
  y: number;
}

const MENU_WIDTH = 216;
const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

export function AppContextMenu({ actions }: AppContextMenuProps) {
  const [point, setPoint] = useState<MenuPoint | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const enabledIndexes = useMemo(
    () =>
      actions
        .map((action, index) => (action.disabled ? -1 : index))
        .filter((index) => index >= 0),
    [actions],
  );

  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      if (shouldUseNativeMenu(event.target)) return;

      event.preventDefault();
      const nextPoint = clampMenuPoint(event.clientX, event.clientY, actions.length);
      setPoint(nextPoint);
      setActiveIndex(enabledIndexes[0] ?? 0);
    }

    function handlePointerDown(event: PointerEvent) {
      if (!point) return;
      if (menuRef.current?.contains(event.target as Node)) return;
      setPoint(null);
    }

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [actions.length, enabledIndexes, point]);

  useEffect(() => {
    if (point) menuRef.current?.focus();
  }, [point]);

  if (!point) return null;

  function selectAction(action: AppContextMenuAction) {
    if (action.disabled) return;
    setPoint(null);
    action.onSelect();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setPoint(null);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectAction(actions[activeIndex]);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const currentEnabledIndex = enabledIndexes.indexOf(activeIndex);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextEnabledIndex =
      (currentEnabledIndex + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextEnabledIndex] ?? activeIndex);
  }

  return (
    <div
      ref={menuRef}
      className="app-context-menu"
      role="menu"
      tabIndex={-1}
      style={{ left: point.x, top: point.y }}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setActiveIndex(enabledIndexes[0] ?? 0)}
    >
      {actions.map((action, index) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className={`app-context-menu__item${index === activeIndex ? " app-context-menu__item--active" : ""}${action.destructive ? " app-context-menu__item--destructive" : ""}`}
          disabled={action.disabled}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectAction(action)}
        >
          <span>{action.label}</span>
          {action.kbd ? <Kbd>{action.kbd}</Kbd> : null}
        </button>
      ))}
    </div>
  );
}

function clampMenuPoint(x: number, y: number, actionCount: number): MenuPoint {
  const height = MENU_PADDING * 2 + actionCount * MENU_ITEM_HEIGHT;
  return {
    x: Math.max(10, Math.min(x, window.innerWidth - MENU_WIDTH - 10)),
    y: Math.max(10, Math.min(y, window.innerHeight - height - 10)),
  };
}

function shouldUseNativeMenu(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]"));
}
