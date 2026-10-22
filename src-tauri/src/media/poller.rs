use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};

use tauri::AppHandle;

use super::{
    emit_media_snapshot,
    model::{MediaSemanticKey, MediaSnapshot},
};

const SMTC_POLL_INTERVAL_MS: u64 = 500;
const POSITION_RESYNC_INTERVAL_MS: u64 = 2_000;
const ERROR_LOG_INTERVAL_MS: u64 = 5_000;
static SMTC_POLLER_STARTED: AtomicBool = AtomicBool::new(false);

pub fn start_smtc_poller(app: AppHandle) {
    if SMTC_POLLER_STARTED
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
        .is_err()
    {
        eprintln!("[VinylDeck SMTC] poller already running");
        return;
    }

    if let Err(error) = thread::Builder::new()
        .name("vinyldeck-smtc-poller".to_string())
        .spawn(move || {
            let poll_interval = Duration::from_millis(SMTC_POLL_INTERVAL_MS);
            let mut poller = SmtcPoller::default();
            let mut error_log = ErrorRateLimiter::new(error_log_interval());

            loop {
                thread::sleep(poll_interval);
                if let Err(error) = tauri::async_runtime::block_on(poll_once(&app, &mut poller)) {
                    if let Some(message) =
                        error_log.message_for_error(&error.to_string(), Instant::now())
                    {
                        eprintln!("[VinylDeck SMTC] {message}");
                    }
                }
            }
        })
    {
        SMTC_POLLER_STARTED.store(false, Ordering::Release);
        eprintln!("[VinylDeck SMTC] failed to start poller: {error}");
    }
}

async fn poll_once(app: &AppHandle, poller: &mut SmtcPoller) -> anyhow::Result<()> {
    if let Some(snapshot) = poller.next_event_snapshot().await? {
        emit_media_snapshot(app, &snapshot);
    }

    Ok(())
}

#[derive(Debug, Default)]
struct SmtcPoller {
    cached_media: Option<CachedMedia>,
    last_emitted_key: Option<MediaSemanticKey>,
    last_emit_at: Option<Instant>,
    had_session: bool,
}

impl SmtcPoller {
    async fn next_event_snapshot(&mut self) -> anyhow::Result<Option<MediaSnapshot>> {
        let snapshot = self.snapshot_for_poll().await?;
        Ok(self.handle_polled_snapshot(snapshot, Instant::now()))
    }

    fn handle_polled_snapshot(
        &mut self,
        snapshot: Option<MediaSnapshot>,
        now: Instant,
    ) -> Option<MediaSnapshot> {
        let Some(snapshot) = snapshot else {
            return self.session_ended_snapshot();
        };
        self.had_session = true;
        if self.should_emit_snapshot(&snapshot, now) {
            self.last_emitted_key = Some(snapshot.semantic_key());
            self.last_emit_at = Some(now);
            return Some(snapshot);
        }

        None
    }

    async fn snapshot_for_poll(&mut self) -> anyhow::Result<Option<MediaSnapshot>> {
        let Some(metadata_snapshot) = super::smtc::current_media_snapshot_with_metadata().await?
        else {
            self.cached_media = None;
            return Ok(None);
        };

        let cache_key = TrackCacheKey::from_snapshot(&metadata_snapshot);
        if self
            .cached_media
            .as_ref()
            .is_some_and(|cached| cached.key == cache_key)
        {
            return Ok(Some(apply_cached_media(
                metadata_snapshot,
                self.cached_media.as_ref(),
            )));
        }

        let Some(full_snapshot) = super::smtc::current_media_snapshot_with_artwork().await? else {
            self.cached_media = None;
            return Ok(Some(metadata_snapshot));
        };

        if TrackCacheKey::from_snapshot(&full_snapshot) == cache_key {
            self.cached_media = Some(CachedMedia::from_snapshot(&full_snapshot));
            return Ok(Some(full_snapshot));
        }

        self.cached_media = None;
        Ok(Some(metadata_snapshot))
    }

    fn session_ended_snapshot(&mut self) -> Option<MediaSnapshot> {
        self.cached_media = None;
        self.last_emitted_key = None;
        self.last_emit_at = None;

        if self.had_session {
            self.had_session = false;
            return Some(MediaSnapshot::default());
        }

        None
    }

    fn should_emit_snapshot(&self, snapshot: &MediaSnapshot, now: Instant) -> bool {
        let key = snapshot.semantic_key();
        if self.last_emitted_key.as_ref() != Some(&key) {
            return true;
        }

        self.last_emit_at
            .is_none_or(|last| now.duration_since(last) >= position_resync_interval())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrackCacheKey {
    source_id: String,
    track: String,
    artist: String,
    album: String,
    duration_millis: u64,
}

impl TrackCacheKey {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            source_id: snapshot.source_id.clone(),
            track: snapshot.track.clone(),
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
            duration_millis: seconds_to_millis(snapshot.duration),
        }
    }
}

#[derive(Debug, Clone)]
struct CachedMedia {
    key: TrackCacheKey,
    track: String,
    artist: String,
    album: String,
    artwork_data_url: Option<String>,
}

impl CachedMedia {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            key: TrackCacheKey::from_snapshot(snapshot),
            track: snapshot.track.clone(),
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
            artwork_data_url: snapshot.artwork_data_url.clone(),
        }
    }
}

fn apply_cached_media(
    mut lightweight: MediaSnapshot,
    cached: Option<&CachedMedia>,
) -> MediaSnapshot {
    if let Some(cached) = cached {
        lightweight.track = cached.track.clone();
        lightweight.artist = cached.artist.clone();
        lightweight.album = cached.album.clone();
        lightweight.artwork_data_url = cached.artwork_data_url.clone();
    }

    lightweight
}

fn seconds_to_millis(seconds: f64) -> u64 {
    if !seconds.is_finite() || seconds <= 0.0 {
        return 0;
    }

    (seconds * 1000.0).round() as u64
}

fn position_resync_interval() -> Duration {
    Duration::from_millis(POSITION_RESYNC_INTERVAL_MS)
}

fn error_log_interval() -> Duration {
    Duration::from_millis(ERROR_LOG_INTERVAL_MS)
}

#[derive(Debug)]
struct ErrorRateLimiter {
    interval: Duration,
    last_log_at: Option<Instant>,
    suppressed: u32,
}

impl ErrorRateLimiter {
    fn new(interval: Duration) -> Self {
        Self {
            interval,
            last_log_at: None,
            suppressed: 0,
        }
    }

    fn message_for_error(&mut self, error: &str, now: Instant) -> Option<String> {
        let should_log = self
            .last_log_at
            .is_none_or(|last| now.duration_since(last) >= self.interval);

        if should_log {
            self.last_log_at = Some(now);
            let suppressed = std::mem::take(&mut self.suppressed);
            if suppressed > 0 {
                return Some(format!(
                    "poll error: {error} ({suppressed} repeated errors suppressed)"
                ));
            }
            return Some(format!("poll error: {error}"));
        }

        self.suppressed = self.suppressed.saturating_add(1);
        None
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};

    use std::time::Duration;

    use super::{
        apply_cached_media, error_log_interval, position_resync_interval, CachedMedia,
        ErrorRateLimiter, MediaSnapshot, SmtcPoller, TrackCacheKey,
    };

    fn claim_start(flag: &AtomicBool) -> bool {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    #[test]
    fn start_guard_allows_only_one_poller() {
        let flag = AtomicBool::new(false);

        assert!(claim_start(&flag));
        assert!(!claim_start(&flag));
    }

    #[test]
    fn track_cache_key_uses_source_metadata_and_duration() {
        let base = MediaSnapshot {
            source_id: "spotify".to_string(),
            track: "Goth Bitch".to_string(),
            artist: "1nonly".to_string(),
            album: "Goth Bitch".to_string(),
            duration: 120.25,
            ..MediaSnapshot::default()
        };
        let same = MediaSnapshot {
            position: 42.0,
            ..base.clone()
        };
        let different_duration = MediaSnapshot {
            duration: 121.0,
            ..base.clone()
        };
        let different_source = MediaSnapshot {
            source_id: "chrome".to_string(),
            ..base.clone()
        };
        let same_duration_next_track = MediaSnapshot {
            track: "CANT HAVE IT".to_string(),
            artist: "JKER".to_string(),
            album: "CANT HAVE IT".to_string(),
            ..base.clone()
        };

        assert_eq!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&same)
        );
        assert_ne!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&different_duration)
        );
        assert_ne!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&different_source)
        );
        assert_ne!(
            TrackCacheKey::from_snapshot(&base),
            TrackCacheKey::from_snapshot(&same_duration_next_track)
        );
    }

    #[test]
    fn cached_media_merges_onto_lightweight_snapshot() {
        let full = MediaSnapshot {
            track: "Track".to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            artwork_data_url: Some("data:image/png;base64,AAAA".to_string()),
            duration: 180.0,
            position: 7.0,
            source_id: "spotify".to_string(),
            ..MediaSnapshot::default()
        };
        let lightweight = MediaSnapshot {
            duration: 180.0,
            position: 9.0,
            is_playing: true,
            source_id: "spotify".to_string(),
            ..MediaSnapshot::default()
        };

        let merged = apply_cached_media(lightweight, Some(&CachedMedia::from_snapshot(&full)));

        assert_eq!(merged.track, "Track");
        assert_eq!(merged.artist, "Artist");
        assert_eq!(merged.album, "Album");
        assert_eq!(
            merged.artwork_data_url,
            Some("data:image/png;base64,AAAA".to_string())
        );
        assert_eq!(merged.position, 9.0);
        assert!(merged.is_playing);
    }

    #[test]
    fn emission_policy_sends_first_semantic_and_periodic_resyncs() {
        let mut poller = SmtcPoller::default();
        let snapshot = MediaSnapshot {
            track: "Track".to_string(),
            source_id: "spotify".to_string(),
            duration: 180.0,
            position: 1.0,
            is_playing: true,
            ..MediaSnapshot::default()
        };
        let now = std::time::Instant::now();

        assert!(poller.should_emit_snapshot(&snapshot, now));
        poller.last_emitted_key = Some(snapshot.semantic_key());
        poller.last_emit_at = Some(now);

        let mut drifted = snapshot.clone();
        drifted.position = 1.5;
        assert!(!poller.should_emit_snapshot(&drifted, now + Duration::from_millis(500)));
        assert!(poller.should_emit_snapshot(&drifted, now + position_resync_interval()));

        let mut paused = drifted;
        paused.is_playing = false;
        assert!(poller.should_emit_snapshot(&paused, now + Duration::from_millis(600)));
    }

    #[test]
    fn session_end_emits_one_empty_snapshot() {
        let mut poller = SmtcPoller {
            had_session: true,
            cached_media: Some(CachedMedia::from_snapshot(&MediaSnapshot {
                track: "Track".to_string(),
                source_id: "spotify".to_string(),
                duration: 180.0,
                ..MediaSnapshot::default()
            })),
            last_emitted_key: None,
            last_emit_at: None,
        };

        let ended = poller.session_ended_snapshot();
        assert_eq!(ended, Some(MediaSnapshot::default()));
        assert_eq!(poller.session_ended_snapshot(), None);
    }

    #[test]
    fn fake_snapshot_state_machine_matches_event_policy() {
        let mut poller = SmtcPoller::default();
        let now = std::time::Instant::now();
        let playing = MediaSnapshot {
            track: "Track".to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            source_id: "spotify".to_string(),
            duration: 180.0,
            position: 10.0,
            is_playing: true,
            can_seek: true,
            can_skip: true,
            can_control: true,
            ..MediaSnapshot::default()
        };

        assert_eq!(
            poller.handle_polled_snapshot(Some(playing.clone()), now),
            Some(playing.clone())
        );

        let position_only = MediaSnapshot {
            position: 10.5,
            ..playing.clone()
        };
        assert_eq!(
            poller.handle_polled_snapshot(
                Some(position_only.clone()),
                now + Duration::from_millis(500),
            ),
            None
        );
        assert_eq!(
            poller.handle_polled_snapshot(
                Some(position_only.clone()),
                now + position_resync_interval(),
            ),
            Some(position_only.clone())
        );

        let track_changed = MediaSnapshot {
            track: "Next Track".to_string(),
            position: 0.0,
            ..position_only
        };
        assert_eq!(
            poller.handle_polled_snapshot(
                Some(track_changed.clone()),
                now + position_resync_interval() + Duration::from_millis(500),
            ),
            Some(track_changed)
        );

        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(3)),
            Some(MediaSnapshot::default())
        );
        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(4)),
            None
        );
    }

    #[test]
    fn full_no_media_lifecycle_emits_clean_transitions() {
        let mut poller = SmtcPoller::default();
        let now = std::time::Instant::now();
        let spotify = MediaSnapshot {
            track: "Spotify Track".to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            source_name: "Spotify".to_string(),
            source_id: "Spotify.exe".to_string(),
            duration: 180.0,
            position: 0.0,
            is_playing: true,
            can_seek: true,
            can_skip: true,
            can_control: true,
            ..MediaSnapshot::default()
        };
        let chrome = MediaSnapshot {
            track: "Browser Track".to_string(),
            source_name: "Chrome".to_string(),
            source_id: "chrome.exe".to_string(),
            position: 12.0,
            ..spotify.clone()
        };

        assert_eq!(poller.handle_polled_snapshot(None, now), None);
        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_millis(500)),
            None
        );

        assert_eq!(
            poller.handle_polled_snapshot(Some(spotify.clone()), now + Duration::from_secs(1)),
            Some(spotify.clone())
        );

        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(2)),
            Some(MediaSnapshot::default())
        );
        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(3)),
            None
        );

        let restarted = MediaSnapshot {
            position: 0.0,
            ..spotify
        };
        assert_eq!(
            poller.handle_polled_snapshot(Some(restarted.clone()), now + Duration::from_secs(4)),
            Some(restarted)
        );
        assert_eq!(
            poller.handle_polled_snapshot(Some(chrome.clone()), now + Duration::from_secs(5)),
            Some(chrome)
        );
    }

    #[test]
    fn metadata_artwork_edges_emit_without_crashing() {
        let mut poller = SmtcPoller::default();
        let now = std::time::Instant::now();
        let empty_metadata_missing_artwork = MediaSnapshot {
            source_name: "Spotify".to_string(),
            source_id: "Spotify.exe".to_string(),
            duration: 0.0,
            position: 0.0,
            is_playing: true,
            can_control: true,
            ..MediaSnapshot::default()
        };

        assert_eq!(
            poller.handle_polled_snapshot(Some(empty_metadata_missing_artwork.clone()), now),
            Some(empty_metadata_missing_artwork.clone())
        );

        let unknown_duration_position = MediaSnapshot {
            duration: f64::INFINITY,
            position: f64::NAN,
            ..empty_metadata_missing_artwork
        };

        assert_eq!(
            poller.handle_polled_snapshot(
                Some(unknown_duration_position.clone()),
                now + Duration::from_secs(1),
            ),
            None
        );
        let resynced = poller.handle_polled_snapshot(
            Some(unknown_duration_position),
            now + position_resync_interval(),
        );
        let resynced = resynced.expect("unknown timeline values should still resync");
        assert!(resynced.duration.is_infinite());
        assert!(resynced.position.is_nan());
    }

    #[test]
    fn poll_errors_are_rate_limited() {
        let mut limiter = ErrorRateLimiter::new(error_log_interval());
        let now = std::time::Instant::now();

        assert_eq!(
            limiter.message_for_error("temporary WinRT failure", now),
            Some("poll error: temporary WinRT failure".to_string())
        );
        assert_eq!(
            limiter.message_for_error("temporary WinRT failure", now + Duration::from_millis(500)),
            None
        );
        assert_eq!(
            limiter.message_for_error("temporary WinRT failure", now + Duration::from_millis(900)),
            None
        );
        assert_eq!(
            limiter.message_for_error("temporary WinRT failure", now + error_log_interval()),
            Some("poll error: temporary WinRT failure (2 repeated errors suppressed)".to_string())
        );
    }
}
