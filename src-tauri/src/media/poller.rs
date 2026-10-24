use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, TryRecvError},
        Condvar, Mutex, OnceLock,
    },
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager};

use super::{
    authority::PlaybackAuthority,
    emit_media_position, emit_media_snapshot,
    model::{MediaPosition, MediaSemanticKey, MediaSnapshot},
};
use crate::collection::{self, listen::ListenTracker};

const SMTC_POLL_INTERVAL_MS: u64 = 1_000;
const POSITION_RESYNC_INTERVAL_MS: u64 = 2_000;
const ERROR_LOG_INTERVAL_MS: u64 = 5_000;
static SMTC_POLLER_STARTED: AtomicBool = AtomicBool::new(false);

/// Wakes the poll loop from platform events or transport commands instead of
/// waiting for the next fallback tick.
static POLL_WAKE: OnceLock<PollWake> = OnceLock::new();

struct PollWake {
    pending: Mutex<bool>,
    signal: Condvar,
}

impl PollWake {
    fn wait(&self, timeout: Duration) {
        let mut pending = self
            .pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if *pending {
            *pending = false;
            return;
        }
        let (mut pending, _) = self
            .signal
            .wait_timeout(pending, timeout)
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        *pending = false;
    }
}

fn poll_wake() -> &'static PollWake {
    POLL_WAKE.get_or_init(|| PollWake {
        pending: Mutex::new(false),
        signal: Condvar::new(),
    })
}

/// Asks the poll loop to read the player again right away. Safe to call from
/// any thread; calls coalesce while a poll is already in flight.
pub(crate) fn wake_poller() {
    let wake = poll_wake();
    let mut pending = wake
        .pending
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    *pending = true;
    wake.signal.notify_one();
}

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

            super::platform::spawn_event_watchers();

            loop {
                poll_wake().wait(poll_interval);
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
    poller.collect_artwork(app);

    let selection = app
        .try_state::<PlaybackAuthority>()
        .and_then(|authority| authority.selection());
    let fallback = poller.last_playing_source_id.clone();
    let snapshot = poller
        .snapshot_for_poll(selection.clone(), fallback.clone())
        .await?;
    poller.observe_playing_source(snapshot.as_ref());
    crate::reactivity::set_playing(
        snapshot
            .as_ref()
            .is_some_and(|snapshot| snapshot.is_playing),
    );
    if let Some(authority) = app.try_state::<PlaybackAuthority>() {
        authority.update(snapshot.clone());
    }
    let now = Instant::now();
    if let Some(play) = poller.listens.observe(snapshot.as_ref(), now) {
        collection::record_play(app, &play).await;
    }
    // Metadata goes out now; the artwork download runs off the poll thread and
    // is emitted as a follow-up snapshot once it lands.
    poller.request_artwork(snapshot.as_ref(), selection, fallback);
    match poller.handle_polled_snapshot(snapshot, now) {
        Some(MediaEmission::Snapshot(snapshot)) => emit_media_snapshot(app, &snapshot),
        Some(MediaEmission::Position(position)) => emit_media_position(app, position),
        None => {}
    }

    Ok(())
}

/// Full snapshots (with artwork) go out only on semantic change; periodic
/// resyncs carry position alone.
#[derive(Debug, Clone, PartialEq)]
enum MediaEmission {
    Snapshot(MediaSnapshot),
    Position(MediaPosition),
}

#[derive(Debug, Default)]
struct SmtcPoller {
    cached_media: Option<CachedMedia>,
    last_emitted_key: Option<MediaSemanticKey>,
    last_emit_at: Option<Instant>,
    had_session: bool,
    last_playing_source_id: Option<String>,
    listens: ListenTracker,
    artwork_rx: Option<Receiver<ArtworkResult>>,
    artwork_in_flight: Option<TrackCacheKey>,
}

type ArtworkResult = (TrackCacheKey, Option<MediaSnapshot>);

impl SmtcPoller {
    fn handle_polled_snapshot(
        &mut self,
        snapshot: Option<MediaSnapshot>,
        now: Instant,
    ) -> Option<MediaEmission> {
        let Some(snapshot) = snapshot else {
            return self.session_ended_snapshot().map(MediaEmission::Snapshot);
        };
        self.had_session = true;

        let key = snapshot.semantic_key();
        if self.last_emitted_key.as_ref() != Some(&key) {
            self.last_emitted_key = Some(key);
            self.last_emit_at = Some(now);
            return Some(MediaEmission::Snapshot(snapshot));
        }

        if self.position_resync_due(now) {
            self.last_emit_at = Some(now);
            return Some(MediaEmission::Position(snapshot.media_position()));
        }

        None
    }

    async fn snapshot_for_poll(
        &mut self,
        selected: Option<String>,
        fallback: Option<String>,
    ) -> anyhow::Result<Option<MediaSnapshot>> {
        let Some(metadata_snapshot) =
            super::platform::current_media_snapshot_with_metadata(selected, fallback).await?
        else {
            self.cached_media = None;
            self.artwork_in_flight = None;
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

        Ok(Some(metadata_snapshot))
    }

    /// Starts an artwork download for a track that is not cached yet. The
    /// result comes back over a channel and is emitted by `collect_artwork`,
    /// so a slow or unreachable artwork URL never stalls the poll loop.
    fn request_artwork(
        &mut self,
        snapshot: Option<&MediaSnapshot>,
        selected: Option<String>,
        fallback: Option<String>,
    ) {
        let Some(snapshot) = snapshot else {
            return;
        };
        let key = TrackCacheKey::from_snapshot(snapshot);
        if self
            .cached_media
            .as_ref()
            .is_some_and(|cached| cached.key == key)
        {
            return;
        }
        if self.artwork_in_flight.as_ref() == Some(&key) {
            return;
        }

        let (tx, rx) = mpsc::channel();
        self.artwork_in_flight = Some(key.clone());
        self.artwork_rx = Some(rx);

        // A dedicated thread, not the async runtime: the WinRT thumbnail
        // handles are not `Send`, and the poll thread must not wait either way.
        let spawned = thread::Builder::new()
            .name("vinyldeck-artwork".to_string())
            .spawn(move || {
                let fetched = tauri::async_runtime::block_on(
                    super::platform::current_media_snapshot_with_artwork(selected, fallback),
                );
                let _ = tx.send((key, fetched.ok().flatten()));
            });

        if spawned.is_err() {
            self.artwork_in_flight = None;
        }
    }

    /// Drains finished artwork downloads, caching and emitting the ones that
    /// still belong to the current track.
    fn collect_artwork(&mut self, app: &AppHandle) {
        let Some(rx) = self.artwork_rx.take() else {
            return;
        };
        let mut disconnected = false;

        loop {
            match rx.try_recv() {
                Ok((key, fetched)) => {
                    if self.artwork_in_flight.as_ref() != Some(&key) {
                        continue;
                    }
                    self.artwork_in_flight = None;

                    let Some(full_snapshot) = fetched else {
                        continue;
                    };
                    if TrackCacheKey::from_snapshot(&full_snapshot) != key {
                        continue;
                    }

                    self.cached_media = Some(CachedMedia::from_snapshot(&full_snapshot));
                    self.last_emitted_key = Some(full_snapshot.semantic_key());
                    self.last_emit_at = Some(Instant::now());
                    if let Some(authority) = app.try_state::<PlaybackAuthority>() {
                        authority.update(Some(full_snapshot.clone()));
                    }
                    emit_media_snapshot(app, &full_snapshot);
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    disconnected = true;
                    break;
                }
            }
        }

        if !disconnected {
            self.artwork_rx = Some(rx);
        }
    }

    fn observe_playing_source(&mut self, snapshot: Option<&MediaSnapshot>) {
        if let Some(snapshot) =
            snapshot.filter(|snapshot| snapshot.is_playing && !snapshot.source_id.is_empty())
        {
            self.last_playing_source_id = Some(snapshot.source_id.clone());
        }
    }

    fn session_ended_snapshot(&mut self) -> Option<MediaSnapshot> {
        self.cached_media = None;
        self.last_emitted_key = None;
        self.last_emit_at = None;
        self.artwork_in_flight = None;

        if self.had_session {
            self.had_session = false;
            return Some(MediaSnapshot::default());
        }

        None
    }

    fn position_resync_due(&self, now: Instant) -> bool {
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
        ErrorRateLimiter, MediaEmission, MediaPosition, MediaSnapshot, SmtcPoller, TrackCacheKey,
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

        assert_eq!(
            poller.handle_polled_snapshot(Some(snapshot.clone()), now),
            Some(MediaEmission::Snapshot(snapshot.clone()))
        );

        let mut drifted = snapshot.clone();
        drifted.position = 1.5;
        assert_eq!(
            poller.handle_polled_snapshot(Some(drifted.clone()), now + Duration::from_millis(500)),
            None
        );
        assert_eq!(
            poller.handle_polled_snapshot(Some(drifted.clone()), now + position_resync_interval()),
            Some(MediaEmission::Position(MediaPosition { position: 1.5 }))
        );

        let mut paused = drifted;
        paused.is_playing = false;
        assert_eq!(
            poller.handle_polled_snapshot(
                Some(paused.clone()),
                now + position_resync_interval() + Duration::from_millis(100),
            ),
            Some(MediaEmission::Snapshot(paused))
        );
    }

    #[test]
    fn artwork_change_on_same_track_sends_full_snapshot() {
        let mut poller = SmtcPoller::default();
        let now = std::time::Instant::now();
        let first = MediaSnapshot {
            track: "Track".to_string(),
            source_id: "spotify".to_string(),
            duration: 180.0,
            artwork_data_url: Some("data:image/png;base64,AAAA".to_string()),
            ..MediaSnapshot::default()
        };
        let swapped = MediaSnapshot {
            artwork_data_url: Some("data:image/png;base64,BBBB".to_string()),
            ..first.clone()
        };

        assert!(matches!(
            poller.handle_polled_snapshot(Some(first), now),
            Some(MediaEmission::Snapshot(_))
        ));
        assert_eq!(
            poller.handle_polled_snapshot(Some(swapped.clone()), now + Duration::from_millis(500)),
            Some(MediaEmission::Snapshot(swapped))
        );
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
            last_playing_source_id: None,
            listens: Default::default(),
            ..Default::default()
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
            Some(MediaEmission::Snapshot(playing.clone()))
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
            Some(MediaEmission::Position(MediaPosition { position: 10.5 }))
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
            Some(MediaEmission::Snapshot(track_changed))
        );

        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(3)),
            Some(MediaEmission::Snapshot(MediaSnapshot::default()))
        );
        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(4)),
            None
        );
    }

    #[test]
    fn remembers_last_playing_source_only_while_playing() {
        let mut poller = SmtcPoller::default();
        let playing = MediaSnapshot {
            source_id: "spotify".to_string(),
            is_playing: true,
            ..MediaSnapshot::default()
        };
        let paused = MediaSnapshot {
            source_id: "chrome".to_string(),
            is_playing: false,
            ..MediaSnapshot::default()
        };

        poller.observe_playing_source(Some(&paused));
        assert_eq!(poller.last_playing_source_id, None);

        poller.observe_playing_source(Some(&playing));
        assert_eq!(poller.last_playing_source_id.as_deref(), Some("spotify"));

        poller.observe_playing_source(Some(&paused));
        assert_eq!(poller.last_playing_source_id.as_deref(), Some("spotify"));

        poller.observe_playing_source(None);
        assert_eq!(poller.last_playing_source_id.as_deref(), Some("spotify"));
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
            Some(MediaEmission::Snapshot(spotify.clone()))
        );

        assert_eq!(
            poller.handle_polled_snapshot(None, now + Duration::from_secs(2)),
            Some(MediaEmission::Snapshot(MediaSnapshot::default()))
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
            Some(MediaEmission::Snapshot(restarted))
        );
        assert_eq!(
            poller.handle_polled_snapshot(Some(chrome.clone()), now + Duration::from_secs(5)),
            Some(MediaEmission::Snapshot(chrome))
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
            Some(MediaEmission::Snapshot(
                empty_metadata_missing_artwork.clone()
            ))
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
        let Some(MediaEmission::Position(resynced)) = resynced else {
            panic!("unknown timeline values should still resync position");
        };
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
