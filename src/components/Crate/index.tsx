// src/components/Crate/index.tsx
// The Crate: every album VinylDeck has played, pressed as its own record.
// Dig through sleeves, pull a record out to read its pressing card.
// Read-only view over the collection store; pressing and play counting
// happen elsewhere (useCratePressing + backend poller).

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useCrateStore } from "../../lib/collection";
import {
  collectionStats,
  filterRecords,
  formatPressingNumber,
  rarityFor,
  rarityRank,
  sortRecords,
  wearFor,
} from "../../lib/collection/records";
import type { CrateSort } from "../../lib/collection/records";
import type { CollectedRecord } from "../../lib/collection/types";
import { CrateDisc } from "./CrateDisc";
import { CrateWrapped } from "./CrateWrapped";
import "../VinylRecord/wear.css";
import "./Crate.css";

const SORTS: { id: CrateSort; label: string; short: string }[] = [
  { id: "recent", label: "Recent", short: "Recent" },
  { id: "plays", label: "Most played", short: "Plays" },
  { id: "rarity", label: "Rarest", short: "Rare" },
  { id: "number", label: "Pressing order", short: "Press" },
  { id: "alpha", label: "Artist A–Z", short: "A–Z" },
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
  const [sort, setSort] = useState<CrateSort>("recent");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const lastFadeKey = useRef("");
  const reduceMotion = useReducedMotion();

  const records = useMemo(() => Object.values(recordsByKey), [recordsByKey]);
  const filtered = useMemo(() => filterRecords(records, query), [records, query]);
  const sorted = useMemo(() => sortRecords(filtered, sort), [filtered, sort]);
  const stats = collectionStats(records);

  useEffect(() => {
    if (!open) {
      // Clear while closed so reopening never flashes a stale filtered shelf.
      setQuery("");
      setWrappedOpen(false);
      lastFadeKey.current = "";
      return;
    }
    setSelectedKey(focusKey && recordsByKey[focusKey] ? focusKey : null);
    // Only re-select when the crate opens, not on every record update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape is owned by useKeyboardShortcuts (topmost surface wins).
  useFocusTrap(overlayRef, open, closeRef);

  // Clarify that results changed without remounting the shelf (or its scroll).
  useEffect(() => {
    if (!open) {
      lastFadeKey.current = "";
      return;
    }
    if (reduceMotion) return;
    const node = gridRef.current;
    const key = `${sort}\u0000${query}`;
    if (!node || lastFadeKey.current === key) return;
    const firstPaint = lastFadeKey.current === "";
    lastFadeKey.current = key;
    if (firstPaint) return;
    node.animate?.(
      [{ opacity: 0.55 }, { opacity: 1 }],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [open, query, sort, reduceMotion, sorted.length]);

  if (!open) return null;

  const selected =
    (selectedKey &&
      sorted.some((record) => record.key === selectedKey) &&
      recordsByKey[selectedKey]) ||
    sorted[0] ||
    null;
  const topAlbumTitle = stats.topAlbum
    ? `${stats.topAlbum.album} — ${stats.topAlbum.artist || "Unknown artist"}`
    : undefined;

  return (
    <div ref={overlayRef} className="crate-overlay" role="dialog" aria-modal="true" aria-label="The Crate">
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
          <div className="crate-panel__actions">
            <button
              type="button"
              className="crate-panel__wrapped"
              onClick={() => setWrappedOpen(true)}
            >
              Wrapped
            </button>
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
          </div>
        </header>

        <CrateWrapped open={wrappedOpen} onClose={() => setWrappedOpen(false)} />

        <dl className="crate-panel__stats" aria-label="Collection statistics">
          <div className="crate-panel__stat">
            <dt>Records</dt>
            <dd>{stats.totalRecords}</dd>
          </div>
          <div className="crate-panel__stat">
            <dt>Plays</dt>
            <dd>{stats.totalPlays}</dd>
          </div>
          <div className="crate-panel__stat crate-panel__stat--album">
            <dt>Top album</dt>
            <dd title={topAlbumTitle}>{stats.topAlbum?.album ?? "—"}</dd>
          </div>
          <div className="crate-panel__stat">
            <dt>Streak</dt>
            <dd title={stats.streak > 0 ? `${stats.streak} consecutive days` : "No active streak"}>
              {stats.streak > 0 ? `${stats.streak}d` : "—"}
            </dd>
          </div>
        </dl>

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
              <div className="crate-toolbar">
                <div className="crate-search" role="search" aria-label="Search the crate">
                  <svg
                    className="crate-search__icon"
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    aria-hidden="true"
                  >
                    <circle cx="5.4" cy="5.4" r="4.1" stroke="currentColor" strokeWidth="1.3" fill="none" />
                    <path d="M8.6 8.6l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    aria-label="Search artist or album"
                    placeholder="Search artist or album"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="crate-search__clear"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery("");
                        searchRef.current?.focus();
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="crate-sort" role="group" aria-label="Sort records">
                  {SORTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`crate-sort__tab${sort === option.id ? " crate-sort__tab--active" : ""}`}
                      aria-label={option.label}
                      aria-pressed={sort === option.id}
                      title={option.label}
                      onClick={() => setSort(option.id)}
                    >
                      {option.short}
                    </button>
                  ))}
                </div>

                <p className="crate-visually-hidden" role="status" aria-live="polite">
                  {query.trim() ? `${sorted.length} of ${records.length} records match` : ""}
                </p>
              </div>

              {sorted.length === 0 ? (
                <motion.div
                  className="crate-panel__no-match"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <p className="crate-panel__no-match-title">No records match</p>
                  <p className="crate-panel__no-match-copy">
                    Nothing in the crate matches “{query.trim()}”. Try a different artist,
                    album, or pressing.
                  </p>
                  <button
                    type="button"
                    className="crate-panel__no-match-clear"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    Clear search
                  </button>
                </motion.div>
              ) : (
                <ul ref={gridRef} className="crate-grid" aria-label="Collected records">
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
              )}
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
