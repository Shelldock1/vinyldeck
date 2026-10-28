//! Repeat-one for players that publish no repeat mode of their own.
//!
//! Browsers and some music apps (Yandex Music on Windows, most web players on
//! Linux) expose play, skip and seek but no repeat control, so the repeat
//! lever would stay hidden. For those sources VinylDeck keeps the record
//! spinning itself: just before the end it drops the needle back to the start,
//! and if the player already rolled over to the next track it steps back once.
//!
//! The lever contract is unchanged: an emulated source reports
//! `canRepeat = true` and `repeatMode` `"off"` or `"one"`, and any request
//! other than `"off"` turns the loop on.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::model::{MediaSnapshot, REPEAT_MODE_OFF, REPEAT_MODE_ONE};

/// Restart this close to the end; the poller ticks at least once a second.
const END_MARGIN_SECONDS: f64 = 1.5;
/// A track change counts as a natural rollover (not a manual skip) only when
/// the previous track was this close to its end.
const ROLLOVER_MARGIN_SECONDS: f64 = 3.5;
/// Where a restart lands. Yandex Music accepts a seek to exactly zero but
/// ignores it, while any position past zero works.
pub(crate) const RESTART_POSITION_SECONDS: f64 = 0.01;
/// A player can accept a seek and still not move (Yandex Music near the end
/// of a track). Give it time to report the jump, retry once, then stop:
/// re-sending every poll floods the player until it hangs.
const RESTART_RETRY_DELAY: Duration = Duration::from_secs(3);
const RESTART_MAX_ATTEMPTS: u8 = 2;

/// Whether the loop is on and whether the current source needs VinylDeck to
/// run it. Lives in the playback authority so commands and the poller share it.
#[derive(Debug, Default)]
pub struct VinylLoop {
    state: Mutex<LoopState>,
}

#[derive(Debug, Default, Clone, Copy)]
struct LoopState {
    enabled: bool,
    emulated: bool,
}

impl VinylLoop {
    fn state(&self) -> std::sync::MutexGuard<'_, LoopState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Exposes the repeat lever on a snapshot from a player without native
    /// repeat. Snapshots that already carry repeat pass through untouched.
    pub fn decorate(&self, mut snapshot: MediaSnapshot) -> MediaSnapshot {
        let mut state = self.state();
        state.emulated = can_emulate(&snapshot);
        if state.emulated {
            snapshot.can_repeat = true;
            snapshot.repeat_mode = if state.enabled {
                REPEAT_MODE_ONE
            } else {
                REPEAT_MODE_OFF
            }
            .to_string();
        }
        snapshot
    }

    /// Takes a repeat request when VinylDeck runs the loop for the current
    /// source. Returns `false` when the player should handle it natively.
    pub fn try_set_mode(&self, mode: &str) -> bool {
        let mut state = self.state();
        if !state.emulated {
            return false;
        }
        state.enabled = mode != REPEAT_MODE_OFF;
        true
    }

    pub fn is_active(&self) -> bool {
        let state = self.state();
        state.emulated && state.enabled
    }
}

fn can_emulate(snapshot: &MediaSnapshot) -> bool {
    !snapshot.can_repeat && snapshot.can_control && (snapshot.can_seek || snapshot.can_skip)
}

/// What the poller should send to the player to keep the loop going.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum LoopAction {
    /// Seek the current track back to the start.
    Restart,
    /// The player moved on by itself; go back to the looped track.
    StepBack,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrackId {
    source_id: String,
    track: String,
    artist: String,
    album: String,
}

impl TrackId {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            source_id: snapshot.source_id.clone(),
            track: snapshot.track.clone(),
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
        }
    }
}

/// Watches consecutive polls and decides when the loop has to act.
#[derive(Debug, Default)]
pub(crate) struct LoopWatch {
    last: Option<(TrackId, f64)>,
    restart: Option<PendingRestart>,
}

/// Restarts sent during the current pass over the end of a track.
#[derive(Debug, Clone)]
struct PendingRestart {
    id: TrackId,
    attempts: u8,
    last_at: Instant,
}

impl LoopWatch {
    pub(crate) fn observe(
        &mut self,
        snapshot: Option<&MediaSnapshot>,
        active: bool,
        now: Instant,
    ) -> Option<LoopAction> {
        // Keep the last track across a gap: Yandex Music briefly closes its
        // session between tracks, and the rollover check needs what played
        // before it.
        let snapshot = snapshot?;

        let id = TrackId::from_snapshot(snapshot);
        let remaining = remaining_seconds(snapshot);
        let previous = self.last.replace((id.clone(), remaining));
        // The pass is over once the track changed or the needle left the end.
        if self
            .restart
            .as_ref()
            .is_some_and(|pending| pending.id != id || remaining > ROLLOVER_MARGIN_SECONDS)
        {
            self.restart = None;
        }
        if !active {
            return None;
        }

        let rolled_over = previous.is_some_and(|(previous_id, previous_remaining)| {
            previous_id.source_id == id.source_id
                && previous_id != id
                && previous_remaining <= ROLLOVER_MARGIN_SECONDS
        });
        if rolled_over && snapshot.can_skip {
            return Some(LoopAction::StepBack);
        }

        if snapshot.is_playing
            && snapshot.can_seek
            && snapshot.duration > END_MARGIN_SECONDS * 2.0
            && remaining <= END_MARGIN_SECONDS
            && self.restart_allowed(now)
        {
            let attempts = self.restart.as_ref().map_or(0, |pending| pending.attempts);
            self.restart = Some(PendingRestart {
                id,
                attempts: attempts + 1,
                last_at: now,
            });
            return Some(LoopAction::Restart);
        }

        None
    }

    fn restart_allowed(&self, now: Instant) -> bool {
        self.restart.as_ref().is_none_or(|pending| {
            pending.attempts < RESTART_MAX_ATTEMPTS
                && now.duration_since(pending.last_at) >= RESTART_RETRY_DELAY
        })
    }
}

fn remaining_seconds(snapshot: &MediaSnapshot) -> f64 {
    if !snapshot.duration.is_finite() || snapshot.duration <= 0.0 {
        return f64::INFINITY;
    }
    (snapshot.duration - snapshot.position.max(0.0)).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::model::REPEAT_MODE_ALL;

    fn t0() -> Instant {
        static START: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
        *START.get_or_init(Instant::now)
    }

    fn browser(track: &str, position: f64) -> MediaSnapshot {
        MediaSnapshot {
            track: track.to_string(),
            artist: "Artist".to_string(),
            source_id: "Chrome".to_string(),
            duration: 180.0,
            position,
            is_playing: true,
            can_seek: true,
            can_skip: true,
            can_control: true,
            ..MediaSnapshot::default()
        }
    }

    #[test]
    fn exposes_the_lever_for_players_without_repeat() {
        let vinyl_loop = VinylLoop::default();
        let snapshot = vinyl_loop.decorate(browser("A", 10.0));
        assert!(snapshot.can_repeat);
        assert_eq!(snapshot.repeat_mode, REPEAT_MODE_OFF);

        assert!(vinyl_loop.try_set_mode(REPEAT_MODE_ALL));
        assert!(vinyl_loop.is_active());
        let snapshot = vinyl_loop.decorate(browser("A", 11.0));
        assert_eq!(snapshot.repeat_mode, REPEAT_MODE_ONE);

        assert!(vinyl_loop.try_set_mode(REPEAT_MODE_OFF));
        assert!(!vinyl_loop.is_active());
    }

    #[test]
    fn leaves_native_repeat_to_the_player() {
        let vinyl_loop = VinylLoop::default();
        let native = MediaSnapshot {
            can_repeat: true,
            repeat_mode: REPEAT_MODE_ALL.to_string(),
            ..browser("A", 10.0)
        };
        let snapshot = vinyl_loop.decorate(native.clone());
        assert_eq!(snapshot, native);
        assert!(!vinyl_loop.try_set_mode(REPEAT_MODE_ONE));
        assert!(!vinyl_loop.is_active());
    }

    #[test]
    fn does_not_offer_a_loop_it_cannot_run() {
        let vinyl_loop = VinylLoop::default();
        let snapshot = vinyl_loop.decorate(MediaSnapshot {
            can_seek: false,
            can_skip: false,
            ..browser("A", 10.0)
        });
        assert!(!snapshot.can_repeat);
    }

    #[test]
    fn restarts_just_before_the_end() {
        let mut watch = LoopWatch::default();
        assert_eq!(watch.observe(Some(&browser("A", 170.0)), true, t0()), None);
        assert_eq!(
            watch.observe(Some(&browser("A", 179.0)), true, t0()),
            Some(LoopAction::Restart)
        );
        assert_eq!(watch.observe(Some(&browser("A", 0.2)), true, t0()), None);
    }

    #[test]
    fn a_seek_the_player_ignores_is_retried_once_then_dropped() {
        let mut watch = LoopWatch::default();
        let stuck = browser("A", 179.0);
        let at = |seconds: u64| t0() + Duration::from_secs(seconds);

        assert_eq!(
            watch.observe(Some(&stuck), true, at(0)),
            Some(LoopAction::Restart)
        );
        // Polls right after the seek (the poller is woken) must not resend it.
        assert_eq!(watch.observe(Some(&stuck), true, at(0)), None);
        assert_eq!(watch.observe(Some(&stuck), true, at(1)), None);
        assert_eq!(
            watch.observe(Some(&stuck), true, at(3)),
            Some(LoopAction::Restart)
        );
        assert_eq!(watch.observe(Some(&stuck), true, at(10)), None);
        assert_eq!(watch.observe(Some(&stuck), true, at(60)), None);

        // The next pass over the end starts a fresh budget.
        assert_eq!(watch.observe(Some(&browser("A", 0.5)), true, at(61)), None);
        assert_eq!(
            watch.observe(Some(&browser("A", 179.0)), true, at(240)),
            Some(LoopAction::Restart)
        );
    }

    #[test]
    fn stays_quiet_when_off_or_paused() {
        let mut watch = LoopWatch::default();
        assert_eq!(watch.observe(Some(&browser("A", 179.0)), false, t0()), None);

        let paused = MediaSnapshot {
            is_playing: false,
            ..browser("A", 179.5)
        };
        assert_eq!(watch.observe(Some(&paused), true, t0()), None);
    }

    #[test]
    fn steps_back_when_the_player_rolled_over() {
        let mut watch = LoopWatch::default();
        let no_seek = |track: &str, position: f64| MediaSnapshot {
            can_seek: false,
            ..browser(track, position)
        };
        assert_eq!(watch.observe(Some(&no_seek("A", 177.5)), true, t0()), None);
        assert_eq!(
            watch.observe(Some(&no_seek("B", 0.5)), true, t0()),
            Some(LoopAction::StepBack)
        );
        assert_eq!(watch.observe(Some(&no_seek("A", 0.3)), true, t0()), None);
    }

    #[test]
    fn a_session_gap_between_tracks_still_reads_as_a_rollover() {
        let mut watch = LoopWatch::default();
        let no_seek = |track: &str, position: f64| MediaSnapshot {
            can_seek: false,
            ..browser(track, position)
        };
        assert_eq!(watch.observe(Some(&no_seek("A", 178.0)), true, t0()), None);
        assert_eq!(watch.observe(None, true, t0()), None);
        assert_eq!(
            watch.observe(Some(&no_seek("B", 0.4)), true, t0()),
            Some(LoopAction::StepBack)
        );
    }

    #[test]
    fn a_manual_skip_mid_track_is_not_a_rollover() {
        let mut watch = LoopWatch::default();
        assert_eq!(watch.observe(Some(&browser("A", 60.0)), true, t0()), None);
        assert_eq!(watch.observe(Some(&browser("B", 0.5)), true, t0()), None);
    }

    #[test]
    fn unknown_duration_never_loops() {
        let mut watch = LoopWatch::default();
        let live = MediaSnapshot {
            duration: 0.0,
            ..browser("A", 3600.0)
        };
        assert_eq!(watch.observe(Some(&live), true, t0()), None);
    }
}
