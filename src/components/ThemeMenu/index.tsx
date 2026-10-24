// src/components/ThemeMenu/index.tsx
// Scheme switcher: one trigger in the top-left .settings-trigger row and a
// radio menu (Light / Dark / Halloween). Writes through Rust settings; the
// applier sets data-scheme on <html>, so nothing else re-renders.

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../Tooltip";
import {
  SCHEME_IDS,
  applyVisualMode,
  resetAmbientColors,
} from "../../lib/themes/applier";
import type { SchemeId } from "../../lib/themes/applier";
import { useVinylDeckStore } from "../../lib/playback/store";
import { commitSettings } from "../../lib/settings";
import "./ThemeMenu.css";
import { logger } from "../../lib/logger";
import { useT } from "../../lib/i18n";

export function ThemeMenu() {
  const t = useT();
  const scheme = useVinylDeckStore((s) => s.settings.scheme);
  const hydrateSettings = useVinylDeckStore((s) => s.hydrateSettings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const selected = Math.max(0, SCHEME_IDS.indexOf(scheme));
    itemRefs.current[selected]?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
    // Focus only when the menu opens, not on every scheme change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function handleSelect(id: SchemeId) {
    close(true);
    if (id === scheme) return;
    void commitSettings({ scheme: id })
      .then((settings) => {
        hydrateSettings(settings);
        applyVisualMode(settings.theme, settings.ambientMode, settings.scheme);
        if (settings.ambientMode === "off") resetAmbientColors();
      })
      .catch((error) => {
        logger.warn("[Settings] Scheme update failed:", error);
      });
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) =>
      items[(next + items.length) % items.length]?.focus();

    switch (event.key) {
      case "ArrowDown":
        focusAt(index + 1);
        break;
      case "ArrowUp":
        focusAt(index - 1);
        break;
      case "Home":
        focusAt(0);
        break;
      case "End":
        focusAt(items.length - 1);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        setOpen(false);
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div className="theme-menu" ref={rootRef}>
      <Tooltip side="bottom">
        <TooltipTrigger>
          <button
            ref={triggerRef}
            type="button"
            className="settings-trigger theme-menu__trigger"
            aria-label={t.theme.menu}
            aria-haspopup="menu"
            aria-expanded={open}
            data-open={open || undefined}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.55" />
              <path d="M12 3.75v16.5a8.25 8.25 0 0 0 0-16.5Z" fill="currentColor" />
            </svg>
          </button>
        </TooltipTrigger>
        <TooltipContent>{t.theme.menu}</TooltipContent>
      </Tooltip>

      {open && (
        <div
          className="theme-menu__list"
          role="menu"
          aria-label={t.theme.menu}
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {SCHEME_IDS.map((id, index) => {
            const selected = id === scheme;
            return (
              <button
                key={id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                className="theme-menu__item"
                onClick={() => handleSelect(id)}
              >
                <span className={`theme-menu__swatch theme-menu__swatch--${id}`} aria-hidden="true" />
                <span className="theme-menu__label">{t.theme.schemes[id]}</span>
                {selected && (
                  <svg
                    className="theme-menu__check"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
