// Monthly Crate Wrapped card. The backend folds the play history; this view
// only renders one month at a time and lets the user step back through months
// that actually have listens.

import { useEffect, useState } from "react";
import { getCollectionWrapped, formatWrappedDay, formatWrappedMonth } from "../../lib/collection/wrapped";
import type { CrateSource, WrappedStats } from "../../lib/collection/types";
import { formatPressingNumber } from "../../lib/collection/records";
import { localeFor, useLanguage, useT } from "../../lib/i18n";

interface CrateWrappedProps {
  open: boolean;
  onClose: () => void;
  /** Same source filter as the shelf behind the card. */
  source: CrateSource;
}

export function CrateWrapped({ open, onClose, source }: CrateWrappedProps) {
  const t = useT();
  const locale = localeFor(useLanguage());
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);

    void getCollectionWrapped(month, source)
      .then((next) => {
        if (!alive) return;
        setStats(next);
        if (next.month !== month) setMonth(next.month);
      })
      .catch(() => {
        if (alive) setError("load");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, month, source]);

  if (!open) return null;

  const empty = stats !== null && stats.totalPlays === 0;
  const monthLabel = stats ? formatWrappedMonth(stats.month, locale) : t.wrapped.thisMonth;
  const playsLabel = (count: number) => `${count} ${t.wrapped.plays(count)}`;

  return (
    <div
      className="crate-wrapped"
      role="dialog"
      aria-modal="true"
      aria-label={t.wrapped.eyebrow}
    >
      <div className="crate-wrapped__panel">
        <header className="crate-wrapped__header">
          <div>
            <span className="crate-wrapped__eyebrow">{t.wrapped.eyebrow}</span>
            <h3 className="crate-wrapped__title">{monthLabel}</h3>
          </div>
          <div className="crate-wrapped__actions">
            {stats && stats.availableMonths.length > 0 ? (
              <label className="crate-wrapped__month">
                <span className="crate-visually-hidden">{t.wrapped.month}</span>
                <select
                  value={stats.month}
                  onChange={(event) => setMonth(event.currentTarget.value)}
                >
                  {stats.availableMonths.map((value) => (
                    <option key={value} value={value}>
                      {formatWrappedMonth(value, locale)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="crate-panel__close"
              aria-label={t.wrapped.close}
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
          </div>
        </header>

        {loading && !stats ? (
          <p className="crate-wrapped__status">{t.wrapped.loading}</p>
        ) : error ? (
          <div className="crate-wrapped__status">
            <p>{t.wrapped.error}</p>
            <button type="button" onClick={() => setMonth(undefined)}>
              {t.wrapped.retry}
            </button>
          </div>
        ) : empty ? (
          <div className="crate-wrapped__empty">
            <p className="crate-wrapped__empty-title">{t.wrapped.quietTitle}</p>
            <p className="crate-wrapped__empty-copy">{t.wrapped.quietCopy(monthLabel)}</p>
          </div>
        ) : stats ? (
          <div className="crate-wrapped__body">
            <section className="crate-wrapped__hero" aria-label={t.wrapped.totals}>
              <div className="crate-wrapped__big">
                <span>{stats.totalPlays}</span>
                <small>{t.wrapped.listens(stats.totalPlays)}</small>
              </div>
              <dl className="crate-wrapped__counts">
                <div>
                  <dt>{t.wrapped.records}</dt>
                  <dd>{stats.uniqueAlbums}</dd>
                </div>
                <div>
                  <dt>{t.wrapped.artists}</dt>
                  <dd>{stats.uniqueArtists}</dd>
                </div>
                <div>
                  <dt>{t.wrapped.tracks}</dt>
                  <dd>{stats.uniqueTracks}</dd>
                </div>
              </dl>
            </section>

            <section className="crate-wrapped__section" aria-label={t.wrapped.topRecords}>
              <h4>{t.wrapped.mostPlayed}</h4>
              <ol className="crate-wrapped__records">
                {stats.topRecords.map((record, index) => (
                  <li key={record.key}>
                    <span className="crate-wrapped__rank">{index + 1}</span>
                    <span className="crate-wrapped__record">
                      <strong>{record.album}</strong>
                      <small>{record.artist || t.common.unknownArtist}</small>
                    </span>
                    <span className="crate-wrapped__plays">
                      {record.plays}
                      <small>{t.wrapped.plays(record.plays)}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="crate-wrapped__cards" aria-label={t.wrapped.highlights}>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">{t.wrapped.topTrack}</span>
                <strong>{stats.topTrack?.track ?? "—"}</strong>
                <small>
                  {stats.topTrack
                    ? `${stats.topTrack.artist || t.common.unknownArtist} · ${playsLabel(stats.topTrack.plays)}`
                    : t.wrapped.noTracks}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">{t.wrapped.topArtist}</span>
                <strong>{stats.topArtist?.artist ?? "—"}</strong>
                <small>
                  {stats.topArtist
                    ? playsLabel(stats.topArtist.plays)
                    : t.wrapped.noArtist}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">{t.wrapped.rarest}</span>
                <strong>{stats.rarest?.album ?? "—"}</strong>
                <small>
                  {stats.rarest?.pressingNumber
                    ? formatPressingNumber(stats.rarest.pressingNumber, t.common.numberPrefix)
                    : t.wrapped.noPressing}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">{t.wrapped.busiestDay}</span>
                <strong>
                  {stats.busiestDay
                    ? formatWrappedDay(stats.busiestDay.date, locale)
                    : "—"}
                </strong>
                <small>
                  {stats.busiestDay
                    ? playsLabel(stats.busiestDay.plays)
                    : t.wrapped.noListens}
                </small>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
