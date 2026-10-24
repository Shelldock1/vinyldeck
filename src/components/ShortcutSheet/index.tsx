// src/components/ShortcutSheet/index.tsx
// Keyboard cheat sheet: the README Controls table, rendered from SHORTCUTS.
// Read-only surface; Escape is owned by useKeyboardShortcuts.

import { Fragment, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { SHORTCUTS, SHORTCUT_GROUPS } from "../../lib/shortcuts";
import { useT } from "../../lib/i18n";
import { Kbd } from "../Kbd";
import "./ShortcutSheet.css";

interface ShortcutSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutSheet({ open, onClose }: ShortcutSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const t = useT();

  useFocusTrap(overlayRef, open, closeRef);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="shortcut-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={t.shortcuts.title}
    >
      <button
        type="button"
        className="shortcut-sheet__scrim"
        aria-label={t.shortcuts.close}
        tabIndex={-1}
        onClick={onClose}
      />

      <motion.section
        className="shortcut-sheet__panel"
        initial={
          reduceMotion ? false : { opacity: 0, scale: 0.97, y: 10 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", duration: 0.24, bounce: 0.12 }
        }
      >
        <header className="shortcut-sheet__header">
          <div className="shortcut-sheet__heading">
            <span className="shortcut-sheet__eyebrow">{t.shortcuts.eyebrow}</span>
            <h2 className="shortcut-sheet__title">{t.shortcuts.title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="shortcut-sheet__close"
            aria-label={t.shortcuts.close}
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className="shortcut-sheet__columns">
          {SHORTCUT_GROUPS.map((group) => {
            const id = `shortcut-sheet-${group.toLowerCase()}`;
            return (
              <section
                key={group}
                className="shortcut-sheet__group"
                aria-labelledby={id}
              >
                <h3 id={id} className="shortcut-sheet__group-label">
                  {t.shortcuts.groups[group]}
                </h3>
                <ul className="shortcut-sheet__list">
                  {SHORTCUTS.filter((shortcut) => shortcut.group === group).map(
                    (shortcut) => (
                      <li key={shortcut.id} className="shortcut-sheet__row">
                        <span className="shortcut-sheet__action">
                          {t.shortcuts.actions[shortcut.id] ?? shortcut.action}
                        </span>
                        <KeyCombo combo={shortcut.key} />
                      </li>
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="shortcut-sheet__footer">
          <p className="shortcut-sheet__hint">
            {t.shortcuts.hintPress} <Kbd className="shortcut-sheet__keycap">?</Kbd>{" "}
            {t.shortcuts.hintOr} <Kbd className="shortcut-sheet__keycap">Esc</Kbd>{" "}
            {t.shortcuts.hintToClose}
          </p>
        </footer>
      </motion.section>
    </div>
  );
}

function KeyCombo({ combo }: { combo: string }) {
  return (
    <span className="shortcut-sheet__keys">
      {combo.split("+").map((part, index) => (
        <Fragment key={`${part}-${index}`}>
          <Kbd className="shortcut-sheet__keycap">{part}</Kbd>
        </Fragment>
      ))}
    </span>
  );
}
