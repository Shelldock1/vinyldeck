// src/components/Crate/index.tsx
// The Crate: every album VinylDeck has played, pressed as its own record.
// Dig through sleeves, pull a record out to read its pressing card.
// Read-only view over the collection store; pressing and play counting
// happen elsewhere (useCratePressing + backend poller).

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCrateStore } from "../../lib/collection";
import {
  formatPressingNumber,
  rarityFor,
  rarityRank,
  wearFor,
} from "../../lib/collection/records";
import type { CollectedRecord } from "../../lib/collection/types";
import { CrateDisc } from "./CrateDisc";
import "../VinylRecord/wear.css";
import "./Crate.css";

type SortId = "recent" | "plays" | "rarity" | "number";

const SORTS: { id: SortId; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "plays", label: "Most played" },
  { id: "rarity", label: "Rarest" },
  { id: "number", label: "Pressing order" },
];

const RARITY_LABEL = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
} as const;

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const HINT_MS = 4000;
// Once per app session: the hint is for discovery, not a nag.
let hintSeen = false;

function lastTouched(record: CollectedRecord): number {
  return record.lastPlayedAt ?? record.firstPressedAt;
}

function sortRecords(records: CollectedRecord[], sort: SortId): CollectedRecord[] {
  const sorted = [...records];
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => lastTouched(b) - lastTouched(a));
    case "plays":
      return sorted.sort((a, b) => b.playCount - a.playCount || lastTouched(b) - lastTouched(a));
    case "rarity":
      return sorted.sort(
        (a, b) => rarityRank(b.recipe) - rarityRank(a.recipe) || b.playCount - a.playCount,
      );
    case "number":
      return sorted.sort((a, b) => a.pressingNumber - b.pressingNumber);
  }
}

function sleeveStyle(record: CollectedRecord): CSSProperties | undefined {
  if (record.thumbnail) return { backgroundImage: `url(${record.thumbnail})` };
  if (!record.colors) return undefined;
  // No artwork seen yet: a plain printed sleeve in the pressing's colors.
  return {
    "--crate-sleeve-a": record.colors.secondary,
    "--crate-sleeve-b": record.colors.primary,
  } as CSSProperties;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

interface CrateProps {
  open: boolean;
  onClose: () => void;
  /** Record to pull out first (usually what's playing). */
  focusKey?: string | null;
}

export function Crate({ open, onClose, focusKey = null }: CrateProps) {
  const recordsByKey = useCrateStore((state) => state.records);
  const [sort, setSort] = useState<SortId>("recent");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  const records = useMemo(() => Object.values(recordsByKey), [recordsByKey]);
  const sorted = useMemo(() => sortRecords(records, sort), [records, sort]);
  const stats = useMemo(
    () => ({
      plays: records.reduce((sum, record) => sum + record.playCount, 0),
      legendary: records.filter((record) => rarityFor(record.recipe) === "legendary").length,
    }),
    [records],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedKey(focusKey && recordsByKey[focusKey] ? focusKey : null);
    closeRef.current?.focus();
    // Only re-focus when the crate opens, not on every record update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasRecords = records.length > 0;
  useEffect(() => {
    // Empty crate already explains itself; save the hint for the shelf.
    if (!open || !hasRecords || hintSeen) return;
    hintSeen = true;
    setShowHint(true);
    const timer = window.setTimeout(() => setShowHint(false), HINT_MS);
    return () => {
      window.clearTimeout(timer);
      setShowHint(false);
    };
  }, [open, hasRecords]);

  // Own Escape handler: global shortcuts ignore keys while a button has focus.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const selected =
    (selectedKey && recordsByKey[selectedKey]) || sorted[0] || null;

  return (
    <div className="crate-overlay" role="dialog" aria-modal="true" aria-label="The Crate">
      <button
        type="button"
        className="crate-overlay__scrim"
        aria-label="Close crate"
        tabIndex={-1}
        onClick={onClose}
      />

      <section className="crate-panel">
        <header className="crate-panel__header">
          <div className="crate-panel__heading">
            <span className="crate-panel__eyebrow">The Crate</span>
            <h2 className="crate-panel__title">Your collection</h2>
          </div>
          <dl className="crate-panel__stats">
            <div>
              <dt>Records</dt>
              <dd>{records.length}</dd>
            </div>
            <div>
              <dt>Plays</dt>
              <dd>{stats.plays}</dd>
            </div>
            <div>
              <dt>Legendary</dt>
              <dd>{stats.legendary}</dd>
            </div>
          </dl>
          <button
            ref={closeRef}
            type="button"
            className="crate-panel__close"
            aria-label="Close crate"
            onClick={onClose}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {records.length === 0 ? (
          <div className="crate-panel__empty">
            <CrateEmptyArt />
            <p className="crate-panel__empty-title">The crate is empty</p>
            <p className="crate-panel__empty-copy">
              Play any album. VinylDeck presses a one-of-a-kind copy for it,
              and every listen leaves its mark.
            </p>
          </div>
        ) : (
          <div className="crate-panel__body">
            <div className="crate-panel__browse">
              <div className="crate-sort" role="tablist" aria-label="Sort records">
                {SORTS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={sort === option.id}
                    className={`crate-sort__tab${sort === option.id ? " crate-sort__tab--active" : ""}`}
                    onClick={() => setSort(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
                <AnimatePresence>
                  {showHint && (
                    <motion.span
                      className="crate-sort__hint"
                      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
                      animate={{ opacity: 0.6, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: reduceMotion ? 0 : 0.6,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      Every album you play lands here
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <ul
                className="crate-grid"
                onScroll={showHint ? () => setShowHint(false) : undefined}
              >
                {sorted.map((record) => (
                  <li key={record.key}>
                    <button
                      type="button"
                      className={`crate-card${selected?.key === record.key ? " crate-card--selected" : ""}`}
                      data-rarity={rarityFor(record.recipe)}
                      aria-pressed={selected?.key === record.key}
                      aria-label={`${record.album} by ${record.artist || "Unknown artist"}`}
                      onClick={() => setSelectedKey(record.key)}
                    >
                      <span className="crate-card__stage">
                        <CrateDisc record={record} className="crate-card__disc" />
                        <span
                          className="crate-card__sleeve"
                          style={sleeveStyle(record)}
                        />
                        {rarityRank(record.recipe) >= 2 && (
                          <span className="crate-card__rarity">
                            {RARITY_LABEL[rarityFor(record.recipe)]}
                          </span>
                        )}
                      </span>
                      <span className="crate-card__album">{record.album}</span>
                      <span className="crate-card__meta">
                        {record.artist || "Unknown artist"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {selected && <RecordCard record={selected} />}
          </div>
        )}
      </section>
    </div>
  );
}

function RecordCard({ record }: { record: CollectedRecord }) {
  const rarity = rarityFor(record.recipe);
  const wear = Math.round(wearFor(record.playCount) * 100);

  return (
    <aside className="crate-detail" data-rarity={rarity} aria-live="polite">
      <div className="crate-detail__disc-wrap" key={record.key}>
        <CrateDisc record={record} className="crate-detail__disc" />
      </div>
      <span className="crate-detail__number">{formatPressingNumber(record.pressingNumber)}</span>
      <h3 className="crate-detail__album">{record.album}</h3>
      <p className="crate-detail__artist">{record.artist || "Unknown artist"}</p>
      <span className="crate-detail__rarity">{RARITY_LABEL[rarity]}</span>
      <dl className="crate-detail__facts">
        <div>
          <dt>Pressing</dt>
          <dd>{record.pressingName ?? "Awaiting artwork"}</dd>
        </div>
        <div>
          <dt>First pressed</dt>
          <dd>{dateFormat.format(record.firstPressedAt)}</dd>
        </div>
        <div>
          <dt>Last spin</dt>
          <dd>{record.lastPlayedAt ? dateFormat.format(record.lastPlayedAt) : "Not yet"}</dd>
        </div>
        <div>
          <dt>Played</dt>
          <dd>{plural(record.playCount, "time")}</dd>
        </div>
        <div>
          <dt>Wear</dt>
          <dd>
            <span className="crate-detail__wear" style={{ "--wear": `${wear}%` } as CSSProperties} />
            {wear === 0 ? "Mint" : `${wear}%`}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function CrateEmptyArt() {
  return (
    <svg className="crate-panel__empty-art" width="96" height="72" viewBox="0 0 96 72" fill="none" aria-hidden="true">
      <circle cx="58" cy="30" r="24" stroke="currentColor" strokeOpacity="0.35" />
      <circle cx="58" cy="30" r="8" stroke="currentColor" strokeOpacity="0.35" />
      <circle cx="38" cy="30" r="24" stroke="currentColor" strokeOpacity="0.55" />
      <circle cx="38" cy="30" r="8" stroke="currentColor" strokeOpacity="0.55" />
      <path d="M6 40h84v26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V40Z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.7" />
      <path d="M6 52h84" stroke="currentColor" strokeOpacity="0.3" />
    </svg>
  );
}
