// Sleep timer / "end of side".
//
// The timer is an ephemeral backend authority: it lives in Rust so it keeps
// counting while the Main window is hidden behind Mini (or hidden to the tray)
// and is not persisted across launches. One generation counter guards every
// scheduled task, so a cancel or restart can never let an older task fire.
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::media::{authority::PlaybackAuthority, model::MediaSnapshot, platform, poller};

pub const SLEEP_TIMER_CHANGED_EVENT: &str = "sleep-timer-changed";
pub const SLEEP_TIMER_FIRED_EVENT: &str = "sleep-timer-fired";

pub const MODE_MINUTES: &str = "minutes";
pub const MODE_END_OF_TRACK: &str = "endOfTrack";

pub const MIN_MINUTES: u32 = 5;
pub const MAX_MINUTES: u32 = 240;
const END_OF_TRACK_POLL: Duration = Duration::from_millis(500);

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SleepTimerSnapshot {
    /// `"minutes"` or `"endOfTrack"`.
    pub mode: String,
    /// Unix milliseconds for minute timers; `null` for end-of-track.
    pub ends_at: Option<u64>,
    /// Track title captured at start; `null` for minute timers.
    pub track: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SleepTimerFired {
    pub mode: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct TrackKey {
    track: String,
    artist: String,
    album: String,
}

impl TrackKey {
    fn from_snapshot(snapshot: &MediaSnapshot) -> Self {
        Self {
            track: snapshot.track.clone(),
            artist: snapshot.artist.clone(),
            album: snapshot.album.clone(),
        }
    }
}

struct ActiveTimer {
    generation: u64,
    snapshot: SleepTimerSnapshot,
}

pub struct SleepTimerState {
    generation: AtomicU64,
    active: Mutex<Option<ActiveTimer>>,
}

impl SleepTimerState {
    pub fn new() -> Self {
        Self {
            generation: AtomicU64::new(0),
            active: Mutex::new(None),
        }
    }

    fn begin(&self, snapshot: SleepTimerSnapshot) -> u64 {
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        *self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(ActiveTimer {
            generation,
            snapshot,
        });
        generation
    }

    fn snapshot(&self) -> Option<SleepTimerSnapshot> {
        self.active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
            .map(|timer| timer.snapshot.clone())
    }

    fn active_generation(&self) -> Option<u64> {
        self.active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()
            .map(|timer| timer.generation)
    }

    /// Cancels any timer, invalidating its scheduled task. Safe to call twice.
    fn cancel(&self) -> Option<SleepTimerSnapshot> {
        self.generation.fetch_add(1, Ordering::SeqCst);
        self.active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take()
            .map(|timer| timer.snapshot)
    }

    /// Takes the timer only when `generation` is still the active one.
    fn take_for_fire(&self, generation: u64) -> Option<SleepTimerSnapshot> {
        let mut active = self
            .active
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if active
            .as_ref()
            .is_some_and(|timer| timer.generation == generation)
        {
            active.take().map(|timer| timer.snapshot)
        } else {
            None
        }
    }
}

impl Default for SleepTimerState {
    fn default() -> Self {
        Self::new()
    }
}

/// Validates a start request and returns the delay for minute timers.
fn validate_start(mode: &str, minutes: Option<u32>) -> Result<Option<u64>, String> {
    match mode {
        MODE_MINUTES => {
            let minutes = minutes.ok_or_else(|| {
                "Sleep timer minutes are required for a minutes timer".to_string()
            })?;
            if !(MIN_MINUTES..=MAX_MINUTES).contains(&minutes) {
                return Err(format!(
                    "Sleep timer minutes must be between {MIN_MINUTES} and {MAX_MINUTES}"
                ));
            }
            Ok(Some(u64::from(minutes) * 60_000))
        }
        MODE_END_OF_TRACK => Ok(None),
        other => Err(format!(
            "Unknown sleep timer mode: {other}. Use \"minutes\" or \"endOfTrack\""
        )),
    }
}

/// End-of-track decision, independent of timers and Tauri so it can be tested.
///
/// Fires when the semantic key changes, the session disappears, or a playing
/// snapshot stops. A session that was already paused at start does not fire
/// until something actually changes.
fn end_of_track_should_fire(
    baseline: &TrackKey,
    baseline_was_playing: bool,
    snapshot: Option<&MediaSnapshot>,
) -> bool {
    let Some(snapshot) = snapshot else {
        return true;
    };
    if TrackKey::from_snapshot(snapshot) != *baseline {
        return true;
    }
    baseline_was_playing && !snapshot.is_playing
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn emit_changed(app: &AppHandle, snapshot: Option<&SleepTimerSnapshot>) {
    if let Err(error) = app.emit(SLEEP_TIMER_CHANGED_EVENT, snapshot) {
        eprintln!("[VinylDeck sleep] failed to emit timer state: {error}");
    }
}

fn emit_fired(app: &AppHandle, mode: &str) {
    if let Err(error) = app.emit(
        SLEEP_TIMER_FIRED_EVENT,
        SleepTimerFired {
            mode: mode.to_string(),
        },
    ) {
        eprintln!("[VinylDeck sleep] failed to emit timer fired: {error}");
    }
}

/// Resolves the same source transport commands use, pauses it, and clears the
/// timer. The generation check happens before the platform call so a stale
/// task can never pause playback after a cancel/restart.
async fn fire(app: AppHandle, generation: u64) {
    let snapshot = {
        let state = app.state::<SleepTimerState>();
        state.take_for_fire(generation)
    };
    let Some(snapshot) = snapshot else {
        return;
    };

    let source_id = {
        let authority = app.state::<PlaybackAuthority>();
        authority.selected_source_id()
    };
    if let Err(error) = platform::pause(source_id.as_deref()).await {
        eprintln!("[VinylDeck sleep] pause failed: {error}");
    }
    poller::wake_poller();

    emit_changed(&app, None);
    emit_fired(&app, &snapshot.mode);
}

#[tauri::command]
pub fn cmd_sleep_timer_start(
    app: AppHandle,
    state: State<'_, SleepTimerState>,
    authority: State<'_, PlaybackAuthority>,
    mode: String,
    minutes: Option<u32>,
) -> Result<SleepTimerSnapshot, String> {
    let delay_ms = validate_start(&mode, minutes)?;
    let current = authority.snapshot();

    let (track, track_key, was_playing) = match mode.as_str() {
        MODE_END_OF_TRACK => {
            let Some(current) = current.as_ref() else {
                return Err("Nothing is playing".to_string());
            };
            let track = Some(current.track.clone()).filter(|track| !track.is_empty());
            (
                track,
                Some(TrackKey::from_snapshot(current)),
                current.is_playing,
            )
        }
        _ => (None, None, false),
    };

    let ends_at = delay_ms.map(|delay| now_unix_ms().saturating_add(delay));
    let snapshot = SleepTimerSnapshot {
        mode: mode.clone(),
        ends_at,
        track,
    };
    let generation = state.begin(snapshot.clone());
    emit_changed(&app, Some(&snapshot));

    if let Some(delay_ms) = delay_ms {
        let timer_app = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            fire(timer_app, generation).await;
        });
    } else {
        let Some(baseline) = track_key else {
            // `validate_start`/the branch above guarantee this, but never
            // panic on a malformed start.
            return Err("Nothing is playing".to_string());
        };
        let timer_app = app.clone();
        let mut receiver = authority.subscribe();
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(END_OF_TRACK_POLL).await;

                let still_active = {
                    let state = timer_app.state::<SleepTimerState>();
                    state.active_generation() == Some(generation)
                };
                if !still_active {
                    return;
                }

                let current = receiver.borrow_and_update().clone();
                if end_of_track_should_fire(&baseline, was_playing, current.as_ref()) {
                    fire(timer_app.clone(), generation).await;
                    return;
                }
            }
        });
    }

    Ok(snapshot)
}

#[tauri::command]
pub fn cmd_sleep_timer_cancel(
    app: AppHandle,
    state: State<'_, SleepTimerState>,
) -> Option<SleepTimerSnapshot> {
    state.cancel();
    emit_changed(&app, None);
    None
}

#[tauri::command]
pub fn cmd_sleep_timer_snapshot(state: State<'_, SleepTimerState>) -> Option<SleepTimerSnapshot> {
    state.snapshot()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(track: &str, playing: bool) -> MediaSnapshot {
        MediaSnapshot {
            track: track.to_string(),
            artist: "Artist".to_string(),
            album: "Album".to_string(),
            is_playing: playing,
            ..MediaSnapshot::default()
        }
    }

    fn timer(mode: &str, ends_at: Option<u64>, track: Option<&str>) -> SleepTimerSnapshot {
        SleepTimerSnapshot {
            mode: mode.to_string(),
            ends_at,
            track: track.map(str::to_string),
        }
    }

    #[test]
    fn minutes_validation_accepts_the_documented_range() {
        assert_eq!(validate_start(MODE_MINUTES, Some(5)), Ok(Some(300_000)));
        assert_eq!(
            validate_start(MODE_MINUTES, Some(240)),
            Ok(Some(14_400_000))
        );
        assert_eq!(validate_start(MODE_END_OF_TRACK, None), Ok(None));
        assert_eq!(validate_start(MODE_END_OF_TRACK, Some(30)), Ok(None));
    }

    #[test]
    fn minutes_validation_rejects_out_of_range_and_missing_values() {
        assert!(validate_start(MODE_MINUTES, Some(4)).is_err());
        assert!(validate_start(MODE_MINUTES, Some(241)).is_err());
        assert!(validate_start(MODE_MINUTES, None).is_err());
        assert!(validate_start("sideways", Some(30)).is_err());
    }

    #[test]
    fn start_and_snapshot_keep_the_active_timer() {
        let state = SleepTimerState::new();
        assert_eq!(state.snapshot(), None);

        let generation = state.begin(timer(MODE_MINUTES, Some(1_700_000_000_000), None));
        assert_eq!(state.active_generation(), Some(generation));
        assert_eq!(
            state.snapshot(),
            Some(timer(MODE_MINUTES, Some(1_700_000_000_000), None))
        );
    }

    #[test]
    fn cancel_is_idempotent_and_invalidates_the_generation() {
        let state = SleepTimerState::new();
        let generation = state.begin(timer(MODE_END_OF_TRACK, None, Some("A")));

        assert_eq!(
            state.cancel(),
            Some(timer(MODE_END_OF_TRACK, None, Some("A")))
        );
        assert_eq!(state.cancel(), None);
        assert_eq!(state.snapshot(), None);
        assert_eq!(state.take_for_fire(generation), None);
    }

    #[test]
    fn restart_invalidates_the_previous_task() {
        let state = SleepTimerState::new();
        let first = state.begin(timer(MODE_MINUTES, Some(1), None));
        let second = state.begin(timer(MODE_MINUTES, Some(2), None));

        assert_ne!(first, second);
        assert_eq!(state.take_for_fire(first), None);
        assert_eq!(
            state.take_for_fire(second),
            Some(timer(MODE_MINUTES, Some(2), None))
        );
        assert_eq!(state.snapshot(), None);
    }

    #[test]
    fn end_of_track_ignores_the_baseline_snapshot() {
        let baseline = TrackKey::from_snapshot(&snapshot("A", true));
        assert!(!end_of_track_should_fire(
            &baseline,
            true,
            Some(&snapshot("A", true))
        ));
    }

    #[test]
    fn end_of_track_fires_on_track_change() {
        let baseline = TrackKey::from_snapshot(&snapshot("A", true));
        assert!(end_of_track_should_fire(
            &baseline,
            true,
            Some(&snapshot("B", true))
        ));
    }

    #[test]
    fn end_of_track_fires_when_the_session_disappears() {
        let baseline = TrackKey::from_snapshot(&snapshot("A", true));
        assert!(end_of_track_should_fire(&baseline, true, None));
    }

    #[test]
    fn end_of_track_fires_when_playback_pauses() {
        let baseline = TrackKey::from_snapshot(&snapshot("A", true));
        assert!(end_of_track_should_fire(
            &baseline,
            true,
            Some(&snapshot("A", false))
        ));
    }

    #[test]
    fn end_of_track_started_paused_waits_for_a_change() {
        let baseline = TrackKey::from_snapshot(&snapshot("A", false));
        assert!(!end_of_track_should_fire(
            &baseline,
            false,
            Some(&snapshot("A", false))
        ));
        assert!(!end_of_track_should_fire(
            &baseline,
            false,
            Some(&snapshot("A", true))
        ));
        assert!(end_of_track_should_fire(
            &baseline,
            false,
            Some(&snapshot("B", false))
        ));
    }

    #[test]
    fn snapshot_serializes_with_camel_case_and_null_fields() {
        let value = serde_json::to_value(timer(MODE_END_OF_TRACK, None, Some("A")))
            .expect("snapshot serializes");
        assert_eq!(
            value,
            serde_json::json!({
                "mode": "endOfTrack",
                "endsAt": null,
                "track": "A",
            })
        );
    }
}
