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
import { getPlayTimes } from "../../lib/collection/wrapped";
import { localeFor, useLanguage, useT } from "../../lib/i18n";
import type { Dict } from "../../lib/i18n";
import {
  collectionStats,
  filterBySource,
  filterRecords,
  formatPressingNumber,
  rarityFor,
  rarityRank,
  sortRecords,
  wearFor,
} from "../../lib/collection/records";
import type { CrateSort } from "../../lib/collection/records";
import type { CollectedRecord, CrateSource } from "../../lib/collection/types";
import { CrateDisc } from "./CrateDisc";
import { CrateWrapped } from "./CrateWrapped";
import "../VinylRecord/wear.css";
import "./Crate.css";

const SORTS: CrateSort[] = ["recent", "plays", "rarity", "number", "alpha"];
const SOURCES: CrateSource[] = ["app", "browser", "all"];

const SOURCE_STORAGE_KEY = "vinyldeck:crate:source";

function readStoredSource(): CrateSource {
  try {
    const stored = window.localStorage.getItem(SOURCE_STORAGE_KEY);
    if (SOURCES.includes(stored as CrateSource)) return stored as CrateSource;
  } catch {
    // Storage blocked: fall back to the music shelf.
  }
  return "app";
}

function storeSource(source: CrateSource) {
  try {
    window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
  } catch {
    // Not persisted; the choice still applies until the crate closes.
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

interface CrateProps {
  open: boolean;
  onClose: () => void;
  /** Record to pull out first (usually what's playing). */
  focusKey?: string | null;
}

export function Crate({ open, onClose, focusKey = null }: CrateProps) {
  const t = useT();
  const recordsByKey = useCrateStore((state) => state.records);
  const [sort, setSort] = useState<CrateSort>("recent");
  const [source, setSource] = useState<CrateSource>(readStoredSource);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [wrappedOpen, setWrappedOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const lastFadeKey = useRef("");
  const reduceMotion = useReducedMotion();

  const allRecords = useMemo(() => Object.values(recordsByKey), [recordsByKey]);
  const records = useMemo(() => filterBySource(allRecords, source), [allRecords, source]);
  const filtered = useMemo(() => filterRecords(records, query), [records, query]);
  const sorted = useMemo(() => sortRecords(filtered, sort), [filtered, sort]);
  const [playTimes, setPlayTimes] = useState<number[]>([]);
  const stats = collectionStats(records, Date.now(), playTimes);

  // The streak needs every listen, not just each record's latest. Refetch when
  // a play lands (the store updates) or the source changes.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void getPlayTimes(source).then((times) => {
      if (alive) setPlayTimes(times);
    });
    return () => {
      alive = false;
    };
  }, [open, source, recordsByKey]);

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
    const key = `${source}\u0000${sort}\u0000${query}`;
    if (!node || lastFadeKey.current === key) return;
    const firstPaint = lastFadeKey.current === "";
    lastFadeKey.current = key;
    if (firstPaint) return;
    node.animate?.(
      [{ opacity: 0.55 }, { opacity: 1 }],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [open, query, sort, source, reduceMotion, sorted.length]);

  if (!open) return null;

  const selected =
    (selectedKey &&
      sorted.some((record) => record.key === selectedKey) &&
      recordsByKey[selectedKey]) ||
    sorted[0] ||
    null;
  const topAlbumTitle = stats.topAlbum
    ? `${stats.topAlbum.album} — ${stats.topAlbum.artist || t.common.unknownArtist}`
    : undefined;

  return (
    <div ref={overlayRef} className="crate-overlay" role="dialog" aria-modal="true" aria-label={t.crate.eyebrow}>
      <button
        type="button"
        className="crate-overlay__scrim"
        aria-label={t.crate.close}
        tabIndex={-1}
        onClick={onClose}
      />

      <section className="crate-panel">
        <header className="crate-panel__header">
          <div className="crate-panel__heading">
            <span className="crate-panel__eyebrow">{t.crate.eyebrow}</span>
            <h2 className="crate-panel__title">{t.crate.title}</h2>
          </div>
          <div className="crate-panel__actions">
            <button
              type="button"
              className="crate-panel__wrapped"
              onClick={() => setWrappedOpen(true)}
            >
              {t.crate.wrapped}
            </button>
            <button
              ref={closeRef}
              type="button"
              className="crate-panel__close"
              aria-label={t.crate.close}
              onClick={onClose}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <CrateWrapped
          open={wrappedOpen}
          onClose={() => setWrappedOpen(false)}
          source={source}
        />

        <div className="crate-sort crate-source" role="group" aria-label={t.crate.sourceGroup}>
          {SOURCES.map((option) => (
            <button
              key={option}
              type="button"
              className={`crate-sort__tab${source === option ? " crate-sort__tab--active" : ""}`}
              aria-pressed={source === option}
              title={t.crate.sources[option].title}
              onClick={() => {
                setSource(option);
                storeSource(option);
              }}
            >
              {t.crate.sources[option].label}
            </button>
          ))}
        </div>

        <dl className="crate-panel__stats" aria-label={t.crate.statsLabel}>
          <div className="crate-panel__stat">
            <dt>{t.crate.records}</dt>
            <dd>{stats.totalRecords}</dd>
          </div>
          <div className="crate-panel__stat">
            <dt>{t.crate.plays}</dt>
            <dd>{stats.totalPlays}</dd>
          </div>
          <div className="crate-panel__stat crate-panel__stat--album">
            <dt>{t.crate.topAlbum}</dt>
            <dd title={topAlbumTitle}>{stats.topAlbum?.album ?? "—"}</dd>
          </div>
          <div className="crate-panel__stat">
            <dt>{t.crate.streak}</dt>
            <dd title={t.crate.streakTitle(stats.streak)}>
              {stats.streak > 0 ? t.crate.streakDays(stats.streak) : "—"}
            </dd>
          </div>
        </dl>

        {records.length === 0 ? (
          <div className="crate-panel__empty">
            <CrateEmptyArt />
            {allRecords.length === 0 ? (
              <>
                <p className="crate-panel__empty-title">{t.crate.emptyTitle}</p>
                <p className="crate-panel__empty-copy">{t.crate.emptyCopy}</p>
              </>
            ) : (
              <>
                <p className="crate-panel__empty-title">{t.crate.emptySourceTitle}</p>
                <p className="crate-panel__empty-copy">
                  {source === "app" ? t.crate.emptyAppCopy : t.crate.emptyBrowserCopy}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="crate-panel__body">
            <div className="crate-panel__browse">
              <div className="crate-toolbar">
                <div className="crate-search" role="search" aria-label={t.crate.searchLabel}>
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
                    aria-label={t.crate.searchPlaceholder}
                    placeholder={t.crate.searchPlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="crate-search__clear"
                      aria-label={t.crate.clearSearch}
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

                <div className="crate-sort" role="group" aria-label={t.crate.sortGroup}>
                  {SORTS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`crate-sort__tab${sort === option ? " crate-sort__tab--active" : ""}`}
                      aria-label={t.crate.sorts[option].label}
                      aria-pressed={sort === option}
                      title={t.crate.sorts[option].label}
                      onClick={() => setSort(option)}
                    >
                      {t.crate.sorts[option].short}
                    </button>
                  ))}
                </div>

                <p className="crate-visually-hidden" role="status" aria-live="polite">
                  {query.trim() ? t.crate.matches(sorted.length, records.length) : ""}
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
                  <p className="crate-panel__no-match-title">{t.crate.noMatchTitle}</p>
                  <p className="crate-panel__no-match-copy">
                    {t.crate.noMatchCopy(query.trim())}
                  </p>
                  <button
                    type="button"
                    className="crate-panel__no-match-clear"
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                  >
                    {t.crate.clearSearch}
                  </button>
                </motion.div>
              ) : (
                <ul ref={gridRef} className="crate-grid" aria-label={t.crate.gridLabel}>
                  {sorted.map((record) => (
                    <li key={record.key}>
                      <button
                        type="button"
                        className={`crate-card${selected?.key === record.key ? " crate-card--selected" : ""}`}
                        data-rarity={rarityFor(record.recipe)}
                        aria-pressed={selected?.key === record.key}
                        aria-label={t.crate.cardLabel(record.album, record.artist || t.common.unknownArtist)}
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
                              {t.crate.rarity[rarityFor(record.recipe)]}
                            </span>
                          )}
                        </span>
                        <span className="crate-card__album">{record.album}</span>
                        <span className="crate-card__meta">
                          {record.artist || t.common.unknownArtist}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected && <RecordCard record={selected} t={t} />}
          </div>
        )}
      </section>
    </div>
  );
}

function RecordCard({ record, t }: { record: CollectedRecord; t: Dict }) {
  const language = useLanguage();
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(localeFor(language), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [language],
  );
  const rarity = rarityFor(record.recipe);
  const wear = Math.round(wearFor(record.playCount) * 100);

  return (
    <aside className="crate-detail" data-rarity={rarity} aria-live="polite">
      <div className="crate-detail__disc-wrap" key={record.key}>
        <CrateDisc record={record} className="crate-detail__disc" />
      </div>
      <span className="crate-detail__number">
        {formatPressingNumber(record.pressingNumber, t.common.numberPrefix)}
      </span>
      <h3 className="crate-detail__album">{record.album}</h3>
      <p className="crate-detail__artist">{record.artist || t.common.unknownArtist}</p>
      <span className="crate-detail__rarity">{t.crate.rarity[rarity]}</span>
      <dl className="crate-detail__facts">
        <div>
          <dt>{t.crate.pressing}</dt>
          <dd>{record.pressingName ?? t.crate.awaitingArtwork}</dd>
        </div>
        <div>
          <dt>{t.crate.firstPressed}</dt>
          <dd>{dateFormat.format(record.firstPressedAt)}</dd>
        </div>
        <div>
          <dt>{t.crate.lastSpin}</dt>
          <dd>{record.lastPlayedAt ? dateFormat.format(record.lastPlayedAt) : t.crate.notYet}</dd>
        </div>
        {record.sourceName && (
          <div>
            <dt>{t.crate.source}</dt>
            <dd>{record.sourceName}</dd>
          </div>
        )}
        <div>
          <dt>{t.crate.played}</dt>
          <dd>{t.crate.times(record.playCount)}</dd>
        </div>
        <div>
          <dt>{t.crate.wear}</dt>
          <dd>
            <span className="crate-detail__wear" style={{ "--wear": `${wear}%` } as CSSProperties} />
            {wear === 0 ? t.crate.mint : `${wear}%`}
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
