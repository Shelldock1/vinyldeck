// Monthly Crate Wrapped card. The backend folds the play history; this view
// only renders one month at a time and lets the user step back through months
// that actually have listens.

import { useEffect, useState } from "react";
import { getCollectionWrapped, formatWrappedDay, formatWrappedMonth } from "../../lib/collection/wrapped";
import type { CrateSource, WrappedStats } from "../../lib/collection/types";

interface CrateWrappedProps {
  open: boolean;
  onClose: () => void;
  /** Same source filter as the shelf behind the card. */
  source: CrateSource;
}

export function CrateWrapped({ open, onClose, source }: CrateWrappedProps) {
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
        if (alive) setError("Could not read this month's plays.");
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

  return (
    <div
      className="crate-wrapped"
      role="dialog"
      aria-modal="true"
      aria-label="Crate Wrapped"
    >
      <div className="crate-wrapped__panel">
        <header className="crate-wrapped__header">
          <div>
            <span className="crate-wrapped__eyebrow">Crate Wrapped</span>
            <h3 className="crate-wrapped__title">
              {stats ? stats.label : "This month"}
            </h3>
          </div>
          <div className="crate-wrapped__actions">
            {stats && stats.availableMonths.length > 0 ? (
              <label className="crate-wrapped__month">
                <span className="crate-visually-hidden">Month</span>
                <select
                  value={stats.month}
                  onChange={(event) => setMonth(event.currentTarget.value)}
                >
                  {stats.availableMonths.map((value) => (
                    <option key={value} value={value}>
                      {formatWrappedMonth(value)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="crate-panel__close"
              aria-label="Close Crate Wrapped"
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
          <p className="crate-wrapped__status">Reading the crate…</p>
        ) : error ? (
          <div className="crate-wrapped__status">
            <p>{error}</p>
            <button type="button" onClick={() => setMonth(undefined)}>
              Try again
            </button>
          </div>
        ) : empty ? (
          <div className="crate-wrapped__empty">
            <p className="crate-wrapped__empty-title">A quiet month</p>
            <p className="crate-wrapped__empty-copy">
              No listens counted in {stats.label} yet. Play something, cross the
              halfway mark, and it will land here.
            </p>
          </div>
        ) : stats ? (
          <div className="crate-wrapped__body">
            <section className="crate-wrapped__hero" aria-label="Totals">
              <div className="crate-wrapped__big">
                <span>{stats.totalPlays}</span>
                <small>{stats.totalPlays === 1 ? "listen" : "listens"}</small>
              </div>
              <dl className="crate-wrapped__counts">
                <div>
                  <dt>Records</dt>
                  <dd>{stats.uniqueAlbums}</dd>
                </div>
                <div>
                  <dt>Artists</dt>
                  <dd>{stats.uniqueArtists}</dd>
                </div>
                <div>
                  <dt>Tracks</dt>
                  <dd>{stats.uniqueTracks}</dd>
                </div>
              </dl>
            </section>

            <section className="crate-wrapped__section" aria-label="Top records">
              <h4>Most played records</h4>
              <ol className="crate-wrapped__records">
                {stats.topRecords.map((record, index) => (
                  <li key={record.key}>
                    <span className="crate-wrapped__rank">{index + 1}</span>
                    <span className="crate-wrapped__record">
                      <strong>{record.album}</strong>
                      <small>{record.artist || "Unknown artist"}</small>
                    </span>
                    <span className="crate-wrapped__plays">
                      {record.plays}
                      <small>{record.plays === 1 ? "play" : "plays"}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="crate-wrapped__cards" aria-label="Month highlights">
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">Top track</span>
                <strong>{stats.topTrack?.track ?? "—"}</strong>
                <small>
                  {stats.topTrack
                    ? `${stats.topTrack.artist || "Unknown artist"} · ${stats.topTrack.plays} ${stats.topTrack.plays === 1 ? "play" : "plays"}`
                    : "No tracks"}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">Top artist</span>
                <strong>{stats.topArtist?.artist ?? "—"}</strong>
                <small>
                  {stats.topArtist
                    ? `${stats.topArtist.plays} ${stats.topArtist.plays === 1 ? "play" : "plays"}`
                    : "No artist"}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">Rarest pressing</span>
                <strong>{stats.rarest?.album ?? "—"}</strong>
                <small>
                  {stats.rarest?.pressingNumber
                    ? `No. ${String(stats.rarest.pressingNumber).padStart(3, "0")}`
                    : "No pressing yet"}
                </small>
              </div>
              <div className="crate-wrapped__card">
                <span className="crate-wrapped__card-label">Busiest day</span>
                <strong>
                  {stats.busiestDay
                    ? formatWrappedDay(stats.busiestDay.date)
                    : "—"}
                </strong>
                <small>
                  {stats.busiestDay
                    ? `${stats.busiestDay.plays} ${stats.busiestDay.plays === 1 ? "play" : "plays"}`
                    : "No listens"}
                </small>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
