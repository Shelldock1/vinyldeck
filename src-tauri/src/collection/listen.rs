//! Listen tracking for The Crate. A play counts once per track instance after
//! half the track or 2 minutes, whichever comes first, has actually been heard. Wall-clock time is accumulated only while playing, so
//! seeking around or leaving a paused track open never inflates the count.
//! Restarting the same track (repeat-one loop, seeking back, or resuming from
//! the start) begins a new instance that can count again.

use std::time::{Duration, Instant};

use crate::media::model::MediaSnapshot;

const MIN_TRACK_SECONDS: f64 = 30.0;
const MAX_THRESHOLD_SECONDS: f64 = 120.0;
/// Poll gaps longer than this (sleep, suspended thread) are not counted.
const MAX_TICK: Duration = Duration::from_secs(2);
/// A backward position jump larger than this is a restart, not resync jitter.
const RESTART_JUMP_SECONDS: f64 = 3.0;
/// Resuming playback this close to the start is a restart.
const RESTART_START_SECONDS: f64 = 3.0;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CountedPlay {
    pub artist: String,
    pub album: String,
    pub track: String,
}

#[derive(Debug, Default)]
pub struct ListenTracker {
    current: Option<ListenProgress>,
}

#[derive(Debug)]
struct ListenProgress {
    id: String,
    listened: Duration,
    counted: bool,
    last_tick: Instant,
    last_position: f64,
    was_playing: bool,
}

impl ListenTracker {
    pub fn observe(
        &mut self,
        snapshot: Option<&MediaSnapshot>,
        now: Instant,
    ) -> Option<CountedPlay> {
        let Some(snapshot) = snapshot.filter(|snapshot| !snapshot.track.trim().is_empty()) else {
            self.current = None;
            return None;
        };

        let id = format!(
            "{}\u{1f}{}\u{1f}{}\u{1f}{}",
            snapshot.source_id, snapshot.track, snapshot.artist, snapshot.album
        );
        let progress = match &mut self.current {
            Some(progress) if progress.id == id => progress,
            _ => self.current.insert(ListenProgress {
                id,
                listened: Duration::ZERO,
                counted: false,
                last_tick: now,
                last_position: snapshot.position,
                was_playing: snapshot.is_playing,
            }),
        };

        if is_restart(progress, snapshot) {
            progress.listened = Duration::ZERO;
            progress.counted = false;
        }
        progress.last_position = snapshot.position;
        progress.was_playing = snapshot.is_playing;

        let tick = now.saturating_duration_since(progress.last_tick);
        progress.last_tick = now;
        if snapshot.is_playing && tick <= MAX_TICK {
            progress.listened += tick;
        }

        if progress.counted {
            return None;
        }
        let threshold = threshold_seconds(snapshot.duration)?;
        if progress.listened.as_secs_f64() < threshold {
            return None;
        }

        progress.counted = true;
        Some(CountedPlay {
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
            track: snapshot.track.clone(),
        })
    }
}

fn is_restart(progress: &ListenProgress, snapshot: &MediaSnapshot) -> bool {
    let position = snapshot.position;
    if !position.is_finite() || !progress.last_position.is_finite() {
        return false;
    }
    let jumped_back = progress.last_position - position > RESTART_JUMP_SECONDS;
    let resumed_at_start =
        !progress.was_playing && snapshot.is_playing && position < RESTART_START_SECONDS;
    jumped_back || resumed_at_start
}

fn threshold_seconds(duration: f64) -> Option<f64> {
    if !duration.is_finite() || duration <= 0.0 {
        // Unknown length (streams): count after the cap.
        return Some(MAX_THRESHOLD_SECONDS);
    }
    if duration < MIN_TRACK_SECONDS {
        return None;
    }
    Some((duration / 2.0).min(MAX_THRESHOLD_SECONDS))
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::ListenTracker;
    use crate::media::model::MediaSnapshot;

    fn playing(track: &str, duration: f64) -> MediaSnapshot {
        MediaSnapshot {
            track: track.to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            duration,
            is_playing: true,
            source_id: "spotify".to_string(),
            ..MediaSnapshot::default()
        }
    }

    fn run(
        tracker: &mut ListenTracker,
        snapshot: &MediaSnapshot,
        start: Instant,
        secs: u64,
    ) -> usize {
        (0..=secs * 2)
            .filter_map(|step| {
                tracker.observe(Some(snapshot), start + Duration::from_millis(step * 500))
            })
            .count()
    }

    #[test]
    fn counts_once_after_half_the_track() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let snapshot = playing("Song", 120.0);
        assert_eq!(run(&mut tracker, &snapshot, start, 59), 0);
        assert_eq!(
            run(
                &mut tracker,
                &snapshot,
                start + Duration::from_secs(60),
                200
            ),
            1
        );
    }

    #[test]
    fn threshold_is_half_or_two_minutes_whichever_first() {
        assert_eq!(super::threshold_seconds(180.0), Some(90.0));
        assert_eq!(super::threshold_seconds(240.0), Some(120.0));
        assert_eq!(super::threshold_seconds(600.0), Some(120.0));
        assert_eq!(super::threshold_seconds(0.0), Some(120.0));
        assert_eq!(super::threshold_seconds(20.0), None);
    }

    #[test]
    fn paused_time_and_long_gaps_do_not_count() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let mut paused = playing("Song", 100.0);
        paused.is_playing = false;
        assert_eq!(run(&mut tracker, &paused, start, 300), 0);

        let snapshot = playing("Song", 100.0);
        tracker.observe(Some(&snapshot), start + Duration::from_secs(400));
        // A 10-minute gap (laptop asleep) is ignored.
        assert!(tracker
            .observe(Some(&snapshot), start + Duration::from_secs(1000))
            .is_none());
    }

    #[test]
    fn caps_threshold_and_skips_tiny_tracks() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        assert_eq!(run(&mut tracker, &playing("Epic", 3600.0), start, 119), 0);
        assert_eq!(
            run(
                &mut tracker,
                &playing("Epic", 3600.0),
                start + Duration::from_secs(120),
                2
            ),
            1
        );

        let mut tracker = ListenTracker::default();
        assert_eq!(run(&mut tracker, &playing("Jingle", 20.0), start, 60), 0);
    }

    /// Plays `snapshot` from `from` seconds of position for `secs`, advancing
    /// position with wall-clock time like a real player.
    fn play_from(
        tracker: &mut ListenTracker,
        snapshot: &MediaSnapshot,
        start: Instant,
        from: f64,
        secs: u64,
    ) -> usize {
        (0..=secs * 2)
            .filter_map(|step| {
                let mut sample = snapshot.clone();
                sample.position = from + step as f64 * 0.5;
                tracker.observe(Some(&sample), start + Duration::from_millis(step * 500))
            })
            .count()
    }

    #[test]
    fn repeat_one_loop_counts_each_pass() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let snapshot = playing("Loop", 100.0);
        assert_eq!(play_from(&mut tracker, &snapshot, start, 0.0, 99), 1);
        // Position wraps from ~99s back to 0 while still playing.
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_millis(99_500),
                0.0,
                99
            ),
            1
        );
    }

    #[test]
    fn manual_restart_after_pause_counts_again() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let snapshot = playing("Song", 100.0);
        assert_eq!(play_from(&mut tracker, &snapshot, start, 0.0, 60), 1);

        // Pause, scrub to 0 (backward jump while paused), then play.
        let mut paused = snapshot.clone();
        paused.is_playing = false;
        paused.position = 60.0;
        tracker.observe(Some(&paused), start + Duration::from_secs(61));
        paused.position = 0.0;
        tracker.observe(Some(&paused), start + Duration::from_secs(70));
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_secs(71),
                0.0,
                60
            ),
            1
        );
    }

    #[test]
    fn resuming_at_start_without_scrub_is_a_restart() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let mut snapshot = playing("Song", 100.0);
        assert_eq!(play_from(&mut tracker, &snapshot, start, 0.0, 60), 1);
        // Source reports the paused track already back at 0 (e.g. stop).
        snapshot.is_playing = false;
        snapshot.position = 0.0;
        tracker.observe(Some(&snapshot), start + Duration::from_secs(200));
        snapshot.is_playing = true;
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_secs(201),
                1.0,
                60
            ),
            1
        );
    }

    #[test]
    fn small_backward_jitter_and_resume_mid_track_do_not_reset() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let mut snapshot = playing("Song", 100.0);
        assert_eq!(play_from(&mut tracker, &snapshot, start, 0.0, 60), 1);
        // Resync pulls position back 2s: same instance, no second count.
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_millis(60_500),
                58.0,
                30
            ),
            0
        );
        // Pause and resume mid-track: still the same instance.
        snapshot.is_playing = false;
        snapshot.position = 88.0;
        tracker.observe(Some(&snapshot), start + Duration::from_secs(95));
        snapshot.is_playing = true;
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_secs(96),
                88.0,
                10
            ),
            0
        );
    }

    #[test]
    fn forward_seek_does_not_credit_listen_time() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        let snapshot = playing("Song", 100.0);
        assert_eq!(play_from(&mut tracker, &snapshot, start, 0.0, 10), 0);
        // Jump to 90s: only real listening counts toward the 50s threshold.
        assert_eq!(
            play_from(
                &mut tracker,
                &snapshot,
                start + Duration::from_millis(10_500),
                90.0,
                9
            ),
            0
        );
    }

    #[test]
    fn switching_tracks_resets_progress() {
        let mut tracker = ListenTracker::default();
        let start = Instant::now();
        run(&mut tracker, &playing("A", 120.0), start, 50);
        assert_eq!(
            run(
                &mut tracker,
                &playing("B", 120.0),
                start + Duration::from_secs(51),
                50
            ),
            0
        );
        assert!(tracker
            .observe(None, start + Duration::from_secs(200))
            .is_none());
    }
}
