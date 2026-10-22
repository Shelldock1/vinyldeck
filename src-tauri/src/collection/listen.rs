//! Listen tracking for The Crate. A play counts once per track instance after
//! half the track or 2 minutes, whichever comes first, has actually been heard. Wall-clock time is accumulated only while playing, so
//! seeking around or leaving a paused track open never inflates the count.

use std::time::{Duration, Instant};

use crate::media::model::MediaSnapshot;

const MIN_TRACK_SECONDS: f64 = 30.0;
const MAX_THRESHOLD_SECONDS: f64 = 120.0;
/// Poll gaps longer than this (sleep, suspended thread) are not counted.
const MAX_TICK: Duration = Duration::from_secs(2);

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
            }),
        };

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
